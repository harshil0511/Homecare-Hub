"""Emergency SOS endpoints — User SOS creation + Servicer response."""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.internal import models, schemas, deps
from app.websockets.emergency import emergency_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Emergency SOS"])

user_or_secretary = deps.RoleChecker(["USER", "SECRETARY"])
servicer_only = deps.RoleChecker(["SERVICER"])

EMERGENCY_WINDOW_MINUTES = 5


def _notify(db: Session, user_id: int, title: str, message: str,
            notification_type: str = "INFO", link: Optional[str] = None) -> None:
    """Stage a Notification row. Caller is responsible for committing."""
    db.add(models.Notification(
        user_id=user_id, title=title, message=message,
        notification_type=notification_type, link=link,
    ))


# ── User SOS Routes ────────────────────────────────────────────────────────────

@router.get("/config", response_model=List[schemas.EmergencyConfigRead])
def get_emergency_configs(
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(deps.get_current_user),
):
    """All category price configs — readable by any authenticated user."""
    return db.query(models.EmergencyConfig).order_by(models.EmergencyConfig.category).all()


@router.get("/providers", response_model=List[schemas.ProviderResponse])
def get_available_providers(
    category: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(user_or_secretary),
):
    """List verified + available providers for manual selection."""
    query = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.is_verified == True,
        models.ServiceProvider.availability_status == "AVAILABLE",
    )
    if category:
        query = query.filter(
            (models.ServiceProvider.category == category) |
            (models.ServiceProvider.categories.like(f"%{category}%"))
        )
    return query.order_by(models.ServiceProvider.rating.desc()).all()


@router.post("/", response_model=schemas.EmergencyRequestRead)
async def create_emergency_request(
    request_in: schemas.EmergencyRequestCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    """Submit an SOS. Validates providers, creates emergency_request, broadcasts via WebSocket."""
    # Enforce one active emergency per user
    active = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.user_id == current_user.id,
        models.EmergencyRequest.status.in_(["PENDING", "ACTIVE"]),
    ).first()
    if active:
        raise HTTPException(
            status_code=409,
            detail="You already have an active emergency request. Cancel it before creating a new one."
        )

    # Validate providers exist and are available
    providers = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id.in_(request_in.provider_ids),
        models.ServiceProvider.is_verified == True,
        models.ServiceProvider.availability_status == "AVAILABLE",
    ).all()
    found_ids = {p.id for p in providers}
    missing = set(request_in.provider_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Provider IDs not found or unavailable: {list(missing)}"
        )

    # Look up config for the category
    config = db.query(models.EmergencyConfig).filter(
        models.EmergencyConfig.category == request_in.category
    ).first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    emergency = models.EmergencyRequest(
        user_id=current_user.id,
        society_name=request_in.society_name,
        building_name=request_in.building_name,
        flat_no=request_in.flat_no,
        landmark=request_in.landmark,
        full_address=request_in.full_address,
        category=request_in.category,
        description=request_in.description,
        device_name=request_in.device_name,
        photos=json.dumps(request_in.photos) if request_in.photos else None,
        contact_name=request_in.contact_name,
        contact_phone=request_in.contact_phone,
        status="PENDING",
        config_id=config.id if config else None,
        expires_at=now + timedelta(minutes=EMERGENCY_WINDOW_MINUTES),
    )
    db.add(emergency)
    db.commit()
    db.refresh(emergency)

    # Notify selected providers via notification + WebSocket
    alert_payload = {
        "event": "emergency_alert",
        "request_id": emergency.id,
        "category": emergency.category,
        "description": emergency.description,
        "society_name": emergency.society_name,
        "building_name": emergency.building_name,
        "flat_no": emergency.flat_no,
        "landmark": emergency.landmark,
        "full_address": emergency.full_address,
        "contact_name": emergency.contact_name,
        "contact_phone": emergency.contact_phone,
        "expires_at": emergency.expires_at.isoformat(),
        "callout_fee": config.callout_fee if config else None,
        "hourly_rate": config.hourly_rate if config else None,
    }

    for provider in providers:
        if provider.user_id:
            _notify(
                db, provider.user_id,
                title="Emergency SOS Alert",
                message=f"Emergency {request_in.category} at {request_in.building_name}, {request_in.flat_no}. Respond within 5 minutes.",
                notification_type="URGENT",
                link="/service/jobs?tab=emergency",
            )

    background_tasks.add_task(
        emergency_manager.broadcast_alert_to_servicers,
        [p.id for p in providers],
        alert_payload,
    )

    db.commit()
    db.refresh(emergency)
    return emergency


@router.get("/incoming-servicer", response_model=List[schemas.IncomingEmergencyRead])
def list_incoming_emergencies(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    """List open emergency requests visible to this servicer (all PENDING, not expired).

    Note: the model does not persist a recipient join table, so all open emergencies
    are shown. The has_responded flag tells the servicer if they have already acted.
    """
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    emergencies = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.status == "PENDING",
        models.EmergencyRequest.expires_at > now,
    ).all()

    result = []
    for em in emergencies:
        existing_response = db.query(models.EmergencyResponse).filter(
            models.EmergencyResponse.request_id == em.id,
            models.EmergencyResponse.provider_id == provider.id,
        ).first()

        config = em.config
        incoming = schemas.IncomingEmergencyRead(
            id=em.id,
            society_name=em.society_name,
            building_name=em.building_name,
            flat_no=em.flat_no,
            landmark=em.landmark,
            full_address=em.full_address,
            category=em.category,
            description=em.description,
            device_name=em.device_name,
            photos=em.photos,
            contact_name=em.contact_name,
            contact_phone=em.contact_phone,
            expires_at=em.expires_at,
            created_at=em.created_at,
            callout_fee=config.callout_fee if config else None,
            hourly_rate=config.hourly_rate if config else None,
            has_responded=existing_response is not None,
        )
        result.append(incoming)

    return result


@router.get("/{request_id}", response_model=schemas.EmergencyRequestRead)
def get_emergency_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Get a single emergency request with all responses so far."""
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if current_user.role not in ("ADMIN", "SECRETARY") and em.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return em


@router.post("/{request_id}/accept/{response_id}", response_model=schemas.BookingRead)
async def accept_emergency_response(
    request_id: UUID,
    response_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    """User accepts a servicer response → creates ServiceBooking, closes emergency."""
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id,
        models.EmergencyRequest.user_id == current_user.id,
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if em.status not in ("PENDING", "ACTIVE"):
        raise HTTPException(status_code=400, detail="Emergency request is no longer active")

    resp = db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.id == response_id,
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.status == "PENDING",
    ).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found or already processed")

    # Create ServiceBooking
    config = em.config
    estimated_cost = config.callout_fee if config else 0.0

    booking = models.ServiceBooking(
        user_id=current_user.id,
        provider_id=resp.provider_id,
        service_type=em.category,
        scheduled_at=resp.arrival_time,
        priority="Emergency",
        issue_description=em.description,
        property_details=f"{em.society_name}, {em.building_name}, {em.flat_no}",
        estimated_cost=estimated_cost,
    )
    db.add(booking)
    db.flush()  # get booking.id

    db.add(models.BookingStatusHistory(
        booking_id=booking.id,
        status="Pending",
        notes="Emergency SOS booking created",
    ))

    em.resulting_booking_id = booking.id
    em.status = "BOOKED"
    resp.status = "ACCEPTED"

    db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.id != response_id,
        models.EmergencyResponse.status == "PENDING",
    ).update({"status": "REJECTED"})

    # Notify user and accepted provider, then commit once
    _notify(db, current_user.id, "Booking Confirmed",
            f"Emergency {em.category} booking confirmed with your servicer.",
            notification_type="INFO", link=f"/user/bookings/{booking.id}")

    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == resp.provider_id
    ).first()
    if provider and provider.user_id:
        _notify(db, provider.user_id, "Emergency Job Accepted",
                f"You have been selected for emergency {em.category}. Proceed to the location.",
                notification_type="URGENT", link="/service/jobs")

    try:
        db.commit()
    except Exception:
        logger.exception("Failed to commit notifications after emergency accept (booking %s)", booking.id)

    db.refresh(booking)

    await emergency_manager.send_to_user(request_id, {
        "event": "request_accepted",
        "booking_id": booking.id,
        "provider_id": resp.provider_id,
    })

    return booking


@router.post("/{request_id}/cancel")
async def cancel_emergency_request(
    request_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    """User cancels the emergency before accepting any response."""
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id,
        models.EmergencyRequest.user_id == current_user.id,
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if em.status not in ("PENDING", "ACTIVE"):
        raise HTTPException(status_code=400, detail="Only PENDING or ACTIVE requests can be cancelled")

    em.status = "CANCELLED"

    cancelled_responses = db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.status == "PENDING",
    ).all()

    cancelled_provider_ids = [r.provider_id for r in cancelled_responses]

    db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.status == "PENDING",
    ).update({"status": "CANCELLED"})

    # Notify providers who had responded
    for r in cancelled_responses:
        provider = db.query(models.ServiceProvider).filter(
            models.ServiceProvider.id == r.provider_id
        ).first()
        if provider and provider.user_id:
            _notify(db, provider.user_id, "Emergency Cancelled",
                    "The emergency request you responded to has been cancelled by the user.",
                    notification_type="INFO", link="/service/jobs?tab=emergency")

    db.commit()

    background_tasks.add_task(
        emergency_manager.broadcast_alert_to_servicers,
        cancelled_provider_ids,
        {"event": "request_cancelled", "request_id": request_id},
    )
    await emergency_manager.send_to_user(request_id, {"event": "request_cancelled"})
    return {"detail": "Emergency request cancelled"}


# ── Servicer Routes ────────────────────────────────────────────────────────────

servicer_router = APIRouter(tags=["Emergency SOS — Servicer"])


@servicer_router.post("/{request_id}/respond", response_model=schemas.EmergencyResponseRead)
async def respond_to_emergency(
    request_id: UUID,
    response_in: schemas.EmergencyResponseCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    """Servicer accepts an emergency with a committed arrival time."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id,
        models.EmergencyRequest.status == "PENDING",
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found or no longer accepting responses")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if now > em.expires_at:
        em.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=410, detail="Emergency request has expired")

    existing = db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.provider_id == provider.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already responded to this emergency")

    response = models.EmergencyResponse(
        request_id=request_id,
        provider_id=provider.id,
        arrival_time=response_in.arrival_time,
        status="PENDING",
    )
    db.add(response)
    db.commit()
    db.refresh(response)

    config = em.config

    await emergency_manager.send_to_user(request_id, {
        "event": "new_response",
        "response_id": response.id,
        "provider_id": provider.id,
        "provider_name": provider.first_name or provider.company_name or provider.owner_name,
        "rating": provider.rating,
        "arrival_time": response_in.arrival_time.isoformat(),
        "callout_fee": config.callout_fee if config else None,
        "hourly_rate": config.hourly_rate if config else None,
        "created_at": response.created_at.isoformat() if response.created_at else None,
    })

    return response


@servicer_router.post("/{request_id}/ignore")
def ignore_emergency(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    """Servicer explicitly ignores an emergency — no penalty, records dismissal."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    existing = db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.provider_id == provider.id,
    ).first()
    if not existing:
        # Use a far-future sentinel — arrival_time is not meaningful for IGNORED records
        far_future = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3650)
        db.add(models.EmergencyResponse(
            request_id=request_id,
            provider_id=provider.id,
            arrival_time=far_future,
            status="IGNORED",
        ))
        db.commit()
    return {"detail": "Emergency request ignored"}

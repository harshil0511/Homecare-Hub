"""Emergency SOS endpoints — User SOS creation + Servicer response."""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.emergency.domain.model import (
    EmergencyConfig, EmergencyRequest, EmergencyResponse,
)
from app.notification.domain.model import Notification
from app.websockets.emergency import emergency_manager
from app.api.emergency.schemas import (
    EmergencyConfigRead,
    EmergencyRequestCreate, EmergencyRequestRead,
    EmergencyResponseCreate, EmergencyResponseRead,
    IncomingEmergencyRead,
)
from app.api.service.schemas import ProviderResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Emergency SOS"])

user_or_secretary = deps.RoleChecker(["USER", "SECRETARY"])
servicer_only = deps.RoleChecker(["SERVICER"])

EMERGENCY_WINDOW_MINUTES = 30


def _notify(db: Session, user_id: UUID, title: str, message: str,
            notification_type: str = "INFO", link: Optional[str] = None) -> None:
    """Stage a Notification row. Caller is responsible for committing."""
    db.add(Notification(
        user_id=user_id, title=title, message=message,
        notification_type=notification_type, link=link,
    ))


# ── User SOS Routes ────────────────────────────────────────────────────────────

@router.get("/config", response_model=List[EmergencyConfigRead])
def get_emergency_configs(
    db: Session = Depends(deps.get_db),
    _: User = Depends(deps.get_current_user),
):
    """All category price configs — readable by any authenticated user."""
    return db.query(EmergencyConfig).order_by(EmergencyConfig.category).all()


@router.get("/me/active", response_model=EmergencyRequestRead)
def get_active_emergency(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    """Get the current user's active (PENDING/ACTIVE) emergency request, if any."""
    em = db.query(EmergencyRequest).filter(
        EmergencyRequest.user_id == current_user.id,
        EmergencyRequest.status.in_(["PENDING", "ACTIVE"]),
    ).order_by(EmergencyRequest.created_at.desc()).first()
    if not em:
        raise HTTPException(status_code=404, detail="No active emergency request")
    return em


@router.get("/providers", response_model=List[ProviderResponse])
def get_available_providers(
    db: Session = Depends(deps.get_db),
    _: User = Depends(user_or_secretary),
):
    """All AVAILABLE providers for emergency SOS — no category filter, sorted by rating."""
    return (
        db.query(ServiceProvider)
        .filter(ServiceProvider.availability_status == "AVAILABLE")
        .order_by(ServiceProvider.rating.desc())
        .all()
    )


@router.post("/", response_model=EmergencyRequestRead)
async def create_emergency_request(
    request_in: EmergencyRequestCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    """Submit an SOS. Validates providers, creates emergency_request, broadcasts via WebSocket."""
    # Enforce one active emergency per user
    active = db.query(EmergencyRequest).filter(
        EmergencyRequest.user_id == current_user.id,
        EmergencyRequest.status.in_(["PENDING", "ACTIVE"]),
    ).first()
    if active:
        raise HTTPException(
            status_code=409,
            detail="You already have an active emergency request. Cancel it before creating a new one."
        )

    # Find providers to broadcast to: specific list if provided, otherwise all available for the category
    if request_in.provider_ids:
        providers = db.query(ServiceProvider).filter(
            ServiceProvider.id.in_(request_in.provider_ids),
            ServiceProvider.availability_status == "AVAILABLE",
        ).all()
    else:
        query = db.query(ServiceProvider).filter(
            ServiceProvider.availability_status == "AVAILABLE",
        )
        if request_in.category:
            query = query.filter(
                (ServiceProvider.category == request_in.category) |
                (ServiceProvider.categories.like(f"%{request_in.category}%"))
            )
        providers = query.all()

    # Look up config for the category
    config = db.query(EmergencyConfig).filter(
        EmergencyConfig.category == request_in.category
    ).first()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    emergency = EmergencyRequest(
        user_id=current_user.id,
        society_name=request_in.society_name,
        building_name=request_in.building_name,
        flat_no=request_in.flat_no,
        landmark=request_in.landmark,
        full_address=request_in.full_address,
        category=request_in.category,
        description=request_in.description or "",
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
        "request_id": str(emergency.id),
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


@router.get("/incoming-servicer", response_model=List[IncomingEmergencyRead])
def list_incoming_emergencies(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    """List open emergency requests visible to this servicer (all PENDING, not expired).

    Note: the model does not persist a recipient join table, so all open emergencies
    are shown. The has_responded flag tells the servicer if they have already acted.
    """
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    emergencies = db.query(EmergencyRequest).filter(
        EmergencyRequest.status == "PENDING",
        EmergencyRequest.expires_at > now,
    ).all()

    result = []
    for em in emergencies:
        existing_response = db.query(EmergencyResponse).filter(
            EmergencyResponse.request_id == em.id,
            EmergencyResponse.provider_id == provider.id,
        ).first()

        config = em.config
        incoming = IncomingEmergencyRead(
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


@router.get("/{request_id}", response_model=EmergencyRequestRead)
def get_emergency_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get a single emergency request with all responses so far."""
    em = db.query(EmergencyRequest).filter(
        EmergencyRequest.id == request_id
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if current_user.role not in ("ADMIN", "SECRETARY") and em.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return em


@router.post("/{request_id}/accept/{response_id}")
async def accept_emergency_response(
    request_id: UUID,
    response_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    """User accepts a servicer response → creates ServiceBooking, closes emergency."""
    from app.booking.domain.model import ServiceBooking, BookingStatusHistory

    em = db.query(EmergencyRequest).filter(
        EmergencyRequest.id == request_id,
        EmergencyRequest.user_id == current_user.id,
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if em.status not in ("PENDING", "ACTIVE"):
        raise HTTPException(status_code=400, detail="Emergency request is no longer active")

    resp = db.query(EmergencyResponse).filter(
        EmergencyResponse.id == response_id,
        EmergencyResponse.request_id == request_id,
        EmergencyResponse.status == "PENDING",
    ).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found or already processed")

    # Read all values we need from ORM objects NOW, before commit expires them
    em_category = em.category
    em_society = em.society_name
    em_building = em.building_name
    em_flat = em.flat_no
    em_description = em.description
    resp_provider_id = resp.provider_id
    resp_arrival_time = resp.arrival_time

    booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=resp_provider_id,
        service_type=em_category,
        scheduled_at=resp_arrival_time,
        priority="Emergency",
        issue_description=em_description,
        property_details=f"{em_society}, {em_building}, {em_flat}",
        estimated_cost=0.0,
        status="Accepted",
        source_type="emergency",
        source_id=request_id,
    )
    db.add(booking)
    db.flush()  # get booking.id

    booking_id = booking.id  # capture before commit expires it

    db.add(BookingStatusHistory(
        booking_id=booking_id,
        status="Accepted",
        notes="Emergency SOS booking — servicer committed arrival time, auto-accepted",
    ))

    em.resulting_booking_id = booking_id
    em.status = "BOOKED"
    resp.status = "ACCEPTED"

    db.query(EmergencyResponse).filter(
        EmergencyResponse.request_id == request_id,
        EmergencyResponse.id != response_id,
        EmergencyResponse.status == "PENDING",
    ).update({"status": "REJECTED"})

    _notify(db, current_user.id, "Booking Confirmed",
            f"Emergency {em_category} booking confirmed with your servicer.",
            notification_type="INFO", link=f"/user/bookings/{booking_id}")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == resp_provider_id
    ).first()
    if provider and provider.user_id:
        _notify(db, provider.user_id, "Emergency Job Accepted",
                f"You have been selected for emergency {em_category}. Proceed to the location.",
                notification_type="URGENT", link="/service/jobs")

    db.commit()

    # WebSocket sends are best-effort — must not crash the HTTP response
    request_id_str = str(request_id)
    booking_id_str = str(booking_id)
    provider_id_str = str(resp_provider_id)

    try:
        await emergency_manager.send_to_user(request_id_str, {
            "event": "request_accepted",
            "booking_id": booking_id_str,
            "provider_id": provider_id_str,
        })
    except Exception:
        logger.warning("WS notify user failed for emergency accept %s", request_id_str)

    try:
        await emergency_manager.send_to_servicer(provider_id_str, {
            "event": "response_accepted",
            "booking_id": booking_id_str,
            "category": em_category,
        })
    except Exception:
        logger.warning("WS notify servicer failed for emergency accept %s", request_id_str)

    return {"id": booking_id_str, "status": "Accepted"}


@router.post("/{request_id}/cancel")
async def cancel_emergency_request(
    request_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    """User cancels the emergency before accepting any response."""
    em = db.query(EmergencyRequest).filter(
        EmergencyRequest.id == request_id,
        EmergencyRequest.user_id == current_user.id,
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if em.status not in ("PENDING", "ACTIVE"):
        raise HTTPException(status_code=400, detail="Only PENDING or ACTIVE requests can be cancelled")

    em.status = "CANCELLED"

    cancelled_responses = db.query(EmergencyResponse).filter(
        EmergencyResponse.request_id == request_id,
        EmergencyResponse.status == "PENDING",
    ).all()

    cancelled_provider_ids = [r.provider_id for r in cancelled_responses]

    db.query(EmergencyResponse).filter(
        EmergencyResponse.request_id == request_id,
        EmergencyResponse.status == "PENDING",
    ).update({"status": "CANCELLED"})

    # Notify providers who had responded
    for r in cancelled_responses:
        provider = db.query(ServiceProvider).filter(
            ServiceProvider.id == r.provider_id
        ).first()
        if provider and provider.user_id:
            _notify(db, provider.user_id, "Emergency Cancelled",
                    "The emergency request you responded to has been cancelled by the user.",
                    notification_type="INFO", link="/service/jobs?tab=emergency")

    db.commit()

    background_tasks.add_task(
        emergency_manager.broadcast_alert_to_servicers,
        [str(pid) for pid in cancelled_provider_ids],
        {"event": "request_cancelled", "request_id": str(request_id)},
    )
    await emergency_manager.send_to_user(str(request_id), {"event": "request_cancelled"})
    return {"detail": "Emergency request cancelled"}


# ── Servicer Routes ────────────────────────────────────────────────────────────

servicer_router = APIRouter(tags=["Emergency SOS — Servicer"])


@servicer_router.post("/{request_id}/respond", response_model=EmergencyResponseRead)
async def respond_to_emergency(
    request_id: UUID,
    response_in: EmergencyResponseCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    """Servicer accepts an emergency with a committed arrival time."""
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    em = db.query(EmergencyRequest).filter(
        EmergencyRequest.id == request_id,
        EmergencyRequest.status == "PENDING",
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found or no longer accepting responses")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if now > em.expires_at:
        em.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=410, detail="Emergency request has expired")

    existing = db.query(EmergencyResponse).filter(
        EmergencyResponse.request_id == request_id,
        EmergencyResponse.provider_id == provider.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already responded to this emergency")

    response = EmergencyResponse(
        request_id=request_id,
        provider_id=provider.id,
        arrival_time=response_in.arrival_time,
        status="PENDING",
    )
    db.add(response)
    db.commit()
    db.refresh(response)

    config = em.config

    await emergency_manager.send_to_user(str(request_id), {
        "event": "new_response",
        "response_id": str(response.id),
        "provider_id": str(provider.id),
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
    current_user: User = Depends(servicer_only),
):
    """Servicer explicitly ignores an emergency — records dismissal and deducts points."""
    from app.service.point_engine import award_points

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    existing = db.query(EmergencyResponse).filter(
        EmergencyResponse.request_id == request_id,
        EmergencyResponse.provider_id == provider.id,
    ).first()
    if not existing:
        # Use a far-future sentinel — arrival_time is not meaningful for IGNORED records
        far_future = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3650)
        db.add(EmergencyResponse(
            request_id=request_id,
            provider_id=provider.id,
            arrival_time=far_future,
            status="IGNORED",
        ))
        db.commit()
        award_points(
            db, provider.id,
            event_type="EMERGENCY_CANCEL",
            source_id=request_id,
            note="Emergency SOS ignored",
        )
        if provider.user_id:
            _notify(db, provider.user_id,
                    title="Emergency SOS Ignored — Points Deducted",
                    message="You ignored an emergency SOS request. 20 points have been deducted from your rating.",
                    notification_type="WARNING")
        db.commit()
    return {"detail": "Emergency request ignored"}

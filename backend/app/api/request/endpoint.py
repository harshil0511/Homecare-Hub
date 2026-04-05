import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.internal import models, schemas, deps

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Service Requests"])

# Role guards
user_or_secretary = deps.RoleChecker(["USER", "SECRETARY"])
servicer_only = deps.RoleChecker(["SERVICER"])


def _mark_expired_if_needed(request: models.ServiceRequest) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC, matches stored datetimes
    if request.status == "OPEN" and now > request.expires_at:
        request.status = "EXPIRED"
        for resp in request.responses:
            if resp.status == "PENDING":
                resp.status = "REJECTED"


def _notify(db: Session, user_id: int, title: str, message: str,
            notification_type: str = "INFO", link: Optional[str] = None) -> None:
    db.add(models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    ))


# IMPORTANT: GET /incoming MUST be defined before GET /{request_id}
# to avoid FastAPI treating "incoming" as an integer path param

@router.get("/incoming", response_model=List[schemas.IncomingServiceRequestRead])
def list_incoming_requests(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    recipients = db.query(models.ServiceRequestRecipient).filter(
        models.ServiceRequestRecipient.provider_id == provider.id
    ).all()

    result = []
    changed = False
    for rec in recipients:
        req = rec.request
        was_open = req.status == "OPEN"
        _mark_expired_if_needed(req)
        if was_open and req.status != "OPEN":
            changed = True

        # Skip non-OPEN requests
        if req.status != "OPEN":
            continue

        has_responded = any(r.provider_id == provider.id for r in req.responses)

        result.append(schemas.IncomingServiceRequestRead(
            id=req.id,
            contact_name=req.contact_name,
            location=req.location,
            device_or_issue=req.device_or_issue,
            description=req.description,
            photos=req.photos,
            preferred_dates=req.preferred_dates,
            urgency=req.urgency,
            status=req.status,
            expires_at=req.expires_at,
            created_at=req.created_at,
            is_read=rec.is_read,
            has_responded=has_responded,
        ))

    if changed:
        db.commit()
    return result


@router.post("/", response_model=schemas.ServiceRequestRead, status_code=201)
def create_service_request(
    request_in: schemas.ServiceRequestCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    providers = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id.in_(request_in.provider_ids)
    ).all()
    found_ids = {p.id for p in providers}
    missing = set(request_in.provider_ids) - found_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Providers not found: {sorted(missing)}")

    now = datetime.utcnow()
    db_request = models.ServiceRequest(
        user_id=current_user.id,
        contact_name=request_in.contact_name,
        contact_mobile=request_in.contact_mobile,
        location=request_in.location,
        device_or_issue=request_in.device_or_issue,
        description=request_in.description,
        photos=json.dumps(request_in.photos) if request_in.photos else None,
        preferred_dates=json.dumps(request_in.preferred_dates) if request_in.preferred_dates else None,
        urgency=request_in.urgency,
        status="OPEN",
        expires_at=now + timedelta(hours=24),
        created_at=now,
    )
    db.add(db_request)
    db.flush()

    for provider in providers:
        db.add(models.ServiceRequestRecipient(
            request_id=db_request.id,
            provider_id=provider.id,
        ))
        if provider.user_id:
            _notify(
                db,
                user_id=provider.user_id,
                title="New Service Request",
                message=f"{request_in.contact_name} needs help with '{request_in.device_or_issue}'. Respond with your offer.",
                notification_type="URGENT" if request_in.urgency == "Emergency" else "INFO",
                link=f"/service/jobs?tab=requests",
            )

    _notify(
        db,
        user_id=current_user.id,
        title="Request Sent",
        message=f"Your request for '{request_in.device_or_issue}' was sent to {len(providers)} provider(s).",
        notification_type="INFO",
        link=f"/user/bookings",
    )

    db.commit()
    db.refresh(db_request)
    return db_request


@router.get("/", response_model=List[schemas.ServiceRequestRead])
def list_my_requests(
    status_filter: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    query = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.user_id == current_user.id
    )
    if status_filter:
        query = query.filter(models.ServiceRequest.status == status_filter.upper())

    requests_list = query.order_by(models.ServiceRequest.created_at.desc()).all()

    changed = False
    for req in requests_list:
        was_open = req.status == "OPEN"
        _mark_expired_if_needed(req)
        if was_open and req.status != "OPEN":
            changed = True

    if changed:
        db.commit()
    return requests_list


@router.get("/{request_id}", response_model=schemas.ServiceRequestDetailRead)
def get_request_detail(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    req = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    db.commit()
    return req


@router.get("/{request_id}/responses", response_model=List[schemas.ServiceRequestResponseRead])
def get_request_responses(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    req = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    db.commit()

    return db.query(models.ServiceRequestResponse).filter(
        models.ServiceRequestResponse.request_id == request_id
    ).order_by(models.ServiceRequestResponse.proposed_price.asc()).all()


@router.post("/{request_id}/respond", response_model=schemas.ServiceRequestResponseRead, status_code=201)
def respond_to_request(
    request_id: UUID,
    response_in: schemas.ServiceRequestResponseCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=403, detail="Only service providers can respond to requests")

    req = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    recipient = db.query(models.ServiceRequestRecipient).filter(
        models.ServiceRequestRecipient.request_id == request_id,
        models.ServiceRequestRecipient.provider_id == provider.id,
    ).first()
    if not recipient:
        raise HTTPException(status_code=403, detail="This request was not sent to you")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Cannot respond: request is {req.status}")

    existing = db.query(models.ServiceRequestResponse).filter(
        models.ServiceRequestResponse.request_id == request_id,
        models.ServiceRequestResponse.provider_id == provider.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already submitted a response for this request")

    db_response = models.ServiceRequestResponse(
        request_id=request_id,
        provider_id=provider.id,
        proposed_date=response_in.proposed_date,
        proposed_price=response_in.proposed_price,
        estimated_hours=response_in.estimated_hours,
        message=response_in.message,
        status="PENDING",
    )
    db.add(db_response)
    recipient.is_read = True

    _notify(
        db,
        user_id=req.user_id,
        title="New Response to Your Request",
        message=f"A provider responded to your '{req.device_or_issue}' request. Proposed: \u20b9{response_in.proposed_price:.0f}.",
        notification_type="INFO",
        link=f"/user/bookings",
    )

    db.commit()
    db.refresh(db_response)
    return db_response


@router.post("/{request_id}/responses/{response_id}/accept", response_model=schemas.BookingDetailRead)
def accept_response(
    request_id: UUID,
    response_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    req = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Cannot accept: request is already {req.status}")

    chosen = db.query(models.ServiceRequestResponse).filter(
        models.ServiceRequestResponse.id == response_id,
        models.ServiceRequestResponse.request_id == request_id,
        models.ServiceRequestResponse.status == "PENDING",
    ).first()
    if not chosen:
        raise HTTPException(status_code=404, detail="Response not found or already processed")

    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == chosen.provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Create the ServiceBooking from the accepted response
    booking = models.ServiceBooking(
        user_id=current_user.id,
        provider_id=chosen.provider_id,
        service_type=req.device_or_issue,
        scheduled_at=chosen.proposed_date,
        priority=req.urgency,
        issue_description=req.description,
        property_details=req.location,
        estimated_cost=chosen.proposed_price,
        photos=req.photos,
        status="Accepted",
    )
    db.add(booking)
    db.flush()

    db.add(models.BookingStatusHistory(
        booking_id=booking.id,
        status="Accepted",
        notes="Contract created from accepted service request offer",
    ))

    chosen.status = "ACCEPTED"

    # Reject all other pending responses
    other_responses = db.query(models.ServiceRequestResponse).filter(
        models.ServiceRequestResponse.request_id == request_id,
        models.ServiceRequestResponse.id != response_id,
        models.ServiceRequestResponse.status == "PENDING",
    ).all()
    for other in other_responses:
        other.status = "REJECTED"

    req.status = "ACCEPTED"
    req.resulting_booking_id = booking.id
    provider.availability_status = "WORKING"

    # Notify accepted provider
    if provider.user_id:
        _notify(
            db,
            user_id=provider.user_id,
            title="Offer Accepted \u2014 Contract Created",
            message=f"Your offer for '{req.device_or_issue}' was accepted. Scheduled: {chosen.proposed_date.strftime('%b %d')}.",
            notification_type="INFO",
            link=f"/service/jobs",
        )

    # Notify rejected providers (those who responded but were not chosen)
    rejected_ids = {r.provider_id for r in other_responses}
    if rejected_ids:
        rejected_providers = db.query(models.ServiceProvider).filter(
            models.ServiceProvider.id.in_(rejected_ids)
        ).all()
        for rp in rejected_providers:
            if rp.user_id:
                _notify(
                    db,
                    user_id=rp.user_id,
                    title="Offer Not Selected",
                    message=f"The client selected another provider for '{req.device_or_issue}'.",
                    notification_type="INFO",
                    link="/service/jobs",
                )

    # Notify providers who received the request but never responded
    responded_provider_ids = {r.provider_id for r in other_responses} | {chosen.provider_id}
    silent_recipients = db.query(models.ServiceRequestRecipient).filter(
        models.ServiceRequestRecipient.request_id == request_id,
        models.ServiceRequestRecipient.provider_id.notin_(responded_provider_ids),
    ).all()
    for rec in silent_recipients:
        rp = db.query(models.ServiceProvider).filter(
            models.ServiceProvider.id == rec.provider_id
        ).first()
        if rp and rp.user_id:
            _notify(db, user_id=rp.user_id, title="Request No Longer Available",
                    message=f"A service request for '{req.device_or_issue}' has been assigned to another provider.",
                    notification_type="INFO", link="/service/jobs")

    # Notify requesting user
    _notify(
        db,
        user_id=current_user.id,
        title="Contract Created",
        message=f"You have confirmed a booking for '{req.device_or_issue}'. Estimated cost: \u20b9{chosen.proposed_price:.0f}.",
        notification_type="INFO",
        link=f"/user/bookings/{booking.id}",
    )

    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{request_id}/responses/{response_id}/reject", status_code=200)
def reject_response(
    request_id: UUID,
    response_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    req = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Cannot reject: request is {req.status}")

    response = db.query(models.ServiceRequestResponse).filter(
        models.ServiceRequestResponse.id == response_id,
        models.ServiceRequestResponse.request_id == request_id,
        models.ServiceRequestResponse.status == "PENDING",
    ).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found or already processed")

    response.status = "REJECTED"

    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == response.provider_id
    ).first()
    if provider and provider.user_id:
        _notify(
            db,
            user_id=provider.user_id,
            title="Offer Declined",
            message=f"The user has declined your offer for '{req.device_or_issue}'.",
            notification_type="INFO",
            link="/service/jobs",
        )

    db.commit()
    return {"detail": "Response rejected"}


@router.delete("/{request_id}", status_code=200)
def cancel_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    req = db.query(models.ServiceRequest).filter(
        models.ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if req.status == "ACCEPTED":
        raise HTTPException(status_code=400, detail="Cannot cancel: a booking was already created. Cancel the booking instead.")
    if req.status == "CANCELLED":
        return {"detail": "Already cancelled"}

    req.status = "CANCELLED"

    pending = db.query(models.ServiceRequestResponse).filter(
        models.ServiceRequestResponse.request_id == request_id,
        models.ServiceRequestResponse.status == "PENDING",
    ).all()
    for resp in pending:
        resp.status = "REJECTED"

    # Batch notify all providers who had pending responses
    pending_provider_ids = [r.provider_id for r in pending]
    if pending_provider_ids:
        pending_providers = db.query(models.ServiceProvider).filter(
            models.ServiceProvider.id.in_(pending_provider_ids)
        ).all()
        for rp in pending_providers:
            if rp.user_id:
                _notify(db, user_id=rp.user_id, title="Request Cancelled",
                        message=f"The client cancelled the request for '{req.device_or_issue}'.",
                        notification_type="INFO", link="/service/jobs")

    # Also notify providers who received but never responded
    responded_provider_ids = set(pending_provider_ids)
    silent_recipients = db.query(models.ServiceRequestRecipient).filter(
        models.ServiceRequestRecipient.request_id == request_id,
        models.ServiceRequestRecipient.provider_id.notin_(responded_provider_ids),
    ).all()
    silent_provider_ids = [rec.provider_id for rec in silent_recipients]
    if silent_provider_ids:
        silent_providers = db.query(models.ServiceProvider).filter(
            models.ServiceProvider.id.in_(silent_provider_ids)
        ).all()
        for rp in silent_providers:
            if rp.user_id:
                _notify(db, user_id=rp.user_id, title="Request Cancelled",
                        message=f"A service request for '{req.device_or_issue}' was cancelled.",
                        notification_type="INFO", link="/service/jobs")

    db.commit()
    return {"detail": "Request cancelled successfully"}

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.request.domain.model import ServiceRequest, ServiceRequestRecipient, ServiceRequestResponse, NegotiationOffer
from app.booking.domain.model import ServiceBooking, BookingStatusHistory
from app.notification.domain.model import Notification
from app.api.request.schemas import (
    ServiceRequestCreate, ServiceRequestResponseCreate,
    ServiceRequestRead, ServiceRequestDetailRead,
    ServiceRequestResponseRead, IncomingServiceRequestRead,
    NegotiationOfferCreate,
)
from app.api.booking.schemas import BookingRead

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Service Requests"])

# Role guards
user_or_secretary = deps.RoleChecker(["USER", "SECRETARY"])
servicer_only = deps.RoleChecker(["SERVICER"])


def _mark_expired_if_needed(request: ServiceRequest) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC, matches stored datetimes
    if request.status == "OPEN" and now > request.expires_at:
        request.status = "EXPIRED"
        for resp in request.responses:
            if resp.status == "PENDING":
                resp.status = "REJECTED"


def _notify(db: Session, user_id: int, title: str, message: str,
            notification_type: str = "INFO", link: Optional[str] = None) -> None:
    db.add(Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    ))


# IMPORTANT: GET /incoming MUST be defined before GET /{request_id}
# to avoid FastAPI treating "incoming" as an integer path param

@router.get("/incoming", response_model=List[IncomingServiceRequestRead])
def list_incoming_requests(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    recipients = db.query(ServiceRequestRecipient).filter(
        ServiceRequestRecipient.provider_id == provider.id
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

        my_response = next((r for r in req.responses if r.provider_id == provider.id), None)
        has_responded = my_response is not None

        result.append(IncomingServiceRequestRead(
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
            response_id=my_response.id if my_response else None,
            negotiation_status=my_response.negotiation_status if my_response else None,
            current_round=my_response.current_round if my_response else 0,
        ))

    if changed:
        db.commit()
    return result


@router.post("/", response_model=ServiceRequestRead, status_code=201)
def create_service_request(
    request_in: ServiceRequestCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    providers = db.query(ServiceProvider).filter(
        ServiceProvider.id.in_(request_in.provider_ids)
    ).all()
    found_ids = {p.id for p in providers}
    missing = set(request_in.provider_ids) - found_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Providers not found: {sorted(missing)}")

    now = datetime.utcnow()
    db_request = ServiceRequest(
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
        db.add(ServiceRequestRecipient(
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


@router.get("/", response_model=List[ServiceRequestRead])
def list_my_requests(
    status_filter: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    query = db.query(ServiceRequest).filter(
        ServiceRequest.user_id == current_user.id
    )
    if status_filter:
        query = query.filter(ServiceRequest.status == status_filter.upper())

    requests_list = query.order_by(ServiceRequest.created_at.desc()).all()

    changed = False
    for req in requests_list:
        was_open = req.status == "OPEN"
        _mark_expired_if_needed(req)
        if was_open and req.status != "OPEN":
            changed = True

    if changed:
        db.commit()
    return requests_list


@router.get("/{request_id}", response_model=ServiceRequestDetailRead)
def get_request_detail(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    req = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    db.commit()
    return req


@router.get("/{request_id}/responses", response_model=List[ServiceRequestResponseRead])
def get_request_responses(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    req = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    db.commit()

    return db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.request_id == request_id
    ).order_by(ServiceRequestResponse.proposed_price.asc()).all()


@router.post("/{request_id}/respond", response_model=ServiceRequestResponseRead, status_code=201)
def respond_to_request(
    request_id: UUID,
    response_in: ServiceRequestResponseCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=403, detail="Only service providers can respond to requests")

    req = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    recipient = db.query(ServiceRequestRecipient).filter(
        ServiceRequestRecipient.request_id == request_id,
        ServiceRequestRecipient.provider_id == provider.id,
    ).first()
    if not recipient:
        raise HTTPException(status_code=403, detail="This request was not sent to you")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Cannot respond: request is {req.status}")

    existing = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.request_id == request_id,
        ServiceRequestResponse.provider_id == provider.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already submitted a response for this request")

    db_response = ServiceRequestResponse(
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


@router.post("/{request_id}/responses/{response_id}/accept")
def accept_response(
    request_id: UUID,
    response_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    from app.api.booking.schemas import BookingDetailRead

    req = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Cannot accept: request is already {req.status}")

    chosen = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.id == response_id,
        ServiceRequestResponse.request_id == request_id,
        ServiceRequestResponse.status == "PENDING",
    ).first()
    if not chosen:
        raise HTTPException(status_code=404, detail="Response not found or already processed")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == chosen.provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Create the ServiceBooking from the accepted response
    booking = ServiceBooking(
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

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Accepted",
        notes="Contract created from accepted service request offer",
    ))

    chosen.status = "ACCEPTED"

    # Reject all other pending responses
    other_responses = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.request_id == request_id,
        ServiceRequestResponse.id != response_id,
        ServiceRequestResponse.status == "PENDING",
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
        rejected_providers = db.query(ServiceProvider).filter(
            ServiceProvider.id.in_(rejected_ids)
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
    silent_recipients = db.query(ServiceRequestRecipient).filter(
        ServiceRequestRecipient.request_id == request_id,
        ServiceRequestRecipient.provider_id.notin_(responded_provider_ids),
    ).all()
    for rec in silent_recipients:
        rp = db.query(ServiceProvider).filter(
            ServiceProvider.id == rec.provider_id
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
    current_user: User = Depends(user_or_secretary),
):
    req = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Cannot reject: request is {req.status}")

    response = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.id == response_id,
        ServiceRequestResponse.request_id == request_id,
        ServiceRequestResponse.status == "PENDING",
    ).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found or already processed")

    response.status = "REJECTED"

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == response.provider_id
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


@router.post("/{request_id}/responses/{response_id}/counter", status_code=200)
def send_counter_offer(
    request_id: UUID,
    response_id: UUID,
    offer_in: NegotiationOfferCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User or servicer sends a counter-offer. Max 3 rounds."""
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.urgency == "Emergency":
        raise HTTPException(status_code=400, detail="Emergency requests cannot be negotiated")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Request is {req.status}")

    response = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.id == response_id,
        ServiceRequestResponse.request_id == request_id,
    ).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    if response.status not in ("PENDING",):
        raise HTTPException(status_code=400, detail=f"Response is already {response.status}")
    if response.negotiation_status == "CLOSED":
        raise HTTPException(status_code=400, detail="Negotiation is closed for this response")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    is_servicer = provider is not None and provider.id == response.provider_id
    is_user = req.user_id == current_user.id

    if not is_servicer and not is_user:
        raise HTTPException(status_code=403, detail="Access denied")

    caller_role = "SERVICER" if is_servicer else "USER"

    # Turn enforcement
    if response.current_round == 0:
        expected_role = "USER"
    else:
        last_offer = db.query(NegotiationOffer).filter(
            NegotiationOffer.response_id == response_id
        ).order_by(NegotiationOffer.round_number.desc()).first()
        expected_role = "USER" if last_offer and last_offer.offered_by == "SERVICER" else "SERVICER"

    if caller_role != expected_role:
        raise HTTPException(status_code=400, detail=f"It is {expected_role}'s turn to respond")

    if response.current_round >= 3:
        raise HTTPException(status_code=400, detail="Maximum negotiation rounds (3) reached")

    new_round = response.current_round + 1

    offer = NegotiationOffer(
        response_id=response_id,
        offered_by=caller_role,
        round_number=new_round,
        proposed_date=offer_in.proposed_date,
        proposed_time=offer_in.proposed_time,
        proposed_price=offer_in.proposed_price,
        message=offer_in.message,
        status="PENDING",
    )
    db.add(offer)
    response.negotiation_status = "NEGOTIATING"
    response.current_round = new_round

    if caller_role == "USER":
        target_provider = db.query(ServiceProvider).filter(
            ServiceProvider.id == response.provider_id
        ).first()
        if target_provider and target_provider.user_id:
            _notify(db, user_id=target_provider.user_id,
                    title="Counter Offer Received",
                    message=f"Counter offer from user for '{req.device_or_issue}': \u20b9{offer_in.proposed_price:.0f}.",
                    notification_type="INFO", link="/service/jobs")
    else:
        _notify(db, user_id=req.user_id,
                title="Servicer Sent New Offer",
                message=f"Servicer updated their offer for '{req.device_or_issue}': \u20b9{offer_in.proposed_price:.0f}.",
                notification_type="INFO", link="/user/bookings")

    db.commit()
    db.refresh(offer)
    return {"detail": "Counter offer sent", "round_number": new_round}


@router.post("/{request_id}/responses/{response_id}/accept-counter", status_code=200)
def accept_counter_offer(
    request_id: UUID,
    response_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Accept the latest counter-offer. Creates booking with agreed price."""
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Request is {req.status}")

    response = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.id == response_id,
        ServiceRequestResponse.request_id == request_id,
    ).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    if response.negotiation_status != "NEGOTIATING":
        raise HTTPException(status_code=400, detail="No active negotiation to accept")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    is_servicer = provider is not None and provider.id == response.provider_id
    is_user = req.user_id == current_user.id

    latest_offer = db.query(NegotiationOffer).filter(
        NegotiationOffer.response_id == response_id,
        NegotiationOffer.status == "PENDING",
    ).order_by(NegotiationOffer.round_number.desc()).first()
    if not latest_offer:
        raise HTTPException(status_code=404, detail="No pending counter offer found")

    if latest_offer.offered_by == "SERVICER" and not is_user:
        raise HTTPException(status_code=403, detail="Only the user can accept this offer")
    if latest_offer.offered_by == "USER" and not is_servicer:
        raise HTTPException(status_code=403, detail="Only the servicer can accept this offer")

    latest_offer.status = "ACCEPTED"
    response.negotiation_status = "AGREED"
    response.agreed_price = latest_offer.proposed_price
    response.agreed_date = latest_offer.proposed_date

    chosen_provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == response.provider_id
    ).first()
    if not chosen_provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    booking = ServiceBooking(
        user_id=req.user_id,
        provider_id=response.provider_id,
        service_type=req.device_or_issue,
        scheduled_at=latest_offer.proposed_date,
        priority=req.urgency,
        issue_description=req.description,
        property_details=req.location,
        estimated_cost=latest_offer.proposed_price,
        photos=req.photos,
        status="Accepted",
        source_type="negotiated",
    )
    db.add(booking)
    db.flush()

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Accepted",
        notes=f"Contract created from negotiated offer (round {response.current_round}). Agreed price: \u20b9{latest_offer.proposed_price:.0f}",
    ))

    response.status = "ACCEPTED"

    others = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.request_id == request_id,
        ServiceRequestResponse.id != response_id,
        ServiceRequestResponse.status == "PENDING",
    ).all()
    for other in others:
        other.status = "REJECTED"

    req.status = "ACCEPTED"
    req.resulting_booking_id = booking.id
    chosen_provider.availability_status = "WORKING"

    if chosen_provider.user_id:
        _notify(db, user_id=chosen_provider.user_id,
                title="Negotiated Offer Accepted \u2014 Contract Created",
                message=f"Counter offer accepted for '{req.device_or_issue}'. Agreed: \u20b9{latest_offer.proposed_price:.0f}.",
                notification_type="INFO", link="/service/jobs")

    _notify(db, user_id=req.user_id,
            title="Contract Created (Negotiated)",
            message=f"Contract created for '{req.device_or_issue}'. Agreed cost: \u20b9{latest_offer.proposed_price:.0f}.",
            notification_type="INFO", link=f"/user/bookings/{booking.id}")

    rejected_ids = {r.provider_id for r in others}
    if rejected_ids:
        rejected_providers = db.query(ServiceProvider).filter(ServiceProvider.id.in_(rejected_ids)).all()
        for rp in rejected_providers:
            if rp.user_id:
                _notify(db, user_id=rp.user_id, title="Offer Not Selected",
                        message=f"The client selected another provider for '{req.device_or_issue}'.",
                        notification_type="INFO", link="/service/jobs")

    db.commit()
    db.refresh(booking)
    return {"detail": "Counter offer accepted. Contract created.", "booking_id": str(booking.id)}


@router.post("/{request_id}/responses/{response_id}/reject-counter", status_code=200)
def reject_counter_offer(
    request_id: UUID,
    response_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Reject the latest counter-offer."""
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    _mark_expired_if_needed(req)
    if req.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Request is {req.status}")

    response = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.id == response_id,
        ServiceRequestResponse.request_id == request_id,
    ).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    if response.negotiation_status != "NEGOTIATING":
        raise HTTPException(status_code=400, detail="No active negotiation to reject")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    is_servicer = provider is not None and provider.id == response.provider_id
    is_user = req.user_id == current_user.id

    latest_offer = db.query(NegotiationOffer).filter(
        NegotiationOffer.response_id == response_id,
        NegotiationOffer.status == "PENDING",
    ).order_by(NegotiationOffer.round_number.desc()).first()
    if not latest_offer:
        raise HTTPException(status_code=404, detail="No pending counter offer found")

    if latest_offer.offered_by == "SERVICER" and not is_user:
        raise HTTPException(status_code=403, detail="Only the user can reject this offer")
    if latest_offer.offered_by == "USER" and not is_servicer:
        raise HTTPException(status_code=403, detail="Only the servicer can reject this offer")

    latest_offer.status = "REJECTED"

    if response.current_round >= 3:
        response.negotiation_status = "CLOSED"
        closed = True
    else:
        response.negotiation_status = "NEGOTIATING"
        closed = False

    if latest_offer.offered_by == "USER":
        _notify(db, user_id=req.user_id,
                title="Counter Offer Rejected",
                message=f"Servicer rejected your counter offer for '{req.device_or_issue}'.",
                notification_type="INFO", link="/user/bookings")
    else:
        target_provider = db.query(ServiceProvider).filter(
            ServiceProvider.id == response.provider_id
        ).first()
        if target_provider and target_provider.user_id:
            _notify(db, user_id=target_provider.user_id,
                    title="Counter Offer Rejected",
                    message=f"User rejected your counter offer for '{req.device_or_issue}'.",
                    notification_type="INFO", link="/service/jobs")

    db.commit()
    msg = "Negotiation closed \u2014 max rounds reached" if closed else "Counter offer rejected"
    return {"detail": msg, "negotiation_closed": closed}


@router.delete("/{request_id}", status_code=200)
def cancel_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(user_or_secretary),
):
    req = db.query(ServiceRequest).filter(
        ServiceRequest.id == request_id
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

    pending = db.query(ServiceRequestResponse).filter(
        ServiceRequestResponse.request_id == request_id,
        ServiceRequestResponse.status == "PENDING",
    ).all()
    for resp in pending:
        resp.status = "REJECTED"

    # Batch notify all providers who had pending responses
    pending_provider_ids = [r.provider_id for r in pending]
    if pending_provider_ids:
        pending_providers = db.query(ServiceProvider).filter(
            ServiceProvider.id.in_(pending_provider_ids)
        ).all()
        for rp in pending_providers:
            if rp.user_id:
                _notify(db, user_id=rp.user_id, title="Request Cancelled",
                        message=f"The client cancelled the request for '{req.device_or_issue}'.",
                        notification_type="INFO", link="/service/jobs")

    # Also notify providers who received but never responded
    responded_provider_ids = set(pending_provider_ids)
    silent_recipients = db.query(ServiceRequestRecipient).filter(
        ServiceRequestRecipient.request_id == request_id,
        ServiceRequestRecipient.provider_id.notin_(responded_provider_ids),
    ).all()
    silent_provider_ids = [rec.provider_id for rec in silent_recipients]
    if silent_provider_ids:
        silent_providers = db.query(ServiceProvider).filter(
            ServiceProvider.id.in_(silent_provider_ids)
        ).all()
        for rp in silent_providers:
            if rp.user_id:
                _notify(db, user_id=rp.user_id, title="Request Cancelled",
                        message=f"A service request for '{req.device_or_issue}' was cancelled.",
                        notification_type="INFO", link="/service/jobs")

    db.commit()
    return {"detail": "Request cancelled successfully"}

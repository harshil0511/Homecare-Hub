import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.common import deps
from app.common.constants import ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.booking.domain.model import ServiceBooking, BookingStatusHistory, BookingChat, BookingReview, BookingComplaint
from app.notification.domain.model import Notification
from app.service.services import get_provider_display_name
from app.service.point_engine import award_points
from app.api.booking.schemas import (
    BookingCreate, BookingUpdate, BookingStatusUpdate,
    BookingReschedule, BookingCancel,
    BookingRead, BookingDetailRead, BookingWithUserRead,
    ChatCreate, ChatRead, ReviewCreate, ReviewRead,
    BookingStatusHistoryRead,
    ReceiptRead, ComplaintCreate, ComplaintRead,
    ChargeSubmitCreate, FlagCreate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _notify_booking(db: Session, user_id, title: str, message: str,
                    notification_type: str = "INFO", link: Optional[str] = None) -> None:
    db.add(Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    ))


@router.post("/create", response_model=BookingRead)
def create_booking(
    booking_in: BookingCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Verify provider exists
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking_in.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Time-conflict check: reject if provider already has an active booking within ± window
    window_start = booking_in.scheduled_at - timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    window_end = booking_in.scheduled_at + timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    conflict = db.query(ServiceBooking).filter(
        ServiceBooking.provider_id == booking_in.provider_id,
        ServiceBooking.status.in_(["Pending", "Accepted", "In Progress"]),
        ServiceBooking.scheduled_at >= window_start,
        ServiceBooking.scheduled_at <= window_end
    ).first()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Expert is already booked around that time (conflict with booking at {conflict.scheduled_at.strftime('%b %d, %H:%M')}). Please choose a different time."
        )

    db_booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=booking_in.provider_id,
        service_type=booking_in.service_type,
        scheduled_at=booking_in.scheduled_at,
        priority=booking_in.priority,
        issue_description=booking_in.issue_description,
        property_details=booking_in.property_details,
        estimated_cost=booking_in.estimated_cost
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)

    # If booking was linked to a pending task → mark task as Assigned
    if booking_in.task_id:
        from app.maintenance.domain.model import MaintenanceTask
        task = db.query(MaintenanceTask).filter(
            MaintenanceTask.id == booking_in.task_id,
            MaintenanceTask.user_id == current_user.id,
            MaintenanceTask.booking_id == None
        ).first()
        if task:
            task.booking_id = db_booking.id
            task.service_provider_id = provider.id
            task.status = "Assigned"
            db.commit()

    # Add initial status history
    history = BookingStatusHistory(
        booking_id=db_booking.id,
        status="Pending",
        notes="Booking initialized by client"
    )
    db.add(history)

    # Trigger Notifications
    # 1. To Client
    user_notif = Notification(
        user_id=current_user.id,
        title="Booking Request Placed",
        message=f"Your request for {db_booking.service_type} has been initialized.",
        notification_type="INFO",
        link=f"/user/bookings/{db_booking.id}"
    )
    db.add(user_notif)

    # 2. To Provider
    if provider.user_id:
        provider_notif = Notification(
            user_id=provider.user_id,
            title="Action Required: New Request",
            message=f"New {db_booking.service_type} request from {current_user.username}.",
            notification_type="URGENT",
            link="/service/jobs"
        )
        db.add(provider_notif)

    db.commit()
    return db_booking

@router.get("/list", response_model=List[BookingRead])
def list_bookings(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role == "SERVICER" or current_user.role == "provider":
        profile = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
        if not profile:
            return []
        query = db.query(ServiceBooking).filter(ServiceBooking.provider_id == profile.id)
    else:
        query = db.query(ServiceBooking).filter(ServiceBooking.user_id == current_user.id)

    # Status filter: "contracted" = Accepted/In Progress/Completed, "pending" = Pending only
    if status == "contracted":
        query = query.filter(ServiceBooking.status.in_(["Accepted", "In Progress", "Pending Confirmation", "Completed"]))
    elif status == "pending":
        query = query.filter(ServiceBooking.status == "Pending")

    return query.order_by(ServiceBooking.created_at.desc()).all()

@router.get("/incoming", response_model=List[BookingRead])
def get_incoming_bookings(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Active jobs for the servicer — excludes completed/cancelled."""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return db.query(ServiceBooking).filter(
        ServiceBooking.provider_id == provider.id,
        ServiceBooking.status.notin_(["Completed", "Cancelled"]),
    ).order_by(ServiceBooking.created_at.desc()).all()


@router.get("/completed-provider", response_model=List[BookingWithUserRead])
def get_completed_bookings_for_provider(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Completed jobs for the servicer — includes user details and review via ORM relationships."""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    return db.query(ServiceBooking).filter(
        ServiceBooking.provider_id == provider.id,
        ServiceBooking.status == "Completed",
    ).order_by(ServiceBooking.created_at.desc()).all()

@router.patch("/{booking_id}/status", response_model=BookingRead)
def update_booking_status(
    booking_id: UUID,
    booking_update: BookingStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    is_provider = provider and provider.user_id == current_user.id
    is_owner = booking.user_id == current_user.id

    if not is_provider and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to update this booking")

    old_status = booking.status
    new_status = booking_update.status

    if new_status != old_status:
        # Guard: Pending Confirmation transitions must go through dedicated endpoints
        if new_status == "Pending Confirmation":
            raise HTTPException(status_code=400, detail="Use the /final-complete endpoint to submit completion")
        if new_status == "Completed" and booking.status == "Pending Confirmation":
            raise HTTPException(status_code=400, detail="Use the /confirm endpoint to confirm completion")

        booking.status = new_status

        # Capture completion data when provider marks job complete
        if new_status == "Completed" and is_provider:
            if booking_update.final_cost is not None:
                booking.final_cost = booking_update.final_cost
            if booking_update.actual_hours is not None:
                booking.actual_hours = booking_update.actual_hours
            if booking_update.completion_notes is not None:
                booking.completion_notes = booking_update.completion_notes
            # Award points based on job priority
            if provider:
                priority = (booking.priority or "Normal").strip()
                if priority == "Emergency":
                    event = "EMERGENCY_COMPLETE"
                elif priority == "High":
                    event = "URGENT_COMPLETE"
                else:
                    event = "REGULAR_COMPLETE"
                award_points(db, provider.id, event, source_id=booking.id,
                             note=f"{booking.service_type} completed")

        # Record status change in history
        db.add(BookingStatusHistory(
            booking_id=booking.id,
            status=new_status,
            notes=f"Status changed from {old_status} to {new_status} by {'provider' if is_provider else 'client'}"
        ))

        # Emergency acceptance bonus: boost provider rating by 0.2 (capped at 5.0)
        if new_status == "Accepted" and booking.priority == "Emergency" and is_provider and provider:
            provider.rating = (provider.rating or 0) + 0.2

        # Reset provider availability when booking is completed
        if new_status == "Completed" and provider:
            provider.availability_status = "AVAILABLE"

        # Notify the party that DID NOT make the change
        notif_link = f"/user/bookings/{booking.id}" if is_provider else f"/service/jobs"
        target_user_id = booking.user_id if is_provider else (provider.user_id if provider else None)

        if target_user_id:
            db.add(Notification(
                user_id=target_user_id,
                title=f"Booking {new_status}",
                message=f"Your booking for {booking.service_type} is now {new_status}.",
                notification_type="INFO",
                link=notif_link,
            ))

    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}", response_model=BookingDetailRead)
def get_booking(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check permissions (either the client or the provider)
    is_client = booking.user_id == current_user.id

    # Check if provider
    is_provider = False
    profile = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if profile and booking.provider_id == profile.id:
        is_provider = True

    if not is_client and not is_provider and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")

    return booking

@router.patch("/{booking_id}/reschedule", response_model=BookingRead)
def reschedule_booking(
    booking_id: UUID,
    reschedule_in: BookingReschedule,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only client or provider can reschedule
    # ... Simplified logic for now

    booking.scheduled_at = reschedule_in.new_date

    # If the booking was cancelled or completed, flip it back to Pending so it's active again
    if booking.status in ["Cancelled", "Completed"]:
        booking.status = "Pending"

    history = BookingStatusHistory(
        booking_id=booking.id,
        status=booking.status,
        notes=f"Rescheduled to {reschedule_in.new_date}. Status reset to {booking.status}."
    )
    db.add(history)

    # Notify the PROVIDER about the new schedule
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    if provider and provider.user_id:
        notif = Notification(
            user_id=provider.user_id,
            title="Schedule Updated & Re-opened",
            message=f"A booking for {booking.service_type} has been rescheduled to {reschedule_in.new_date} and is now active again.",
            notification_type="WARNING",
            link="/service/jobs"
        )
        db.add(notif)

    db.commit()
    db.refresh(booking)
    return booking

@router.patch("/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: UUID,
    cancel_in: BookingCancel,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == "Cancelled":
         return booking # Already cancelled

    booking.status = "Cancelled"

    # Deduct points only if the PROVIDER is cancelling (not the user)
    _cancel_provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == booking.provider_id
    ).first()
    if _cancel_provider and _cancel_provider.user_id == current_user.id:
        priority = (booking.priority or "Normal").strip()
        cancel_event = "EMERGENCY_CANCEL" if priority == "Emergency" else "REGULAR_CANCEL"
        award_points(db, _cancel_provider.id, cancel_event, source_id=booking.id,
                     note=f"Cancelled by provider: {cancel_in.reason}")

    history = BookingStatusHistory(
        booking_id=booking.id,
        status="Cancelled",
        notes=f"Cancelled. Reason: {cancel_in.reason}"
    )
    db.add(history)

    # Notify the OTHER party
    # If the current user is the owner (client), notify the provider
    # If the current user is the provider, notify the owner
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    target_user_id = provider.user_id if booking.user_id == current_user.id else booking.user_id

    if target_user_id:
        # Link destination depends on who is being notified
        cancel_link = "/service/jobs" if booking.user_id == current_user.id else f"/user/bookings/{booking.id}"
        notif = Notification(
            user_id=target_user_id,
            title="Booking Cancelled",
            message=f"The booking for {booking.service_type} has been cancelled by the other party.",
            notification_type="URGENT",
            link=cancel_link
        )
        db.add(notif)

    db.commit()
    db.refresh(booking)
    return booking

@router.post("/{booking_id}/review", response_model=ReviewRead)
def create_review(
    booking_id: UUID,
    review_in: ReviewCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking or booking.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking not found or access denied")

    if booking.status != "Completed":
        raise HTTPException(status_code=400, detail="Cannot review incomplete booking")

    db_review = BookingReview(
        booking_id=booking_id,
        rating=review_in.rating,
        review_text=review_in.review_text,
        quality_rating=review_in.quality_rating,
        punctuality_rating=review_in.punctuality_rating,
        professionalism_rating=review_in.professionalism_rating
    )
    db.add(db_review)

    # Award feedback points — point engine recalculates rating and commits
    _review_provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == booking.provider_id
    ).first()
    if _review_provider:
        star = review_in.rating
        event_map = {5: "FEEDBACK_5_STAR", 4: "FEEDBACK_4_STAR",
                     3: "FEEDBACK_3_STAR", 2: "FEEDBACK_2_STAR", 1: "FEEDBACK_1_STAR"}
        feedback_event = event_map.get(star, "FEEDBACK_1_STAR")
        award_points(db, _review_provider.id, feedback_event, source_id=booking_id,
                     note=f"{star}-star review for {booking.service_type}")
        if review_in.review_text and review_in.review_text.strip():
            award_points(db, _review_provider.id, "REVIEW_WRITTEN", source_id=booking_id,
                         note="Written review bonus")
    else:
        db.commit()
    db.refresh(db_review)
    return db_review

@router.post("/{booking_id}/final-complete", response_model=BookingRead)
def final_complete_booking(
    booking_id: UUID,
    body: ChargeSubmitCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Servicer submits actual hours + charge amount. Booking → Pending Confirmation. User must confirm."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider or provider.id != booking.provider_id:
        raise HTTPException(status_code=403, detail="Only the assigned servicer can submit a charge")

    if booking.source_type == "emergency":
        raise HTTPException(status_code=400, detail="Emergency bookings use the emergency billing flow")

    if booking.status not in ("In Progress", "Accepted"):
        raise HTTPException(
            status_code=400,
            detail=f"Booking is '{booking.status}' — must be 'Accepted' or 'In Progress' to submit charge"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    booking.status = "Pending Confirmation"
    booking.actual_hours = body.actual_hours
    booking.final_cost = body.charge_amount
    booking.completion_notes = body.charge_description

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Pending Confirmation",
        notes=(
            f"Servicer submitted charge: {body.actual_hours}h × "
            f"\u20b9{body.charge_amount / body.actual_hours:.0f}/h"
            f" = \u20b9{body.charge_amount:.0f}."
            + (f" Note: {body.charge_description}" if body.charge_description else "")
            + " Awaiting user confirmation."
        ),
        timestamp=now,
    ))

    _notify_booking(
        db, user_id=booking.user_id,
        title="Charge Submitted \u2014 Please Confirm",
        message=(
            f"'{booking.service_type}': {body.actual_hours}h worked, "
            f"charge \u20b9{body.charge_amount:.0f}. Review and confirm."
        ),
        notification_type="URGENT",
        link=f"/user/bookings/{booking.id}",
    )

    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_id}/confirm", response_model=BookingRead)
def confirm_booking_complete(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User confirms the receipt — booking moves to Completed and points are awarded."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the booking's user can confirm")
    if booking.status != "Pending Confirmation":
        raise HTTPException(status_code=400, detail=f"Booking is '{booking.status}', must be 'Pending Confirmation' to confirm")

    booking.status = "Completed"
    booking.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Completed",
        notes="User confirmed receipt and payment.",
    ))

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    if provider:
        event = "URGENT_COMPLETE" if booking.priority in ("High", "Emergency") else "REGULAR_COMPLETE"
        try:
            award_points(db, provider_id=provider.id, event_type=event, source_id=booking.id)
        except Exception as exc:
            logger.warning("award_points failed for booking %s: %s", booking.id, exc)

        _notify_booking(
            db, user_id=provider.user_id,
            title="Payment Confirmed",
            message=f"User confirmed your receipt for '{booking.service_type}'. Job complete!",
            notification_type="SUCCESS",
            link="/service/jobs",
        )

    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_id}/reject-charge", response_model=BookingRead)
def reject_charge(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User rejects the submitted charge. Booking is cancelled and both parties are freed."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the booking's user can reject a charge")
    if booking.status != "Pending Confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Booking is '{booking.status}' \u2014 must be 'Pending Confirmation' to reject charge"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    booking.status = "Cancelled"

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Cancelled",
        notes="Charge rejected by user. Booking closed.",
        timestamp=now,
    ))

    # Note: no point deduction applied — the provider did not cancel,
    # the user rejected the charge. Provider availability is freed.
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    if provider:
        provider.availability_status = "AVAILABLE"
        if provider.user_id:
            _notify_booking(
                db, user_id=provider.user_id,
                title="Charge Rejected \u2014 Booking Closed",
                message=f"User rejected your charge for '{booking.service_type}'. Booking has been closed.",
                notification_type="INFO",
                link="/service/jobs",
            )

    db.commit()
    db.refresh(booking)
    return booking


@router.post("/{booking_id}/flag", response_model=ComplaintRead)
def flag_booking(
    booking_id: UUID,
    body: FlagCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User, servicer, or admin flags a booking as disputed. Creates a complaint and marks booking is_flagged=True."""
    from app.auth.domain.model import User as UserModel

    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    is_user = booking.user_id == current_user.id
    is_servicer = provider is not None and provider.id == booking.provider_id
    is_admin = current_user.role == "ADMIN"

    if not is_user and not is_servicer and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    if booking.status == "Cancelled":
        raise HTTPException(status_code=400, detail="Cannot flag a cancelled booking")
    if booking.is_flagged:
        raise HTTPException(status_code=409, detail="Booking is already flagged")

    booking.is_flagged = True

    complaint = BookingComplaint(
        booking_id=booking_id,
        filed_by=current_user.id,
        reason=body.flag_reason,
        status="OPEN",
    )
    db.add(complaint)
    db.flush()

    admins = db.query(UserModel).filter(UserModel.role == "ADMIN").all()
    for admin in admins:
        _notify_booking(
            db, user_id=admin.id,
            title="Booking Flagged",
            message=f"Booking '{booking.service_type}' has been flagged: {body.flag_reason[:80]}",
            notification_type="URGENT",
            link="/admin/bookings",
        )

    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/{booking_id}/receipt", response_model=ReceiptRead)
def get_receipt(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Fetch payment receipt for a completed booking."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in ("Completed", "Pending Confirmation"):
        raise HTTPException(status_code=400, detail="Receipt only available for completed or pending-confirmation bookings")

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    is_user = booking.user_id == current_user.id
    is_servicer = provider is not None and provider.id == booking.provider_id
    if not is_user and not is_servicer:
        raise HTTPException(status_code=403, detail="Access denied")

    booking_provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    provider_name = get_provider_display_name(booking_provider) if booking_provider else "Unknown"

    base_price = booking.estimated_cost or 0.0
    final_amount = booking.final_cost if booking.final_cost else base_price
    extra_charge = max(0.0, final_amount - base_price)
    extra_hours = booking.actual_hours or 0.0
    hourly_rate = (extra_charge / extra_hours) if extra_hours > 0 else 0.0

    return ReceiptRead(
        booking_id=booking.id,
        service_type=booking.service_type,
        servicer_name=provider_name,
        base_price=base_price,
        extra_hours=extra_hours,
        hourly_rate=hourly_rate,
        extra_charge=extra_charge,
        final_amount=final_amount,
        completed_at=booking.completed_at,
        negotiated=(booking.source_type == "negotiated"),
    )


@router.get("/{booking_id}/chat", response_model=List[ChatRead])
def get_chat(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Verify access...
    return db.query(BookingChat).filter(BookingChat.booking_id == booking_id).order_by(BookingChat.timestamp).all()

@router.post("/{booking_id}/chat/message", response_model=ChatRead)
def send_message(
    booking_id: UUID,
    message_in: ChatCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    db_message = BookingChat(
        booking_id=booking_id,
        sender_id=current_user.id,
        message=message_in.message
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


@router.post("/{booking_id}/complaint", response_model=ComplaintRead)
def file_complaint(
    booking_id: UUID,
    body: ComplaintCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User files a complaint about a completed booking."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    is_user = booking.user_id == current_user.id
    is_servicer = provider is not None and provider.id == booking.provider_id
    if not is_user and not is_servicer:
        raise HTTPException(status_code=403, detail="Only the booking's user or assigned servicer can file a complaint")
    if booking.status not in ("Completed", "Pending Confirmation"):
        raise HTTPException(status_code=400, detail="Can only file complaints on completed or pending-confirmation bookings")

    complaint = BookingComplaint(
        booking_id=booking_id,
        filed_by=current_user.id,
        reason=body.reason,
        status="OPEN",
    )
    db.add(complaint)
    db.flush()

    from app.auth.domain.model import User as UserModel
    admins = db.query(UserModel).filter(UserModel.role == "ADMIN").all()
    for admin in admins:
        _notify_booking(db, user_id=admin.id,
                        title="New Booking Complaint Filed",
                        message=f"Complaint filed for booking '{booking.service_type}' (#{str(booking.id)[:8]}). Review required.",
                        notification_type="WARNING",
                        link="/admin/bookings?tab=complaints")

    db.commit()
    db.refresh(complaint)
    return complaint

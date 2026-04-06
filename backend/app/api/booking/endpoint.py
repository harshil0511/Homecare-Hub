import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.internal import models, schemas, deps
from app.internal.services import (
    get_provider_display_name,
    ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS,
)
from app.internal.point_engine import award_points

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/create", response_model=schemas.BookingRead)
def create_booking(
    booking_in: schemas.BookingCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # Verify provider exists
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == booking_in.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Time-conflict check: reject if provider already has an active booking within ± window
    window_start = booking_in.scheduled_at - timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    window_end = booking_in.scheduled_at + timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    conflict = db.query(models.ServiceBooking).filter(
        models.ServiceBooking.provider_id == booking_in.provider_id,
        models.ServiceBooking.status.in_(["Pending", "Accepted", "In Progress"]),
        models.ServiceBooking.scheduled_at >= window_start,
        models.ServiceBooking.scheduled_at <= window_end
    ).first()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Expert is already booked around that time (conflict with booking at {conflict.scheduled_at.strftime('%b %d, %H:%M')}). Please choose a different time."
        )

    db_booking = models.ServiceBooking(
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
        task = db.query(models.MaintenanceTask).filter(
            models.MaintenanceTask.id == booking_in.task_id,
            models.MaintenanceTask.user_id == current_user.id,
            models.MaintenanceTask.booking_id == None
        ).first()
        if task:
            task.booking_id = db_booking.id
            task.service_provider_id = provider.id
            task.status = "Assigned"
            db.commit()
    
    # Add initial status history
    history = models.BookingStatusHistory(
        booking_id=db_booking.id,
        status="Pending",
        notes="Booking initialized by client"
    )
    db.add(history)
    
    # Trigger Notifications
    # 1. To Client
    user_notif = models.Notification(
        user_id=current_user.id,
        title="Booking Request Placed",
        message=f"Your request for {db_booking.service_type} has been initialized.",
        notification_type="INFO",
        link=f"/dashboard/bookings/{db_booking.id}"
    )
    db.add(user_notif)

    # 2. To Provider
    if provider.user_id:
        provider_notif = models.Notification(
            user_id=provider.user_id,
            title="Action Required: New Request",
            message=f"New {db_booking.service_type} request from {current_user.username}.",
            notification_type="URGENT",
            link=f"/dashboard/bookings/{db_booking.id}"
        )
        db.add(provider_notif)

    db.commit()
    return db_booking

@router.get("/list", response_model=List[schemas.BookingRead])
def list_bookings(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if current_user.role == "SERVICER" or current_user.role == "provider":
        profile = db.query(models.ServiceProvider).filter(models.ServiceProvider.user_id == current_user.id).first()
        if not profile:
            return []
        query = db.query(models.ServiceBooking).filter(models.ServiceBooking.provider_id == profile.id)
    else:
        query = db.query(models.ServiceBooking).filter(models.ServiceBooking.user_id == current_user.id)

    # Status filter: "contracted" = Accepted/In Progress/Completed, "pending" = Pending only
    if status == "contracted":
        query = query.filter(models.ServiceBooking.status.in_(["Accepted", "In Progress", "Completed"]))
    elif status == "pending":
        query = query.filter(models.ServiceBooking.status == "Pending")

    return query.order_by(models.ServiceBooking.created_at.desc()).all()

@router.get("/incoming", response_model=List[schemas.BookingRead])
def get_incoming_bookings(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return db.query(models.ServiceBooking).filter(models.ServiceBooking.provider_id == provider.id).all()

@router.patch("/{booking_id}/status", response_model=schemas.BookingRead)
def update_booking_status(
    booking_id: UUID,
    booking_update: schemas.BookingStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    booking = db.query(models.ServiceBooking).filter(models.ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == booking.provider_id).first()
    is_provider = provider and provider.user_id == current_user.id
    is_owner = booking.user_id == current_user.id

    if not is_provider and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to update this booking")

    old_status = booking.status
    new_status = booking_update.status

    if new_status != old_status:
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
        db.add(models.BookingStatusHistory(
            booking_id=booking.id,
            status=new_status,
            notes=f"Status changed from {old_status} to {new_status} by {'provider' if is_provider else 'client'}"
        ))

        # Emergency acceptance bonus: boost provider rating by 0.2 (capped at 5.0)
        if new_status == "Accepted" and booking.priority == "Emergency" and is_provider and provider:
            provider.rating = min(5.0, (provider.rating or 0) + 0.2)

        # Reset provider availability when booking is completed
        if new_status == "Completed" and provider:
            provider.availability_status = "AVAILABLE"

        # Notify the party that DID NOT make the change
        notif_link = f"/user/bookings/{booking.id}" if is_provider else f"/service/jobs"
        target_user_id = booking.user_id if is_provider else (provider.user_id if provider else None)

        if target_user_id:
            db.add(models.Notification(
                user_id=target_user_id,
                title=f"Booking {new_status}",
                message=f"Your booking for {booking.service_type} is now {new_status}.",
                notification_type="INFO",
                link=notif_link,
            ))

    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}", response_model=schemas.BookingDetailRead)
def get_booking(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    booking = db.query(models.ServiceBooking).filter(models.ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    # Check permissions (either the client or the provider)
    is_client = booking.user_id == current_user.id
    
    # Check if provider
    is_provider = False
    profile = db.query(models.ServiceProvider).filter(models.ServiceProvider.user_id == current_user.id).first()
    if profile and booking.provider_id == profile.id:
        is_provider = True
        
    if not is_client and not is_provider and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")
        
    return booking

@router.patch("/{booking_id}/reschedule", response_model=schemas.BookingRead)
def reschedule_booking(
    booking_id: UUID,
    reschedule_in: schemas.BookingReschedule,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    booking = db.query(models.ServiceBooking).filter(models.ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    # Only client or provider can reschedule
    # ... Simplified logic for now
    
    booking.scheduled_at = reschedule_in.new_date
    
    # If the booking was cancelled or completed, flip it back to Pending so it's active again
    if booking.status in ["Cancelled", "Completed"]:
        booking.status = "Pending"
    
    history = models.BookingStatusHistory(
        booking_id=booking.id,
        status=booking.status,
        notes=f"Rescheduled to {reschedule_in.new_date}. Status reset to {booking.status}."
    )
    db.add(history)
    
    # Notify the PROVIDER about the new schedule
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == booking.provider_id).first()
    if provider and provider.user_id:
        notif = models.Notification(
            user_id=provider.user_id,
            title="Schedule Updated & Re-opened",
            message=f"A booking for {booking.service_type} has been rescheduled to {reschedule_in.new_date} and is now active again.",
            notification_type="WARNING",
            link=f"/dashboard/bookings/{booking.id}"
        )
        db.add(notif)

    db.commit()
    db.refresh(booking)
    return booking

@router.patch("/{booking_id}/cancel", response_model=schemas.BookingRead)
def cancel_booking(
    booking_id: UUID,
    cancel_in: schemas.BookingCancel,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    booking = db.query(models.ServiceBooking).filter(models.ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking.status == "Cancelled":
         return booking # Already cancelled

    booking.status = "Cancelled"

    # Deduct points only if the PROVIDER is cancelling (not the user)
    _cancel_provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == booking.provider_id
    ).first()
    if _cancel_provider and _cancel_provider.user_id == current_user.id:
        priority = (booking.priority or "Normal").strip()
        cancel_event = "EMERGENCY_CANCEL" if priority == "Emergency" else "REGULAR_CANCEL"
        award_points(db, _cancel_provider.id, cancel_event, source_id=booking.id,
                     note=f"Cancelled by provider: {cancel_in.reason}")

    history = models.BookingStatusHistory(
        booking_id=booking.id,
        status="Cancelled",
        notes=f"Cancelled. Reason: {cancel_in.reason}"
    )
    db.add(history)
    
    # Notify the OTHER party
    # If the current user is the owner (client), notify the provider
    # If the current user is the provider, notify the owner
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == booking.provider_id).first()
    target_user_id = provider.user_id if booking.user_id == current_user.id else booking.user_id
    
    if target_user_id:
        notif = models.Notification(
            user_id=target_user_id,
            title="Booking Cancelled",
            message=f"The booking for {booking.service_type} has been cancelled by the other party.",
            notification_type="URGENT",
            link="/dashboard/bookings"
        )
        db.add(notif)

    db.commit()
    db.refresh(booking)
    return booking

@router.post("/{booking_id}/review", response_model=schemas.ReviewRead)
def create_review(
    booking_id: UUID,
    review_in: schemas.ReviewCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    booking = db.query(models.ServiceBooking).filter(models.ServiceBooking.id == booking_id).first()
    if not booking or booking.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking not found or access denied")
        
    if booking.status != "Completed":
        raise HTTPException(status_code=400, detail="Cannot review incomplete booking")
        
    db_review = models.BookingReview(
        booking_id=booking_id,
        rating=review_in.rating,
        review_text=review_in.review_text,
        quality_rating=review_in.quality_rating,
        punctuality_rating=review_in.punctuality_rating,
        professionalism_rating=review_in.professionalism_rating
    )
    db.add(db_review)
    
    # Award feedback points — point engine recalculates rating and commits
    _review_provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == booking.provider_id
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

@router.get("/{booking_id}/receipt", response_model=schemas.ReceiptRead)
def get_booking_receipt(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    booking = db.query(models.ServiceBooking).filter(models.ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    is_client = booking.user_id == current_user.id
    profile = db.query(models.ServiceProvider).filter(models.ServiceProvider.user_id == current_user.id).first()
    is_provider = profile and booking.provider_id == profile.id

    if not is_client and not is_provider and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")

    if booking.status != "Completed":
        raise HTTPException(status_code=400, detail="Receipt is only available for completed bookings")

    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == booking.provider_id
    ).first()
    provider_name = (
        (provider.company_name or provider.first_name or provider.owner_name or "Unknown")
        if provider else "Unknown"
    )

    return schemas.ReceiptRead(
        booking_id=booking.id,
        service_type=booking.service_type or "",
        status=booking.status,
        scheduled_at=booking.scheduled_at,
        estimated_cost=booking.estimated_cost or 0.0,
        final_cost=booking.final_cost if booking.final_cost else None,
        actual_hours=booking.actual_hours,
        completion_notes=booking.completion_notes,
        provider_name=provider_name,
        provider_id=booking.provider_id,
        user_id=booking.user_id,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
    )


@router.get("/{booking_id}/chat", response_model=List[schemas.ChatRead])
def get_chat(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # Verify access...
    return db.query(models.BookingChat).filter(models.BookingChat.booking_id == booking_id).order_by(models.BookingChat.timestamp).all()

@router.post("/{booking_id}/chat/message", response_model=schemas.ChatRead)
def send_message(
    booking_id: UUID,
    message_in: schemas.ChatCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    db_message = models.BookingChat(
        booking_id=booking_id,
        sender_id=current_user.id,
        message=message_in.message
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


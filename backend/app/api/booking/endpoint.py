from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.internal import models, schemas, deps
import datetime
from datetime import timedelta

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

    # Time-conflict check: reject if provider already has an active booking within ±3 hours
    window_start = booking_in.scheduled_at - timedelta(hours=3)
    window_end = booking_in.scheduled_at + timedelta(hours=3)
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
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    if current_user.role == "SERVICER" or current_user.role == "provider":
        # Get provider profile
        profile = db.query(models.ServiceProvider).filter(models.ServiceProvider.user_id == current_user.id).first()
        if not profile:
            return []
        return db.query(models.ServiceBooking).filter(models.ServiceBooking.provider_id == profile.id).all()
    
    return db.query(models.ServiceBooking).filter(models.ServiceBooking.user_id == current_user.id).all()

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
    booking_id: int,
    booking_update: schemas.BookingUpdate,
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

    # Added: Notify relevant party of status change if it actually changed
    old_status = getattr(booking, "status", None)
    
    update_data = booking_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(booking, field, value)

    if "status" in update_data and update_data["status"] != old_status:
        notif_title = f"Booking {update_data['status']}"
        notif_msg = f"Your project for {booking.service_type} is now {update_data['status']}."
        
        # Determine target: notify the party that DID NOT make the change
        # If provider updated it, notify user. If user updated it, notify provider.
        target_user_id = booking.user_id if is_provider else provider.user_id
        
        if target_user_id:
            new_notif = models.Notification(
                user_id=target_user_id,
                title=notif_title,
                message=notif_msg,
                notification_type="INFO",
                link=f"/dashboard/bookings/{booking.id}"
            )
            db.add(new_notif)

    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}", response_model=schemas.BookingDetailRead)
def get_booking(
    booking_id: int,
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
    booking_id: int,
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
    booking_id: int,
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
    booking_id: int,
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
    
    # Update provider rating
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == booking.provider_id).first()
    if provider:
        all_reviews = db.query(models.BookingReview).join(models.ServiceBooking).filter(models.ServiceBooking.provider_id == provider.id).all()
        ratings = [r.rating for r in all_reviews] + [review_in.rating]
        provider.rating = sum(ratings) / len(ratings)
        
    db.commit()
    db.refresh(db_review)
    return db_review

@router.get("/{booking_id}/chat", response_model=List[schemas.ChatRead])
def get_chat(
    booking_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    # Verify access...
    return db.query(models.BookingChat).filter(models.BookingChat.booking_id == booking_id).order_by(models.BookingChat.timestamp).all()

@router.post("/{booking_id}/chat/message", response_model=schemas.ChatRead)
def send_message(
    booking_id: int,
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

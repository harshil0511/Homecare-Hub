from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from app.internal import deps
from app.internal.models import (
    MaintenanceTask, User, Notification,
    ServiceProvider, ServiceBooking, BookingStatusHistory,
)
from app.internal.schemas import (
    TaskCreate, TaskResponse, MaintenanceTaskUpdate,
    RoutineTaskCreate, RoutineTaskResponse, RoutineTaskAssign,
    ProviderResponse
)
from app.internal.services import (
    find_verified_provider, get_provider_display_name,
    ROUTINE_CATEGORY_MAP, BOOKING_CONFLICT_WINDOW_HOURS,
)

router = APIRouter(tags=["Maintenance Tasks API"])

# ── Existing endpoints ──

@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    return db.query(MaintenanceTask).filter(MaintenanceTask.user_id == current_user.id).all()

@router.post("/", response_model=TaskResponse)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    db_task = MaintenanceTask(
        **task_in.model_dump(),
        user_id=current_user.id
    )
    db.add(db_task)

    # Trigger Notification
    notif = Notification(
        user_id=current_user.id,
        title="Task Initialized",
        message=f"New operation '{db_task.title}' has been committed to the ledger.",
        notification_type="INFO",
        link="/dashboard"
    )
    db.add(notif)

    db.commit()
    db.refresh(db_task)
    return db_task

@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    update_in: MaintenanceTaskUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if update_in.status is not None:
        task.status = update_in.status
    if update_in.completion_method is not None:
        task.completion_method = update_in.completion_method
        task.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if update_in.status is None and update_in.completion_method != "cancelled":
            task.status = "Completed"
    if update_in.task_type is not None:
        task.task_type = update_in.task_type

    db.commit()
    db.refresh(task)
    return task

# ── Routine Task endpoints ──

@router.post("/routine", response_model=RoutineTaskResponse)
def create_routine_task(
    task_in: RoutineTaskCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    db_task = MaintenanceTask(
        title=task_in.title,
        description=task_in.description,
        category=task_in.category,
        location=task_in.location,
        priority=task_in.priority,
        task_type="routine",
        due_date=None,
        user_id=current_user.id
    )
    db.add(db_task)
    db.flush()

    # Check if a verified expert is available for this category
    provider = find_verified_provider(
        db,
        category=task_in.category,
        location=task_in.location,
        society_id=current_user.society_id
    )

    has_verified_expert = provider is not None

    notif = Notification(
        user_id=current_user.id,
        title="Routine Service Created",
        message=(
            f"Routine request for '{db_task.title}' created. Verified experts available — assign from the request page."
            if has_verified_expert
            else f"Routine request for '{db_task.title}' created. No verified expert found — use Find Expert to search."
        ),
        notification_type="INFO",
        link="/dashboard/routine"
    )
    db.add(notif)

    db.commit()
    db.refresh(db_task)
    return db_task

@router.get("/routine", response_model=List[RoutineTaskResponse])
def get_routine_tasks(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    return (
        db.query(MaintenanceTask)
        .filter(
            MaintenanceTask.user_id == current_user.id,
            MaintenanceTask.task_type == "routine"
        )
        .order_by(MaintenanceTask.id.desc())
        .all()
    )

@router.get("/routine/{task_id}/providers", response_model=List[ProviderResponse])
def get_matching_providers(
    task_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Build category filter using mapping
    mapped_categories = ROUTINE_CATEGORY_MAP.get(task.category, [task.category])
    category_filters = []
    for cat in mapped_categories:
        category_filters.append(ServiceProvider.category == cat)
        category_filters.append(ServiceProvider.categories.like(f"%{cat}%"))

    query = db.query(ServiceProvider).filter(
        or_(*category_filters),
        ServiceProvider.availability_status == "AVAILABLE"
    )

    # Location filter
    if task.location:
        location_term = f"%{task.location}%"
        query = query.filter(ServiceProvider.location.ilike(location_term))

    # Society filtering
    if current_user.society_id:
        query = query.filter(
            (ServiceProvider.society_id == current_user.society_id) |
            (ServiceProvider.society_id == None)
        )

    return query.order_by(ServiceProvider.rating.desc()).all()

@router.post("/routine/{task_id}/assign", response_model=RoutineTaskResponse)
def assign_routine_provider(
    task_id: int,
    assign_in: RoutineTaskAssign,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Validate scheduled_at is in the future (strip tz info for naive comparison if needed)
    now_utc = datetime.now(timezone.utc)
    scheduled = assign_in.scheduled_at
    # Normalise to offset-aware for comparison
    if scheduled.tzinfo is None:
        scheduled = scheduled.replace(tzinfo=timezone.utc)
    if scheduled <= now_utc:
        raise HTTPException(status_code=400, detail="scheduled_at must be a future date and time")

    # Validate task — use SELECT FOR UPDATE to prevent double-assignment race condition
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id
    ).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.booking_id:
        raise HTTPException(status_code=400, detail="Task already has an assigned provider")

    # Validate provider
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == assign_in.provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Time-conflict check: reject if provider already has an active booking within ± window
    # Use the normalised aware datetime for consistent arithmetic
    window_start = scheduled - timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    window_end = scheduled + timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    conflict = db.query(ServiceBooking).filter(
        ServiceBooking.provider_id == assign_in.provider_id,
        ServiceBooking.status.in_(["Pending", "Accepted", "In Progress"]),
        ServiceBooking.scheduled_at >= window_start,
        ServiceBooking.scheduled_at <= window_end
    ).first()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="Provider has a conflicting booking near this time. Please choose a different time."
        )

    # Create ServiceBooking as Pending request (not direct assignment)
    booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=provider.id,
        service_type=task.category or "General",
        issue_description=f"{task.title}: {task.description}" if task.description else task.title,
        scheduled_at=scheduled,
        priority=task.priority,
        property_details=task.location,
        estimated_cost=provider.hourly_rate or 0.0,
        source_type="alert",
        source_id=task.id,
    )
    db.add(booking)
    db.flush()

    # Status history
    history = BookingStatusHistory(
        booking_id=booking.id,
        status="Pending",
        notes="Service request sent — awaiting provider acceptance"
    )
    db.add(history)

    # Link task to booking
    task.booking_id = booking.id
    task.service_provider_id = provider.id
    task.status = "Assigned"
    task.completion_method = "booked"

    # Notify user: request sent
    provider_name = get_provider_display_name(provider)
    user_notif = Notification(
        user_id=current_user.id,
        title="Request Sent",
        message=f"Service request for '{task.title}' sent to '{provider_name}'. Awaiting their response.",
        notification_type="INFO",
        link=f"/dashboard/bookings/{booking.id}"
    )
    db.add(user_notif)

    # Notify provider: new request to accept/reject
    if provider.user_id:
        provider_notif = Notification(
            user_id=provider.user_id,
            title="New Service Request",
            message=f"New {task.category} request from {current_user.username} scheduled for {scheduled.strftime('%d %b %Y at %H:%M')}. Accept or reject.",
            notification_type="URGENT",
            link=f"/dashboard/bookings/{booking.id}"
        )
        db.add(provider_notif)

    db.commit()
    db.refresh(task)
    return task

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from datetime import datetime
from app.internal import deps
from app.internal.models import (
    MaintenanceTask, User, Notification,
    ServiceProvider, ServiceBooking, BookingStatusHistory
)
from app.internal.schemas import (
    TaskCreate, TaskResponse,
    RoutineTaskCreate, RoutineTaskResponse, RoutineTaskAssign,
    ProviderResponse
)

router = APIRouter(tags=["Maintenance Tasks API"])

# Category mapping: routine category -> provider categories to search
ROUTINE_CATEGORY_MAP = {
    "AC Service": ["HVAC", "Air Conditioning", "AC Service"],
    "Appliance Repair": ["Appliance Repair", "Electrical", "General"],
    "Home Cleaning": ["Cleaning", "Home Cleaning"],
    "Plumbing": ["Plumbing"],
    "Electrical": ["Electrical"],
    "Pest Control": ["Pest Control"],
    "Painting": ["Painting"],
    "Carpentry": ["Carpentry"],
    "General Maintenance": ["General", "General Maintenance"],
}

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

    notif = Notification(
        user_id=current_user.id,
        title="Routine Service Created",
        message=f"Routine request for '{db_task.title}' has been created. Find an expert to assign.",
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
        MaintenanceTask.user_id == current_user.id,
        MaintenanceTask.task_type == "routine"
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Routine task not found")

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
    # Validate task
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id,
        MaintenanceTask.task_type == "routine"
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Routine task not found")
    if task.booking_id:
        raise HTTPException(status_code=400, detail="Task already has an assigned provider")

    # Validate provider
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == assign_in.provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Create ServiceBooking
    booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=provider.id,
        service_type=task.category or "General",
        issue_description=f"{task.title}: {task.description}" if task.description else task.title,
        scheduled_at=datetime.utcnow(),
        priority=task.priority,
        property_details=task.location,
        estimated_cost=provider.hourly_rate or 0.0
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Status history
    history = BookingStatusHistory(
        booking_id=booking.id,
        status="Pending",
        notes="Routine service request — awaiting provider acceptance"
    )
    db.add(history)

    # Link task to booking
    task.booking_id = booking.id
    task.service_provider_id = provider.id
    task.status = "Assigned"

    # Notifications
    user_notif = Notification(
        user_id=current_user.id,
        title="Expert Assigned",
        message=f"Provider '{provider.company_name}' has been assigned to your routine request for '{task.title}'.",
        notification_type="INFO",
        link=f"/dashboard/bookings/{booking.id}"
    )
    db.add(user_notif)

    if provider.user_id:
        provider_notif = Notification(
            user_id=provider.user_id,
            title="Action Required: New Request",
            message=f"New routine {task.category} request from {current_user.username}.",
            notification_type="URGENT",
            link=f"/dashboard/bookings/{booking.id}"
        )
        db.add(provider_notif)

    db.commit()
    db.refresh(task)
    return task

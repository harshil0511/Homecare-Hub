from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, date
from uuid import UUID
from app.common import deps
from app.auth.domain.model import User
from app.maintenance.domain.model import MaintenanceTask
from app.notification.domain.model import Notification
from app.api.maintenance.schemas import (
    TaskCreate, TaskResponse, MaintenanceTaskUpdate,
    UserAlertCreate, UserAlertUpdate, UserAlertResponse,
)

router = APIRouter(tags=["Maintenance Tasks API"])

VALID_TASK_TRANSITIONS: dict[str, list[str]] = {
    "Pending":   ["Assigned", "Completed"],
    "Active":    ["Completed", "Cancelled"],
    "Assigned":  ["Completed"],
    "Triggered": ["Completed", "Cancelled"],
    "Overdue":   ["Completed", "Cancelled"],
    "Expired":   [],
    "Completed": [],
    "Cancelled": [],
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

@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: UUID,
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
        allowed = VALID_TASK_TRANSITIONS.get(task.status, [])
        if update_in.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change status from '{task.status}' to '{update_in.status}'."
            )
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


# ── User Alert endpoints ───────────────────────────────────────────────────────

@router.get("/alerts/", response_model=List[UserAlertResponse])
def list_alerts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    return (
        db.query(MaintenanceTask)
        .filter(
            MaintenanceTask.user_id == current_user.id,
            MaintenanceTask.task_type == "user_alert",
        )
        .order_by(MaintenanceTask.due_date.asc())
        .all()
    )


@router.post("/alerts/", response_model=UserAlertResponse)
def create_alert(
    alert_in: UserAlertCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    db_alert = MaintenanceTask(
        title=alert_in.service_type,
        description=alert_in.description,
        due_date=alert_in.due_date,
        due_time=alert_in.due_time,
        status="Active",
        task_type="user_alert",
        category=alert_in.service_type,
        user_id=current_user.id,
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.patch("/alerts/{alert_id}", response_model=UserAlertResponse)
def update_alert(
    alert_id: UUID,
    update_in: UserAlertUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    alert = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == alert_id,
        MaintenanceTask.user_id == current_user.id,
        MaintenanceTask.task_type == "user_alert",
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if update_in.service_type is not None:
        alert.title = update_in.service_type
        alert.category = update_in.service_type
    if update_in.description is not None:
        alert.description = update_in.description
    if update_in.due_date is not None:
        alert.due_date = update_in.due_date
        alert.due_time = update_in.due_time  # sync time with date (None clears it)
        # Reset notification flags so scheduler fires again at new dates
        alert.warning_sent = False
        alert.final_sent = False
        alert.overdue_sent = False
    if update_in.status == "Completed":
        if alert.due_date and alert.due_date > date.today():
            raise HTTPException(
                status_code=400,
                detail="Cannot mark done before target date"
            )
        alert.status = "Completed"
        alert.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    elif update_in.status == "Cancelled":
        alert.status = "Cancelled"

    db.commit()
    db.refresh(alert)
    return alert


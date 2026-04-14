from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from uuid import UUID
from app.common import deps
from app.auth.domain.model import User
from app.maintenance.domain.model import MaintenanceTask
from app.notification.domain.model import Notification
from app.api.maintenance.schemas import (
    TaskCreate, TaskResponse, MaintenanceTaskUpdate,
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


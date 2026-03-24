from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.internal import deps
from app.internal.models import MaintenanceTask, User, Notification
from app.internal.schemas import TaskCreate, TaskResponse

router = APIRouter(tags=["Maintenance Tasks API"])

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

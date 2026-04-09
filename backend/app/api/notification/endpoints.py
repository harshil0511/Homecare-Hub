from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.common import deps
from app.auth.domain.model import User
from app.notification.domain.model import Notification
from app.api.notification.schemas import NotificationResponse, NotificationUpdate

router = APIRouter(tags=["Notifications API"])

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    return db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()

@router.patch("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: UUID,
    notification_in: NotificationUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = notification_in.is_read
    db.commit()
    db.refresh(notification)
    return notification

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()
    return {"detail": "Notification deleted"}

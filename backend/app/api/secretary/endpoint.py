from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.internal import deps
from app.internal.models import User, Society, MaintenanceTask, ServiceProvider
from app.internal.schemas import SocietyResponse, SocietyUpdate, UserResponse

router = APIRouter(tags=["Secretary API"])

def get_secretary_society(current_user: User, db: Session) -> Society:
    """Get the society this secretary manages."""
    if not current_user.society_id:
        raise HTTPException(status_code=404, detail="No society assigned to this secretary.")
    society = db.query(Society).filter(Society.id == current_user.society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found.")
    return society


@router.get("/society", response_model=SocietyResponse)
def get_my_society(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get the society this secretary is assigned to."""
    deps.RoleChecker(["SECRETARY"])(current_user)
    return get_secretary_society(current_user, db)


@router.patch("/society", response_model=SocietyResponse)
def update_my_society(
    society_in: SocietyUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Update society details."""
    deps.RoleChecker(["SECRETARY"])(current_user)
    society = get_secretary_society(current_user, db)
    for field, value in society_in.model_dump(exclude_unset=True).items():
        setattr(society, field, value)
    db.commit()
    db.refresh(society)
    return society


@router.get("/members")
def get_society_members(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get all home users in the secretary's society."""
    deps.RoleChecker(["SECRETARY"])(current_user)
    society = get_secretary_society(current_user, db)
    members = db.query(User).filter(
        User.society_id == society.id,
        User.role == "USER"
    ).all()
    return [{"id": m.id, "username": m.username, "email": m.email, "is_active": m.is_active} for m in members]


@router.get("/alerts")
def get_society_alerts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get maintenance tasks from all society members."""
    deps.RoleChecker(["SECRETARY"])(current_user)
    society = get_secretary_society(current_user, db)
    member_ids = [u.id for u in db.query(User).filter(
        User.society_id == society.id,
        User.role == "USER"
    ).all()]
    if not member_ids:
        return []
    tasks = db.query(MaintenanceTask).filter(
        MaintenanceTask.user_id.in_(member_ids)
    ).order_by(MaintenanceTask.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "created_at": str(t.created_at),
            "user_id": t.user_id
        }
        for t in tasks
    ]


@router.get("/providers")
def get_society_providers(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Get trusted service providers for the society."""
    deps.RoleChecker(["SECRETARY"])(current_user)
    society = get_secretary_society(current_user, db)
    return [
        {
            "id": p.id,
            "company_name": p.company_name,
            "category": p.category,
            "rating": p.rating,
            "availability_status": p.availability_status,
            "phone": p.phone
        }
        for p in society.trusted_providers
    ]

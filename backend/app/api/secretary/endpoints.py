from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
from app.common import deps
from app.auth.domain.model import User, Society
from app.maintenance.domain.model import MaintenanceTask
from app.service.domain.model import ServiceProvider, SocietyRequest
from app.secretary.domain.model import SecretaryComplaint
from app.notification.domain.model import Notification
from app.api.auth.schemas import UserResponse
from app.api.service.schemas import SocietyResponse, SocietyUpdate, ProviderResponse, SocietyRequestResponse, SocietyRequestAction
from app.api.secretary.schemas import HomeAssign, SecretaryComplaintCreate, SecretaryComplaintRead


router = APIRouter(tags=["Secretary API"])

secretary_only = deps.RoleChecker(["SECRETARY"])


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
    current_user: User = Depends(secretary_only)
):
    """Get the society this secretary is assigned to."""
    return get_secretary_society(current_user, db)


@router.patch("/society", response_model=SocietyResponse)
def update_my_society(
    society_in: SocietyUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only)
):
    """Update society details."""
    society = get_secretary_society(current_user, db)
    for field, value in society_in.model_dump(exclude_unset=True).items():
        setattr(society, field, value)
    db.commit()
    db.refresh(society)
    return society


@router.get("/members")
def get_society_members(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only)
):
    """Get all home users in the secretary's society."""
    society = get_secretary_society(current_user, db)
    members = db.query(User).filter(
        User.society_id == society.id,
        User.role == "USER"
    ).all()
    return [
        {
            "id": m.id,
            "username": m.username,
            "email": m.email,
            "is_active": m.is_active,
            "home_number": m.home_number,
            "resident_name": m.resident_name,
        }
        for m in members
    ]


@router.get("/alerts")
def get_society_alerts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only)
):
    """Get maintenance tasks from all society members."""
    tasks = (
        db.query(MaintenanceTask)
        .join(User, User.id == MaintenanceTask.user_id)
        .filter(User.society_id == current_user.society_id, User.role == "USER")
        .order_by(MaintenanceTask.created_at.desc())
        .all()
    )
    return [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "user_id": t.user_id
        }
        for t in tasks
    ]


@router.get("/providers")
def get_society_providers(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only)
):
    """Get trusted service providers for the society."""
    society = get_secretary_society(current_user, db)
    sorted_providers = sorted(society.trusted_providers, key=lambda p: p.rating or 0, reverse=True)
    return [
        {
            "id": p.id,
            "company_name": p.company_name,
            "category": p.category,
            "rating": p.rating,
            "availability_status": p.availability_status,
            "phone": p.phone,
            "is_verified": p.is_verified
        }
        for p in sorted_providers
    ]


@router.patch("/members/{member_id}/home")
def assign_home_to_member(
    member_id: UUID,
    data: HomeAssign,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only)
):
    """Assign a home number and resident name to a society member."""
    society = get_secretary_society(current_user, db)
    member = db.query(User).filter(
        User.id == member_id,
        User.society_id == society.id,
        User.role == "USER"
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in your society.")
    member.home_number = data.home_number
    member.resident_name = data.resident_name
    db.commit()
    db.refresh(member)
    return {
        "id": member.id,
        "username": member.username,
        "email": member.email,
        "is_active": member.is_active,
        "home_number": member.home_number,
        "resident_name": member.resident_name,
    }


@router.post("/complaints", response_model=SecretaryComplaintRead)
def file_secretary_complaint(
    body: SecretaryComplaintCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    """Secretary files a general complaint to admin."""
    society = get_secretary_society(current_user, db)

    complaint = SecretaryComplaint(
        society_id=society.id,
        filed_by=current_user.id,
        subject=body.subject,
        description=body.description,
        status="OPEN",
    )
    db.add(complaint)
    db.flush()

    admins = db.query(User).filter(User.role == "ADMIN").all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id,
            title="Secretary Report Filed",
            message=f"Secretary complaint: {body.subject}",
            notification_type="WARNING",
            link="/admin/bookings?tab=secretary-reports",
        ))

    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/complaints", response_model=List[SecretaryComplaintRead])
def list_secretary_complaints(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    """Secretary lists their own filed complaints."""
    return (
        db.query(SecretaryComplaint)
        .filter(SecretaryComplaint.filed_by == current_user.id)
        .order_by(SecretaryComplaint.created_at.desc())
        .all()
    )

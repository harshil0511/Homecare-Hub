from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.internal import deps
from app.internal.models import User, ServiceProvider, ServiceBooking, MaintenanceTask
from app.internal.schemas import UserResponse

router = APIRouter(tags=["Admin API"])

# All routes are protected — only ADMIN role can access them
admin_only = deps.RoleChecker(["ADMIN"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Overview numbers for the Admin dashboard cards."""
    return {
        "total_users": db.query(User).filter(User.role == "USER").count(),
        "total_servicers": db.query(User).filter(User.role == "SERVICER").count(),
        "total_bookings": db.query(ServiceBooking).count(),
        "total_tasks": db.query(MaintenanceTask).count(),
        "pending_verifications": db.query(ServiceProvider).filter(ServiceProvider.is_verified == False).count(),
    }


@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """List all registered users (all roles)."""
    return db.query(User).order_by(User.id.desc()).all()


@router.patch("/users/{user_uuid}/role")
def change_user_role(
    user_uuid: str,
    new_role: str,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Change a user's role. Allowed values: USER, SERVICER, ADMIN."""
    if new_role not in ["USER", "SERVICER", "ADMIN"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be USER, SERVICER, or ADMIN.")

    user = db.query(User).filter(User.user_uuid == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.role = new_role
    db.commit()
    return {"message": f"Role updated to {new_role} for {user.email}"}


@router.patch("/users/{user_uuid}/activate")
def toggle_user_active(
    user_uuid: str,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Toggle a user's is_active status (enable/disable account)."""
    user = db.query(User).filter(User.user_uuid == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = not user.is_active
    db.commit()
    status_text = "activated" if user.is_active else "deactivated"
    return {"message": f"Account {status_text} for {user.email}", "is_active": user.is_active}


@router.get("/providers/pending")
def get_pending_providers(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """List all service providers that are not yet verified."""
    providers = db.query(ServiceProvider).filter(ServiceProvider.is_verified == False).all()
    return [
        {
            "id": p.id,
            "company_name": p.company_name,
            "owner_name": p.owner_name,
            "category": p.category,
            "email": p.email,
            "phone": p.phone,
        }
        for p in providers
    ]


@router.patch("/providers/{provider_id}/verify")
def verify_provider(
    provider_id: int,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Mark a service provider as verified."""
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    provider.is_verified = True
    db.commit()
    return {"message": f"Provider '{provider.company_name}' is now verified."}

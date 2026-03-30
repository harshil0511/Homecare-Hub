from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
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
        "total_users": db.query(User).count(),
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
    """Change a user's role. Allowed: USER, SERVICER, ADMIN, SECRETARY."""
    if new_role not in ["USER", "SERVICER", "ADMIN", "SECRETARY"]:
        raise HTTPException(status_code=400, detail="Invalid role.")

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
    """Toggle a user's is_active status."""
    user = db.query(User).filter(User.user_uuid == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = not user.is_active
    db.commit()
    return {"message": f"Account {'activated' if user.is_active else 'deactivated'}", "is_active": user.is_active}


@router.delete("/users/{user_uuid}")
def delete_user(
    user_uuid: str,
    db: Session = Depends(deps.get_db),
    current_admin: User = Depends(admin_only)
):
    """Permanently delete a user account."""
    if current_admin.user_uuid == user_uuid:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account.")

    user = db.query(User).filter(User.user_uuid == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    db.delete(user)
    db.commit()
    return {"message": f"Account for {user.email} permanently deleted."}


@router.get("/bookings")
def get_all_bookings(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """List all bookings in the system."""
    bookings = db.query(ServiceBooking).order_by(ServiceBooking.id.desc()).all()
    return [
        {
            "id": b.id,
            "user_id": b.user_id,
            "provider_id": b.provider_id,
            "service_type": b.service_type,
            "status": b.status,
            "priority": b.priority,
            "scheduled_at": b.scheduled_at.isoformat() if b.scheduled_at else None,
            "estimated_cost": b.estimated_cost,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in bookings
    ]


@router.get("/providers")
def get_all_providers(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """List all service providers."""
    providers = db.query(ServiceProvider).order_by(ServiceProvider.id.desc()).all()
    return [
        {
            "id": p.id,
            "company_name": p.company_name,
            "owner_name": p.owner_name,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "category": p.category,
            "email": p.email,
            "phone": p.phone,
            "rating": p.rating,
            "is_verified": p.is_verified,
            "availability_status": p.availability_status,
        }
        for p in providers
    ]


@router.get("/providers/pending")
def get_pending_providers(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """List all unverified service providers."""
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


@router.get("/contracts")
def get_all_contracts(
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """List all service bookings with optional filters. Used as the admin contracts view."""
    query = db.query(ServiceBooking)

    if status and status != "ALL":
        query = query.filter(ServiceBooking.status == status)
    if date_from:
        query = query.filter(ServiceBooking.scheduled_at >= date_from)
    if date_to:
        query = query.filter(ServiceBooking.scheduled_at <= date_to)
    if min_amount is not None:
        query = query.filter(ServiceBooking.estimated_cost >= min_amount)
    if max_amount is not None:
        query = query.filter(ServiceBooking.estimated_cost <= max_amount)

    bookings = query.order_by(ServiceBooking.id.desc()).all()

    # Batch load users and providers
    from app.internal.models import User as UserModel, ServiceProvider
    user_ids = list({b.user_id for b in bookings if b.user_id})
    provider_ids = list({b.provider_id for b in bookings if b.provider_id})

    users_map = {}
    if user_ids:
        users = db.query(UserModel).filter(UserModel.id.in_(user_ids)).all()
        users_map = {u.id: u for u in users}

    providers_map = {}
    if provider_ids:
        providers = db.query(ServiceProvider).filter(
            ServiceProvider.id.in_(provider_ids)
        ).all()
        providers_map = {p.id: p for p in providers}

    result = []
    for b in bookings:
        user = users_map.get(b.user_id)
        provider = providers_map.get(b.provider_id)
        pname = ""
        if provider:
            pname = f"{provider.first_name or ''} {provider.last_name or ''}".strip() or provider.company_name or "Unknown"
        result.append({
            "id": b.id,
            "user_name": user.username if user else "Unknown",
            "servicer_name": pname if pname else "Unknown",
            "service_type": b.service_type,
            "scheduled_at": b.scheduled_at.isoformat() if b.scheduled_at else None,
            "estimated_cost": b.estimated_cost,
            "status": b.status,
            "created_at": b.created_at.isoformat() if hasattr(b, 'created_at') and b.created_at else None,
        })

    return result


@router.get("/logs")
def get_activity_logs(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Recent system activity: latest bookings and maintenance tasks."""
    bookings = db.query(ServiceBooking).order_by(ServiceBooking.id.desc()).limit(20).all()
    tasks = db.query(MaintenanceTask).order_by(MaintenanceTask.id.desc()).limit(20).all()

    logs = []
    for b in bookings:
        logs.append({
            "type": "BOOKING",
            "id": b.id,
            "description": f"Booking #{b.id} — {b.service_type or 'Service'} [{b.status}]",
            "status": b.status,
            "user_id": b.user_id,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    for t in tasks:
        logs.append({
            "type": "TASK",
            "id": t.id,
            "description": f"Task: {t.title} [{t.status}]",
            "status": t.status,
            "user_id": t.user_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    logs.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return logs[:30]

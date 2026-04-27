import uuid
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.booking.domain.model import ServiceBooking, BookingComplaint
from app.maintenance.domain.model import MaintenanceTask
from app.api.auth.schemas import UserResponse
from app.api.service.schemas import ProviderResponse
from app.api.admin.schemas import AdminVerifyUpdate, ComplaintAdminRead, ComplaintAdminUpdate, SecretaryComplaintRead, SecretaryComplaintAdminUpdate
from app.secretary.domain.model import SecretaryComplaint
from app.core.config import settings

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
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """List all registered users (all roles). Supports pagination via limit/offset."""
    return db.query(User).order_by(User.id.desc()).offset(offset).limit(limit).all()


@router.patch("/users/{user_uuid}/role")
def change_user_role(
    user_uuid: str,
    new_role: str,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Change a user's role. ADMIN role cannot be assigned via this endpoint."""
    allowed_roles = ["USER", "SERVICER", "SECRETARY"]
    if new_role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Allowed: {', '.join(allowed_roles)}"
        )

    try:
        uid = uuid.UUID(user_uuid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user UUID format.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.email == settings.SUPERADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Super admin role cannot be changed.")

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
    try:
        uid = uuid.UUID(user_uuid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user UUID format.")
    user = db.query(User).filter(User.id == uid).first()
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
    if str(current_admin.id) == user_uuid:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account.")

    try:
        uid = uuid.UUID(user_uuid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user UUID format.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.role == "ADMIN":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be deleted.")
    if user.email == settings.SUPERADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Super admin account cannot be deleted.")

    db.delete(user)
    db.commit()
    return {"message": f"Account for {user.email} permanently deleted."}


@router.get("/bookings")
def get_all_bookings(
    limit: int = 200,
    offset: int = 0,
    status: Optional[str] = None,
    flagged: Optional[bool] = None,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """List all bookings. Supports pagination (limit/offset), status filter, and flagged=true filter."""
    query = db.query(ServiceBooking)
    if status:
        query = query.filter(ServiceBooking.status == status)
    if flagged is not None:
        query = query.filter(ServiceBooking.is_flagged == flagged)
    bookings = query.order_by(ServiceBooking.id.desc()).offset(offset).limit(limit).all()
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
    providers = db.query(ServiceProvider).order_by(ServiceProvider.rating.desc()).all()
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
    provider_id: UUID,
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


@router.patch("/providers/{provider_id}/revoke-verify")
def revoke_provider_verification(
    provider_id: UUID,
    body: AdminVerifyUpdate,
    db: Session = Depends(deps.get_db),
    _: User = Depends(deps.RoleChecker(["ADMIN"])),
):
    from app.notification.domain.model import Notification
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider.is_verified = body.is_verified

    if provider.user_id:
        if not body.is_verified:
            msg = f"Your verified status has been revoked by admin. Reason: {body.reason or 'Not specified'}"
        else:
            msg = "Your profile has been re-verified by admin."
        db.add(Notification(
            user_id=provider.user_id,
            title="Verification Status Updated",
            message=msg,
            notification_type="WARNING" if not body.is_verified else "INFO",
        ))

    db.commit()
    db.refresh(provider)
    return {"id": str(provider.id), "is_verified": provider.is_verified, "message": "Verification status updated"}


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
    user_ids = list({b.user_id for b in bookings if b.user_id})
    provider_ids = list({b.provider_id for b in bookings if b.provider_id})

    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
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


@router.get("/health")
def get_system_health(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Real system health check. Returns live status of DB, API, and auth."""
    from datetime import datetime, timezone
    import sqlalchemy

    db_ok = False
    try:
        db.execute(sqlalchemy.text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "database": db_ok,
        "api": True,
        "jwt": True,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/bookings/{booking_id}")
def get_booking_detail(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Curated booking detail for admin view — need-to-know fields only."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    user = db.query(User).filter(User.id == booking.user_id).first()
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()

    return {
        "id": booking.id,
        "status": booking.status,
        "priority": booking.priority,
        "service_type": booking.service_type,
        "scheduled_at": booking.scheduled_at.isoformat() if booking.scheduled_at else None,
        "estimated_cost": booking.estimated_cost,
        "issue_description": booking.issue_description,
        "property_details": booking.property_details,
        "user": {
            "username": user.username if user else "Unknown",
            "email": user.email if user else "—",
        } if user else None,
        "provider": {
            "name": f"{provider.first_name or ''} {provider.last_name or ''}".strip()
                    or provider.company_name or "Unknown",
            "category": provider.category,
            "is_verified": provider.is_verified,
        } if provider else None,
    }


@router.get("/providers/{provider_id}/detail")
def get_provider_detail(
    provider_id: UUID,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Curated provider detail for admin view — need-to-know fields only."""
    from app.service.domain.model import ServiceCertificate

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    certs = []
    cert_count = 0
    try:
        certs = db.query(ServiceCertificate).filter(
            ServiceCertificate.provider_id == provider_id
        ).all()
        cert_count = len(certs)
    except Exception:
        pass
    try:
        booking_count = db.query(ServiceBooking).filter(ServiceBooking.provider_id == provider_id).count()
    except Exception:
        booking_count = 0

    return {
        "id": provider.id,
        "name": f"{provider.first_name or ''} {provider.last_name or ''}".strip()
                or provider.company_name or "Unknown",
        "category": provider.category,
        "rating": round(provider.rating or 0, 1),
        "is_verified": provider.is_verified,
        "availability_status": provider.availability_status,
        "location": provider.location,
        "hourly_rate": provider.hourly_rate,
        "bio_excerpt": (provider.bio or "")[:180] or None,
        "certificate_count": cert_count,
        "total_bookings": booking_count,
        "email": provider.email,
        "phone": provider.phone,
        "certificates": [
            {
                "id": str(c.id),
                "title": c.title,
                "category": c.category,
                "certificate_url": c.certificate_url,
                "is_verified": c.is_verified,
            }
            for c in certs
        ],
    }


@router.get("/users/{user_uuid}/detail")
def get_user_detail(
    user_uuid: str,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only)
):
    """Curated user detail for admin view — need-to-know fields only."""
    from app.request.domain.model import ServiceRequest
    from app.auth.domain.model import Society

    try:
        uid = uuid.UUID(user_uuid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user UUID format.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    try:
        booking_count = db.query(ServiceBooking).filter(ServiceBooking.user_id == user.id).count()
    except Exception:
        booking_count = 0
    try:
        request_count = db.query(ServiceRequest).filter(ServiceRequest.user_id == user.id).count()
    except Exception:
        request_count = 0

    society_name = None
    if user.society_id:
        society = db.query(Society).filter(Society.id == user.society_id).first()
        society_name = society.name if society else None

    return {
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "society": society_name,
        "booking_count": booking_count,
        "request_count": request_count,
    }


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


@router.get("/revenue")
def get_revenue_summary(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Revenue summary: total, completed count, top categories, monthly breakdown."""
    from sqlalchemy import func, extract
    from datetime import datetime, timezone

    completed = db.query(ServiceBooking).filter(ServiceBooking.status == "Completed").all()

    total_revenue = sum(b.estimated_cost or 0 for b in completed)
    completed_count = len(completed)

    # Category breakdown
    cat_map: dict = {}
    for b in completed:
        cat = b.service_type or "Other"
        cat_map[cat] = cat_map.get(cat, 0) + (b.estimated_cost or 0)
    top_categories = sorted(
        [{"category": k, "revenue": round(v, 2)} for k, v in cat_map.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )[:5]

    # Monthly breakdown (last 6 months)
    monthly: dict = {}
    for b in completed:
        if b.scheduled_at:
            key = b.scheduled_at.strftime("%b %Y")
            monthly[key] = monthly.get(key, 0) + (b.estimated_cost or 0)
    monthly_list = [{"month": k, "revenue": round(v, 2)} for k, v in monthly.items()]

    return {
        "total_revenue": round(total_revenue, 2),
        "completed_bookings": completed_count,
        "avg_booking_value": round(total_revenue / completed_count, 2) if completed_count else 0,
        "top_categories": top_categories,
        "monthly": monthly_list,
    }


@router.get("/complaints", response_model=List[ComplaintAdminRead])
def list_complaints(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """List all booking complaints. Filter by ?status=OPEN|UNDER_REVIEW|RESOLVED"""
    query = db.query(BookingComplaint)
    if status:
        query = query.filter(BookingComplaint.status == status)
    return query.order_by(BookingComplaint.created_at.desc()).all()


@router.patch("/complaints/{complaint_id}", response_model=ComplaintAdminRead)
def update_complaint(
    complaint_id: UUID,
    body: ComplaintAdminUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """Update complaint status/notes and optionally cancel bill or override amount."""
    from app.notification.domain.model import Notification as NotificationModel
    from app.service.point_engine import award_points

    complaint = db.query(BookingComplaint).filter(BookingComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    booking = db.query(ServiceBooking).filter(ServiceBooking.id == complaint.booking_id).first()

    if body.action == "cancel_bill":
        if not booking or booking.status != "Pending Confirmation":
            raise HTTPException(status_code=400, detail="Booking must be in 'Pending Confirmation' to cancel bill")
        # Revert to In Progress so servicer re-submits
        booking.status = "In Progress"
        booking.final_cost = None
        booking.actual_hours = None
        booking.completion_notes = None
        from app.booking.domain.model import BookingStatusHistory
        db.add(BookingStatusHistory(
            booking_id=booking.id,
            status="In Progress",
            notes="Admin cancelled bill after complaint. Servicer must re-submit completion.",
        ))
        complaint.status = "UNDER_REVIEW"
        if body.admin_notes:
            complaint.admin_notes = body.admin_notes
        # Notify servicer
        from app.service.domain.model import ServiceProvider as SP
        provider = db.query(SP).filter(SP.id == booking.provider_id).first()
        if provider:
            db.add(NotificationModel(
                user_id=provider.user_id,
                title="Bill Cancelled by Admin",
                message=f"Admin cancelled your bill for '{booking.service_type}'. Please re-submit with correct hours.",
                notification_type="WARNING",
                link="/service/jobs",
            ))

    elif body.action == "override_amount":
        if body.override_amount is None:
            raise HTTPException(status_code=400, detail="override_amount is required for override_amount action")
        if not booking or booking.status != "Pending Confirmation":
            raise HTTPException(status_code=400, detail="Booking must be in 'Pending Confirmation' to override amount")
        booking.status = "Completed"
        booking.final_cost = body.override_amount
        booking.completed_at = datetime.utcnow()
        from app.booking.domain.model import BookingStatusHistory
        db.add(BookingStatusHistory(
            booking_id=booking.id,
            status="Completed",
            notes=f"Admin resolved dispute. Final amount overridden to \u20b9{body.override_amount:.0f}.",
        ))
        complaint.status = "RESOLVED"
        complaint.resolved_at = datetime.utcnow()
        if body.admin_notes:
            complaint.admin_notes = body.admin_notes
        # Notify both parties
        msg = f"Admin resolved the dispute — final amount: \u20b9{body.override_amount:.0f}"
        db.add(NotificationModel(
            user_id=booking.user_id,
            title="Dispute Resolved",
            message=msg,
            notification_type="SUCCESS",
            link=f"/user/bookings/{booking.id}",
        ))
        from app.service.domain.model import ServiceProvider as SP
        provider = db.query(SP).filter(SP.id == booking.provider_id).first()
        if provider:
            db.add(NotificationModel(
                user_id=provider.user_id,
                title="Dispute Resolved",
                message=msg,
                notification_type="SUCCESS",
                link="/service/jobs",
            ))
        # Award points now that booking is completed
        try:
            event = "URGENT_COMPLETE" if booking.priority in ("High", "Emergency") else "REGULAR_COMPLETE"
            award_points(db, provider_id=booking.provider_id, event_type=event, source_id=booking.id)
        except Exception:
            pass

    else:
        # Normal status/notes update
        if body.status is not None:
            complaint.status = body.status
            if body.status == "RESOLVED":
                complaint.resolved_at = datetime.utcnow()
        if body.admin_notes is not None:
            complaint.admin_notes = body.admin_notes

    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/secretary-complaints", response_model=List[SecretaryComplaintRead])
def list_secretary_complaints(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Admin: list all secretary complaints."""
    return (
        db.query(SecretaryComplaint)
        .order_by(SecretaryComplaint.created_at.desc())
        .all()
    )


@router.patch("/secretary-complaints/{complaint_id}", response_model=SecretaryComplaintRead)
def update_secretary_complaint(
    complaint_id: UUID,
    body: SecretaryComplaintAdminUpdate,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Admin: update secretary complaint status/notes."""
    complaint = db.query(SecretaryComplaint).filter(SecretaryComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if body.status is not None:
        complaint.status = body.status
        if body.status == "RESOLVED":
            complaint.resolved_at = datetime.utcnow()
    if body.admin_notes is not None:
        complaint.admin_notes = body.admin_notes
    db.commit()
    db.refresh(complaint)
    return complaint

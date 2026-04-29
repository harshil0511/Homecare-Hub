import uuid
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.service.services import get_provider_display_name
from app.booking.domain.model import ServiceBooking, BookingComplaint
from app.maintenance.domain.model import MaintenanceTask
from app.api.auth.schemas import UserResponse
from app.api.service.schemas import ProviderResponse
from app.api.admin.schemas import AdminVerifyUpdate, ComplaintAdminRead, ComplaintAdminUpdate, SecretaryComplaintRead, SecretaryComplaintAdminUpdate, ServiceRequestAdminRead, ServiceRequestResponseAdminRead, ServiceRequestRecipientAdminRead
from app.request.domain.model import ServiceRequest, ServiceRequestResponse, ServiceRequestRecipient
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
        "open_complaints": db.query(BookingComplaint).filter(BookingComplaint.status == "OPEN").count(),
        "flagged_bookings_count": db.query(ServiceBooking).filter(ServiceBooking.is_flagged == True).count(),
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


@router.get("/stats/bookings-trend")
def get_bookings_trend(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Returns last 7 days booking counts (by created_at date)."""
    from datetime import date, timedelta
    today = date.today()
    result = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = db.query(ServiceBooking).filter(
            ServiceBooking.created_at >= datetime(day.year, day.month, day.day, 0, 0, 0),
            ServiceBooking.created_at < datetime(day.year, day.month, day.day, 23, 59, 59),
        ).count()
        result.append({
            "date": day.isoformat(),
            "day": day.strftime("%a"),
            "count": count,
        })
    return result


@router.get("/stats/provider-earnings")
def get_provider_earnings(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Per-provider earnings: total jobs, total earned, and last 3 periods (3-day buckets)."""
    from datetime import date, timedelta

    completed = db.query(ServiceBooking).filter(ServiceBooking.status == "Completed").all()

    # Group by provider_id
    provider_map: dict = {}
    for b in completed:
        pid = str(b.provider_id)
        if pid not in provider_map:
            provider_map[pid] = {"jobs": 0, "earned": 0.0, "bookings": []}
        provider_map[pid]["jobs"] += 1
        provider_map[pid]["earned"] += b.final_cost or b.estimated_cost or 0
        provider_map[pid]["bookings"].append(b)

    if not provider_map:
        return []

    # Resolve provider names
    pids = list(provider_map.keys())
    from uuid import UUID as UUIDT
    providers = db.query(ServiceProvider).filter(
        ServiceProvider.id.in_([UUIDT(p) for p in pids])
    ).all()
    pname_map = {}
    for p in providers:
        name = f"{p.first_name or ''} {p.last_name or ''}".strip() or p.company_name or "Unknown"
        pname_map[str(p.id)] = {"name": name, "category": p.category or ""}

    # Build 3-day buckets for last 9 days
    today = date.today()
    periods = []
    for i in range(2, -1, -1):
        start = today - timedelta(days=(i + 1) * 3 - 1)
        end = today - timedelta(days=i * 3)
        label = f"{start.strftime('%d %b')}–{end.strftime('%d %b')}"
        periods.append({"start": start, "end": end, "label": label})

    result = []
    for pid, data in provider_map.items():
        period_earnings = []
        for period in periods:
            earned = sum(
                b.final_cost or b.estimated_cost or 0
                for b in data["bookings"]
                if b.completed_at and period["start"] <= b.completed_at.date() <= period["end"]
            )
            period_earnings.append({"label": period["label"], "earned": round(earned, 2)})

        info = pname_map.get(pid, {"name": "Unknown", "category": ""})
        result.append({
            "provider_id": pid,
            "name": info["name"],
            "category": info["category"],
            "total_jobs": data["jobs"],
            "total_earned": round(data["earned"], 2),
            "periods": period_earnings,
        })

    result.sort(key=lambda x: x["total_earned"], reverse=True)
    return result[:15]


@router.get("/complaints", response_model=List[ComplaintAdminRead])
def list_complaints(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """List all booking complaints with full booking context."""
    query = db.query(BookingComplaint)
    if status:
        query = query.filter(BookingComplaint.status == status)
    complaints = query.order_by(BookingComplaint.created_at.desc()).all()

    result = []
    for c in complaints:
        booking = db.query(ServiceBooking).filter(ServiceBooking.id == c.booking_id).first()
        filer = db.query(User).filter(User.id == c.filed_by).first()

        provider_name = None
        user_name = None
        if booking:
            if booking.provider_id:
                prov = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
                if prov:
                    provider_name = get_provider_display_name(prov)
            if booking.user_id:
                u = db.query(User).filter(User.id == booking.user_id).first()
                if u:
                    user_name = u.username

        result.append(ComplaintAdminRead(
            id=c.id,
            booking_id=c.booking_id,
            filed_by=c.filed_by,
            filed_by_username=filer.username if filer else None,
            reason=c.reason,
            status=c.status,
            admin_notes=c.admin_notes,
            created_at=c.created_at,
            resolved_at=c.resolved_at,
            service_type=booking.service_type if booking else None,
            booking_status=booking.status if booking else None,
            scheduled_at=booking.scheduled_at if booking else None,
            final_cost=booking.final_cost if booking else None,
            estimated_cost=booking.estimated_cost if booking else None,
            provider_name=provider_name,
            user_name=user_name,
        ))
    return result


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
        if not booking or booking.status in ("Cancelled", "Pending", "Accepted"):
            raise HTTPException(status_code=400, detail="No active bill to cancel for this booking")
        # Revert to In Progress so servicer re-submits
        booking.status = "In Progress"
        booking.completed_at = None
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
        # Only update the charge — status stays "Pending Confirmation" so user still pays
        booking.final_cost = body.override_amount
        booking.is_flagged = False
        from app.booking.domain.model import BookingStatusHistory
        db.add(BookingStatusHistory(
            booking_id=booking.id,
            status="Pending Confirmation",
            notes=f"Admin adjusted charge to ₹{body.override_amount:.0f}. Awaiting user payment.",
        ))
        complaint.status = "UNDER_REVIEW"
        if body.admin_notes:
            complaint.admin_notes = body.admin_notes
        # Notify user to review updated amount and complete payment
        db.add(NotificationModel(
            user_id=booking.user_id,
            title="Charge Adjusted by Admin",
            message=f"Admin updated the charge for '{booking.service_type}' to ₹{body.override_amount:.0f}. Please review and complete payment.",
            notification_type="URGENT",
            link=f"/user/bookings/{booking.id}",
        ))
        from app.service.domain.model import ServiceProvider as SP
        provider = db.query(SP).filter(SP.id == booking.provider_id).first()
        if provider and provider.user_id:
            db.add(NotificationModel(
                user_id=provider.user_id,
                title="Charge Adjusted by Admin",
                message=f"Admin adjusted the final charge for '{booking.service_type}' to ₹{body.override_amount:.0f}. Awaiting user payment.",
                notification_type="INFO",
                link="/service/jobs",
            ))

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


@router.get("/requests", response_model=List[ServiceRequestAdminRead])
def list_service_requests(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Admin: list all service requests with requester and response details."""
    query = db.query(ServiceRequest)
    if status:
        query = query.filter(ServiceRequest.status == status)
    requests = query.order_by(ServiceRequest.created_at.desc()).all()

    result = []
    for req in requests:
        user = db.query(User).filter(User.id == req.user_id).first()

        responses = []
        responded_provider_ids = set()
        for resp in req.responses:
            prov = db.query(ServiceProvider).filter(ServiceProvider.id == resp.provider_id).first()
            pname = get_provider_display_name(prov) if prov else None
            responded_provider_ids.add(resp.provider_id)
            responses.append(ServiceRequestResponseAdminRead(
                id=resp.id,
                provider_name=pname,
                proposed_price=resp.proposed_price,
                proposed_date=resp.proposed_date,
                status=resp.status,
                negotiation_status=resp.negotiation_status,
                message=resp.message,
            ))

        recipients = []
        for rec in req.recipients:
            prov = db.query(ServiceProvider).filter(ServiceProvider.id == rec.provider_id).first()
            pname = get_provider_display_name(prov) if prov else None
            recipients.append(ServiceRequestRecipientAdminRead(
                provider_name=pname,
                is_read=rec.is_read,
                has_responded=rec.provider_id in responded_provider_ids,
            ))

        result.append(ServiceRequestAdminRead(
            id=req.id,
            device_or_issue=req.device_or_issue,
            urgency=req.urgency,
            status=req.status,
            contact_name=req.contact_name,
            location=req.location,
            created_at=req.created_at,
            expires_at=req.expires_at,
            user_name=user.username if user else None,
            response_count=len(responses),
            responses=responses,
            recipients=recipients,
        ))
    return result


@router.delete("/requests/{request_id}")
def cancel_service_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Admin: cancel an OPEN or ACCEPTED service request."""
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Service request not found")
    if req.status not in ("OPEN", "ACCEPTED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a request with status '{req.status}'"
        )
    req.status = "CANCELLED"
    db.commit()
    return {"message": "Service request cancelled"}


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

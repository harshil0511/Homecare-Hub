"""Servicer analytics endpoint — GET /services/providers/me/analytics"""

import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.internal import models, schemas, deps
from app.internal.models import ProviderPoints, ServiceProvider, ServiceBooking

router = APIRouter(tags=["Servicer Analytics"])

servicer_only = deps.RoleChecker(["SERVICER"])


@router.get("/providers/me/analytics", response_model=schemas.ProviderAnalyticsRead)
def get_my_analytics(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    # ── Job counts ────────────────────────────────────────────────────────────
    all_bookings = db.query(ServiceBooking).filter(
        ServiceBooking.provider_id == provider.id
    ).all()

    emergency_jobs = sum(1 for b in all_bookings if (b.priority or "").strip() == "Emergency" and b.status == "Completed")
    urgent_jobs    = sum(1 for b in all_bookings if (b.priority or "").strip() == "High"      and b.status == "Completed")
    regular_jobs   = sum(1 for b in all_bookings if (b.priority or "").strip() not in ("Emergency", "High") and b.status == "Completed")
    cancelled_jobs = sum(1 for b in all_bookings if b.status == "Cancelled")
    total_jobs     = emergency_jobs + urgent_jobs + regular_jobs
    total_attempted = total_jobs + cancelled_jobs
    completion_rate = round((total_jobs / total_attempted * 100), 1) if total_attempted > 0 else 0.0

    # ── Points ───────────────────────────────────────────────────────────────
    all_points = db.query(ProviderPoints).filter(
        ProviderPoints.provider_id == provider.id
    ).order_by(ProviderPoints.created_at.desc()).all()

    total_points = sum(p.delta for p in all_points)

    emergency_pts = sum(p.delta for p in all_points if p.event_type == "EMERGENCY_COMPLETE")
    urgent_pts    = sum(p.delta for p in all_points if p.event_type == "URGENT_COMPLETE")
    regular_pts   = sum(p.delta for p in all_points if p.event_type == "REGULAR_COMPLETE")
    feedback_pts  = sum(p.delta for p in all_points if p.event_type.startswith("FEEDBACK") or p.event_type == "REVIEW_WRITTEN")
    penalty_pts   = sum(p.delta for p in all_points if p.delta < 0)

    breakdown = schemas.PointsBreakdown(
        emergency=round(emergency_pts, 1),
        urgent=round(urgent_pts, 1),
        regular=round(regular_pts, 1),
        feedback=round(feedback_pts, 1),
        penalties=round(penalty_pts, 1),
    )

    # ── Recent log (last 10) ──────────────────────────────────────────────────
    recent_log = [
        schemas.PointLogEntry(
            created_at=p.created_at,
            event_type=p.event_type,
            delta=p.delta,
            note=p.note,
        )
        for p in all_points[:10]
    ]

    # ── Monthly stats (last 6 months) ─────────────────────────────────────────
    monthly_stats = []
    now = datetime.datetime.utcnow()
    for i in range(5, -1, -1):
        # Reliable month arithmetic: subtract months from current year/month
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        month_start = datetime.datetime(year, month, 1, 0, 0, 0)
        # next_month is always the first day of the following calendar month
        if month == 12:
            next_month = datetime.datetime(year + 1, 1, 1, 0, 0, 0)
        else:
            next_month = datetime.datetime(year, month + 1, 1, 0, 0, 0)
        # For the current month, cap at now so we don't include future data
        if i == 0:
            next_month = now

        month_label = month_start.strftime("%Y-%m")

        month_jobs = sum(
            1 for b in all_bookings
            if b.status == "Completed"
            and b.created_at is not None
            and month_start <= b.created_at < next_month
        )
        month_pts = sum(
            p.delta for p in all_points
            if p.created_at is not None and month_start <= p.created_at < next_month
        )

        cumulative = sum(
            p.delta for p in all_points
            if p.created_at is not None and p.created_at < next_month
        )
        rating_end = round(max(0.0, cumulative / 100.0), 2)

        monthly_stats.append(schemas.MonthlyStatEntry(
            month=month_label,
            jobs=month_jobs,
            points_earned=round(month_pts, 1),
            rating_end=rating_end,
        ))

    return schemas.ProviderAnalyticsRead(
        total_jobs=total_jobs,
        emergency_jobs=emergency_jobs,
        urgent_jobs=urgent_jobs,
        regular_jobs=regular_jobs,
        cancelled_jobs=cancelled_jobs,
        total_points=round(total_points, 1),
        current_rating=round(provider.rating or 0.0, 2),
        completion_rate=completion_rate,
        points_breakdown=breakdown,
        recent_point_log=recent_log,
        monthly_stats=monthly_stats,
    )

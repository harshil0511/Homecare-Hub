"""Admin Emergency SOS management endpoints."""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.emergency.domain.model import (
    EmergencyConfig, EmergencyPenaltyConfig,
    EmergencyRequest, EmergencyResponse, EmergencyStarAdjustment,
)
from app.service.point_engine import award_points
from app.api.emergency.schemas import (
    EmergencyConfigCreate, EmergencyConfigUpdate, EmergencyConfigRead,
    EmergencyPenaltyConfigUpdate, EmergencyPenaltyConfigRead,
    EmergencyStarAdjustCreate, EmergencyStarAdjustRead,
    EmergencyRequestRead,
)
from app.api.emergency.schemas import AdminProviderStatusUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin — Emergency SOS"])

admin_only = deps.RoleChecker(["ADMIN"])


# ── Pricing Config ─────────────────────────────────────────────────────────────

@router.get("/config", response_model=List[EmergencyConfigRead])
def list_emergency_configs(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """List all emergency category pricing configurations."""
    return db.query(EmergencyConfig).order_by(EmergencyConfig.category).all()


@router.post("/config", response_model=EmergencyConfigRead)
def create_emergency_config(
    payload: EmergencyConfigCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """Create a new category pricing config. Each category must be unique."""
    existing = db.query(EmergencyConfig).filter(
        EmergencyConfig.category == payload.category
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Config for '{payload.category}' already exists. Use PATCH to update.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    config = EmergencyConfig(
        category=payload.category,
        callout_fee=payload.callout_fee,
        hourly_rate=payload.hourly_rate,
        updated_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.patch("/config/{config_id}", response_model=EmergencyConfigRead)
def update_emergency_config(
    config_id: UUID,
    payload: EmergencyConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """Update callout_fee and/or hourly_rate for an existing config."""
    config = db.query(EmergencyConfig).filter(
        EmergencyConfig.id == config_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Emergency config not found")

    if payload.callout_fee is not None:
        config.callout_fee = payload.callout_fee
    if payload.hourly_rate is not None:
        config.hourly_rate = payload.hourly_rate
    config.updated_by = current_user.id
    config.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    db.refresh(config)
    return config


# ── Penalty Config ─────────────────────────────────────────────────────────────

@router.get("/penalty", response_model=List[EmergencyPenaltyConfigRead])
def list_penalty_configs(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """List all event-type penalty configurations (star deduction rates)."""
    return db.query(EmergencyPenaltyConfig).order_by(EmergencyPenaltyConfig.event_type).all()


@router.patch("/penalty/{event_type}", response_model=EmergencyPenaltyConfigRead)
def update_penalty_config(
    event_type: str,
    payload: EmergencyPenaltyConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """Update star_deduction for a given event_type (LATE_ARRIVAL / CANCELLATION / NO_SHOW)."""
    config = db.query(EmergencyPenaltyConfig).filter(
        EmergencyPenaltyConfig.event_type == event_type
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail=f"Penalty config for event_type '{event_type}' not found")

    config.star_deduction = payload.star_deduction
    config.updated_by = current_user.id
    config.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    db.refresh(config)
    return config


# ── Emergency Requests ─────────────────────────────────────────────────────────

@router.get("/requests", response_model=List[EmergencyRequestRead])
def list_all_emergency_requests(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """List all emergency requests across users, optionally filtered by status."""
    query = db.query(EmergencyRequest)
    if status:
        query = query.filter(EmergencyRequest.status == status.upper())
    return query.order_by(EmergencyRequest.id.desc()).all()


@router.get("/requests/{request_id}", response_model=EmergencyRequestRead)
def get_emergency_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Get a single emergency request with full detail."""
    em = db.query(EmergencyRequest).filter(
        EmergencyRequest.id == request_id
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    return em


# ── Star Adjustments ───────────────────────────────────────────────────────────

@router.post("/star-adjust/{provider_id}", response_model=EmergencyStarAdjustRead)
def manual_star_adjustment(
    provider_id: UUID,
    payload: EmergencyStarAdjustCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """Manually adjust a provider's star rating (±5.0 max). Clamped to [0.0, 5.0]."""
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Use the point engine so the delta is recorded in provider_points and
    # persists correctly through future award_points() recalculations.
    # payload.delta is in stars; 100 pts = 1 star.
    award_points(
        db,
        provider_id=provider_id,
        event_type="ADMIN_ADJUSTMENT",
        custom_delta=payload.delta * 100.0,
        note=payload.reason,
    )

    # Log the star adjustment record (for audit history).
    adjustment = EmergencyStarAdjustment(
        provider_id=provider_id,
        adjusted_by=current_user.id,
        delta=payload.delta,
        reason=payload.reason,
        event_type="MANUAL_ADMIN",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)
    return adjustment


@router.get("/star-adjust/{provider_id}", response_model=List[EmergencyStarAdjustRead])
def list_star_adjustments(
    provider_id: UUID,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """List all star adjustments for a provider (most recent first)."""
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    return (
        db.query(EmergencyStarAdjustment)
        .filter(EmergencyStarAdjustment.provider_id == provider_id)
        .order_by(EmergencyStarAdjustment.id.desc())
        .all()
    )


# ── Provider Status Management ─────────────────────────────────────────────────

@router.patch("/provider/{provider_id}/status")
def update_provider_status(
    provider_id: UUID,
    payload: AdminProviderStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """Suspend or reinstate a provider. Optionally log a reason as a star adjustment note."""
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider.is_active = payload.is_active

    if payload.reason:
        event_type = "REINSTATEMENT" if payload.is_active else "SUSPENSION"
        db.add(EmergencyStarAdjustment(
            provider_id=provider_id,
            adjusted_by=current_user.id,
            delta=0.0,
            reason=payload.reason,
            event_type=event_type,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        ))

    db.commit()
    action = "reinstated" if payload.is_active else "suspended"
    return {"detail": f"Provider {provider_id} has been {action}"}

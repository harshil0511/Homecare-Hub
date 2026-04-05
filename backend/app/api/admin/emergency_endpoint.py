"""Admin Emergency SOS management endpoints."""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.internal import models, schemas, deps
from app.internal.services import apply_star_delta

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin — Emergency SOS"])

admin_only = deps.RoleChecker(["ADMIN"])


# ── Pricing Config ─────────────────────────────────────────────────────────────

@router.get("/config", response_model=List[schemas.EmergencyConfigRead])
def list_emergency_configs(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    """List all emergency category pricing configurations."""
    return db.query(models.EmergencyConfig).order_by(models.EmergencyConfig.category).all()


@router.post("/config", response_model=schemas.EmergencyConfigRead)
def create_emergency_config(
    payload: schemas.EmergencyConfigCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    """Create a new category pricing config. Each category must be unique."""
    existing = db.query(models.EmergencyConfig).filter(
        models.EmergencyConfig.category == payload.category
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Config for '{payload.category}' already exists. Use PATCH to update.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    config = models.EmergencyConfig(
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


@router.patch("/config/{config_id}", response_model=schemas.EmergencyConfigRead)
def update_emergency_config(
    config_id: UUID,
    payload: schemas.EmergencyConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    """Update callout_fee and/or hourly_rate for an existing config."""
    config = db.query(models.EmergencyConfig).filter(
        models.EmergencyConfig.id == config_id
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

@router.get("/penalty", response_model=List[schemas.EmergencyPenaltyConfigRead])
def list_penalty_configs(
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    """List all event-type penalty configurations (star deduction rates)."""
    return db.query(models.EmergencyPenaltyConfig).order_by(models.EmergencyPenaltyConfig.event_type).all()


@router.patch("/penalty/{event_type}", response_model=schemas.EmergencyPenaltyConfigRead)
def update_penalty_config(
    event_type: str,
    payload: schemas.EmergencyPenaltyConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    """Update star_deduction for a given event_type (LATE_ARRIVAL / CANCELLATION / NO_SHOW)."""
    config = db.query(models.EmergencyPenaltyConfig).filter(
        models.EmergencyPenaltyConfig.event_type == event_type
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

@router.get("/requests", response_model=List[schemas.EmergencyRequestRead])
def list_all_emergency_requests(
    status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    """List all emergency requests across users, optionally filtered by status."""
    query = db.query(models.EmergencyRequest)
    if status:
        query = query.filter(models.EmergencyRequest.status == status.upper())
    return query.order_by(models.EmergencyRequest.id.desc()).all()


@router.get("/requests/{request_id}", response_model=schemas.EmergencyRequestRead)
def get_emergency_request(
    request_id: UUID,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    """Get a single emergency request with full detail."""
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    return em


# ── Star Adjustments ───────────────────────────────────────────────────────────

@router.post("/star-adjust/{provider_id}", response_model=schemas.EmergencyStarAdjustRead)
def manual_star_adjustment(
    provider_id: UUID,
    payload: schemas.EmergencyStarAdjustCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    """Manually adjust a provider's star rating (±5.0 max). Clamped to [0.0, 5.0]."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    apply_star_delta(provider, payload.delta)

    adjustment = models.EmergencyStarAdjustment(
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


@router.get("/star-adjust/{provider_id}", response_model=List[schemas.EmergencyStarAdjustRead])
def list_star_adjustments(
    provider_id: UUID,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    """List all star adjustments for a provider (most recent first)."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    return (
        db.query(models.EmergencyStarAdjustment)
        .filter(models.EmergencyStarAdjustment.provider_id == provider_id)
        .order_by(models.EmergencyStarAdjustment.id.desc())
        .all()
    )


# ── Provider Status Management ─────────────────────────────────────────────────

@router.patch("/provider/{provider_id}/status")
def update_provider_status(
    provider_id: UUID,
    payload: schemas.AdminProviderStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    """Suspend or reinstate a provider. Optionally log a reason as a star adjustment note."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider.is_active = payload.is_active

    if payload.reason:
        event_type = "REINSTATEMENT" if payload.is_active else "SUSPENSION"
        db.add(models.EmergencyStarAdjustment(
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

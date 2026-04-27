from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.common.deps import get_db, get_current_user, RoleChecker
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.payment.domain.model import PaymentProfile
from app.core.encryption import encrypt
from app.api.payment.schemas import (
    UserPaymentProfileCreate,
    ProviderPaymentProfileCreate,
    PaymentProfileRead,
    ProviderPaymentStatusRead,
    ProviderPayDetailsRead,
)

router = APIRouter(tags=["payment"])

require_user = RoleChecker(["USER"])
require_servicer = RoleChecker(["SERVICER"])


def _masked(last4: str) -> str:
    return f"XXXXXX{last4}"


def _profile_to_read(p: PaymentProfile) -> PaymentProfileRead:
    return PaymentProfileRead(
        id=p.id,
        account_holder_name=p.account_holder_name,
        account_number_masked=_masked(p.account_number_last4),
        ifsc_code=p.ifsc_code,
        branch=p.branch,
        upi_id=p.upi_id,
        upi_qr_image_url=p.upi_qr_image_url,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _upsert_profile(
    db: Session,
    user: User,
    data: UserPaymentProfileCreate,
    upi_id: Optional[str] = None,
    upi_qr_image_url: Optional[str] = None,
) -> PaymentProfile:
    existing = db.scalar(select(PaymentProfile).where(PaymentProfile.user_id == str(user.id)))
    last4 = data.account_number[-4:]
    encrypted = encrypt(data.account_number)
    if existing:
        existing.account_holder_name = data.account_holder_name
        existing.account_number_encrypted = encrypted
        existing.account_number_last4 = last4
        existing.ifsc_code = data.ifsc_code
        existing.branch = data.branch
        existing.upi_id = upi_id
        existing.upi_qr_image_url = upi_qr_image_url
        db.commit()
        db.refresh(existing)
        return existing
    profile = PaymentProfile(
        user_id=str(user.id),
        account_holder_name=data.account_holder_name,
        account_number_encrypted=encrypted,
        account_number_last4=last4,
        ifsc_code=data.ifsc_code,
        branch=data.branch,
        upi_id=upi_id,
        upi_qr_image_url=upi_qr_image_url,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/user", response_model=PaymentProfileRead)
def get_user_payment_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_user),
):
    profile = db.scalar(select(PaymentProfile).where(PaymentProfile.user_id == str(current_user.id)))
    if not profile:
        raise HTTPException(status_code=404, detail="No payment profile found")
    return _profile_to_read(profile)


@router.post("/user", response_model=PaymentProfileRead)
def upsert_user_payment_profile(
    data: UserPaymentProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_user),
):
    profile = _upsert_profile(db, current_user, data)
    return _profile_to_read(profile)


@router.get("/provider", response_model=PaymentProfileRead)
def get_provider_payment_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_servicer),
):
    profile = db.scalar(select(PaymentProfile).where(PaymentProfile.user_id == str(current_user.id)))
    if not profile:
        raise HTTPException(status_code=404, detail="No payment profile found")
    return _profile_to_read(profile)


@router.post("/provider", response_model=PaymentProfileRead)
def upsert_provider_payment_profile(
    data: ProviderPaymentProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_servicer),
):
    profile = _upsert_profile(db, current_user, data, upi_id=data.upi_id, upi_qr_image_url=data.upi_qr_image_url)
    return _profile_to_read(profile)


@router.get("/provider/{provider_id}/status", response_model=ProviderPaymentStatusRead)
def get_provider_payment_status(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_user),
):
    provider = db.scalar(select(ServiceProvider).where(ServiceProvider.id == provider_id))
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    profile = db.scalar(select(PaymentProfile).where(PaymentProfile.user_id == provider.user_id))
    has_profile = (
        profile is not None
        and bool(profile.account_number_encrypted)
        and bool(profile.account_holder_name)
        and bool(profile.ifsc_code)
        and bool(profile.branch)
    )
    return ProviderPaymentStatusRead(provider_id=provider_id, has_payment_profile=has_profile)


@router.get("/provider/{provider_id}/pay-details", response_model=ProviderPayDetailsRead)
def get_provider_pay_details(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_user),
):
    provider = db.scalar(select(ServiceProvider).where(ServiceProvider.id == provider_id))
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    profile = db.scalar(select(PaymentProfile).where(PaymentProfile.user_id == provider.user_id))
    if not profile or not profile.account_number_encrypted:
        raise HTTPException(status_code=404, detail="Provider has no payment profile")
    return ProviderPayDetailsRead(
        account_holder_name=profile.account_holder_name,
        account_number_masked=_masked(profile.account_number_last4),
        account_number_last4=profile.account_number_last4,
        ifsc_code=profile.ifsc_code,
        upi_id=profile.upi_id,
        upi_qr_image_url=profile.upi_qr_image_url,
        has_upi=bool(profile.upi_id),
        has_qr=bool(profile.upi_qr_image_url),
    )

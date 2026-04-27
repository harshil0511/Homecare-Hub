# Payment Profile — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `payment_profile` table, bank/UPI settings pages for users and providers, provider eligibility gates on the provider list, and a "Pay Provider" panel on the booking receipt for systematic-flow bookings.

**Architecture:** Single `payment_profiles` table linked one-to-one with `users` via `user_id`. Fernet encryption for account numbers at rest. New `/api/v1/payment` router with role-specific endpoints. Frontend adds a Payment tab in Sidebar, two settings pages, a dashboard banner for providers, an eligibility gate on the provider list, and a 3-tab Pay Provider panel on the receipt/booking detail page.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, `cryptography` (Fernet — already available via `python-jose[cryptography]`), Next.js 16, Tailwind CSS, lucide-react.

---

## File Map

### New Files
| File | Purpose |
|---|---|
| `backend/app/core/encryption.py` | Fernet encrypt/decrypt helpers |
| `backend/app/payment/domain/model.py` | `PaymentProfile` SQLAlchemy model |
| `backend/app/api/payment/schemas.py` | Pydantic schemas for payment endpoints |
| `backend/app/api/payment/endpoints.py` | Payment router (5 endpoints) |
| `backend/alembic/versions/27_04_2026_add_payment_profiles.py` | DB migration |
| `frontend/app/user/settings/payment/page.tsx` | User payment settings page |
| `frontend/app/service/settings/payment/page.tsx` | Provider payment settings page |

### Modified Files
| File | What Changes |
|---|---|
| `backend/.env` | Add `PAYMENT_ENCRYPTION_KEY` |
| `backend/app/core/config.py` | Add `PAYMENT_ENCRYPTION_KEY` field to Settings |
| `backend/app/auth/domain/model.py` | Add `payment_profile` relationship to `User` |
| `backend/app/api/booking/schemas.py` | Add `flow_type` + `provider_id` to `ReceiptRead` |
| `backend/app/api/booking/endpoints.py` | Populate `flow_type` + `provider_id` in receipt endpoint |
| `backend/app/api/service/schemas.py` | Add `has_payment_profile` to `ProviderResponse` |
| `backend/app/api/service/endpoints.py` | Annotate `has_payment_profile` in provider list |
| `backend/app/main.py` | Register payment router |
| `frontend/components/layout/Sidebar.tsx` | Add Payment entry to USER_SETTINGS + SERVICE_SETTINGS |
| `frontend/app/service/dashboard/page.tsx` | Add missing-payment-details banner |
| `frontend/app/user/providers/page.tsx` | Eligibility gate on provider cards |
| `frontend/app/user/bookings/[id]/page.tsx` | Pay Provider panel (systematic flow) |
| `frontend/app/user/bookings/[id]/receipt/page.tsx` | Pay Provider panel (systematic flow) |

---

## Task 1: Fernet key — generate and wire into config

**Files:**
- Modify: `backend/.env`
- Modify: `backend/app/core/config.py`
- Create: `backend/app/core/encryption.py`

- [ ] **Step 1: Generate a Fernet key**

Run from `backend/`:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Copy the printed key (looks like `abc123…=`).

- [ ] **Step 2: Add key to .env**

Open `backend/.env` and append:
```
PAYMENT_ENCRYPTION_KEY=<paste-key-here>
```

- [ ] **Step 3: Add field to config**

In `backend/app/core/config.py`, add `PAYMENT_ENCRYPTION_KEY` to `Settings`:
```python
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    SUPERADMIN_EMAIL: str
    SUPERADMIN_PASSWORD: str
    SUPERADMIN_USERNAME: str = "Super Admin"
    FRONTEND_URL: str = "http://localhost:3000"
    ANTHROPIC_API_KEY: str = ""
    PAYMENT_ENCRYPTION_KEY: str = ""

    model_config = ConfigDict(env_file=".env")

settings = Settings()
```

- [ ] **Step 4: Create encryption helper**

Create `backend/app/core/encryption.py`:
```python
from cryptography.fernet import Fernet
from app.core.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(settings.PAYMENT_ENCRYPTION_KEY.encode())
    return _fernet


def encrypt(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _get_fernet().decrypt(value.encode()).decode()
```

- [ ] **Step 5: Verify encryption works**

Run from `backend/`:
```bash
python -c "
from app.core.encryption import encrypt, decrypt
ct = encrypt('123456789012')
assert decrypt(ct) == '123456789012'
print('OK:', ct[:20], '...')
"
```
Expected: `OK: gAAAAAAB...`

- [ ] **Step 6: Commit**
```bash
git add backend/.env backend/app/core/config.py backend/app/core/encryption.py
git commit -m "feat: Fernet encryption helper + PAYMENT_ENCRYPTION_KEY config"
```

---

## Task 2: PaymentProfile model + User relationship

**Files:**
- Create: `backend/app/payment/__init__.py`
- Create: `backend/app/payment/domain/__init__.py`
- Create: `backend/app/payment/domain/model.py`
- Modify: `backend/app/auth/domain/model.py`

- [ ] **Step 1: Create package init files**
```bash
mkdir -p backend/app/payment/domain
touch backend/app/payment/__init__.py
touch backend/app/payment/domain/__init__.py
```

- [ ] **Step 2: Create the model**

Create `backend/app/payment/domain/model.py`:
```python
import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class PaymentProfile(Base):
    __tablename__ = "payment_profiles"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    account_holder_name = Column(String, nullable=False)
    account_number_encrypted = Column(String, nullable=False)
    account_number_last4 = Column(String(4), nullable=False)
    ifsc_code = Column(String(11), nullable=False)
    branch = Column(String, nullable=False)
    upi_id = Column(String, nullable=True)
    upi_qr_image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="payment_profile")
```

- [ ] **Step 3: Add relationship to User model**

In `backend/app/auth/domain/model.py`, add the import and relationship inside the `User` class. The existing relationships end with `emergency_requests`. Add after that line:
```python
    emergency_requests = relationship("EmergencyRequest", back_populates="user")
    payment_profile = relationship("PaymentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
```

- [ ] **Step 4: Verify import works**

Run from `backend/`:
```bash
python -c "from app.payment.domain.model import PaymentProfile; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Commit**
```bash
git add backend/app/payment/ backend/app/auth/domain/model.py
git commit -m "feat: PaymentProfile model + User relationship"
```

---

## Task 3: Alembic migration

**Files:**
- Create: `backend/alembic/versions/27_04_2026_add_payment_profiles.py`

- [ ] **Step 1: Create the migration file**

Create `backend/alembic/versions/27_04_2026_add_payment_profiles.py`:
```python
"""add_payment_profiles

Revision ID: c9f4e2a83b56
Revises: b8e3d1f92a45
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c9f4e2a83b56"
down_revision = "b8e3d1f92a45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("account_holder_name", sa.String(), nullable=False),
        sa.Column("account_number_encrypted", sa.String(), nullable=False),
        sa.Column("account_number_last4", sa.String(4), nullable=False),
        sa.Column("ifsc_code", sa.String(11), nullable=False),
        sa.Column("branch", sa.String(), nullable=False),
        sa.Column("upi_id", sa.String(), nullable=True),
        sa.Column("upi_qr_image_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("payment_profiles")
```

- [ ] **Step 2: Run the migration**

Run from `backend/`:
```bash
alembic upgrade head
```
Expected output ends with: `Running upgrade b8e3d1f92a45 -> c9f4e2a83b56, add_payment_profiles`

- [ ] **Step 3: Verify table exists**
```bash
alembic current
```
Expected: shows `c9f4e2a83b56 (head)`

- [ ] **Step 4: Commit**
```bash
git add backend/alembic/versions/27_04_2026_add_payment_profiles.py
git commit -m "feat: migration — add payment_profiles table"
```

---

## Task 4: Payment schemas

**Files:**
- Create: `backend/app/api/payment/__init__.py`
- Create: `backend/app/api/payment/schemas.py`

- [ ] **Step 1: Create package**
```bash
touch backend/app/api/payment/__init__.py
```

- [ ] **Step 2: Create schemas**

Create `backend/app/api/payment/schemas.py`:
```python
import re
from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
UPI_RE = re.compile(r"^.+@.+$")


class UserPaymentProfileCreate(BaseModel):
    account_holder_name: str
    account_number: str
    ifsc_code: str
    branch: str

    @field_validator("account_holder_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 60:
            raise ValueError("Name must be 2–60 characters")
        if not re.match(r"^[A-Za-z ]+$", v):
            raise ValueError("Name must contain only letters and spaces")
        return v

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or not (9 <= len(v) <= 18):
            raise ValueError("Account number must be 9–18 digits")
        return v

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        v = v.strip().upper()
        if not IFSC_RE.match(v):
            raise ValueError("IFSC must be 4 letters + 0 + 6 alphanumeric (e.g. SBIN0001234)")
        return v

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Branch is required")
        return v


class ProviderPaymentProfileCreate(UserPaymentProfileCreate):
    upi_id: Optional[str] = None
    upi_qr_image_url: Optional[str] = None

    @field_validator("upi_id", mode="before")
    @classmethod
    def validate_upi_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and not UPI_RE.match(v):
                raise ValueError("UPI ID must be in format name@bank")
            return v or None
        return None


class PaymentProfileRead(BaseModel):
    id: UUID
    account_holder_name: str
    account_number_masked: str
    ifsc_code: str
    branch: str
    upi_id: Optional[str] = None
    upi_qr_image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProviderPaymentStatusRead(BaseModel):
    provider_id: UUID
    has_payment_profile: bool


class ProviderPayDetailsRead(BaseModel):
    account_holder_name: str
    account_number_masked: str
    ifsc_code: str
    upi_id: Optional[str] = None
    upi_qr_image_url: Optional[str] = None
    has_upi: bool
    has_qr: bool
```

- [ ] **Step 3: Verify schemas import cleanly**

Run from `backend/`:
```bash
python -c "from app.api.payment.schemas import UserPaymentProfileCreate, ProviderPaymentProfileCreate, PaymentProfileRead; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**
```bash
git add backend/app/api/payment/
git commit -m "feat: payment API schemas"
```

---

## Task 5: Payment endpoints + router registration

**Files:**
- Create: `backend/app/api/payment/endpoints.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the endpoints file**

Create `backend/app/api/payment/endpoints.py`:
```python
import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.common import deps
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

router = APIRouter(tags=["Payment"])


def _mask(last4: str) -> str:
    return f"XXXXXX{last4}"


def _to_read(profile: PaymentProfile) -> PaymentProfileRead:
    return PaymentProfileRead(
        id=profile.id,
        account_holder_name=profile.account_holder_name,
        account_number_masked=_mask(profile.account_number_last4),
        ifsc_code=profile.ifsc_code,
        branch=profile.branch,
        upi_id=profile.upi_id,
        upi_qr_image_url=profile.upi_qr_image_url,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("/user", response_model=PaymentProfileRead)
def get_user_payment_profile(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    profile = db.query(PaymentProfile).filter(PaymentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Payment profile not found")
    return _to_read(profile)


@router.post("/user", response_model=PaymentProfileRead)
def upsert_user_payment_profile(
    data: UserPaymentProfileCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    profile = db.query(PaymentProfile).filter(PaymentProfile.user_id == current_user.id).first()
    encrypted = encrypt(data.account_number)
    last4 = data.account_number[-4:]
    now = datetime.datetime.utcnow()
    if profile:
        profile.account_holder_name = data.account_holder_name
        profile.account_number_encrypted = encrypted
        profile.account_number_last4 = last4
        profile.ifsc_code = data.ifsc_code
        profile.branch = data.branch
        profile.updated_at = now
    else:
        profile = PaymentProfile(
            user_id=current_user.id,
            account_holder_name=data.account_holder_name,
            account_number_encrypted=encrypted,
            account_number_last4=last4,
            ifsc_code=data.ifsc_code,
            branch=data.branch,
        )
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return _to_read(profile)


@router.get("/provider", response_model=PaymentProfileRead)
def get_provider_payment_profile(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    profile = db.query(PaymentProfile).filter(PaymentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Payment profile not found")
    return _to_read(profile)


@router.post("/provider", response_model=PaymentProfileRead)
def upsert_provider_payment_profile(
    data: ProviderPaymentProfileCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    profile = db.query(PaymentProfile).filter(PaymentProfile.user_id == current_user.id).first()
    encrypted = encrypt(data.account_number)
    last4 = data.account_number[-4:]
    now = datetime.datetime.utcnow()
    if profile:
        profile.account_holder_name = data.account_holder_name
        profile.account_number_encrypted = encrypted
        profile.account_number_last4 = last4
        profile.ifsc_code = data.ifsc_code
        profile.branch = data.branch
        profile.upi_id = data.upi_id
        profile.upi_qr_image_url = data.upi_qr_image_url
        profile.updated_at = now
    else:
        profile = PaymentProfile(
            user_id=current_user.id,
            account_holder_name=data.account_holder_name,
            account_number_encrypted=encrypted,
            account_number_last4=last4,
            ifsc_code=data.ifsc_code,
            branch=data.branch,
            upi_id=data.upi_id,
            upi_qr_image_url=data.upi_qr_image_url,
        )
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return _to_read(profile)


@router.get("/provider/{provider_id}/status", response_model=ProviderPaymentStatusRead)
def get_provider_payment_status(
    provider_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    profile = db.query(PaymentProfile).filter(
        PaymentProfile.user_id == provider.user_id,
        PaymentProfile.account_number_encrypted.isnot(None),
    ).first()
    return ProviderPaymentStatusRead(
        provider_id=provider_id,
        has_payment_profile=profile is not None,
    )


@router.get("/provider/{provider_id}/pay-details", response_model=ProviderPayDetailsRead)
def get_provider_pay_details(
    provider_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    profile = db.query(PaymentProfile).filter(
        PaymentProfile.user_id == provider.user_id,
    ).first()
    if not profile or not profile.account_number_encrypted:
        raise HTTPException(status_code=404, detail="Provider payment details not available")
    return ProviderPayDetailsRead(
        account_holder_name=profile.account_holder_name,
        account_number_masked=_mask(profile.account_number_last4),
        ifsc_code=profile.ifsc_code,
        upi_id=profile.upi_id,
        upi_qr_image_url=profile.upi_qr_image_url,
        has_upi=bool(profile.upi_id),
        has_qr=bool(profile.upi_qr_image_url),
    )
```

- [ ] **Step 2: Register the router in main.py**

In `backend/app/main.py`, add the import after the other router imports:
```python
from app.api.payment.endpoints import router as payment_router
```

Then add the router registration in the `# ── Routers ──` section, after the `admin_emergency_router` line:
```python
app.include_router(payment_router, prefix="/api/v1/payment")
```

- [ ] **Step 3: Start backend and verify endpoints appear in docs**

Run from `backend/`:
```bash
uvicorn app.main:app --reload --port 8000
```
Open `http://localhost:8000/api/v1/docs` and confirm the "Payment" tag appears with 5 endpoints:
- `GET /api/v1/payment/user`
- `POST /api/v1/payment/user`
- `GET /api/v1/payment/provider`
- `POST /api/v1/payment/provider`
- `GET /api/v1/payment/provider/{provider_id}/status`
- `GET /api/v1/payment/provider/{provider_id}/pay-details`

- [ ] **Step 4: Commit**
```bash
git add backend/app/api/payment/endpoints.py backend/app/main.py
git commit -m "feat: payment endpoints + router registration"
```

---

## Task 6: Add flow_type + provider_id to ReceiptRead

**Files:**
- Modify: `backend/app/api/booking/schemas.py`
- Modify: `backend/app/api/booking/endpoints.py`

- [ ] **Step 1: Update ReceiptRead schema**

In `backend/app/api/booking/schemas.py`, find `class ReceiptRead` and add two fields:
```python
class ReceiptRead(BaseModel):
    booking_id: UUID
    service_type: str
    servicer_name: str
    is_emergency: bool = False
    callout_fee: float = 0.0
    base_price: float
    extra_hours: float
    hourly_rate: float
    extra_charge: float
    final_amount: float
    completed_at: Optional[datetime] = None
    negotiated: bool = False
    flow_type: str = "systematic"
    provider_id: Optional[UUID] = None

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Populate the new fields in the receipt endpoint**

In `backend/app/api/booking/endpoints.py`, there are two `ReceiptRead(...)` return statements in `get_receipt` (one for emergency bookings, one for regular). Add `flow_type=booking.flow_type, provider_id=booking.provider_id` to **both**.

Emergency return (around line 876):
```python
        return ReceiptRead(
            booking_id=booking.id,
            service_type=booking.service_type,
            servicer_name=provider_name,
            is_emergency=True,
            callout_fee=callout_fee,
            base_price=callout_fee,
            extra_hours=extra_hours,
            hourly_rate=hourly_rate,
            extra_charge=extra_hours * hourly_rate,
            final_amount=final_amount,
            completed_at=booking.completed_at,
            negotiated=False,
            flow_type=booking.flow_type,
            provider_id=booking.provider_id,
        )
```

Regular return (around line 895):
```python
    return ReceiptRead(
        booking_id=booking.id,
        service_type=booking.service_type,
        servicer_name=provider_name,
        is_emergency=False,
        callout_fee=0.0,
        base_price=0.0,
        extra_hours=actual_hours,
        hourly_rate=hourly_rate,
        extra_charge=final_amount,
        final_amount=final_amount,
        completed_at=booking.completed_at,
        negotiated=(booking.source_type == "negotiated"),
        flow_type=booking.flow_type,
        provider_id=booking.provider_id,
    )
```

- [ ] **Step 3: Verify receipt endpoint includes new fields**

With the backend running, GET the receipt for any existing booking via docs or curl. Confirm `flow_type` and `provider_id` appear in the JSON response.

- [ ] **Step 4: Commit**
```bash
git add backend/app/api/booking/schemas.py backend/app/api/booking/endpoints.py
git commit -m "feat: add flow_type + provider_id to ReceiptRead"
```

---

## Task 7: Annotate provider list with has_payment_profile

**Files:**
- Modify: `backend/app/api/service/schemas.py`
- Modify: `backend/app/api/service/endpoints.py`

- [ ] **Step 1: Add field to ProviderResponse**

In `backend/app/api/service/schemas.py`, find `class ProviderResponse(ProviderBase)` and add `has_payment_profile`:
```python
class ProviderResponse(ProviderBase):
    id: UUID
    user_id: Optional[UUID] = None
    is_verified: Optional[bool] = False
    rating: Optional[float] = 0.0
    completed_jobs: Optional[int] = 0
    emergency_jobs: Optional[int] = 0
    has_payment_profile: Optional[bool] = False
    certificates: List[CertificateResponse] = []

    @field_validator('categories', mode='before')
    @classmethod
    def parse_categories(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v or []

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Import PaymentProfile in service endpoints**

In `backend/app/api/service/endpoints.py`, add the import at the top with the other model imports:
```python
from app.payment.domain.model import PaymentProfile
```

- [ ] **Step 3: Add the batch annotation in get_providers**

In `backend/app/api/service/endpoints.py`, find the `get_providers` function. After the `emergency_counts` batch query block (around line 242), add:

```python
    # Batch-annotate payment profile status
    provider_user_ids = [p.user_id for p in providers]
    payment_ready_user_ids: set = set()
    if provider_user_ids:
        payment_ready_user_ids = {
            str(row.user_id)
            for row in db.query(PaymentProfile.user_id).filter(
                PaymentProfile.user_id.in_(provider_user_ids),
                PaymentProfile.account_number_encrypted.isnot(None),
            ).all()
        }
```

Then in the result loop (around line 261), after `r.emergency_jobs = emergency_counts.get(p.id, 0)` add:
```python
        r.has_payment_profile = str(p.user_id) in payment_ready_user_ids
```

The loop becomes:
```python
    result = []
    for p in providers:
        r = ProviderResponse.model_validate(p)
        r.completed_jobs = counts.get(p.id, 0)
        r.emergency_jobs = emergency_counts.get(p.id, 0)
        r.has_payment_profile = str(p.user_id) in payment_ready_user_ids
        if p.id in availability_overrides:
            r.availability_status = availability_overrides[p.id]
        result.append(r)
    return result
```

- [ ] **Step 4: Verify provider list includes has_payment_profile**

With backend running, call `GET /api/v1/services/providers` (with auth). Confirm each provider object includes `"has_payment_profile": false` (or `true` for any provider who already has a profile).

- [ ] **Step 5: Commit**
```bash
git add backend/app/api/service/schemas.py backend/app/api/service/endpoints.py
git commit -m "feat: annotate provider list with has_payment_profile"
```

---

## Task 8: Sidebar — add Payment tab

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add CreditCard icon import**

In `frontend/components/layout/Sidebar.tsx`, find the lucide-react import line and add `CreditCard`:
```typescript
import { ..., CreditCard } from "lucide-react";
```

- [ ] **Step 2: Add Payment to USER_SETTINGS**

Find `const USER_SETTINGS = [` and add a new entry:
```typescript
const USER_SETTINGS = [
  { name: "Profile", icon: User, path: "/user/settings/profile" },
  { name: "Password", icon: Lock, path: "/user/settings/password" },
  { name: "Notifications", icon: BellRing, path: "/user/settings/notifications" },
  { name: "Account", icon: ShieldCheck, path: "/user/settings/account" },
  { name: "Payment", icon: CreditCard, path: "/user/settings/payment" },
];
```

- [ ] **Step 3: Add Payment to SERVICE_SETTINGS**

Find `const SERVICE_SETTINGS = [` and add:
```typescript
const SERVICE_SETTINGS = [
  { name: "Profile", icon: User, path: "/service/settings/profile" },
  { name: "Password", icon: Lock, path: "/service/settings/password" },
  { name: "Notifications", icon: BellRing, path: "/service/settings/notifications" },
  { name: "Account", icon: ShieldCheck, path: "/service/settings/account" },
  { name: "Payment", icon: CreditCard, path: "/service/settings/payment" },
];
```

- [ ] **Step 4: Verify the sidebar compiles**

Run from `frontend/`:
```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors mentioning Sidebar.

- [ ] **Step 5: Commit**
```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat: add Payment tab to user and service settings sidebar"
```

---

## Task 9: User payment settings page

**Files:**
- Create: `frontend/app/user/settings/payment/page.tsx`

- [ ] **Step 1: Create the page**

Create `frontend/app/user/settings/payment/page.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5";
const inputCls = "w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-semibold text-sm";
const errorCls = "text-[10px] text-rose-600 font-bold mt-1";

export default function UserPaymentPage() {
    const [profile, setProfile] = useState<{
        account_holder_name: string;
        account_number_masked: string;
        ifsc_code: string;
        branch: string;
    } | null>(null);

    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [acNumber, setAcNumber] = useState("");
    const [acConfirm, setAcConfirm] = useState("");
    const [ifsc, setIfsc] = useState("");
    const [branch, setBranch] = useState("");
    const [showAc, setShowAc] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        apiFetch("/payment/user")
            .then((data) => {
                setProfile(data);
                setName(data.account_holder_name);
                setIfsc(data.ifsc_code);
                setBranch(data.branch);
            })
            .catch(() => {
                setEditing(true);
            });
    }, []);

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!name.trim() || name.trim().length < 2) e.name = "Name must be at least 2 characters";
        if (!/^[A-Za-z ]+$/.test(name.trim())) e.name = "Letters and spaces only";
        if (!acNumber || !/^\d{9,18}$/.test(acNumber)) e.acNumber = "9–18 digit number required";
        if (acNumber !== acConfirm) e.acConfirm = "Account numbers do not match";
        if (!IFSC_RE.test(ifsc)) e.ifsc = "Invalid IFSC (e.g. SBIN0001234)";
        if (!branch.trim()) e.branch = "Branch is required";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        setLoadError("");
        try {
            const data = await apiFetch("/payment/user", {
                method: "POST",
                body: JSON.stringify({
                    account_holder_name: name.trim(),
                    account_number: acNumber,
                    ifsc_code: ifsc.toUpperCase(),
                    branch: branch.trim(),
                }),
            });
            setProfile(data);
            setEditing(false);
            setSuccess(true);
            setAcNumber("");
            setAcConfirm("");
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setLoadError((err as Error).message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                            <CreditCard className="w-5 h-5 text-[#064e3b]" />
                        </div>
                        <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Payment Details</h2>
                    </div>
                    {profile && !editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                            Edit
                        </button>
                    )}
                </div>

                {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl flex items-center mb-6 shadow-md shadow-emerald-900/5">
                        <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Payment Details Saved</span>
                    </div>
                )}

                {loadError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-center mb-6">
                        <AlertCircle className="w-5 h-5 mr-3 text-rose-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest">{loadError}</span>
                    </div>
                )}

                {/* Saved view */}
                {profile && !editing && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">Account Holder</span>
                                <span className="font-black text-slate-900">{profile.account_holder_name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">Account Number</span>
                                <span className="font-black text-slate-900 font-mono">{profile.account_number_masked}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">IFSC</span>
                                <span className="font-black text-slate-900">{profile.ifsc_code}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">Branch</span>
                                <span className="font-black text-slate-900">{profile.branch}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Bank Account Verified
                        </div>
                    </div>
                )}

                {/* Edit/Create form */}
                {editing && (
                    <form onSubmit={handleSave} className="space-y-5">
                        <div>
                            <label className={labelCls}>Name as per Bank / Aadhaar</label>
                            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
                            {errors.name && <p className={errorCls}>{errors.name}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Account Number</label>
                            <div className="relative">
                                <input
                                    className={inputCls}
                                    type={showAc ? "text" : "password"}
                                    value={acNumber}
                                    onChange={e => setAcNumber(e.target.value)}
                                    placeholder="9–18 digit number"
                                    inputMode="numeric"
                                />
                                <button type="button" onClick={() => setShowAc(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showAc ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.acNumber && <p className={errorCls}>{errors.acNumber}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Confirm Account Number</label>
                            <input
                                className={inputCls}
                                type="password"
                                value={acConfirm}
                                onChange={e => setAcConfirm(e.target.value)}
                                placeholder="Re-enter account number"
                                inputMode="numeric"
                            />
                            {errors.acConfirm && <p className={errorCls}>{errors.acConfirm}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>IFSC Code</label>
                            <input
                                className={inputCls}
                                value={ifsc}
                                onChange={e => setIfsc(e.target.value.toUpperCase())}
                                placeholder="e.g. SBIN0001234"
                                maxLength={11}
                            />
                            {errors.ifsc && <p className={errorCls}>{errors.ifsc}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Bank Branch</label>
                            <input className={inputCls} value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch name" />
                            {errors.branch && <p className={errorCls}>{errors.branch}</p>}
                        </div>
                        <div className="flex gap-3 pt-2">
                            {profile && (
                                <button
                                    type="button"
                                    onClick={() => { setEditing(false); setErrors({}); }}
                                    className="flex-1 border border-slate-200 text-slate-600 font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-950/10 transition-all active:scale-[0.98] disabled:opacity-50 text-xs uppercase tracking-[0.2em]"
                            >
                                {saving ? "Saving..." : "Save Details"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify page compiles**
```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | grep -i payment | head -10
```
Expected: no errors for the payment page.

- [ ] **Step 3: Commit**
```bash
git add frontend/app/user/settings/payment/
git commit -m "feat: user payment settings page"
```

---

## Task 10: Provider payment settings page

**Files:**
- Create: `frontend/app/service/settings/payment/page.tsx`

- [ ] **Step 1: Create the page**

Create `frontend/app/service/settings/payment/page.tsx`:
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { CreditCard, CheckCircle2, AlertCircle, Eye, EyeOff, Upload, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const UPI_RE = /^.+@.+$/;

const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5";
const inputCls = "w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-semibold text-sm";
const errorCls = "text-[10px] text-rose-600 font-bold mt-1";

export default function ProviderPaymentPage() {
    const [profile, setProfile] = useState<{
        account_holder_name: string;
        account_number_masked: string;
        ifsc_code: string;
        branch: string;
        upi_id?: string;
        upi_qr_image_url?: string;
    } | null>(null);

    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [acNumber, setAcNumber] = useState("");
    const [acConfirm, setAcConfirm] = useState("");
    const [ifsc, setIfsc] = useState("");
    const [branch, setBranch] = useState("");
    const [upiId, setUpiId] = useState("");
    const [qrUrl, setQrUrl] = useState("");
    const [showAc, setShowAc] = useState(false);
    const qrInputRef = useRef<HTMLInputElement>(null);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        apiFetch("/payment/provider")
            .then((data) => {
                setProfile(data);
                setName(data.account_holder_name);
                setIfsc(data.ifsc_code);
                setBranch(data.branch);
                setUpiId(data.upi_id || "");
                setQrUrl(data.upi_qr_image_url || "");
            })
            .catch(() => {
                setEditing(true);
            });
    }, []);

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!name.trim() || name.trim().length < 2) e.name = "Name must be at least 2 characters";
        if (!/^[A-Za-z ]+$/.test(name.trim())) e.name = "Letters and spaces only";
        if (!acNumber || !/^\d{9,18}$/.test(acNumber)) e.acNumber = "9–18 digit number required";
        if (acNumber !== acConfirm) e.acConfirm = "Account numbers do not match";
        if (!IFSC_RE.test(ifsc)) e.ifsc = "Invalid IFSC (e.g. SBIN0001234)";
        if (!branch.trim()) e.branch = "Branch is required";
        if (upiId && !UPI_RE.test(upiId)) e.upiId = "UPI ID must be in format name@bank";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        setLoadError("");
        try {
            const data = await apiFetch("/payment/provider", {
                method: "POST",
                body: JSON.stringify({
                    account_holder_name: name.trim(),
                    account_number: acNumber,
                    ifsc_code: ifsc.toUpperCase(),
                    branch: branch.trim(),
                    upi_id: upiId.trim() || null,
                    upi_qr_image_url: qrUrl.trim() || null,
                }),
            });
            setProfile(data);
            setEditing(false);
            setSuccess(true);
            setAcNumber("");
            setAcConfirm("");
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setLoadError((err as Error).message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const Badge = ({ filled, label }: { filled: boolean; label: string }) => (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${filled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
            <CheckCircle2 className="w-3 h-3" /> {label}
        </span>
    );

    return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                            <CreditCard className="w-5 h-5 text-[#064e3b]" />
                        </div>
                        <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Payment Details</h2>
                    </div>
                    {profile && !editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                            Edit
                        </button>
                    )}
                </div>

                {/* Completion badges */}
                {profile && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        <Badge filled={!!profile.account_number_masked} label="Bank" />
                        <Badge filled={!!profile.upi_id} label="UPI" />
                        <Badge filled={!!profile.upi_qr_image_url} label="QR" />
                    </div>
                )}

                {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl flex items-center mb-6 shadow-md shadow-emerald-900/5">
                        <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Payment Details Saved</span>
                    </div>
                )}

                {loadError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-center mb-6">
                        <AlertCircle className="w-5 h-5 mr-3 text-rose-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest">{loadError}</span>
                    </div>
                )}

                {/* Saved view */}
                {profile && !editing && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">Account Holder</span>
                                <span className="font-black text-slate-900">{profile.account_holder_name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">Account Number</span>
                                <span className="font-black text-slate-900 font-mono">{profile.account_number_masked}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">IFSC</span>
                                <span className="font-black text-slate-900">{profile.ifsc_code}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-semibold">Branch</span>
                                <span className="font-black text-slate-900">{profile.branch}</span>
                            </div>
                            {profile.upi_id && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500 font-semibold">UPI ID</span>
                                    <span className="font-black text-slate-900">{profile.upi_id}</span>
                                </div>
                            )}
                            {profile.upi_qr_image_url && (
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-slate-500 font-semibold">QR Code</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Uploaded</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Edit/Create form */}
                {editing && (
                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Bank Account</div>
                        <div>
                            <label className={labelCls}>Name as per Bank / Aadhaar</label>
                            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
                            {errors.name && <p className={errorCls}>{errors.name}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Account Number</label>
                            <div className="relative">
                                <input
                                    className={inputCls}
                                    type={showAc ? "text" : "password"}
                                    value={acNumber}
                                    onChange={e => setAcNumber(e.target.value)}
                                    placeholder="9–18 digit number"
                                    inputMode="numeric"
                                />
                                <button type="button" onClick={() => setShowAc(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showAc ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.acNumber && <p className={errorCls}>{errors.acNumber}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Confirm Account Number</label>
                            <input
                                className={inputCls}
                                type="password"
                                value={acConfirm}
                                onChange={e => setAcConfirm(e.target.value)}
                                placeholder="Re-enter account number"
                                inputMode="numeric"
                            />
                            {errors.acConfirm && <p className={errorCls}>{errors.acConfirm}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>IFSC Code</label>
                            <input
                                className={inputCls}
                                value={ifsc}
                                onChange={e => setIfsc(e.target.value.toUpperCase())}
                                placeholder="e.g. SBIN0001234"
                                maxLength={11}
                            />
                            {errors.ifsc && <p className={errorCls}>{errors.ifsc}</p>}
                        </div>
                        <div>
                            <label className={labelCls}>Bank Branch</label>
                            <input className={inputCls} value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch name" />
                            {errors.branch && <p className={errorCls}>{errors.branch}</p>}
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 mt-2">UPI (Optional)</div>
                            <div>
                                <label className={labelCls}>UPI ID</label>
                                <input className={inputCls} value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="name@bank" />
                                {errors.upiId && <p className={errorCls}>{errors.upiId}</p>}
                            </div>
                            <div className="mt-4">
                                <label className={labelCls}>UPI QR Image URL</label>
                                <input className={inputCls} value={qrUrl} onChange={e => setQrUrl(e.target.value)} placeholder="https://..." />
                                <p className="text-[10px] text-slate-400 mt-1">Paste a hosted image URL of your UPI QR code</p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            {profile && (
                                <button
                                    type="button"
                                    onClick={() => { setEditing(false); setErrors({}); }}
                                    className="flex-1 border border-slate-200 text-slate-600 font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-950/10 transition-all active:scale-[0.98] disabled:opacity-50 text-xs uppercase tracking-[0.2em]"
                            >
                                {saving ? "Saving..." : "Save Details"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify page compiles**
```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | grep -i payment | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/app/service/settings/payment/
git commit -m "feat: provider payment settings page"
```

---

## Task 11: Provider dashboard banner

**Files:**
- Modify: `frontend/app/service/dashboard/page.tsx`

- [ ] **Step 1: Add payment profile state**

In `frontend/app/service/dashboard/page.tsx`, find the existing `useState` declarations at the top of `ServicerDashboard` and add:
```tsx
const [hasPaymentProfile, setHasPaymentProfile] = useState<boolean | null>(null);
```

- [ ] **Step 2: Fetch payment profile status in fetchData**

In the `fetchData` function, add a payment profile check alongside the other fetches:
```tsx
const paymentData = await apiFetch("/payment/provider").catch(() => null);
setHasPaymentProfile(paymentData !== null && !!paymentData.account_number_masked);
```

Add this right after `setProfile(myProfile)`.

- [ ] **Step 3: Add the banner JSX**

In the JSX return, find the first `<div>` after the loading/error check and add the banner before the main dashboard content:
```tsx
{hasPaymentProfile === false && (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-800">
                Add your bank details to start accepting jobs
            </p>
        </div>
        <a
            href="/service/settings/payment"
            className="text-[10px] font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
            Complete Setup
        </a>
    </div>
)}
```

- [ ] **Step 4: Import CreditCard icon**

In the lucide-react import at the top of the file, add `CreditCard`:
```tsx
import { Briefcase, Clock, Star, TrendingUp, CheckCircle2,
    ChevronRight, MapPin, DollarSign, Calendar, GraduationCap,
    ShieldCheck, Building2, Phone, AlertTriangle, User, CreditCard
} from "lucide-react";
```

- [ ] **Step 5: Verify it compiles**
```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 6: Commit**
```bash
git add frontend/app/service/dashboard/page.tsx
git commit -m "feat: provider dashboard missing-payment-details banner"
```

---

## Task 12: Provider list eligibility gate

**Files:**
- Modify: `frontend/app/user/providers/page.tsx`

- [ ] **Step 1: Add has_payment_profile to Provider interface**

In `frontend/app/user/providers/page.tsx`, find the `interface Provider` block and add the field:
```tsx
interface Provider {
    id: string;
    company_name: string;
    owner_name: string;
    first_name: string | null;
    last_name: string | null;
    category: string;
    categories: string[];
    profile_photo_url: string | null;
    hourly_rate: number;
    availability_status: string;
    is_verified: boolean;
    rating: number;
    completed_jobs: number;
    emergency_jobs: number;
    experience_years: number;
    location: string | null;
    bio: string | null;
    has_payment_profile: boolean;
    certificates: { id: string; category: string; certificate_url: string; is_verified: boolean; uploaded_at: string }[];
}
```

- [ ] **Step 2: Replace the checkbox toggle button in each provider card row**

In the provider card loop, find the checkbox button (around line 666):
```tsx
                                <button onClick={() => toggleSelect(p.id)} className="flex-shrink-0 text-slate-300 hover:text-[#064e3b] transition-colors">
                                    {isSelected ? <CheckSquare size={16} className="text-[#064e3b]" /> : <Square size={16} />}
                                </button>
```
Replace with:
```tsx
                                <button onClick={() => p.has_payment_profile && toggleSelect(p.id)} className={`flex-shrink-0 transition-colors ${p.has_payment_profile ? "text-slate-300 hover:text-[#064e3b]" : "text-slate-200 cursor-not-allowed"}`}>
                                    {isSelected ? <CheckSquare size={16} className="text-[#064e3b]" /> : <Square size={16} />}
                                </button>
```

- [ ] **Step 3: Replace the "Request" button in each provider card row**

Find the "Request" button (around line 699):
```tsx
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([p.id])); setShowRequestModal(true); }}
                                    className="flex-shrink-0 text-[9px] font-black text-white bg-[#064e3b] border border-[#064e3b] px-3 py-1.5 rounded-xl hover:bg-emerald-800 transition-all uppercase tracking-wide"
                                >
                                    Request
                                </button>
```
Replace with:
```tsx
                                {p.has_payment_profile ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([p.id])); setShowRequestModal(true); }}
                                        className="flex-shrink-0 text-[9px] font-black text-white bg-[#064e3b] border border-[#064e3b] px-3 py-1.5 rounded-xl hover:bg-emerald-800 transition-all uppercase tracking-wide"
                                    >
                                        Request
                                    </button>
                                ) : (
                                    <span
                                        title="This provider hasn't set up payment details yet"
                                        className="flex-shrink-0 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl uppercase tracking-wide cursor-not-allowed"
                                    >
                                        Not Available
                                    </span>
                                )}
```

- [ ] **Step 4: Verify it compiles and renders**
```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 5: Commit**
```bash
git add frontend/app/user/providers/page.tsx
git commit -m "feat: provider list eligibility gate — disable Send Request if no payment profile"
```

---

## Task 13: Pay Provider panel — booking detail page

**Files:**
- Modify: `frontend/app/user/bookings/[id]/page.tsx`

- [ ] **Step 1: Add PayDetails interface and state**

In `frontend/app/user/bookings/[id]/page.tsx`, add the interface after the existing interfaces:
```tsx
interface PayDetails {
    account_holder_name: string;
    account_number_masked: string;
    ifsc_code: string;
    upi_id?: string;
    upi_qr_image_url?: string;
    has_upi: boolean;
    has_qr: boolean;
}
```

Add `flow_type` and `provider_id` to `BookingData`:
```tsx
interface BookingData {
    id: string | number;
    status: string;
    service_type: string;
    estimated_cost?: number;
    final_cost?: number;
    property_details?: string;
    scheduled_at: string;
    issue_description?: string;
    actual_hours?: number | string;
    completion_notes?: string;
    review?: unknown;
    status_history?: { status: string; notes: string; timestamp: string }[];
    chats?: ChatMessage[];
    user_id?: string;
    provider?: BookingProvider;
    provider_id?: string;
    flow_type?: string;
}
```

Add state variables inside `BookingDetailsPage`:
```tsx
const [payDetails, setPayDetails] = useState<PayDetails | null>(null);
const [payTab, setPayTab] = useState<"bank" | "upi" | "qr">("bank");
const [copied, setCopied] = useState(false);
```

- [ ] **Step 2: Fetch pay-details when appropriate**

In `fetchData`, after `setBooking(data)`, add:
```tsx
if (data.flow_type === "systematic" && data.status === "Pending Confirmation" && data.provider_id) {
    apiFetch(`/payment/provider/${data.provider_id}/pay-details`)
        .then(setPayDetails)
        .catch(() => {});
}
```

- [ ] **Step 3: Add the Pay Provider panel to JSX**

Find where the receipt/confirm section is rendered (search for `Pending Confirmation` or `receipt` in the JSX). Add the Pay Provider panel right before the existing confirm button section, conditional on `booking.flow_type === "systematic"`:

```tsx
{booking?.flow_type === "systematic" && booking.status === "Pending Confirmation" && payDetails && (
    <div className="bg-white border border-emerald-100 rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pay Provider</p>
            <p className="text-base font-black text-emerald-700">
                ₹{booking.final_cost?.toLocaleString() ?? booking.estimated_cost?.toLocaleString()}
            </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 mb-4 bg-slate-50 p-1 rounded-xl">
            {(["bank", "upi", "qr"] as const).map((tab) => {
                const disabled = (tab === "upi" && !payDetails.has_upi) || (tab === "qr" && !payDetails.has_qr);
                const labels = { bank: "Bank Transfer", upi: "UPI", qr: "QR Scanner" };
                return (
                    <button
                        key={tab}
                        onClick={() => !disabled && setPayTab(tab)}
                        disabled={disabled}
                        className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all ${
                            payTab === tab
                                ? "bg-white text-[#064e3b] shadow-sm"
                                : disabled
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {labels[tab]}
                    </button>
                );
            })}
        </div>

        {/* Bank Transfer */}
        {payTab === "bank" && (
            <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Name</span>
                    <span className="font-black text-slate-900">{payDetails.account_holder_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Account No.</span>
                    <span className="font-black text-slate-900 font-mono">{payDetails.account_number_masked}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">IFSC</span>
                    <span className="font-black text-slate-900">{payDetails.ifsc_code}</span>
                </div>
            </div>
        )}

        {/* UPI */}
        {payTab === "upi" && payDetails.upi_id && (
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">UPI ID</p>
                    <p className="font-black text-slate-900">{payDetails.upi_id}</p>
                </div>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(payDetails.upi_id!);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
        )}

        {/* QR Scanner */}
        {payTab === "qr" && payDetails.upi_qr_image_url && (
            <div className="flex justify-center">
                <img
                    src={payDetails.upi_qr_image_url}
                    alt="UPI QR Code"
                    className="w-48 h-48 object-contain rounded-xl border border-slate-100"
                />
            </div>
        )}
    </div>
)}
```

- [ ] **Step 4: Add CreditCard to lucide-react imports if needed**
```tsx
import { ClockIcon, Calendar, ChevronLeft, Settings, AlertTriangle,
    ShieldCheck, Send, Phone, MapPin, X, FileText, Star, CheckCircle2,
    IndianRupee, CreditCard } from "lucide-react";
```

- [ ] **Step 5: Verify it compiles**
```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 6: Commit**
```bash
git add frontend/app/user/bookings/[id]/page.tsx
git commit -m "feat: Pay Provider panel on booking detail page (systematic flow)"
```

---

## Task 14: Pay Provider panel — receipt page

**Files:**
- Modify: `frontend/app/user/bookings/[id]/receipt/page.tsx`

- [ ] **Step 1: Add flow_type and provider_id to Receipt interface and state**

In `frontend/app/user/bookings/[id]/receipt/page.tsx`, update the `Receipt` interface:
```tsx
interface Receipt {
  booking_id: string;
  service_type: string;
  servicer_name: string;
  base_price: number;
  extra_hours: number;
  hourly_rate: number;
  extra_charge: number;
  final_amount: number;
  completed_at: string | null;
  negotiated: boolean;
  flow_type?: string;
  provider_id?: string;
}
```

Add state variables inside `ReceiptPage`:
```tsx
const [payDetails, setPayDetails] = useState<{
    account_holder_name: string;
    account_number_masked: string;
    ifsc_code: string;
    upi_id?: string;
    upi_qr_image_url?: string;
    has_upi: boolean;
    has_qr: boolean;
} | null>(null);
const [payTab, setPayTab] = useState<"bank" | "upi" | "qr">("bank");
const [copied, setCopied] = useState(false);
```

- [ ] **Step 2: Fetch pay-details after receipt loads**

In the `useEffect` that fetches the receipt, after `setReceipt(data)`:
```tsx
apiFetch(`/bookings/${id}/receipt`)
    .then(data => {
        setReceipt(data);
        if (data.flow_type === "systematic" && data.provider_id) {
            apiFetch(`/payment/provider/${data.provider_id}/pay-details`)
                .then(setPayDetails)
                .catch(() => {});
        }
    })
    .catch(() => toast.error("Failed to load receipt"))
    .finally(() => setLoading(false));
```

- [ ] **Step 3: Add the Pay Provider panel to JSX**

In the receipt page JSX, after the price breakdown section (after the `border-t` Total line) and before the "Dispute Extra Charges" button, add:

```tsx
{receipt.flow_type === "systematic" && payDetails && (
    <div className="border-t border-slate-100 pt-4 mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Pay Provider</p>

        {/* Tab selector */}
        <div className="flex gap-1 mb-3 bg-slate-50 p-1 rounded-xl">
            {(["bank", "upi", "qr"] as const).map((tab) => {
                const disabled = (tab === "upi" && !payDetails.has_upi) || (tab === "qr" && !payDetails.has_qr);
                const labels = { bank: "Bank", upi: "UPI", qr: "QR" };
                return (
                    <button
                        key={tab}
                        onClick={() => !disabled && setPayTab(tab)}
                        disabled={disabled}
                        className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all ${
                            payTab === tab
                                ? "bg-white text-[#064e3b] shadow-sm"
                                : disabled
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {labels[tab]}
                    </button>
                );
            })}
        </div>

        {payTab === "bank" && (
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-500">Name</span>
                    <span className="font-bold text-slate-900">{payDetails.account_holder_name}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">Account</span>
                    <span className="font-bold text-slate-900 font-mono">{payDetails.account_number_masked}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">IFSC</span>
                    <span className="font-bold text-slate-900">{payDetails.ifsc_code}</span>
                </div>
            </div>
        )}

        {payTab === "upi" && payDetails.upi_id && (
            <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-900">{payDetails.upi_id}</span>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(payDetails.upi_id!);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
        )}

        {payTab === "qr" && payDetails.upi_qr_image_url && (
            <div className="flex justify-center">
                <img
                    src={payDetails.upi_qr_image_url}
                    alt="UPI QR Code"
                    className="w-44 h-44 object-contain rounded-xl border border-slate-100"
                />
            </div>
        )}
    </div>
)}
```

- [ ] **Step 4: Verify it compiles**
```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 5: Commit**
```bash
git add frontend/app/user/bookings/[id]/receipt/page.tsx
git commit -m "feat: Pay Provider panel on receipt page (systematic flow)"
```

---

## Final Verification Checklist

- [ ] Backend starts without errors: `uvicorn app.main:app --reload --port 8000`
- [ ] Migration applied: `alembic current` shows `c9f4e2a83b56 (head)`
- [ ] Payment endpoints visible in `/api/v1/docs` under "Payment" tag
- [ ] Provider list response includes `has_payment_profile` field
- [ ] Receipt response includes `flow_type` and `provider_id` fields
- [ ] Frontend builds without errors: `npm run build`
- [ ] User settings sidebar shows "Payment" tab linking to `/user/settings/payment`
- [ ] Service settings sidebar shows "Payment" tab linking to `/service/settings/payment`
- [ ] Provider dashboard shows amber banner when no payment profile set
- [ ] Provider cards show "Not yet accepting bookings" badge for providers without payment profile
- [ ] Pay Provider panel appears on booking detail page when `flow_type=systematic` and status is `Pending Confirmation`
- [ ] Pay Provider panel appears on receipt page under same conditions
- [ ] Bank Transfer tab shows masked account number and IFSC only
- [ ] UPI tab is disabled if provider has no UPI ID
- [ ] QR tab is disabled if provider has no QR image URL
- [ ] No raw account number ever returned by any API endpoint

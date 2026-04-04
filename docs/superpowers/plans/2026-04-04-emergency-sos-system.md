# Emergency SOS System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing single-assign emergency flow with a full broadcast→response→select→track Emergency SOS system, backed by Super Admin-controlled fixed pricing, auto-penalties, and real-time WebSocket updates.

**Architecture:** New dedicated `emergency_requests`, `emergency_responses`, `emergency_config`, `emergency_penalty_config`, and `emergency_star_adjustments` tables sit independently from bookings. After a user accepts a servicer response, a standard `ServiceBooking` (priority="Emergency") is created and all existing booking infrastructure (chat, status, billing, review) takes over. WebSockets power real-time response streaming.

**Tech Stack:** FastAPI, SQLAlchemy 1.x (Column style), Pydantic v2, Alembic, PostgreSQL, FastAPI WebSockets (uvicorn[standard]), Next.js App Router, TypeScript, Tailwind CSS, lucide-react.

---

## File Map

### Backend — New Files
- `backend/app/api/emergency/__init__.py` — package init
- `backend/app/api/emergency/endpoint.py` — user SOS + servicer emergency routes
- `backend/app/api/admin/emergency_endpoint.py` — admin config, oversight, star management
- `backend/app/websockets/__init__.py` — package init
- `backend/app/websockets/emergency.py` — ConnectionManager + WebSocket handlers
- `backend/alembic/versions/04_04_2026_add_emergency_sos_system.py` — migration
- `backend/tests/conftest.py` — shared pytest fixtures (SQLite in-memory DB)
- `backend/tests/test_emergency_services.py` — unit tests for billing + penalty logic

### Backend — Modified Files
- `backend/app/internal/models.py` — add 5 new models, add `emergency_requests` relationship to User
- `backend/app/internal/schemas.py` — replace old `EmergencyCreate`/`EmergencyResponse`, add all new schemas
- `backend/app/internal/services.py` — add `calculate_emergency_bill()`, `apply_star_delta()`, `EMERGENCY_CATEGORIES`
- `backend/app/api/booking/endpoint.py` — remove `POST /emergency` endpoint, remove `EMERGENCY_RATE_MULTIPLIER` import
- `backend/app/main.py` — register 3 new routers + 2 WebSocket endpoints

### Frontend — New Files
- `frontend/app/admin/emergency/page.tsx` — admin emergency panel

### Frontend — Modified Files
- `frontend/app/user/bookings/emergency/page.tsx` — full replacement (warning → form → live feed → confirmed)
- `frontend/app/service/jobs/page.tsx` — add Emergency tab with WebSocket
- `frontend/components/layout/Sidebar.tsx` — add Emergency entry to ADMIN_NAV
- `frontend/lib/api.ts` — add emergency API helper functions

---

## Task 1: DB Models

**Files:**
- Modify: `backend/app/internal/models.py`

- [ ] **Step 1: Write a test that imports the new models**

Create `backend/tests/test_emergency_services.py`:

```python
def test_emergency_models_importable():
    from app.internal.models import (
        EmergencyConfig,
        EmergencyPenaltyConfig,
        EmergencyRequest,
        EmergencyResponse,
        EmergencyStarAdjustment,
    )
    assert EmergencyConfig.__tablename__ == "emergency_config"
    assert EmergencyPenaltyConfig.__tablename__ == "emergency_penalty_config"
    assert EmergencyRequest.__tablename__ == "emergency_requests"
    assert EmergencyResponse.__tablename__ == "emergency_responses"
    assert EmergencyStarAdjustment.__tablename__ == "emergency_star_adjustments"
```

- [ ] **Step 2: Run test to confirm it fails**

Run from `backend/` directory:
```bash
cd backend && python -m pytest tests/test_emergency_services.py::test_emergency_models_importable -v
```
Expected: `ImportError` — models don't exist yet.

- [ ] **Step 3: Add 5 new models to `backend/app/internal/models.py`**

Append after the last class (`ServiceRequestResponse`) in `models.py`:

```python
class EmergencyConfig(Base):
    __tablename__ = "emergency_config"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, unique=True, nullable=False)   # e.g. "Electrical"
    callout_fee = Column(Float, default=0.0)                 # Flat fee for first hour
    hourly_rate = Column(Float, default=0.0)                 # Rate billed per hour after hour 1
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    requests = relationship("EmergencyRequest", back_populates="config")


class EmergencyPenaltyConfig(Base):
    __tablename__ = "emergency_penalty_config"

    id = Column(Integer, primary_key=True, index=True)
    # event_type: LATE_ARRIVAL | CANCELLATION | NO_SHOW
    event_type = Column(String, unique=True, nullable=False)
    star_deduction = Column(Float, default=0.5)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    society_name = Column(String, nullable=False)
    building_name = Column(String, nullable=False)
    flat_no = Column(String, nullable=False)
    landmark = Column(String, nullable=False)
    full_address = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    device_name = Column(String, nullable=True)
    photos = Column(Text, nullable=True)           # JSON list of URLs, max 3
    contact_name = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    # status: PENDING | ACTIVE | COMPLETED | CANCELLED | EXPIRED
    status = Column(String, default="PENDING", nullable=False)
    config_id = Column(Integer, ForeignKey("emergency_config.id"), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    resulting_booking_id = Column(Integer, ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="emergency_requests")
    config = relationship("EmergencyConfig", back_populates="requests")
    responses = relationship("EmergencyResponse", back_populates="request", cascade="all, delete-orphan")
    resulting_booking = relationship("ServiceBooking", foreign_keys=[resulting_booking_id])


class EmergencyResponse(Base):
    __tablename__ = "emergency_responses"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("emergency_requests.id"), nullable=False)
    provider_id = Column(Integer, ForeignKey("service_providers.id"), nullable=False)
    arrival_time = Column(DateTime, nullable=False)
    # status: PENDING | ACCEPTED | REJECTED | CANCELLED
    status = Column(String, default="PENDING", nullable=False)
    penalty_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    request = relationship("EmergencyRequest", back_populates="responses")
    provider = relationship("ServiceProvider")


class EmergencyStarAdjustment(Base):
    __tablename__ = "emergency_star_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("service_providers.id"), nullable=False)
    adjusted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    delta = Column(Float, nullable=False)         # positive = increase, negative = decrease
    reason = Column(Text, nullable=False)
    # event_type: AUTO_PENALTY | MANUAL_ADJUST | EMERGENCY_BONUS | REVIEW
    event_type = Column(String, nullable=False)
    emergency_request_id = Column(Integer, ForeignKey("emergency_requests.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider")
    admin_user = relationship("User", foreign_keys=[adjusted_by])
```

- [ ] **Step 4: Add `emergency_requests` relationship to the `User` model**

In `models.py`, inside the `User` class, add after the `service_requests` relationship line:

```python
    emergency_requests = relationship("EmergencyRequest", back_populates="user")
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
cd backend && python -m pytest tests/test_emergency_services.py::test_emergency_models_importable -v
```
Expected: `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/app/internal/models.py backend/tests/test_emergency_services.py
git commit -m "feat: add Emergency SOS DB models (5 new tables)"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/04_04_2026_add_emergency_sos_system.py`

- [ ] **Step 1: Create the migration file**

Create `backend/alembic/versions/04_04_2026_add_emergency_sos_system.py`:

```python
"""add emergency sos system tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-04 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'emergency_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('callout_fee', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('hourly_rate', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category'),
    )
    op.create_index('ix_emergency_config_id', 'emergency_config', ['id'])

    op.create_table(
        'emergency_penalty_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('star_deduction', sa.Float(), nullable=True, server_default='0.5'),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_type'),
    )
    op.create_index('ix_emergency_penalty_config_id', 'emergency_penalty_config', ['id'])

    op.create_table(
        'emergency_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('society_name', sa.String(), nullable=False),
        sa.Column('building_name', sa.String(), nullable=False),
        sa.Column('flat_no', sa.String(), nullable=False),
        sa.Column('landmark', sa.String(), nullable=False),
        sa.Column('full_address', sa.Text(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('device_name', sa.String(), nullable=True),
        sa.Column('photos', sa.Text(), nullable=True),
        sa.Column('contact_name', sa.String(), nullable=False),
        sa.Column('contact_phone', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('config_id', sa.Integer(), sa.ForeignKey('emergency_config.id'), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('resulting_booking_id', sa.Integer(), sa.ForeignKey('service_bookings.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_emergency_requests_id', 'emergency_requests', ['id'])
    op.create_index('ix_emergency_requests_user_id', 'emergency_requests', ['user_id'])

    op.create_table(
        'emergency_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), sa.ForeignKey('emergency_requests.id'), nullable=False),
        sa.Column('provider_id', sa.Integer(), sa.ForeignKey('service_providers.id'), nullable=False),
        sa.Column('arrival_time', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('penalty_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_emergency_responses_id', 'emergency_responses', ['id'])
    op.create_index('ix_emergency_responses_request_id', 'emergency_responses', ['request_id'])

    op.create_table(
        'emergency_star_adjustments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), sa.ForeignKey('service_providers.id'), nullable=False),
        sa.Column('adjusted_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('delta', sa.Float(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('emergency_request_id', sa.Integer(), sa.ForeignKey('emergency_requests.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_emergency_star_adjustments_id', 'emergency_star_adjustments', ['id'])
    op.create_index('ix_emergency_star_adjustments_provider_id', 'emergency_star_adjustments', ['provider_id'])


def downgrade() -> None:
    op.drop_table('emergency_star_adjustments')
    op.drop_table('emergency_responses')
    op.drop_table('emergency_requests')
    op.drop_table('emergency_penalty_config')
    op.drop_table('emergency_config')
```

- [ ] **Step 2: Verify the migration runs without error (requires DB connection)**

```bash
cd backend && alembic upgrade head
```
Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/04_04_2026_add_emergency_sos_system.py
git commit -m "feat: alembic migration — add emergency SOS system tables"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Modify: `backend/app/internal/schemas.py`

- [ ] **Step 1: Write a test for the new schemas**

Add to `backend/tests/test_emergency_services.py`:

```python
def test_emergency_schemas_importable():
    from app.internal.schemas import (
        EmergencyConfigCreate, EmergencyConfigRead,
        EmergencyPenaltyConfigRead, EmergencyPenaltyConfigUpdate,
        EmergencyRequestCreate, EmergencyRequestRead,
        EmergencyResponseCreate, EmergencyResponseRead,
        EmergencyStarAdjustCreate, EmergencyStarAdjustRead,
        AdminProviderStatusUpdate,
    )
    assert EmergencyConfigCreate.__name__ == "EmergencyConfigCreate"

def test_emergency_request_create_validation():
    from app.internal.schemas import EmergencyRequestCreate
    import pytest
    # description max 500 chars
    with pytest.raises(Exception):
        EmergencyRequestCreate(
            society_name="S",
            building_name="B",
            flat_no="101",
            landmark="L",
            full_address="A",
            category="Electrical",
            description="x" * 501,
            contact_name="Test",
            contact_phone="9999999999",
            provider_ids=[1],
        )
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python -m pytest tests/test_emergency_services.py::test_emergency_schemas_importable tests/test_emergency_services.py::test_emergency_request_create_validation -v
```
Expected: `ImportError`

- [ ] **Step 3: Remove old emergency schemas from `schemas.py`**

In `backend/app/internal/schemas.py`, delete these lines (they are around line 207–218):

```python
class EmergencyCreate(BaseModel):
    category: str
    description: str
    location: Optional[str] = None

class EmergencyResponse(BaseModel):
    provider_found: bool
    booking_id: Optional[int] = None
    provider_name: Optional[str] = None
    provider_id: Optional[int] = None
    redirect_url: Optional[str] = None
```

- [ ] **Step 4: Append new emergency schemas at the end of `schemas.py`**

```python
# ────────────────────────────────────────────────────────────
# Emergency SOS Schemas
# ────────────────────────────────────────────────────────────

EMERGENCY_CATEGORY_OPTIONS = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
]

# --- Config (Admin manages) ---

class EmergencyConfigCreate(BaseModel):
    category: str
    callout_fee: float
    hourly_rate: float

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EMERGENCY_CATEGORY_OPTIONS:
            raise ValueError(f"category must be one of: {EMERGENCY_CATEGORY_OPTIONS}")
        return v

    @field_validator("callout_fee", "hourly_rate")
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Fee/rate cannot be negative")
        return v


class EmergencyConfigUpdate(BaseModel):
    callout_fee: Optional[float] = None
    hourly_rate: Optional[float] = None

    @field_validator("callout_fee", "hourly_rate")
    @classmethod
    def validate_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Fee/rate cannot be negative")
        return v


class EmergencyConfigRead(BaseModel):
    id: int
    category: str
    callout_fee: float
    hourly_rate: float
    updated_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Penalty Config ---

class EmergencyPenaltyConfigUpdate(BaseModel):
    star_deduction: float

    @field_validator("star_deduction")
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("star_deduction cannot be negative")
        return v


class EmergencyPenaltyConfigRead(BaseModel):
    id: int
    event_type: str
    star_deduction: float
    updated_by: Optional[int] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Emergency Request ---

class EmergencyRequestCreate(BaseModel):
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    provider_ids: List[int]           # Selected servicer provider IDs

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EMERGENCY_CATEGORY_OPTIONS:
            raise ValueError(f"category must be one of: {EMERGENCY_CATEGORY_OPTIONS}")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if len(v) > 500:
            raise ValueError("description cannot exceed 500 characters")
        return v

    @field_validator("photos")
    @classmethod
    def validate_photos(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v and len(v) > 3:
            raise ValueError("Maximum 3 photos allowed")
        return v

    @field_validator("provider_ids")
    @classmethod
    def validate_providers(cls, v: List[int]) -> List[int]:
        if not v:
            raise ValueError("At least one provider must be selected")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate provider IDs are not allowed")
        return v


class EmergencyResponseRead(BaseModel):
    id: int
    request_id: int
    provider_id: int
    arrival_time: datetime
    status: str
    penalty_count: int
    created_at: Optional[datetime] = None
    provider: Optional[ProviderResponse] = None

    class Config:
        from_attributes = True


class EmergencyRequestRead(BaseModel):
    id: int
    user_id: int
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    status: str
    config_id: Optional[int] = None
    expires_at: datetime
    resulting_booking_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    responses: List[EmergencyResponseRead] = []
    config: Optional[EmergencyConfigRead] = None

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True


# --- Servicer Response ---

class EmergencyResponseCreate(BaseModel):
    arrival_time: datetime


# --- Star Adjustments ---

class EmergencyStarAdjustCreate(BaseModel):
    delta: float
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("reason cannot be empty")
        return v


class EmergencyStarAdjustRead(BaseModel):
    id: int
    provider_id: int
    adjusted_by: int
    delta: float
    reason: str
    event_type: str
    emergency_request_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Admin Provider Status ---

class AdminProviderStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


# --- Incoming Emergency (Servicer side) ---

class IncomingEmergencyRead(BaseModel):
    id: int
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    callout_fee: Optional[float] = None
    hourly_rate: Optional[float] = None
    has_responded: bool = False

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True
```

- [ ] **Step 5: Run tests**

```bash
cd backend && python -m pytest tests/test_emergency_services.py::test_emergency_schemas_importable tests/test_emergency_services.py::test_emergency_request_create_validation -v
```
Expected: both `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/app/internal/schemas.py backend/tests/test_emergency_services.py
git commit -m "feat: add Emergency SOS Pydantic schemas, remove old emergency schemas"
```

---

## Task 4: Business Logic

**Files:**
- Modify: `backend/app/internal/services.py`

- [ ] **Step 1: Write tests for the new service functions**

Add to `backend/tests/test_emergency_services.py`:

```python
def test_calculate_emergency_bill_first_hour():
    from app.internal.services import calculate_emergency_bill
    # 0.5 hours — still minimum (callout_fee covers first hour)
    result = calculate_emergency_bill(callout_fee=500.0, hourly_rate=400.0, actual_hours=0.5)
    assert result == 500.0

def test_calculate_emergency_bill_exactly_one_hour():
    from app.internal.services import calculate_emergency_bill
    result = calculate_emergency_bill(callout_fee=500.0, hourly_rate=400.0, actual_hours=1.0)
    assert result == 500.0

def test_calculate_emergency_bill_over_one_hour():
    from app.internal.services import calculate_emergency_bill
    # 2h15m = 2.25 hours; extra = 1.25 hrs beyond first hour
    result = calculate_emergency_bill(callout_fee=500.0, hourly_rate=400.0, actual_hours=2.25)
    assert abs(result - (500.0 + 1.25 * 400.0)) < 0.01   # 1000.0

def test_calculate_emergency_bill_zero_hours():
    from app.internal.services import calculate_emergency_bill
    # minimum charge is callout_fee
    result = calculate_emergency_bill(callout_fee=500.0, hourly_rate=400.0, actual_hours=0.0)
    assert result == 500.0

def test_apply_star_delta_clamps_at_zero():
    """Rating should never go below 0."""
    from unittest.mock import MagicMock
    from app.internal.services import apply_star_delta
    provider = MagicMock()
    provider.rating = 0.3
    apply_star_delta(provider, delta=-1.0)
    assert provider.rating == 0.0

def test_apply_star_delta_clamps_at_five():
    """Rating should never exceed 5.0."""
    from unittest.mock import MagicMock
    from app.internal.services import apply_star_delta
    provider = MagicMock()
    provider.rating = 4.9
    apply_star_delta(provider, delta=0.5)
    assert provider.rating == 5.0

def test_apply_star_delta_normal():
    from unittest.mock import MagicMock
    from app.internal.services import apply_star_delta
    provider = MagicMock()
    provider.rating = 3.0
    apply_star_delta(provider, delta=-0.5)
    assert abs(provider.rating - 2.5) < 0.001
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python -m pytest tests/test_emergency_services.py -k "bill or star_delta" -v
```
Expected: `ImportError` or `AttributeError`

- [ ] **Step 3: Add functions to `backend/app/internal/services.py`**

Append after the existing `find_verified_provider` function:

```python
# ── Emergency SOS ──

EMERGENCY_CATEGORIES = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
]


def calculate_emergency_bill(callout_fee: float, hourly_rate: float, actual_hours: float) -> float:
    """
    Billing formula:
      - callout_fee covers the first hour (minimum charge)
      - each hour beyond the first is billed at hourly_rate
      - actual_hours below 1.0 still result in callout_fee only
    """
    extra_hours = max(0.0, actual_hours - 1.0)
    return callout_fee + (extra_hours * hourly_rate)


def apply_star_delta(provider: "ServiceProvider", delta: float) -> None:
    """Mutates provider.rating, clamped to [0.0, 5.0]. Caller must commit."""
    provider.rating = max(0.0, min(5.0, provider.rating + delta))
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/test_emergency_services.py -k "bill or star_delta" -v
```
Expected: all `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/internal/services.py backend/tests/test_emergency_services.py
git commit -m "feat: add calculate_emergency_bill and apply_star_delta to services"
```

---

## Task 5: Remove Old Emergency Endpoint from Bookings

**Files:**
- Modify: `backend/app/api/booking/endpoint.py`

- [ ] **Step 1: Open `backend/app/api/booking/endpoint.py` and locate the `POST /emergency` endpoint**

It starts with `@router.post("/emergency", response_model=schemas.EmergencyResponse)` and ends before the next `@router` decorator. Delete that entire endpoint function (roughly 40–50 lines).

- [ ] **Step 2: Update the import line at the top of `booking/endpoint.py`**

Change:
```python
from app.internal.services import (
    find_verified_provider, get_provider_display_name,
    ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS, EMERGENCY_RATE_MULTIPLIER,
)
```
To (remove `EMERGENCY_RATE_MULTIPLIER` and `find_verified_provider` if only used by emergency):
```python
from app.internal.services import (
    get_provider_display_name,
    ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS,
)
```

Note: `find_verified_provider` may still be imported by `task/endpoint.py` — do not remove it from `services.py`, only from the booking endpoint import.

- [ ] **Step 3: Verify the booking module still imports cleanly**

```bash
cd backend && python -c "from app.api.booking.endpoint import router; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/booking/endpoint.py
git commit -m "refactor: remove old single-assign emergency endpoint from bookings"
```

---

## Task 6: WebSocket Connection Manager

**Files:**
- Create: `backend/app/websockets/__init__.py`
- Create: `backend/app/websockets/emergency.py`

- [ ] **Step 1: Create the package init**

Create `backend/app/websockets/__init__.py` (empty file):
```python
```

- [ ] **Step 2: Create `backend/app/websockets/emergency.py`**

```python
"""WebSocket connection manager for Emergency SOS real-time updates."""

import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class EmergencyConnectionManager:
    """
    Tracks two pools of WebSocket connections:
    - user_connections[request_id]  → single WebSocket for the user watching their SOS
    - servicer_connections[provider_id] → single WebSocket for a servicer watching for alerts
    """

    def __init__(self):
        # request_id → WebSocket
        self.user_connections: Dict[int, WebSocket] = {}
        # provider_id → WebSocket
        self.servicer_connections: Dict[int, WebSocket] = {}

    async def connect_user(self, request_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.user_connections[request_id] = websocket
        logger.info(f"User connected to emergency WS: request_id={request_id}")

    def disconnect_user(self, request_id: int) -> None:
        self.user_connections.pop(request_id, None)
        logger.info(f"User disconnected from emergency WS: request_id={request_id}")

    async def connect_servicer(self, provider_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.servicer_connections[provider_id] = websocket
        logger.info(f"Servicer connected to emergency alert WS: provider_id={provider_id}")

    def disconnect_servicer(self, provider_id: int) -> None:
        self.servicer_connections.pop(provider_id, None)
        logger.info(f"Servicer disconnected from emergency alert WS: provider_id={provider_id}")

    async def send_to_user(self, request_id: int, payload: dict) -> None:
        """Push a JSON message to the user watching this emergency request."""
        ws = self.user_connections.get(request_id)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception as e:
                logger.warning(f"Failed to send to user (request_id={request_id}): {e}")
                self.disconnect_user(request_id)

    async def send_to_servicer(self, provider_id: int, payload: dict) -> None:
        """Push a JSON message to a connected servicer."""
        ws = self.servicer_connections.get(provider_id)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception as e:
                logger.warning(f"Failed to send to servicer (provider_id={provider_id}): {e}")
                self.disconnect_servicer(provider_id)

    async def broadcast_alert_to_servicers(
        self, provider_ids: List[int], payload: dict
    ) -> None:
        """Send emergency_alert to all selected connected servicers."""
        for pid in provider_ids:
            await self.send_to_servicer(pid, payload)


# Singleton — shared across all routes and WebSocket handlers
emergency_manager = EmergencyConnectionManager()
```

- [ ] **Step 3: Verify the module imports cleanly**

```bash
cd backend && python -c "from app.websockets.emergency import emergency_manager; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/websockets/__init__.py backend/app/websockets/emergency.py
git commit -m "feat: add EmergencyConnectionManager WebSocket manager"
```

---

## Task 7: User SOS + Servicer Emergency Endpoints

**Files:**
- Create: `backend/app/api/emergency/__init__.py`
- Create: `backend/app/api/emergency/endpoint.py`

- [ ] **Step 1: Create the package init**

Create `backend/app/api/emergency/__init__.py` (empty):
```python
```

- [ ] **Step 2: Create `backend/app/api/emergency/endpoint.py`**

```python
"""Emergency SOS endpoints — User SOS creation + Servicer response."""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.internal import models, schemas, deps
from app.internal.services import EMERGENCY_CATEGORIES, apply_star_delta
from app.websockets.emergency import emergency_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Emergency SOS"])

user_or_secretary = deps.RoleChecker(["USER", "SECRETARY"])
servicer_only = deps.RoleChecker(["SERVICER"])

EMERGENCY_WINDOW_MINUTES = 5


def _notify(db: Session, user_id: int, title: str, message: str,
            notification_type: str = "INFO", link: Optional[str] = None) -> None:
    db.add(models.Notification(
        user_id=user_id, title=title, message=message,
        notification_type=notification_type, link=link,
    ))


# ── User SOS Routes ────────────────────────────────────────────────────────────

@router.get("/config", response_model=List[schemas.EmergencyConfigRead])
def get_emergency_configs(
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(deps.get_current_user),
):
    """All category price configs — readable by any authenticated user."""
    return db.query(models.EmergencyConfig).order_by(models.EmergencyConfig.category).all()


@router.get("/providers", response_model=List[schemas.ProviderResponse])
def get_available_providers(
    category: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(user_or_secretary),
):
    """List verified + available providers for manual selection."""
    query = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.is_verified == True,
        models.ServiceProvider.availability_status == "AVAILABLE",
    )
    if category:
        query = query.filter(
            (models.ServiceProvider.category == category) |
            (models.ServiceProvider.categories.like(f"%{category}%"))
        )
    return query.order_by(models.ServiceProvider.rating.desc()).all()


@router.post("/", response_model=schemas.EmergencyRequestRead)
async def create_emergency_request(
    request_in: schemas.EmergencyRequestCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    """Submit an SOS. Validates providers, creates emergency_request, broadcasts via WebSocket."""
    # Enforce one active emergency per user
    active = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.user_id == current_user.id,
        models.EmergencyRequest.status.in_(["PENDING", "ACTIVE"]),
    ).first()
    if active:
        raise HTTPException(
            status_code=409,
            detail="You already have an active emergency request. Cancel it before creating a new one."
        )

    # Validate providers exist and are available
    providers = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id.in_(request_in.provider_ids),
        models.ServiceProvider.is_verified == True,
        models.ServiceProvider.availability_status == "AVAILABLE",
    ).all()
    found_ids = {p.id for p in providers}
    missing = set(request_in.provider_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Provider IDs not found or unavailable: {list(missing)}"
        )

    # Look up config for the category
    config = db.query(models.EmergencyConfig).filter(
        models.EmergencyConfig.category == request_in.category
    ).first()

    now = datetime.utcnow()
    emergency = models.EmergencyRequest(
        user_id=current_user.id,
        society_name=request_in.society_name,
        building_name=request_in.building_name,
        flat_no=request_in.flat_no,
        landmark=request_in.landmark,
        full_address=request_in.full_address,
        category=request_in.category,
        description=request_in.description,
        device_name=request_in.device_name,
        photos=json.dumps(request_in.photos) if request_in.photos else None,
        contact_name=request_in.contact_name,
        contact_phone=request_in.contact_phone,
        status="PENDING",
        config_id=config.id if config else None,
        expires_at=now + timedelta(minutes=EMERGENCY_WINDOW_MINUTES),
    )
    db.add(emergency)
    db.commit()
    db.refresh(emergency)

    # Notify selected providers via notification + WebSocket
    alert_payload = {
        "event": "emergency_alert",
        "request_id": emergency.id,
        "category": emergency.category,
        "description": emergency.description,
        "society_name": emergency.society_name,
        "building_name": emergency.building_name,
        "flat_no": emergency.flat_no,
        "landmark": emergency.landmark,
        "full_address": emergency.full_address,
        "contact_name": emergency.contact_name,
        "contact_phone": emergency.contact_phone,
        "expires_at": emergency.expires_at.isoformat(),
        "callout_fee": config.callout_fee if config else None,
        "hourly_rate": config.hourly_rate if config else None,
    }

    for provider in providers:
        if provider.user_id:
            _notify(
                db, provider.user_id,
                title="🚨 Emergency SOS Alert",
                message=f"Emergency {request_in.category} at {request_in.building_name}, {request_in.flat_no}. Respond within 5 minutes.",
                notification_type="URGENT",
                link=f"/service/jobs?tab=emergency",
            )
        background_tasks.add_task(
            emergency_manager.send_to_servicer, provider.id, alert_payload
        )

    db.commit()
    db.refresh(emergency)
    return emergency


@router.get("/incoming-servicer", response_model=List[schemas.IncomingEmergencyRead])
def list_incoming_emergencies(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    """List active emergency requests that this servicer was selected for."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    # Find emergencies where this provider was included (has a response row or check via notification)
    # We check emergency_responses for PENDING from this provider, or PENDING emergencies overall
    # that haven't expired yet and are in PENDING status
    now = datetime.utcnow()
    emergencies = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.status == "PENDING",
        models.EmergencyRequest.expires_at > now,
    ).all()

    result = []
    for em in emergencies:
        # Check if this provider was notified (has a response row or was in provider_ids)
        # We infer from emergency_responses: if a response exists → already responded
        existing_response = db.query(models.EmergencyResponse).filter(
            models.EmergencyResponse.request_id == em.id,
            models.EmergencyResponse.provider_id == provider.id,
        ).first()

        config = em.config
        incoming = schemas.IncomingEmergencyRead(
            id=em.id,
            society_name=em.society_name,
            building_name=em.building_name,
            flat_no=em.flat_no,
            landmark=em.landmark,
            full_address=em.full_address,
            category=em.category,
            description=em.description,
            device_name=em.device_name,
            photos=em.photos,
            contact_name=em.contact_name,
            contact_phone=em.contact_phone,
            expires_at=em.expires_at,
            created_at=em.created_at,
            callout_fee=config.callout_fee if config else None,
            hourly_rate=config.hourly_rate if config else None,
            has_responded=existing_response is not None,
        )
        result.append(incoming)

    return result


@router.get("/{request_id}", response_model=schemas.EmergencyRequestRead)
def get_emergency_request(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Get a single emergency request with all responses so far."""
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    # Users can only see their own; admins see all
    if current_user.role not in ("ADMIN",) and em.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return em


@router.post("/{request_id}/accept/{response_id}", response_model=schemas.BookingRead)
async def accept_emergency_response(
    request_id: int,
    response_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    """User accepts a servicer response → creates ServiceBooking, closes emergency."""
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id,
        models.EmergencyRequest.user_id == current_user.id,
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if em.status not in ("PENDING", "ACTIVE"):
        raise HTTPException(status_code=400, detail="Emergency request is no longer active")

    resp = db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.id == response_id,
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.status == "PENDING",
    ).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found or already processed")

    # Create ServiceBooking
    config = em.config
    estimated_cost = config.callout_fee if config else 0.0

    booking = models.ServiceBooking(
        user_id=current_user.id,
        provider_id=resp.provider_id,
        service_type=em.category,
        scheduled_at=resp.arrival_time,
        priority="Emergency",
        issue_description=em.description,
        property_details=f"{em.society_name}, {em.building_name}, {em.flat_no}",
        estimated_cost=estimated_cost,
    )
    db.add(booking)
    db.flush()  # get booking.id

    # Status history
    db.add(models.BookingStatusHistory(
        booking_id=booking.id,
        status="Pending",
        notes="Emergency SOS booking created",
    ))

    # Close the emergency request
    em.resulting_booking_id = booking.id
    em.status = "ACTIVE"

    # Mark accepted response
    resp.status = "ACCEPTED"

    # Reject all other PENDING responses for this emergency
    db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.id != response_id,
        models.EmergencyResponse.status == "PENDING",
    ).update({"status": "REJECTED"})

    db.commit()
    db.refresh(booking)

    # Notify user and selected servicer
    _notify(db, current_user.id, "Booking Confirmed",
            f"Emergency {em.category} booking confirmed with your servicer.",
            notification_type="INFO", link=f"/user/bookings/{booking.id}")

    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == resp.provider_id
    ).first()
    if provider and provider.user_id:
        _notify(db, provider.user_id, "Emergency Job Accepted",
                f"You have been selected for emergency {em.category}. Proceed to the location.",
                notification_type="URGENT", link=f"/service/jobs")

    db.commit()

    # Notify WebSocket: request closed
    await emergency_manager.send_to_user(request_id, {
        "event": "request_accepted",
        "booking_id": booking.id,
        "provider_id": resp.provider_id,
    })

    return booking


@router.post("/{request_id}/cancel")
async def cancel_emergency_request(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(user_or_secretary),
):
    """User cancels the emergency before accepting any response."""
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id,
        models.EmergencyRequest.user_id == current_user.id,
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    if em.status not in ("PENDING", "ACTIVE"):
        raise HTTPException(status_code=400, detail="Only PENDING or ACTIVE requests can be cancelled")

    em.status = "CANCELLED"
    db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.status == "PENDING",
    ).update({"status": "CANCELLED"})
    db.commit()

    await emergency_manager.send_to_user(request_id, {"event": "request_cancelled"})
    return {"detail": "Emergency request cancelled"}


# ── Servicer Routes ────────────────────────────────────────────────────────────

servicer_router = APIRouter(tags=["Emergency SOS — Servicer"])


@servicer_router.post("/{request_id}/respond", response_model=schemas.EmergencyResponseRead)
async def respond_to_emergency(
    request_id: int,
    response_in: schemas.EmergencyResponseCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    """Servicer accepts an emergency with a committed arrival time."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id,
        models.EmergencyRequest.status == "PENDING",
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found or no longer accepting responses")

    now = datetime.utcnow()
    if now > em.expires_at:
        em.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=410, detail="Emergency request has expired")

    # Prevent duplicate responses
    existing = db.query(models.EmergencyResponse).filter(
        models.EmergencyResponse.request_id == request_id,
        models.EmergencyResponse.provider_id == provider.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already responded to this emergency")

    response = models.EmergencyResponse(
        request_id=request_id,
        provider_id=provider.id,
        arrival_time=response_in.arrival_time,
        status="PENDING",
    )
    db.add(response)
    db.commit()
    db.refresh(response)

    # Get config for price info
    config = em.config

    # Broadcast new response to the user watching via WebSocket
    await emergency_manager.send_to_user(request_id, {
        "event": "new_response",
        "response_id": response.id,
        "provider_id": provider.id,
        "provider_name": provider.first_name or provider.company_name or provider.owner_name,
        "rating": provider.rating,
        "arrival_time": response_in.arrival_time.isoformat(),
        "callout_fee": config.callout_fee if config else None,
        "hourly_rate": config.hourly_rate if config else None,
        "created_at": response.created_at.isoformat() if response.created_at else None,
    })

    return response


@servicer_router.post("/{request_id}/ignore")
def ignore_emergency(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    """Servicer explicitly ignores an emergency — no penalty."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    # No action needed — simply acknowledges intent. Return success.
    return {"detail": "Emergency request ignored"}
```

- [ ] **Step 3: Verify the module imports cleanly**

```bash
cd backend && python -c "from app.api.emergency.endpoint import router, servicer_router; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/emergency/__init__.py backend/app/api/emergency/endpoint.py
git commit -m "feat: add User SOS and Servicer emergency API endpoints"
```

---

## Task 8: Admin Emergency Endpoint

**Files:**
- Create: `backend/app/api/admin/emergency_endpoint.py`

- [ ] **Step 1: Create `backend/app/api/admin/emergency_endpoint.py`**

```python
"""Admin Emergency SOS — config, oversight, star management, penalties."""

import logging
from typing import List, Optional

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
    return db.query(models.EmergencyConfig).order_by(models.EmergencyConfig.category).all()


@router.post("/config", response_model=schemas.EmergencyConfigRead)
def create_emergency_config(
    config_in: schemas.EmergencyConfigCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    existing = db.query(models.EmergencyConfig).filter(
        models.EmergencyConfig.category == config_in.category
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Config for this category already exists. Use PATCH to update.")

    config = models.EmergencyConfig(
        category=config_in.category,
        callout_fee=config_in.callout_fee,
        hourly_rate=config_in.hourly_rate,
        updated_by=current_user.id,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.patch("/config/{config_id}", response_model=schemas.EmergencyConfigRead)
def update_emergency_config(
    config_id: int,
    config_in: schemas.EmergencyConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    config = db.query(models.EmergencyConfig).filter(
        models.EmergencyConfig.id == config_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    if config_in.callout_fee is not None:
        config.callout_fee = config_in.callout_fee
    if config_in.hourly_rate is not None:
        config.hourly_rate = config_in.hourly_rate
    config.updated_by = current_user.id
    db.commit()
    db.refresh(config)
    return config


# ── Penalty Config ─────────────────────────────────────────────────────────────

@router.get("/penalty-config", response_model=List[schemas.EmergencyPenaltyConfigRead])
def list_penalty_configs(
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    return db.query(models.EmergencyPenaltyConfig).all()


@router.patch("/penalty-config/{config_id}", response_model=schemas.EmergencyPenaltyConfigRead)
def update_penalty_config(
    config_id: int,
    update_in: schemas.EmergencyPenaltyConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    config = db.query(models.EmergencyPenaltyConfig).filter(
        models.EmergencyPenaltyConfig.id == config_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Penalty config not found")
    config.star_deduction = update_in.star_deduction
    config.updated_by = current_user.id
    db.commit()
    db.refresh(config)
    return config


# ── Emergency Request Oversight ────────────────────────────────────────────────

@router.get("/requests", response_model=List[schemas.EmergencyRequestRead])
def list_all_emergency_requests(
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    query = db.query(models.EmergencyRequest)
    if status:
        query = query.filter(models.EmergencyRequest.status == status)
    if category:
        query = query.filter(models.EmergencyRequest.category == category)
    return query.order_by(models.EmergencyRequest.created_at.desc()).all()


@router.get("/requests/{request_id}", response_model=schemas.EmergencyRequestRead)
def get_emergency_request_admin(
    request_id: int,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    em = db.query(models.EmergencyRequest).filter(
        models.EmergencyRequest.id == request_id
    ).first()
    if not em:
        raise HTTPException(status_code=404, detail="Emergency request not found")
    return em


# ── Star Management ────────────────────────────────────────────────────────────

@router.post("/providers/{provider_id}/stars", response_model=schemas.EmergencyStarAdjustRead)
def manually_adjust_stars(
    provider_id: int,
    adjust_in: schemas.EmergencyStarAdjustCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    apply_star_delta(provider, adjust_in.delta)

    adjustment = models.EmergencyStarAdjustment(
        provider_id=provider_id,
        adjusted_by=current_user.id,
        delta=adjust_in.delta,
        reason=adjust_in.reason,
        event_type="MANUAL_ADJUST",
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)
    return adjustment


@router.get("/providers/{provider_id}/star-history", response_model=List[schemas.EmergencyStarAdjustRead])
def get_star_history(
    provider_id: int,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return (
        db.query(models.EmergencyStarAdjustment)
        .filter(models.EmergencyStarAdjustment.provider_id == provider_id)
        .order_by(models.EmergencyStarAdjustment.created_at.desc())
        .all()
    )


@router.get("/penalties", response_model=List[schemas.EmergencyStarAdjustRead])
def list_all_penalties(
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    return (
        db.query(models.EmergencyStarAdjustment)
        .filter(models.EmergencyStarAdjustment.event_type == "AUTO_PENALTY")
        .order_by(models.EmergencyStarAdjustment.created_at.desc())
        .all()
    )


# ── Provider Status (Suspend / Reactivate / Delete) ───────────────────────────

@router.patch("/providers/{provider_id}/status")
def update_provider_account_status(
    provider_id: int,
    update_in: schemas.AdminProviderStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(admin_only),
):
    """Suspend or reactivate a provider's linked user account."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if not provider.user_id:
        raise HTTPException(status_code=400, detail="Provider has no linked user account")

    user = db.query(models.User).filter(models.User.id == provider.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Linked user not found")

    user.is_active = update_in.is_active
    db.commit()

    status_label = "reactivated" if update_in.is_active else "suspended"
    return {"detail": f"Provider account {status_label}", "provider_id": provider_id, "is_active": update_in.is_active}


@router.delete("/providers/{provider_id}")
def delete_provider_account(
    provider_id: int,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(admin_only),
):
    """Permanently delete a provider's linked user account."""
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if provider.user_id:
        user = db.query(models.User).filter(models.User.id == provider.user_id).first()
        if user:
            db.delete(user)

    db.commit()
    return {"detail": "Provider account permanently deleted", "provider_id": provider_id}


# ── Auto-Penalty Trigger (called internally) ───────────────────────────────────

def trigger_auto_penalty(
    db: Session,
    provider_id: int,
    admin_user_id: int,
    event_type: str,
    emergency_request_id: Optional[int] = None,
) -> None:
    """Deduct stars based on configured penalty for the event_type."""
    config = db.query(models.EmergencyPenaltyConfig).filter(
        models.EmergencyPenaltyConfig.event_type == event_type
    ).first()
    if not config:
        logger.warning(f"No penalty config found for event_type={event_type}")
        return

    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        return

    apply_star_delta(provider, -config.star_deduction)

    adjustment = models.EmergencyStarAdjustment(
        provider_id=provider_id,
        adjusted_by=admin_user_id,
        delta=-config.star_deduction,
        reason=f"Auto-penalty: {event_type}",
        event_type="AUTO_PENALTY",
        emergency_request_id=emergency_request_id,
    )
    db.add(adjustment)

    if provider.user_id:
        db.add(models.Notification(
            user_id=provider.user_id,
            title="Penalty Applied",
            message=f"A penalty of -{config.star_deduction} stars has been applied to your profile ({event_type}).",
            notification_type="URGENT",
        ))
```

- [ ] **Step 2: Verify imports cleanly**

```bash
cd backend && python -c "from app.api.admin.emergency_endpoint import router; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/admin/emergency_endpoint.py
git commit -m "feat: add Admin Emergency SOS config, star management, and penalty endpoints"
```

---

## Task 9: Register in main.py + WebSocket Endpoints

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add imports to `main.py`**

After the existing import block (after `from app.api.request.endpoint import router as request_router`), add:

```python
from app.api.emergency.endpoint import router as emergency_router, servicer_router as emergency_servicer_router
from app.api.admin.emergency_endpoint import router as admin_emergency_router
from app.websockets.emergency import emergency_manager
from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
```

- [ ] **Step 2: Register the new routers in `main.py`**

After the existing `app.include_router(request_router, ...)` line, add:

```python
app.include_router(emergency_router,          prefix="/api/v1/emergency")
app.include_router(emergency_servicer_router, prefix="/api/v1/emergency/servicer")
app.include_router(admin_emergency_router,    prefix="/api/v1/admin/emergency")
```

- [ ] **Step 3: Add WebSocket endpoints to `main.py`**

After the router registrations and before the basic routes section, add:

```python
# ── WebSocket Endpoints ────────────────────────────────────────────────────────

def _get_user_id_from_token(token: str) -> Optional[int]:
    """Decode JWT and return user id, or None if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_uuid = payload.get("sub")
        if not user_uuid:
            return None
        from app.core.database import SessionLocal
        if SessionLocal is None:
            return None
        db = SessionLocal()
        try:
            from app.internal.models import User
            user = db.query(User).filter(User.user_uuid == user_uuid).first()
            return user.id if user else None
        finally:
            db.close()
    except JWTError:
        return None


@app.websocket("/ws/emergency/{request_id}")
async def emergency_user_ws(websocket: WebSocket, request_id: int, token: str = ""):
    """User watches real-time responses for their emergency request."""
    user_id = _get_user_id_from_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return
    await emergency_manager.connect_user(request_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep alive — user only receives
    except WebSocketDisconnect:
        emergency_manager.disconnect_user(request_id)


@app.websocket("/ws/servicer/alerts")
async def servicer_alerts_ws(websocket: WebSocket, token: str = ""):
    """Servicer listens for incoming emergency alerts."""
    from app.core.database import SessionLocal
    if not token or SessionLocal is None:
        await websocket.close(code=4001)
        return
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_uuid = payload.get("sub")
    except JWTError:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        from app.internal.models import User, ServiceProvider
        user = db.query(User).filter(User.user_uuid == user_uuid).first()
        if not user or user.role != "SERVICER":
            await websocket.close(code=4003)
            return
        provider = db.query(ServiceProvider).filter(
            ServiceProvider.user_id == user.id
        ).first()
        if not provider:
            await websocket.close(code=4003)
            return
        provider_id = provider.id
    finally:
        db.close()

    await emergency_manager.connect_servicer(provider_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep alive — servicer only receives
    except WebSocketDisconnect:
        emergency_manager.disconnect_servicer(provider_id)
```

- [ ] **Step 4: Add `Optional` to the `typing` import in main.py**

The file currently imports `from datetime import datetime, timezone`. Add `Optional` to the typing import if not present. At the top of main.py add:

```python
from typing import Optional
```

- [ ] **Step 5: Verify the app starts cleanly**

```bash
cd backend && python -c "from app.main import app; print('App loaded OK')"
```
Expected: `App loaded OK` (no import errors)

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register emergency routers and WebSocket endpoints in main.py"
```

---

## Task 10: Seed Default Penalty Configs

The penalty config table needs initial rows for the 3 event types. This is done via a startup seed in `main.py`'s lifespan function.

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add the seeding logic to the lifespan function**

Find the existing `lifespan` function in `main.py`. Currently it calls `init_db()` and yields. Modify it to also seed default penalty configs:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB and seed required config rows. Shutdown: nothing extra needed."""
    logger.info("🚀 Starting HomeCare Hub API ...")
    init_db()
    _seed_penalty_configs()
    yield
    logger.info("🛑 Shutting down HomeCare Hub API.")


def _seed_penalty_configs() -> None:
    """Insert default penalty config rows if they don't exist yet."""
    from app.core.database import SessionLocal
    if SessionLocal is None:
        return
    db = SessionLocal()
    try:
        from app.internal.models import EmergencyPenaltyConfig
        defaults = [
            ("LATE_ARRIVAL", 0.3),
            ("CANCELLATION", 0.5),
            ("NO_SHOW", 1.0),
        ]
        for event_type, deduction in defaults:
            exists = db.query(EmergencyPenaltyConfig).filter(
                EmergencyPenaltyConfig.event_type == event_type
            ).first()
            if not exists:
                db.add(EmergencyPenaltyConfig(
                    event_type=event_type,
                    star_deduction=deduction,
                ))
        db.commit()
        logger.info("✅ Emergency penalty configs seeded")
    except Exception as e:
        logger.warning(f"Could not seed penalty configs: {e}")
    finally:
        db.close()
```

- [ ] **Step 2: Verify the app still loads cleanly**

```bash
cd backend && python -c "from app.main import app; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: seed default emergency penalty configs on startup"
```

---

## Task 11: Frontend API Client

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Append emergency API helper functions to `frontend/lib/api.ts`**

At the end of `frontend/lib/api.ts`, add:

```typescript
// ── Emergency SOS API ──────────────────────────────────────────────────────────

export interface EmergencyConfig {
    id: number;
    category: string;
    callout_fee: number;
    hourly_rate: number;
}

export interface EmergencyProvider {
    id: number;
    first_name?: string;
    company_name?: string;
    owner_name?: string;
    category: string;
    rating: number;
    location?: string;
    profile_photo_url?: string;
    availability_status: string;
    experience_years?: number;
}

export interface EmergencyResponseData {
    id: number;
    request_id: number;
    provider_id: number;
    arrival_time: string;
    status: string;
    penalty_count: number;
    created_at?: string;
    provider?: EmergencyProvider;
}

export interface EmergencyRequestData {
    id: number;
    user_id: number;
    society_name: string;
    building_name: string;
    flat_no: string;
    landmark: string;
    full_address: string;
    category: string;
    description: string;
    device_name?: string;
    photos?: string[];
    contact_name: string;
    contact_phone: string;
    status: string;
    expires_at: string;
    resulting_booking_id?: number;
    created_at?: string;
    responses: EmergencyResponseData[];
    config?: EmergencyConfig;
}

export interface EmergencyStarAdjust {
    id: number;
    provider_id: number;
    adjusted_by: number;
    delta: number;
    reason: string;
    event_type: string;
    created_at?: string;
}

export interface AdminProviderStatusUpdate {
    is_active: boolean;
    reason?: string;
}

export async function fetchEmergencyConfigs(): Promise<EmergencyConfig[]> {
    return apiFetch("/emergency/config");
}

export async function fetchEmergencyProviders(category?: string): Promise<EmergencyProvider[]> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    return apiFetch(`/emergency/providers${qs}`);
}

export async function createEmergencyRequest(payload: {
    society_name: string;
    building_name: string;
    flat_no: string;
    landmark: string;
    full_address: string;
    category: string;
    description: string;
    device_name?: string;
    photos?: string[];
    contact_name: string;
    contact_phone: string;
    provider_ids: number[];
}): Promise<EmergencyRequestData> {
    return apiFetch("/emergency/", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function fetchEmergencyRequest(requestId: number): Promise<EmergencyRequestData> {
    return apiFetch(`/emergency/${requestId}`);
}

export async function acceptEmergencyResponse(requestId: number, responseId: number) {
    return apiFetch(`/emergency/${requestId}/accept/${responseId}`, { method: "POST" });
}

export async function cancelEmergencyRequest(requestId: number) {
    return apiFetch(`/emergency/${requestId}/cancel`, { method: "POST" });
}

export async function respondToEmergency(requestId: number, arrivalTime: string) {
    return apiFetch(`/emergency/servicer/${requestId}/respond`, {
        method: "POST",
        body: JSON.stringify({ arrival_time: arrivalTime }),
    });
}

export async function ignoreEmergency(requestId: number) {
    return apiFetch(`/emergency/servicer/${requestId}/ignore`, { method: "POST" });
}

export async function fetchIncomingEmergencies() {
    return apiFetch("/emergency/incoming-servicer");
}

// Admin
export async function fetchAdminEmergencyConfigs(): Promise<EmergencyConfig[]> {
    return apiFetch("/admin/emergency/config");
}

export async function createAdminEmergencyConfig(payload: { category: string; callout_fee: number; hourly_rate: number }) {
    return apiFetch("/admin/emergency/config", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateAdminEmergencyConfig(configId: number, payload: { callout_fee?: number; hourly_rate?: number }) {
    return apiFetch(`/admin/emergency/config/${configId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function fetchAdminPenaltyConfigs() {
    return apiFetch("/admin/emergency/penalty-config");
}

export async function updateAdminPenaltyConfig(configId: number, star_deduction: number) {
    return apiFetch(`/admin/emergency/penalty-config/${configId}`, {
        method: "PATCH",
        body: JSON.stringify({ star_deduction }),
    });
}

export async function fetchAdminAllEmergencies(status?: string, category?: string): Promise<EmergencyRequestData[]> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiFetch(`/admin/emergency/requests${qs}`);
}

export async function adjustProviderStars(providerId: number, delta: number, reason: string): Promise<EmergencyStarAdjust> {
    return apiFetch(`/admin/emergency/providers/${providerId}/stars`, {
        method: "POST",
        body: JSON.stringify({ delta, reason }),
    });
}

export async function fetchProviderStarHistory(providerId: number): Promise<EmergencyStarAdjust[]> {
    return apiFetch(`/admin/emergency/providers/${providerId}/star-history`);
}

export async function fetchAllPenalties(): Promise<EmergencyStarAdjust[]> {
    return apiFetch("/admin/emergency/penalties");
}

export async function updateProviderAccountStatus(providerId: number, payload: AdminProviderStatusUpdate) {
    return apiFetch(`/admin/emergency/providers/${providerId}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}
```

- [ ] **Step 2: Verify the frontend still type-checks**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors from the added functions.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add emergency SOS API helper functions to frontend api client"
```

---

## Task 12: Frontend User Emergency Page (Full Replacement)

**Files:**
- Modify: `frontend/app/user/bookings/emergency/page.tsx` (full replacement)

- [ ] **Step 1: Replace the entire content of `frontend/app/user/bookings/emergency/page.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertTriangle, ShieldAlert, Zap, Wrench, Droplets, Flame,
    Lock, Monitor, Building2, Bug, HelpCircle,
    ArrowRight, Loader2, Check, X, Star, Clock,
    IndianRupee, Phone, MapPin, User,
} from "lucide-react";
import Link from "next/link";
import {
    fetchEmergencyConfigs, fetchEmergencyProviders,
    createEmergencyRequest, acceptEmergencyResponse, cancelEmergencyRequest,
    EmergencyConfig, EmergencyProvider, EmergencyResponseData,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    Electrical:        <Zap size={28} />,
    Plumbing:          <Droplets size={28} />,
    "Gas Leak":        <Flame size={28} />,
    "Lock/Door":       <Lock size={28} />,
    "Appliance Failure": <Monitor size={28} />,
    Structural:        <Building2 size={28} />,
    Pest:              <Bug size={28} />,
    Other:             <HelpCircle size={28} />,
};

type Step = "warning" | "form" | "livefeed" | "confirmed" | "expired";

function formatArrival(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCountdown(expiresAt: string): string {
    const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function EmergencySOSPage() {
    const router = useRouter();
    const toast = useToast();

    // Step control
    const [step, setStep] = useState<Step>("warning");

    // Form state
    const [configs, setConfigs] = useState<EmergencyConfig[]>([]);
    const [providers, setProviders] = useState<EmergencyProvider[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([]);
    const [societyName, setSocietyName] = useState("");
    const [buildingName, setBuildingName] = useState("");
    const [flatNo, setFlatNo] = useState("");
    const [landmark, setLandmark] = useState("");
    const [fullAddress, setFullAddress] = useState("");
    const [description, setDescription] = useState("");
    const [deviceName, setDeviceName] = useState("");
    const [contactName, setContactName] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState("");

    // Live feed state
    const [requestId, setRequestId] = useState<number | null>(null);
    const [expiresAt, setExpiresAt] = useState<string>("");
    const [responses, setResponses] = useState<EmergencyResponseData[]>([]);
    const [countdown, setCountdown] = useState("5:00");
    const [accepting, setAccepting] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<"fastest" | "rating">("fastest");
    const wsRef = useRef<WebSocket | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Confirmed state
    const [confirmedBookingId, setConfirmedBookingId] = useState<number | null>(null);

    // Load user profile for contact name auto-fill
    useEffect(() => {
        const username = typeof window !== "undefined" ? localStorage.getItem("hc_username") || "" : "";
        setContactName(username);
    }, []);

    // Load configs on mount
    useEffect(() => {
        fetchEmergencyConfigs().then(setConfigs).catch(() => {});
    }, []);

    // Load providers when category changes
    useEffect(() => {
        if (!selectedCategory) return;
        fetchEmergencyProviders(selectedCategory).then(setProviders).catch(() => {});
    }, [selectedCategory]);

    // Countdown ticker
    useEffect(() => {
        if (step !== "livefeed" || !expiresAt) return;
        countdownRef.current = setInterval(() => {
            const remaining = new Date(expiresAt).getTime() - Date.now();
            if (remaining <= 0) {
                setCountdown("0:00");
                setStep("expired");
                clearInterval(countdownRef.current!);
            } else {
                setCountdown(formatCountdown(expiresAt));
            }
        }, 1000);
        return () => clearInterval(countdownRef.current!);
    }, [step, expiresAt]);

    // WebSocket connection for live feed
    useEffect(() => {
        if (step !== "livefeed" || !requestId) return;
        const token = localStorage.getItem("hc_token_USER") || "";
        const wsBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
            .replace(/^http/, "ws").replace(/\/$/, "");
        const ws = new WebSocket(`${wsBase}/ws/emergency/${requestId}?token=${token}`);
        wsRef.current = ws;

        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.event === "new_response") {
                    setResponses(prev => [...prev, {
                        id: data.response_id,
                        request_id: requestId,
                        provider_id: data.provider_id,
                        arrival_time: data.arrival_time,
                        status: "PENDING",
                        penalty_count: 0,
                        created_at: data.created_at,
                        provider: {
                            id: data.provider_id,
                            first_name: data.provider_name,
                            company_name: data.provider_name,
                            owner_name: data.provider_name,
                            category: selectedCategory,
                            rating: data.rating,
                            availability_status: "AVAILABLE",
                        },
                    }]);
                } else if (data.event === "request_accepted") {
                    setConfirmedBookingId(data.booking_id);
                    setStep("confirmed");
                } else if (data.event === "request_cancelled" || data.event === "request_expired") {
                    setStep("expired");
                }
            } catch {}
        };

        ws.onerror = () => toast.error("Lost real-time connection");

        return () => ws.close();
    }, [step, requestId]);

    const activeConfig = configs.find(c => c.category === selectedCategory);

    const toggleProvider = (id: number) => {
        setSelectedProviderIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        setFormError("");
        if (!societyName || !buildingName || !flatNo || !landmark || !fullAddress || !description || !contactPhone || selectedProviderIds.length === 0) {
            setFormError("Please fill all required fields and select at least one servicer.");
            return;
        }
        setLoading(true);
        try {
            const result = await createEmergencyRequest({
                society_name: societyName,
                building_name: buildingName,
                flat_no: flatNo,
                landmark,
                full_address: fullAddress,
                category: selectedCategory,
                description,
                device_name: deviceName || undefined,
                contact_name: contactName,
                contact_phone: contactPhone,
                provider_ids: selectedProviderIds,
            });
            setRequestId(result.id);
            setExpiresAt(result.expires_at);
            setStep("livefeed");
        } catch (err: any) {
            setFormError(err.message || "Failed to send emergency alert. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (responseId: number) => {
        if (!requestId) return;
        setAccepting(responseId);
        try {
            const booking = await acceptEmergencyResponse(requestId, responseId);
            setConfirmedBookingId(booking.id);
            setStep("confirmed");
        } catch (err: any) {
            toast.error(err.message || "Failed to accept servicer");
        } finally {
            setAccepting(null);
        }
    };

    const handleCancel = async () => {
        if (!requestId) return;
        try {
            await cancelEmergencyRequest(requestId);
        } catch {}
        setStep("warning");
        setSelectedCategory("");
        setSelectedProviderIds([]);
        setResponses([]);
        setRequestId(null);
    };

    const sortedResponses = [...responses].sort((a, b) => {
        if (sortBy === "rating") return (b.provider?.rating ?? 0) - (a.provider?.rating ?? 0);
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const fastestId = responses.length > 0
        ? responses.reduce((min, r) => new Date(r.created_at || 0) < new Date(min.created_at || 0) ? r : min).id
        : null;

    return (
        <div className="max-w-2xl mx-auto pb-20 px-4">

            {/* STEP: Warning Modal */}
            {step === "warning" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-500 text-center py-12">
                    <div className="flex justify-center relative">
                        <div className="absolute inset-0 bg-rose-500/10 rounded-full scale-125 blur-xl animate-pulse" />
                        <div className="relative w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border-[3px] border-white shadow-lg">
                            <ShieldAlert size={44} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Emergency SOS</h1>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Fast-track urgent service dispatch</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-left space-y-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold text-amber-800">Emergency services have <strong>higher costs</strong> — a fixed callout fee applies immediately.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold text-amber-800">False or non-urgent requests may result in <strong>account penalties</strong>.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => router.back()} className="py-5 rounded-2xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                            Go Back
                        </button>
                        <button onClick={() => setStep("form")} className="py-5 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all">
                            I Understand — Continue
                        </button>
                    </div>
                </div>
            )}

            {/* STEP: Form */}
            {step === "form" && (
                <div className="space-y-8 animate-in fade-in duration-300 py-6">
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                            <AlertTriangle size={22} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase">Emergency Form</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fill all required fields</p>
                        </div>
                    </div>

                    {formError && (
                        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl text-xs font-bold">
                            <AlertTriangle size={16} className="shrink-0" />
                            {formError}
                        </div>
                    )}

                    {/* Category */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emergency Category *</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.keys(CATEGORY_ICONS).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => { setSelectedCategory(cat); setSelectedProviderIds([]); }}
                                    className={`p-4 rounded-2xl border-2 text-center transition-all ${
                                        selectedCategory === cat
                                            ? "bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-600/20"
                                            : "bg-white border-slate-100 text-slate-400 hover:border-rose-200 hover:text-rose-500"
                                    }`}
                                >
                                    <div className="flex justify-center mb-2">{CATEGORY_ICONS[cat]}</div>
                                    <span className="font-black text-[9px] uppercase tracking-wide leading-tight block">{cat}</span>
                                </button>
                            ))}
                        </div>
                        {activeConfig && (
                            <div className="bg-slate-50 rounded-2xl px-4 py-3 flex items-center gap-3 text-sm">
                                <IndianRupee size={16} className="text-emerald-600" />
                                <span className="font-bold text-slate-700">
                                    Callout: ₹{activeConfig.callout_fee} &nbsp;+&nbsp; ₹{activeConfig.hourly_rate}/hr (after 1st hour)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location Details *</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Society Name", val: societyName, set: setSocietyName, ph: "e.g. Green Valley" },
                                { label: "Building Name", val: buildingName, set: setBuildingName, ph: "e.g. Tower A" },
                                { label: "House / Flat No.", val: flatNo, set: setFlatNo, ph: "e.g. 402" },
                                { label: "Landmark", val: landmark, set: setLandmark, ph: "e.g. Near main gate" },
                            ].map(f => (
                                <div key={f.label} className="space-y-1">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{f.label}</label>
                                    <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300" />
                                </div>
                            ))}
                        </div>
                        <textarea value={fullAddress} onChange={e => setFullAddress(e.target.value)}
                            placeholder="Full address *"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300" rows={2} />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Description * <span className="text-slate-300 normal-case font-semibold">({description.length}/500)</span>
                        </label>
                        <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))}
                            placeholder="Describe the emergency clearly..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300" rows={3} />
                    </div>

                    {/* Optional */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Device / Appliance Name (optional)</label>
                        <input value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="e.g. Washing machine, AC unit"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300" />
                    </div>

                    {/* Contact */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Name *</label>
                            <input value={contactName} onChange={e => setContactName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Phone *</label>
                            <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="10-digit number"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300" />
                        </div>
                    </div>

                    {/* Provider Selection */}
                    {selectedCategory && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Select Servicers to Alert * — {providers.length} available
                            </label>
                            {providers.length === 0 ? (
                                <p className="text-sm text-slate-400 font-semibold py-4 text-center">No verified servicers available for this category right now.</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {providers.map(p => {
                                        const name = p.first_name || p.company_name || p.owner_name || "Servicer";
                                        const selected = selectedProviderIds.includes(p.id);
                                        return (
                                            <button key={p.id} onClick={() => toggleProvider(p.id)}
                                                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                                                    selected ? "border-rose-500 bg-rose-50" : "border-slate-100 bg-white hover:border-slate-200"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm font-black">
                                                        {name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm text-slate-900">{name}</p>
                                                        <p className="text-[10px] text-slate-400 font-semibold">{p.category} · {p.experience_years ?? 0}yrs exp</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center gap-1 text-amber-500 font-black text-sm">
                                                        <Star size={14} fill="currentColor" /> {p.rating?.toFixed(1)}
                                                    </span>
                                                    {selected && <Check size={18} className="text-rose-500" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <button onClick={() => setStep("warning")} className="py-5 rounded-2xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                            Back
                        </button>
                        <button onClick={handleSubmit} disabled={loading || selectedProviderIds.length === 0}
                            className="py-5 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <>Send Emergency Alert <ArrowRight size={16} /></>}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP: Live Feed */}
            {step === "livefeed" && (
                <div className="space-y-6 animate-in fade-in duration-300 py-6">
                    {/* Timer header */}
                    <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-3xl px-6 py-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Emergency Alert Sent</p>
                            <p className="text-sm font-bold text-rose-700">{selectedCategory} · {responses.length} response{responses.length !== 1 ? "s" : ""} so far</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Window Closes In</p>
                            <p className="text-3xl font-black text-rose-600 tabular-nums">{countdown}</p>
                        </div>
                    </div>

                    {/* Sort tabs */}
                    <div className="flex gap-2">
                        {(["fastest", "rating"] as const).map(s => (
                            <button key={s} onClick={() => setSortBy(s)}
                                className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                    sortBy === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                }`}>
                                {s === "fastest" ? "⚡ Fastest" : "⭐ Rating"}
                            </button>
                        ))}
                    </div>

                    {/* Responses */}
                    {sortedResponses.length === 0 ? (
                        <div className="text-center py-16 space-y-3">
                            <Loader2 size={32} className="animate-spin text-rose-400 mx-auto" />
                            <p className="text-sm font-bold text-slate-400">Waiting for servicers to respond...</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sortedResponses.map((r, idx) => {
                                const name = r.provider?.first_name || r.provider?.company_name || r.provider?.owner_name || "Servicer";
                                const isFastest = r.id === fastestId;
                                return (
                                    <div key={r.id} className={`bg-white border-2 rounded-3xl p-6 space-y-4 transition-all ${isFastest ? "border-rose-400 shadow-lg shadow-rose-100" : "border-slate-100"}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 text-lg">
                                                    {name[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-slate-900">{name}</p>
                                                        {isFastest && <span className="bg-rose-100 text-rose-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">⚡ Fastest</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-amber-500">
                                                        <Star size={12} fill="currentColor" />
                                                        <span className="text-xs font-bold">{r.provider?.rating?.toFixed(1) ?? "—"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Arrives at</p>
                                                <p className="font-black text-slate-900 text-lg">{formatArrival(r.arrival_time)}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleAccept(r.id)} disabled={accepting !== null}
                                            className="w-full py-4 rounded-2xl bg-[#064e3b] text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-950 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                            {accepting === r.id ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Accept This Servicer</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <button onClick={handleCancel} className="w-full py-4 rounded-2xl border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                        Cancel Emergency Request
                    </button>
                </div>
            )}

            {/* STEP: Confirmed */}
            {step === "confirmed" && (
                <div className="space-y-10 text-center py-16 animate-in fade-in duration-300">
                    <div className="flex justify-center">
                        <div className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40">
                            <Check size={56} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Servicer Confirmed</h1>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Your emergency booking is active. Track in real-time.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {confirmedBookingId && (
                            <Link href={`/user/bookings/${confirmedBookingId}`}
                                className="px-8 py-4 bg-[#064e3b] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-950 transition-all shadow-lg">
                                Track Job
                            </Link>
                        )}
                        <Link href="/user/dashboard"
                            className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            )}

            {/* STEP: Expired */}
            {step === "expired" && (
                <div className="space-y-10 text-center py-16 animate-in fade-in duration-300">
                    <div className="flex justify-center">
                        <div className="w-28 h-28 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-xl">
                            <Clock size={56} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Time Expired</h1>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs max-w-sm mx-auto">
                            {responses.length === 0
                                ? "No servicers responded within the 5-minute window."
                                : "The response window closed before you accepted a servicer."}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => { setStep("warning"); setSelectedCategory(""); setSelectedProviderIds([]); setResponses([]); setRequestId(null); }}
                            className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20">
                            Try Again
                        </button>
                        <Link href="/user/dashboard"
                            className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Verify the page compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep emergency
```
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/user/bookings/emergency/page.tsx
git commit -m "feat: replace emergency SOS page with broadcast→response→select flow"
```

---

## Task 13: Frontend Servicer Emergency Tab

**Files:**
- Modify: `frontend/app/service/jobs/page.tsx`

- [ ] **Step 1: Add the `JobTab` type update and `EmergencyJob` interface**

In `frontend/app/service/jobs/page.tsx`, find:
```typescript
type JobTab = "jobs" | "requests";
```
Replace with:
```typescript
type JobTab = "jobs" | "requests" | "emergency";
```

After the `IncomingRequest` interface, add:
```typescript
interface EmergencyJob {
    id: number;
    society_name: string;
    building_name: string;
    flat_no: string;
    landmark: string;
    full_address: string;
    category: string;
    description: string;
    device_name?: string;
    contact_name: string;
    contact_phone: string;
    expires_at: string;
    created_at?: string;
    callout_fee?: number;
    hourly_rate?: number;
    has_responded: boolean;
    photos?: string[];
}
```

- [ ] **Step 2: Add state for emergency jobs to the component**

Inside `ServicerJobsPage`, after the existing state declarations, add:
```typescript
const [emergencyJobs, setEmergencyJobs] = useState<EmergencyJob[]>([]);
const [emergencyLoading, setEmergencyLoading] = useState(false);
const [respondingToEmergency, setRespondingToEmergency] = useState<EmergencyJob | null>(null);
const [emArrivalDate, setEmArrivalDate] = useState("");
const [emArrivalTime, setEmArrivalTime] = useState("09:00");
const [submittingEmResponse, setSubmittingEmResponse] = useState(false);
const [emCountdown, setEmCountdown] = useState<Record<number, string>>({});
const emergencyWsRef = useRef<WebSocket | null>(null);
```

Add `useRef` to the import from "react".

- [ ] **Step 3: Add `fetchEmergencyJobs` function**

After the existing `fetchJobs` function in the component, add:

```typescript
const fetchEmergencyJobs = async () => {
    setEmergencyLoading(true);
    try {
        const data = await apiFetch("/emergency/incoming-servicer");
        setEmergencyJobs(data || []);
    } catch (err: any) {
        if (!err?.message?.toLowerCase().includes("not found")) {
            console.error("Failed to fetch emergency jobs", err);
        }
        setEmergencyJobs([]);
    } finally {
        setEmergencyLoading(false);
    }
};
```

- [ ] **Step 4: Add WebSocket connection effect for emergency tab**

After the existing `useEffect` blocks in the component, add:

```typescript
useEffect(() => {
    if (activeTab !== "emergency") return;
    fetchEmergencyJobs();

    // Connect to servicer alert WebSocket
    const token = localStorage.getItem("hc_token_SERVICER") || "";
    const wsBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
        .replace(/^http/, "ws").replace(/\/$/, "");
    const ws = new WebSocket(`${wsBase}/ws/servicer/alerts?token=${token}`);
    emergencyWsRef.current = ws;
    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.event === "emergency_alert") {
                setEmergencyJobs(prev => {
                    if (prev.find(j => j.id === data.request_id)) return prev;
                    return [{
                        id: data.request_id,
                        society_name: data.society_name,
                        building_name: data.building_name,
                        flat_no: data.flat_no,
                        landmark: data.landmark,
                        full_address: data.full_address,
                        category: data.category,
                        description: data.description,
                        contact_name: data.contact_name,
                        contact_phone: data.contact_phone,
                        expires_at: data.expires_at,
                        callout_fee: data.callout_fee,
                        hourly_rate: data.hourly_rate,
                        has_responded: false,
                    }, ...prev];
                });
            }
        } catch {}
    };
    return () => ws.close();
}, [activeTab]);

// Countdown for emergency jobs
useEffect(() => {
    if (activeTab !== "emergency") return;
    const timer = setInterval(() => {
        const now = Date.now();
        const updates: Record<number, string> = {};
        emergencyJobs.forEach(j => {
            const diff = Math.max(0, new Date(j.expires_at).getTime() - now);
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            updates[j.id] = `${m}:${s.toString().padStart(2, "0")}`;
        });
        setEmCountdown(updates);
    }, 1000);
    return () => clearInterval(timer);
}, [activeTab, emergencyJobs]);
```

- [ ] **Step 5: Add the `handleEmergencyRespond` function**

```typescript
const handleEmergencyRespond = async () => {
    if (!respondingToEmergency || !emArrivalDate || !emArrivalTime) return;
    setSubmittingEmResponse(true);
    try {
        const arrivalISO = new Date(`${emArrivalDate}T${emArrivalTime}:00`).toISOString();
        await apiFetch(`/emergency/servicer/${respondingToEmergency.id}/respond`, {
            method: "POST",
            body: JSON.stringify({ arrival_time: arrivalISO }),
        });
        toast.success("Response sent! Waiting for user to accept.");
        setEmergencyJobs(prev =>
            prev.map(j => j.id === respondingToEmergency.id ? { ...j, has_responded: true } : j)
        );
        setRespondingToEmergency(null);
    } catch (err: any) {
        toast.error(err.message || "Failed to respond to emergency");
    } finally {
        setSubmittingEmResponse(false);
    }
};
```

- [ ] **Step 6: Add the Emergency tab button**

Find the existing tab buttons section (where "Jobs" and "Requests" tabs are rendered). Add a third tab button after the "Requests" button:

```tsx
<button
    onClick={() => setActiveTab("emergency")}
    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
        activeTab === "emergency"
            ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
            : "bg-rose-50 text-rose-500 hover:bg-rose-100"
    }`}
>
    🚨 Emergency
    {emergencyJobs.filter(j => !j.has_responded).length > 0 && (
        <span className="bg-white text-rose-600 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {emergencyJobs.filter(j => !j.has_responded).length}
        </span>
    )}
</button>
```

Import `AlertTriangle`, `IndianRupee`, `Phone` from `lucide-react` if not already imported.

- [ ] **Step 7: Add the Emergency tab panel**

Find where `activeTab === "requests"` panel is rendered. After its closing tag, add:

```tsx
{/* Emergency Tab */}
{activeTab === "emergency" && (
    <div className="space-y-4">
        {emergencyLoading ? (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={32} className="animate-spin text-rose-400" />
            </div>
        ) : emergencyJobs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
                <p className="text-slate-400 font-bold text-sm">No active emergency alerts</p>
                <p className="text-slate-300 text-xs mt-1">Emergency requests will appear here in real-time</p>
            </div>
        ) : (
            emergencyJobs.map(job => (
                <div key={job.id} className={`bg-white border-2 rounded-3xl p-6 space-y-4 ${
                    job.has_responded ? "border-emerald-200 opacity-70" : "border-rose-300 shadow-lg shadow-rose-100"
                }`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-rose-600 font-black text-sm uppercase">🚨 {job.category}</span>
                                {job.has_responded && <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Responded</span>}
                            </div>
                            <p className="text-slate-600 text-sm font-semibold">{job.building_name}, {job.flat_no}</p>
                            <p className="text-slate-400 text-xs">{job.society_name} · {job.landmark}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-rose-400">Closes in</p>
                            <p className="text-xl font-black text-rose-600 tabular-nums">{emCountdown[job.id] || "—"}</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 font-medium bg-slate-50 rounded-xl px-4 py-3">{job.description}</p>
                    {(job.callout_fee !== undefined) && (
                        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2">
                            <IndianRupee size={14} />
                            ₹{job.callout_fee} callout + ₹{job.hourly_rate}/hr after 1st hour
                        </div>
                    )}
                    {!job.has_responded && (
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => {
                                setRespondingToEmergency(job);
                                const today = new Date().toISOString().split("T")[0];
                                setEmArrivalDate(today);
                            }}
                                className="py-3 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 active:scale-[0.98] transition-all">
                                Accept
                            </button>
                            <button onClick={async () => {
                                await apiFetch(`/emergency/servicer/${job.id}/ignore`, { method: "POST" }).catch(() => {});
                                setEmergencyJobs(prev => prev.filter(j => j.id !== job.id));
                            }}
                                className="py-3 rounded-2xl border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                                Ignore
                            </button>
                        </div>
                    )}
                </div>
            ))
        )}

        {/* Accept Modal */}
        {respondingToEmergency && (
            <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
                <div className="bg-white rounded-3xl p-8 w-full max-w-md space-y-6 shadow-2xl">
                    <h3 className="text-xl font-black text-slate-900 uppercase">Commit to Arrival Time</h3>
                    <p className="text-sm text-rose-600 font-bold bg-rose-50 rounded-xl px-4 py-3">
                        ⚠ Late arrival or cancellation will result in a star penalty.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date</label>
                            <input type="date" value={emArrivalDate} onChange={e => setEmArrivalDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Time</label>
                            <input type="time" value={emArrivalTime} onChange={e => setEmArrivalTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setRespondingToEmergency(null)} className="py-4 rounded-2xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                            Cancel
                        </button>
                        <button onClick={handleEmergencyRespond} disabled={submittingEmResponse}
                            className="py-4 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {submittingEmResponse ? <Loader2 size={16} className="animate-spin" /> : "Confirm"}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
)}
```

Add `IndianRupee` to the lucide-react import at the top if not present. Also add `Loader2` if not present.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep jobs
```
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/service/jobs/page.tsx
git commit -m "feat: add Emergency tab to servicer jobs page with real-time WebSocket alerts"
```

---

## Task 14: Frontend Admin Emergency Panel

**Files:**
- Create: `frontend/app/admin/emergency/page.tsx`

- [ ] **Step 1: Create the admin layout wrapper**

Check if `frontend/app/admin/emergency/` directory exists and create it:
```bash
mkdir -p frontend/app/admin/emergency
```

- [ ] **Step 2: Create `frontend/app/admin/emergency/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
    ShieldAlert, Settings2, IndianRupee, Star, AlertTriangle,
    ChevronDown, ChevronUp, Search, Check, X, Loader2, User,
} from "lucide-react";
import {
    fetchAdminEmergencyConfigs, createAdminEmergencyConfig, updateAdminEmergencyConfig,
    fetchAdminPenaltyConfigs, updateAdminPenaltyConfig,
    fetchAdminAllEmergencies, adjustProviderStars, fetchProviderStarHistory,
    fetchAllPenalties, updateProviderAccountStatus,
    EmergencyConfig, EmergencyRequestData, EmergencyStarAdjust,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/api";

type AdminEmTab = "pricing" | "requests" | "stars" | "penalties";

interface PenaltyConfig {
    id: number;
    event_type: string;
    star_deduction: number;
}

export default function AdminEmergencyPage() {
    const toast = useToast();
    const [tab, setTab] = useState<AdminEmTab>("pricing");

    // Pricing
    const [configs, setConfigs] = useState<EmergencyConfig[]>([]);
    const [editingConfig, setEditingConfig] = useState<Record<number, { callout_fee: string; hourly_rate: string }>>({});
    const [newCategory, setNewCategory] = useState("");
    const [newCallout, setNewCallout] = useState("");
    const [newHourly, setNewHourly] = useState("");
    const [savingConfig, setSavingConfig] = useState(false);

    // Penalty config
    const [penaltyConfigs, setPenaltyConfigs] = useState<PenaltyConfig[]>([]);
    const [editingPenalty, setEditingPenalty] = useState<Record<number, string>>({});

    // Requests
    const [requests, setRequests] = useState<EmergencyRequestData[]>([]);
    const [requestFilter, setRequestFilter] = useState("");
    const [loadingRequests, setLoadingRequests] = useState(false);

    // Stars
    const [starProviderId, setStarProviderId] = useState("");
    const [starDelta, setStarDelta] = useState("");
    const [starReason, setStarReason] = useState("");
    const [starHistory, setStarHistory] = useState<EmergencyStarAdjust[]>([]);
    const [starHistoryProviderId, setStarHistoryProviderId] = useState("");
    const [savingStar, setSavingStar] = useState(false);

    // Penalties
    const [penalties, setPenalties] = useState<EmergencyStarAdjust[]>([]);

    useEffect(() => {
        if (tab === "pricing") {
            fetchAdminEmergencyConfigs().then(setConfigs).catch(() => {});
            fetchAdminPenaltyConfigs().then(setPenaltyConfigs).catch(() => {});
        } else if (tab === "requests") {
            setLoadingRequests(true);
            fetchAdminAllEmergencies(requestFilter || undefined)
                .then(setRequests).catch(() => {}).finally(() => setLoadingRequests(false));
        } else if (tab === "penalties") {
            fetchAllPenalties().then(setPenalties).catch(() => {});
        }
    }, [tab, requestFilter]);

    const handleSaveConfig = async (id: number) => {
        const vals = editingConfig[id];
        if (!vals) return;
        setSavingConfig(true);
        try {
            await updateAdminEmergencyConfig(id, {
                callout_fee: parseFloat(vals.callout_fee),
                hourly_rate: parseFloat(vals.hourly_rate),
            });
            setConfigs(prev => prev.map(c => c.id === id
                ? { ...c, callout_fee: parseFloat(vals.callout_fee), hourly_rate: parseFloat(vals.hourly_rate) }
                : c
            ));
            setEditingConfig(prev => { const n = { ...prev }; delete n[id]; return n; });
            toast.success("Pricing updated");
        } catch (err: any) {
            toast.error(err.message || "Failed to update pricing");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleCreateConfig = async () => {
        if (!newCategory || !newCallout || !newHourly) return;
        setSavingConfig(true);
        try {
            const created = await createAdminEmergencyConfig({
                category: newCategory,
                callout_fee: parseFloat(newCallout),
                hourly_rate: parseFloat(newHourly),
            });
            setConfigs(prev => [...prev, created]);
            setNewCategory(""); setNewCallout(""); setNewHourly("");
            toast.success("Category pricing created");
        } catch (err: any) {
            toast.error(err.message || "Failed to create pricing");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleSavePenalty = async (id: number) => {
        const val = editingPenalty[id];
        if (!val) return;
        try {
            await updateAdminPenaltyConfig(id, parseFloat(val));
            setPenaltyConfigs(prev => prev.map(p => p.id === id ? { ...p, star_deduction: parseFloat(val) } : p));
            setEditingPenalty(prev => { const n = { ...prev }; delete n[id]; return n; });
            toast.success("Penalty rate updated");
        } catch (err: any) {
            toast.error(err.message || "Failed to update penalty");
        }
    };

    const handleAdjustStars = async () => {
        if (!starProviderId || !starDelta || !starReason) return;
        setSavingStar(true);
        try {
            await adjustProviderStars(parseInt(starProviderId), parseFloat(starDelta), starReason);
            toast.success(`Stars ${parseFloat(starDelta) > 0 ? "added" : "deducted"} for provider #${starProviderId}`);
            setStarProviderId(""); setStarDelta(""); setStarReason("");
        } catch (err: any) {
            toast.error(err.message || "Failed to adjust stars");
        } finally {
            setSavingStar(false);
        }
    };

    const handleLoadStarHistory = async () => {
        if (!starHistoryProviderId) return;
        try {
            const hist = await fetchProviderStarHistory(parseInt(starHistoryProviderId));
            setStarHistory(hist);
        } catch (err: any) {
            toast.error(err.message || "Provider not found");
        }
    };

    const CATEGORY_OPTIONS = [
        "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
        "Appliance Failure", "Structural", "Pest", "Other",
    ];

    const STATUS_COLORS: Record<string, string> = {
        PENDING: "bg-amber-50 text-amber-700",
        ACTIVE: "bg-blue-50 text-blue-700",
        COMPLETED: "bg-emerald-50 text-emerald-700",
        CANCELLED: "bg-slate-100 text-slate-500",
        EXPIRED: "bg-red-50 text-red-600",
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 px-4 space-y-8">
            <div className="flex items-center gap-4 pt-8">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                    <ShieldAlert size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase">Emergency SOS Control</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pricing · Oversight · Star Management</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {(["pricing", "requests", "stars", "penalties"] as AdminEmTab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}>
                        {t === "pricing" ? "💰 Pricing" : t === "requests" ? "📋 All Emergencies" : t === "stars" ? "⭐ Star Management" : "⚠ Penalties"}
                    </button>
                ))}
            </div>

            {/* PRICING TAB */}
            {tab === "pricing" && (
                <div className="space-y-8">
                    {/* Category pricing table */}
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h2 className="font-black text-slate-900 uppercase text-sm">Category Pricing</h2>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">Callout fee covers the first hour. Hourly rate applies after.</p>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {configs.length === 0 && (
                                <p className="text-center text-sm text-slate-400 py-8 font-semibold">No pricing configs yet. Add one below.</p>
                            )}
                            {configs.map(c => {
                                const editing = editingConfig[c.id];
                                return (
                                    <div key={c.id} className="px-6 py-4 flex items-center gap-4 flex-wrap">
                                        <span className="font-black text-slate-900 text-sm w-36">{c.category}</span>
                                        {editing ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[9px] font-black uppercase text-slate-400">Callout ₹</label>
                                                    <input type="number" value={editing.callout_fee}
                                                        onChange={e => setEditingConfig(prev => ({ ...prev, [c.id]: { ...prev[c.id], callout_fee: e.target.value } }))}
                                                        className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[9px] font-black uppercase text-slate-400">Hourly ₹</label>
                                                    <input type="number" value={editing.hourly_rate}
                                                        onChange={e => setEditingConfig(prev => ({ ...prev, [c.id]: { ...prev[c.id], hourly_rate: e.target.value } }))}
                                                        className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none" />
                                                </div>
                                                <div className="flex gap-2 ml-auto">
                                                    <button onClick={() => handleSaveConfig(c.id)} disabled={savingConfig}
                                                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase">
                                                        {savingConfig ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                                                    </button>
                                                    <button onClick={() => setEditingConfig(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                                                        className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-sm font-semibold text-slate-600">₹{c.callout_fee} callout</span>
                                                <span className="text-sm font-semibold text-slate-600">₹{c.hourly_rate}/hr</span>
                                                <button onClick={() => setEditingConfig(prev => ({ ...prev, [c.id]: { callout_fee: String(c.callout_fee), hourly_rate: String(c.hourly_rate) } }))}
                                                    className="ml-auto px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all">
                                                    Edit
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Add new config */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3 flex-wrap">
                            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none">
                                <option value="">Select category</option>
                                {CATEGORY_OPTIONS.filter(c => !configs.find(cfg => cfg.category === c)).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <input type="number" placeholder="Callout ₹" value={newCallout} onChange={e => setNewCallout(e.target.value)}
                                className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none" />
                            <input type="number" placeholder="Hourly ₹" value={newHourly} onChange={e => setNewHourly(e.target.value)}
                                className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none" />
                            <button onClick={handleCreateConfig} disabled={!newCategory || !newCallout || !newHourly || savingConfig}
                                className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50">
                                Add Pricing
                            </button>
                        </div>
                    </div>

                    {/* Penalty rates */}
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h2 className="font-black text-slate-900 uppercase text-sm">Auto-Penalty Star Deduction Rates</h2>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {penaltyConfigs.map(p => {
                                const editingVal = editingPenalty[p.id];
                                return (
                                    <div key={p.id} className="px-6 py-4 flex items-center gap-4">
                                        <span className="font-black text-slate-700 text-sm w-40">{p.event_type.replace(/_/g, " ")}</span>
                                        {editingVal !== undefined ? (
                                            <>
                                                <input type="number" step="0.1" value={editingVal}
                                                    onChange={e => setEditingPenalty(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                    className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none" />
                                                <span className="text-xs text-slate-400 font-semibold">stars deducted</span>
                                                <div className="flex gap-2 ml-auto">
                                                    <button onClick={() => handleSavePenalty(p.id)}
                                                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase">Save</button>
                                                    <button onClick={() => setEditingPenalty(prev => { const n = { ...prev }; delete n[p.id]; return n; })}
                                                        className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase">Cancel</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-sm font-semibold text-rose-600">-{p.star_deduction} ⭐</span>
                                                <button onClick={() => setEditingPenalty(prev => ({ ...prev, [p.id]: String(p.star_deduction) }))}
                                                    className="ml-auto px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all">
                                                    Edit
                                                </button>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* REQUESTS TAB */}
            {tab === "requests" && (
                <div className="space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        {["", "PENDING", "ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"].map(s => (
                            <button key={s} onClick={() => setRequestFilter(s)}
                                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                    requestFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                }`}>
                                {s || "All"}
                            </button>
                        ))}
                    </div>

                    {loadingRequests ? (
                        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-rose-400" /></div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
                            <p className="text-slate-400 font-bold text-sm">No emergency requests found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {requests.map(r => (
                                <div key={r.id} className="bg-white border border-slate-100 rounded-3xl px-6 py-5 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">#{r.id} · {r.category}</p>
                                            <p className="text-xs text-slate-500 font-semibold">{r.society_name}, {r.building_name}, {r.flat_no}</p>
                                            <p className="text-xs text-slate-400">{r.contact_name} · {r.contact_phone}</p>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${STATUS_COLORS[r.status] || "bg-slate-100 text-slate-500"}`}>
                                            {r.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{r.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-slate-400 font-semibold">
                                        <span>{r.responses.length} response{r.responses.length !== 1 ? "s" : ""}</span>
                                        {r.resulting_booking_id && <span className="text-emerald-600">Booking #{r.resulting_booking_id}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* STARS TAB */}
            {tab === "stars" && (
                <div className="space-y-8">
                    {/* Manual adjustment */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-5">
                        <h2 className="font-black text-slate-900 uppercase text-sm">Manual Star Adjustment</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400">Provider ID</label>
                                <input value={starProviderId} onChange={e => setStarProviderId(e.target.value)} placeholder="e.g. 42"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400">Delta (e.g. -0.5 or +1.0)</label>
                                <input type="number" step="0.1" value={starDelta} onChange={e => setStarDelta(e.target.value)} placeholder="-0.5"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400">Reason</label>
                                <input value={starReason} onChange={e => setStarReason(e.target.value)} placeholder="Admin review"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" />
                            </div>
                        </div>
                        <button onClick={handleAdjustStars} disabled={savingStar || !starProviderId || !starDelta || !starReason}
                            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                            {savingStar ? <Loader2 size={14} className="animate-spin" /> : "Apply Adjustment"}
                        </button>
                    </div>

                    {/* Star history lookup */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-5">
                        <h2 className="font-black text-slate-900 uppercase text-sm">Provider Star History</h2>
                        <div className="flex gap-3">
                            <input value={starHistoryProviderId} onChange={e => setStarHistoryProviderId(e.target.value)} placeholder="Provider ID"
                                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" />
                            <button onClick={handleLoadStarHistory} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase">
                                Load History
                            </button>
                        </div>
                        {starHistory.length > 0 && (
                            <div className="divide-y divide-slate-50">
                                {starHistory.map(h => (
                                    <div key={h.id} className="py-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{h.event_type.replace(/_/g, " ")}</p>
                                            <p className="text-xs text-slate-400">{h.reason}</p>
                                        </div>
                                        <span className={`font-black text-sm ${h.delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                            {h.delta > 0 ? "+" : ""}{h.delta} ⭐
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PENALTIES TAB */}
            {tab === "penalties" && (
                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="font-black text-slate-900 uppercase text-sm">Auto-Penalty Log</h2>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">All auto-applied penalties platform-wide</p>
                    </div>
                    {penalties.length === 0 ? (
                        <p className="text-center text-sm text-slate-400 py-12 font-semibold">No penalties recorded yet</p>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {penalties.map(p => (
                                <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-sm text-slate-900">Provider #{p.provider_id}</p>
                                        <p className="text-xs text-slate-400 font-semibold">{p.reason}</p>
                                        {p.emergency_request_id && <p className="text-[10px] text-slate-300">Emergency #{p.emergency_request_id}</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-rose-600">{p.delta} ⭐</p>
                                        <p className="text-[10px] text-slate-400">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "admin/emergency"
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/emergency/page.tsx
git commit -m "feat: add Admin Emergency SOS panel (pricing, oversight, stars, penalties)"
```

---

## Task 15: Sidebar Update

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Emergency entry to `ADMIN_NAV` in `Sidebar.tsx`**

Find in `frontend/components/layout/Sidebar.tsx`:

```typescript
const ADMIN_NAV = [
  { name: "Overview", icon: BarChart3, path: "/admin/dashboard" },
  { name: "All Users", icon: Users, path: "/admin/users" },
  { name: "Providers", icon: UserCheck, path: "/admin/providers" },
  { name: "Bookings", icon: ClipboardList, path: "/admin/bookings" },
  { name: "System Logs", icon: ShieldCheck, path: "/admin/logs" },
  { name: "Settings", icon: Settings, path: "/admin/settings" },
];
```

Replace with:

```typescript
const ADMIN_NAV = [
  { name: "Overview", icon: BarChart3, path: "/admin/dashboard" },
  { name: "All Users", icon: Users, path: "/admin/users" },
  { name: "Providers", icon: UserCheck, path: "/admin/providers" },
  { name: "Bookings", icon: ClipboardList, path: "/admin/bookings" },
  { name: "Emergency SOS", icon: ShieldAlert, path: "/admin/emergency" },
  { name: "System Logs", icon: ShieldCheck, path: "/admin/logs" },
  { name: "Settings", icon: Settings, path: "/admin/settings" },
];
```

- [ ] **Step 2: Add `ShieldAlert` to the lucide-react import**

Find the import line:
```typescript
import {
  LayoutDashboard, Wrench, Bell, Settings,
  LogOut, Briefcase, Star, Users, ShieldCheck,
  BarChart3, ClipboardList, UserCheck, ChevronRight,
  User, Lock, BellRing, Search, Home,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
```

Add `ShieldAlert` to the list:
```typescript
import {
  LayoutDashboard, Wrench, Bell, Settings,
  LogOut, Briefcase, Star, Users, ShieldCheck, ShieldAlert,
  BarChart3, ClipboardList, UserCheck, ChevronRight,
  User, Lock, BellRing, Search, Home,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep Sidebar
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat: add Emergency SOS link to admin sidebar nav"
```

---

## Self-Review Checklist

### Spec Coverage
- ✅ DB schema: 5 new models (EmergencyConfig, EmergencyPenaltyConfig, EmergencyRequest, EmergencyResponse, EmergencyStarAdjustment)
- ✅ Alembic migration for all 5 tables
- ✅ Admin: GET/POST/PATCH pricing config, penalty config, all emergencies, star adjust, star history, penalties log, provider status
- ✅ User SOS: GET config (price preview), GET providers, POST create, GET detail, POST accept, POST cancel
- ✅ Servicer: GET incoming, POST respond, POST ignore
- ✅ WebSocket: user watches responses (`/ws/emergency/{id}`), servicer receives alerts (`/ws/servicer/alerts`)
- ✅ Billing formula: callout_fee + max(0, hours-1) × hourly_rate, tested
- ✅ Star delta: clamped [0, 5], tested
- ✅ Auto-penalty seeded on startup (LATE_ARRIVAL, CANCELLATION, NO_SHOW)
- ✅ Remove old `POST /bookings/emergency` endpoint
- ✅ Frontend: user warning → form → live feed → confirmed/expired
- ✅ Frontend: servicer Emergency tab on jobs page with WebSocket
- ✅ Frontend: admin panel (pricing, requests, stars, penalties)
- ✅ Sidebar: admin Emergency SOS nav link

### Type Consistency
- `EmergencyResponseRead` used in `EmergencyRequestRead.responses` — consistent throughout
- `apply_star_delta` referenced in both `services.py` and `admin/emergency_endpoint.py` — same import path
- `trigger_auto_penalty` defined in `admin/emergency_endpoint.py` — available to import when booking cancellation penalty is needed (future: import and call from booking endpoint)
- `EMERGENCY_CATEGORIES` in `services.py` matches `EMERGENCY_CATEGORY_OPTIONS` in `schemas.py` — both defined from same list

### Placeholder Scan
- No TBDs. All code steps have complete implementations.

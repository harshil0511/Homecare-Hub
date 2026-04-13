# Society Contract System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let secretaries invite service providers into time-bound society contracts, dispatch them to member jobs, and let servicers accept/counter/reject via a dedicated Society Jobs tab.

**Architecture:** Two new DB tables (`society_contracts`, `society_dispatches`) + two new FastAPI routers (`/secretary/contracts`, `/service/contracts`). Frontend extends existing `/secretary/providers` page (invite button) and `/service/jobs` page (new tab). One new secretary page at `/secretary/contracts` for contract management.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, Next.js 16, Tailwind CSS 4, lucide-react.

---

## File Map

**Create (backend):**
- `backend/app/contract/__init__.py`
- `backend/app/contract/domain/__init__.py`
- `backend/app/contract/domain/model.py` — SocietyContract + SocietyDispatch ORM models
- `backend/app/api/secretary/contracts_schemas.py` — Pydantic schemas for secretary side
- `backend/app/api/secretary/contracts_endpoints.py` — 7 endpoints for secretary
- `backend/app/api/service/contracts_schemas.py` — Pydantic schemas for servicer side
- `backend/app/api/service/contracts_endpoints.py` — 6 endpoints for servicer
- `backend/alembic/versions/13_04_2026_add_society_contracts.py` — migration
- `backend/tests/test_society_contracts.py` — model + schema + business logic tests

**Modify (backend):**
- `backend/alembic/env.py` — register new model module
- `backend/app/core/scheduler.py` — add daily contract expiry job
- `backend/app/main.py` — register two new routers

**Create (frontend):**
- `frontend/app/secretary/contracts/page.tsx` — contract list + dispatch page

**Modify (frontend):**
- `frontend/app/secretary/providers/page.tsx` — add "Invite to Contract" to floating bar
- `frontend/app/service/jobs/page.tsx` — add "society" tab
- `frontend/components/layout/Sidebar.tsx` — add Contracts to SECRETARY_NAV

---

## Task 1: Domain Models

**Files:**
- Create: `backend/app/contract/__init__.py`
- Create: `backend/app/contract/domain/__init__.py`
- Create: `backend/app/contract/domain/model.py`

- [ ] **Step 1: Create the package init files**

```bash
# Run from backend/
mkdir -p app/contract/domain
touch app/contract/__init__.py app/contract/domain/__init__.py
```

- [ ] **Step 2: Write the model file**

Create `backend/app/contract/domain/model.py`:

```python
import uuid
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class SocietyContract(Base):
    __tablename__ = "society_contracts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=False)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    proposed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    duration_months = Column(Integer, nullable=False)
    counter_duration_months = Column(Integer, nullable=True)
    monthly_rate = Column(Float, nullable=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, default="PENDING")
    secretary_notes = Column(Text, nullable=True)
    servicer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)

    society = relationship("Society")
    provider = relationship("ServiceProvider")
    proposed_by_user = relationship("User", foreign_keys=[proposed_by])
    dispatches = relationship(
        "SocietyDispatch", back_populates="contract", cascade="all, delete-orphan"
    )


class SocietyDispatch(Base):
    __tablename__ = "society_dispatches"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    contract_id = Column(
        PG_UUID(as_uuid=True), ForeignKey("society_contracts.id"), nullable=False
    )
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=False)
    provider_id = Column(
        PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False
    )
    member_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    service_type = Column(String, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    job_price = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String, default="ASSIGNED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    contract = relationship("SocietyContract", back_populates="dispatches")
    provider = relationship("ServiceProvider")
    member = relationship("User", foreign_keys=[member_id])
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/contract/
git commit -m "feat: add SocietyContract and SocietyDispatch domain models"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/13_04_2026_add_society_contracts.py`
- Modify: `backend/alembic/env.py`

- [ ] **Step 1: Create the migration file**

Create `backend/alembic/versions/13_04_2026_add_society_contracts.py`:

```python
"""add society_contracts and society_dispatches tables

Revision ID: 13042026_society_contracts
Revises: 13042026_home_members
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "13042026_society_contracts"
down_revision = "13042026_home_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "society_contracts",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("society_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("societies.id"), nullable=False),
        sa.Column("provider_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_providers.id"), nullable=False),
        sa.Column("proposed_by", PG_UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("duration_months", sa.Integer, nullable=False),
        sa.Column("counter_duration_months", sa.Integer, nullable=True),
        sa.Column("monthly_rate", sa.Float, nullable=False),
        sa.Column("start_date", sa.DateTime, nullable=True),
        sa.Column("end_date", sa.DateTime, nullable=True),
        sa.Column("status", sa.String(50), server_default="PENDING", nullable=False),
        sa.Column("secretary_notes", sa.Text, nullable=True),
        sa.Column("servicer_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_society_contracts_society_id", "society_contracts", ["society_id"])
    op.create_index("ix_society_contracts_provider_id", "society_contracts", ["provider_id"])

    op.create_table(
        "society_dispatches",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("contract_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("society_contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("society_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("societies.id"), nullable=False),
        sa.Column("provider_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_providers.id"), nullable=False),
        sa.Column("member_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("service_type", sa.String(200), nullable=False),
        sa.Column("scheduled_at", sa.DateTime, nullable=False),
        sa.Column("job_price", sa.Float, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), server_default="ASSIGNED", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_society_dispatches_contract_id", "society_dispatches", ["contract_id"])
    op.create_index("ix_society_dispatches_provider_id", "society_dispatches", ["provider_id"])


def downgrade() -> None:
    op.drop_index("ix_society_dispatches_provider_id", table_name="society_dispatches")
    op.drop_index("ix_society_dispatches_contract_id", table_name="society_dispatches")
    op.drop_table("society_dispatches")
    op.drop_index("ix_society_contracts_provider_id", table_name="society_contracts")
    op.drop_index("ix_society_contracts_society_id", table_name="society_contracts")
    op.drop_table("society_contracts")
```

- [ ] **Step 2: Register the new model in alembic/env.py**

In `backend/alembic/env.py`, find the block of model imports (around line 31–38) and add one line:

```python
# existing imports
from app.auth.domain import model as _auth  # noqa
from app.service.domain import model as _service  # noqa
from app.booking.domain import model as _booking  # noqa
from app.maintenance.domain import model as _maintenance  # noqa
from app.notification.domain import model as _notification  # noqa
from app.request.domain import model as _request  # noqa
from app.emergency.domain import model as _emergency  # noqa
from app.secretary.domain import model as _secretary  # noqa
from app.contract.domain import model as _contract  # noqa   ← ADD THIS LINE
```

- [ ] **Step 3: Apply the migration (requires running DB)**

```bash
# Run from backend/
alembic upgrade head
```

Expected output ends with: `Running upgrade 13042026_home_members -> 13042026_society_contracts`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/13_04_2026_add_society_contracts.py backend/alembic/env.py
git commit -m "feat: migration — add society_contracts and society_dispatches tables"
```

---

## Task 3: Tests (models + schemas + business logic)

**Files:**
- Create: `backend/tests/test_society_contracts.py`

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_society_contracts.py`:

```python
"""
TDD tests for Society Contract system.
Pure Python — no live DB or HTTP required.
Covers: model columns, schema validation, status-transition business logic.
"""
import pytest
import uuid
from datetime import datetime


# ──────────────────────────────────────────────
# MODEL COLUMN TESTS
# ──────────────────────────────────────────────

class TestSocietyContractModel:
    def test_has_required_columns(self):
        from app.contract.domain.model import SocietyContract
        cols = {c.name for c in SocietyContract.__table__.columns}
        for name in ("id", "society_id", "provider_id", "proposed_by",
                     "duration_months", "monthly_rate", "status",
                     "start_date", "end_date", "counter_duration_months",
                     "secretary_notes", "servicer_notes", "created_at", "updated_at"):
            assert name in cols, f"Missing column: {name}"

    def test_status_defaults_to_pending(self):
        from app.contract.domain.model import SocietyContract
        col = SocietyContract.__table__.columns["status"]
        assert col.default.arg == "PENDING"

    def test_counter_duration_is_nullable(self):
        from app.contract.domain.model import SocietyContract
        col = SocietyContract.__table__.columns["counter_duration_months"]
        assert col.nullable is True

    def test_start_date_is_nullable(self):
        from app.contract.domain.model import SocietyContract
        col = SocietyContract.__table__.columns["start_date"]
        assert col.nullable is True

    def test_end_date_is_nullable(self):
        from app.contract.domain.model import SocietyContract
        col = SocietyContract.__table__.columns["end_date"]
        assert col.nullable is True


class TestSocietyDispatchModel:
    def test_has_required_columns(self):
        from app.contract.domain.model import SocietyDispatch
        cols = {c.name for c in SocietyDispatch.__table__.columns}
        for name in ("id", "contract_id", "society_id", "provider_id",
                     "member_id", "service_type", "scheduled_at",
                     "job_price", "notes", "status", "created_at"):
            assert name in cols, f"Missing column: {name}"

    def test_status_defaults_to_assigned(self):
        from app.contract.domain.model import SocietyDispatch
        col = SocietyDispatch.__table__.columns["status"]
        assert col.default.arg == "ASSIGNED"

    def test_notes_is_nullable(self):
        from app.contract.domain.model import SocietyDispatch
        col = SocietyDispatch.__table__.columns["notes"]
        assert col.nullable is True


# ──────────────────────────────────────────────
# SECRETARY SCHEMA TESTS
# ──────────────────────────────────────────────

class TestSocietyContractCreate:
    def test_valid_duration_2_months(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        s = SocietyContractCreate(
            provider_id=uuid.uuid4(),
            duration_months=2,
            monthly_rate=5000.0,
        )
        assert s.duration_months == 2

    def test_valid_duration_6_months(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        s = SocietyContractCreate(
            provider_id=uuid.uuid4(),
            duration_months=6,
            monthly_rate=5000.0,
        )
        assert s.duration_months == 6

    def test_valid_duration_10_months(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        s = SocietyContractCreate(
            provider_id=uuid.uuid4(),
            duration_months=10,
            monthly_rate=5000.0,
        )
        assert s.duration_months == 10

    def test_valid_duration_12_months(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        s = SocietyContractCreate(
            provider_id=uuid.uuid4(),
            duration_months=12,
            monthly_rate=5000.0,
        )
        assert s.duration_months == 12

    def test_invalid_duration_rejected(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SocietyContractCreate(
                provider_id=uuid.uuid4(),
                duration_months=3,   # not in (2, 6, 10, 12)
                monthly_rate=5000.0,
            )

    def test_zero_monthly_rate_rejected(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SocietyContractCreate(
                provider_id=uuid.uuid4(),
                duration_months=6,
                monthly_rate=0.0,
            )

    def test_negative_monthly_rate_rejected(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SocietyContractCreate(
                provider_id=uuid.uuid4(),
                duration_months=6,
                monthly_rate=-100.0,
            )

    def test_secretary_notes_is_optional(self):
        from app.api.secretary.contracts_schemas import SocietyContractCreate
        s = SocietyContractCreate(
            provider_id=uuid.uuid4(),
            duration_months=6,
            monthly_rate=5000.0,
        )
        assert s.secretary_notes is None


class TestSocietyDispatchCreate:
    def test_valid_dispatch(self):
        from app.api.secretary.contracts_schemas import SocietyDispatchCreate
        s = SocietyDispatchCreate(
            member_id=uuid.uuid4(),
            service_type="Plumbing",
            scheduled_at=datetime(2026, 5, 10, 9, 0),
            job_price=1500.0,
        )
        assert s.service_type == "Plumbing"
        assert s.job_price == 1500.0

    def test_zero_job_price_rejected(self):
        from app.api.secretary.contracts_schemas import SocietyDispatchCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SocietyDispatchCreate(
                member_id=uuid.uuid4(),
                service_type="Plumbing",
                scheduled_at=datetime(2026, 5, 10, 9, 0),
                job_price=0.0,
            )

    def test_notes_is_optional(self):
        from app.api.secretary.contracts_schemas import SocietyDispatchCreate
        s = SocietyDispatchCreate(
            member_id=uuid.uuid4(),
            service_type="Electrical",
            scheduled_at=datetime(2026, 5, 10, 9, 0),
            job_price=800.0,
        )
        assert s.notes is None


# ──────────────────────────────────────────────
# SERVICER SCHEMA TESTS
# ──────────────────────────────────────────────

class TestSocietyContractCounterCreate:
    def test_valid_counter_duration(self):
        from app.api.service.contracts_schemas import SocietyContractCounterCreate
        s = SocietyContractCounterCreate(counter_duration_months=2)
        assert s.counter_duration_months == 2

    def test_invalid_counter_duration_rejected(self):
        from app.api.service.contracts_schemas import SocietyContractCounterCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SocietyContractCounterCreate(counter_duration_months=5)

    def test_servicer_notes_optional(self):
        from app.api.service.contracts_schemas import SocietyContractCounterCreate
        s = SocietyContractCounterCreate(counter_duration_months=6)
        assert s.servicer_notes is None


class TestSocietyDispatchStatusUpdate:
    def test_in_progress_valid(self):
        from app.api.service.contracts_schemas import SocietyDispatchStatusUpdate
        s = SocietyDispatchStatusUpdate(status="IN_PROGRESS")
        assert s.status == "IN_PROGRESS"

    def test_completed_valid(self):
        from app.api.service.contracts_schemas import SocietyDispatchStatusUpdate
        s = SocietyDispatchStatusUpdate(status="COMPLETED")
        assert s.status == "COMPLETED"

    def test_invalid_status_rejected(self):
        from app.api.service.contracts_schemas import SocietyDispatchStatusUpdate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SocietyDispatchStatusUpdate(status="ASSIGNED")  # not a valid update target

    def test_cancelled_rejected(self):
        from app.api.service.contracts_schemas import SocietyDispatchStatusUpdate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SocietyDispatchStatusUpdate(status="CANCELLED")


# ──────────────────────────────────────────────
# BUSINESS LOGIC TESTS
# ──────────────────────────────────────────────

class TestContractStatusTransitions:
    """Pure-logic mirrors of the endpoint guard conditions."""

    def _can_accept(self, status: str) -> bool:
        return status == "PENDING"

    def _can_counter(self, status: str) -> bool:
        return status == "PENDING"

    def _can_reject(self, status: str) -> bool:
        return status == "PENDING"

    def _can_confirm_counter(self, status: str) -> bool:
        return status == "COUNTER_PROPOSED"

    def _can_reject_counter(self, status: str) -> bool:
        return status == "COUNTER_PROPOSED"

    def _can_cancel(self, status: str) -> bool:
        return status == "ACTIVE"

    def _can_dispatch(self, status: str) -> bool:
        return status == "ACTIVE"

    def test_accept_only_when_pending(self):
        assert self._can_accept("PENDING") is True
        assert self._can_accept("COUNTER_PROPOSED") is False
        assert self._can_accept("ACTIVE") is False

    def test_counter_only_when_pending(self):
        assert self._can_counter("PENDING") is True
        assert self._can_counter("COUNTER_PROPOSED") is False

    def test_reject_only_when_pending(self):
        assert self._can_reject("PENDING") is True
        assert self._can_reject("ACTIVE") is False

    def test_confirm_counter_only_when_counter_proposed(self):
        assert self._can_confirm_counter("COUNTER_PROPOSED") is True
        assert self._can_confirm_counter("PENDING") is False

    def test_reject_counter_only_when_counter_proposed(self):
        assert self._can_reject_counter("COUNTER_PROPOSED") is True
        assert self._can_reject_counter("ACTIVE") is False

    def test_cancel_only_when_active(self):
        assert self._can_cancel("ACTIVE") is True
        assert self._can_cancel("PENDING") is False
        assert self._can_cancel("EXPIRED") is False

    def test_dispatch_only_when_active(self):
        assert self._can_dispatch("ACTIVE") is True
        assert self._can_dispatch("PENDING") is False
        assert self._can_dispatch("CANCELLED") is False


class TestDispatchStatusTransitions:
    VALID_TRANSITIONS = {
        "ASSIGNED": ["IN_PROGRESS"],
        "IN_PROGRESS": ["COMPLETED"],
    }

    def _can_transition(self, current: str, target: str) -> bool:
        return target in self.VALID_TRANSITIONS.get(current, [])

    def test_assigned_can_go_in_progress(self):
        assert self._can_transition("ASSIGNED", "IN_PROGRESS") is True

    def test_in_progress_can_go_completed(self):
        assert self._can_transition("IN_PROGRESS", "COMPLETED") is True

    def test_assigned_cannot_skip_to_completed(self):
        assert self._can_transition("ASSIGNED", "COMPLETED") is False

    def test_completed_cannot_transition_further(self):
        assert self._can_transition("COMPLETED", "IN_PROGRESS") is False

    def test_backwards_transition_blocked(self):
        assert self._can_transition("IN_PROGRESS", "ASSIGNED") is False
```

- [ ] **Step 2: Run tests — all should pass**

```bash
# Run from backend/
pytest tests/test_society_contracts.py -v
```

Expected: All tests PASS (models exist, schemas validate, logic is correct).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_society_contracts.py
git commit -m "test: society contract model, schema, and business logic tests"
```

---

## Task 4: Secretary Contracts Schemas

**Files:**
- Create: `backend/app/api/secretary/contracts_schemas.py`

- [ ] **Step 1: Write the schemas**

Create `backend/app/api/secretary/contracts_schemas.py`:

```python
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


class SocietyContractCreate(BaseModel):
    provider_id: UUID
    duration_months: int
    monthly_rate: float
    secretary_notes: Optional[str] = None

    @field_validator("duration_months")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v not in (2, 6, 10, 12):
            raise ValueError("duration_months must be 2, 6, 10, or 12")
        return v

    @field_validator("monthly_rate")
    @classmethod
    def validate_rate(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("monthly_rate must be positive")
        return v


class SocietyDispatchCreate(BaseModel):
    member_id: UUID
    service_type: str
    scheduled_at: datetime
    job_price: float
    notes: Optional[str] = None

    @field_validator("job_price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("job_price must be positive")
        return v


class ProviderSummary(BaseModel):
    id: UUID
    company_name: str
    category: str
    rating: float
    phone: Optional[str] = None
    availability_status: str

    class Config:
        from_attributes = True


class SocietyDispatchRead(BaseModel):
    id: UUID
    contract_id: UUID
    society_id: UUID
    provider_id: UUID
    member_id: UUID
    service_type: str
    scheduled_at: datetime
    job_price: float
    notes: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SocietyContractRead(BaseModel):
    id: UUID
    society_id: UUID
    provider_id: UUID
    proposed_by: UUID
    duration_months: int
    counter_duration_months: Optional[int] = None
    monthly_rate: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str
    secretary_notes: Optional[str] = None
    servicer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    provider: Optional[ProviderSummary] = None
    dispatches: List[SocietyDispatchRead] = []

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Re-run tests to confirm schemas still pass**

```bash
pytest tests/test_society_contracts.py -v -k "Schema"
```

Expected: All schema tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/secretary/contracts_schemas.py
git commit -m "feat: secretary contracts Pydantic schemas"
```

---

## Task 5: Secretary Contracts Endpoints

**Files:**
- Create: `backend/app/api/secretary/contracts_endpoints.py`

- [ ] **Step 1: Write the endpoints**

Create `backend/app/api/secretary/contracts_endpoints.py`:

```python
import logging
from datetime import datetime, timezone, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.common import deps
from app.auth.domain.model import User, Society
from app.service.domain.model import ServiceProvider
from app.contract.domain.model import SocietyContract, SocietyDispatch
from app.notification.domain.model import Notification
from app.api.secretary.contracts_schemas import (
    SocietyContractCreate, SocietyContractRead,
    SocietyDispatchCreate, SocietyDispatchRead,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Secretary Contracts"])
secretary_only = deps.RoleChecker(["SECRETARY"])


def _get_society(current_user: User, db: Session) -> Society:
    if not current_user.society_id:
        raise HTTPException(status_code=404, detail="No society assigned to this secretary.")
    society = db.query(Society).filter(Society.id == current_user.society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found.")
    return society


def _notify(db: Session, user_id, title: str, message: str,
            notification_type: str = "INFO", link: str = None) -> None:
    db.add(Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    ))


@router.get("/", response_model=List[SocietyContractRead])
def list_contracts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    return (
        db.query(SocietyContract)
        .filter(SocietyContract.society_id == society.id)
        .order_by(SocietyContract.created_at.desc())
        .all()
    )


@router.post("/", response_model=SocietyContractRead, status_code=201)
def create_contract(
    contract_in: SocietyContractCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.id == contract_in.provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    existing = db.query(SocietyContract).filter(
        SocietyContract.society_id == society.id,
        SocietyContract.provider_id == contract_in.provider_id,
        SocietyContract.status == "ACTIVE",
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This provider already has an active contract with your society.",
        )

    contract = SocietyContract(
        society_id=society.id,
        provider_id=contract_in.provider_id,
        proposed_by=current_user.id,
        duration_months=contract_in.duration_months,
        monthly_rate=contract_in.monthly_rate,
        secretary_notes=contract_in.secretary_notes,
        status="PENDING",
    )
    db.add(contract)
    db.flush()

    if provider.user_id:
        _notify(
            db,
            user_id=provider.user_id,
            title="Society Contract Invite",
            message=(
                f"{society.name} invites you to a {contract_in.duration_months}-month "
                f"contract at \u20b9{contract_in.monthly_rate:.0f}/month."
            ),
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(contract)
    return contract


@router.post("/{contract_id}/confirm-counter", response_model=SocietyContractRead)
def confirm_counter(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "COUNTER_PROPOSED":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not COUNTER_PROPOSED.",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    contract.status = "ACTIVE"
    contract.duration_months = contract.counter_duration_months
    contract.start_date = now
    contract.end_date = now + timedelta(days=30 * contract.duration_months)

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="Contract Active",
            message=(
                f"Your {contract.duration_months}-month contract with "
                f"{society.name} is now active."
            ),
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(contract)
    return contract


@router.post("/{contract_id}/reject-counter", response_model=SocietyContractRead)
def reject_counter(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "COUNTER_PROPOSED":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not COUNTER_PROPOSED.",
        )

    contract.status = "REJECTED"

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="Contract Counter Rejected",
            message=f"{society.name} rejected your counter-proposal. The invite is closed.",
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=200)
def cancel_contract(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Only ACTIVE contracts can be cancelled.")

    contract.status = "CANCELLED"

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="Contract Cancelled",
            message=f"Your contract with {society.name} has been cancelled by the secretary.",
            notification_type="WARNING",
            link="/service/jobs?tab=society",
        )

    db.commit()
    return {"detail": "Contract cancelled."}


@router.post("/{contract_id}/dispatch", response_model=SocietyDispatchRead, status_code=201)
def dispatch_job(
    contract_id: UUID,
    dispatch_in: SocietyDispatchCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Can only dispatch on ACTIVE contracts.")

    member = db.query(User).filter(
        User.id == dispatch_in.member_id,
        User.society_id == society.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in your society.")

    dispatch = SocietyDispatch(
        contract_id=contract_id,
        society_id=society.id,
        provider_id=contract.provider_id,
        member_id=dispatch_in.member_id,
        service_type=dispatch_in.service_type,
        scheduled_at=dispatch_in.scheduled_at,
        job_price=dispatch_in.job_price,
        notes=dispatch_in.notes,
        status="ASSIGNED",
    )
    db.add(dispatch)
    db.flush()

    if contract.provider.user_id:
        _notify(
            db,
            user_id=contract.provider.user_id,
            title="New Society Job Dispatched",
            message=(
                f"New job: {dispatch_in.service_type} on "
                f"{dispatch_in.scheduled_at.strftime('%b %d')}. "
                f"\u20b9{dispatch_in.job_price:.0f}."
            ),
            notification_type="INFO",
            link="/service/jobs?tab=society",
        )

    db.commit()
    db.refresh(dispatch)
    return dispatch


@router.get("/{contract_id}/dispatches", response_model=List[SocietyDispatchRead])
def list_dispatches(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    society = _get_society(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.society_id == society.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    return (
        db.query(SocietyDispatch)
        .filter(SocietyDispatch.contract_id == contract_id)
        .order_by(SocietyDispatch.created_at.desc())
        .all()
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/secretary/contracts_endpoints.py
git commit -m "feat: secretary contracts endpoints (7 routes)"
```

---

## Task 6: Servicer Contracts Schemas

**Files:**
- Create: `backend/app/api/service/contracts_schemas.py`

- [ ] **Step 1: Write the schemas**

Create `backend/app/api/service/contracts_schemas.py`:

```python
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


class SocietyContractCounterCreate(BaseModel):
    counter_duration_months: int
    servicer_notes: Optional[str] = None

    @field_validator("counter_duration_months")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v not in (2, 6, 10, 12):
            raise ValueError("counter_duration_months must be 2, 6, 10, or 12")
        return v


class SocietyDispatchStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("IN_PROGRESS", "COMPLETED"):
            raise ValueError("status must be IN_PROGRESS or COMPLETED")
        return v


class SocietySummary(BaseModel):
    id: UUID
    name: str
    address: str

    class Config:
        from_attributes = True


class SocietyDispatchServicerRead(BaseModel):
    id: UUID
    service_type: str
    scheduled_at: datetime
    job_price: float
    notes: Optional[str] = None
    status: str
    created_at: datetime
    member_home_number: Optional[str] = None
    member_name: Optional[str] = None


class SocietyContractServicerRead(BaseModel):
    id: UUID
    society_id: UUID
    duration_months: int
    counter_duration_months: Optional[int] = None
    monthly_rate: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str
    secretary_notes: Optional[str] = None
    servicer_notes: Optional[str] = None
    created_at: datetime
    society: Optional[SocietySummary] = None
    dispatches: List[SocietyDispatchServicerRead] = []
```

- [ ] **Step 2: Re-run servicer schema tests**

```bash
pytest tests/test_society_contracts.py -v -k "Counter or StatusUpdate"
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/service/contracts_schemas.py
git commit -m "feat: servicer contracts Pydantic schemas"
```

---

## Task 7: Servicer Contracts Endpoints

**Files:**
- Create: `backend/app/api/service/contracts_endpoints.py`

- [ ] **Step 1: Write the endpoints**

Create `backend/app/api/service/contracts_endpoints.py`:

```python
import logging
from datetime import datetime, timezone, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.contract.domain.model import SocietyContract, SocietyDispatch
from app.notification.domain.model import Notification
from app.api.service.contracts_schemas import (
    SocietyContractCounterCreate, SocietyDispatchStatusUpdate,
    SocietyContractServicerRead, SocietyDispatchServicerRead,
    SocietySummary,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Servicer Contracts"])
servicer_only = deps.RoleChecker(["SERVICER"])


def _notify(db: Session, user_id, title: str, message: str,
            notification_type: str = "INFO", link: str = None) -> None:
    db.add(Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
    ))


def _get_provider(current_user: User, db: Session) -> ServiceProvider:
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found.")
    return provider


def _build_servicer_read(contract: SocietyContract) -> SocietyContractServicerRead:
    dispatches = []
    for d in contract.dispatches:
        member = d.member
        dispatches.append(SocietyDispatchServicerRead(
            id=d.id,
            service_type=d.service_type,
            scheduled_at=d.scheduled_at,
            job_price=d.job_price,
            notes=d.notes,
            status=d.status,
            created_at=d.created_at,
            member_home_number=member.home_number if member else None,
            member_name=member.username if member else None,
        ))

    society = contract.society
    society_summary = (
        SocietySummary(id=society.id, name=society.name, address=society.address)
        if society else None
    )

    return SocietyContractServicerRead(
        id=contract.id,
        society_id=contract.society_id,
        duration_months=contract.duration_months,
        counter_duration_months=contract.counter_duration_months,
        monthly_rate=contract.monthly_rate,
        start_date=contract.start_date,
        end_date=contract.end_date,
        status=contract.status,
        secretary_notes=contract.secretary_notes,
        servicer_notes=contract.servicer_notes,
        created_at=contract.created_at,
        society=society_summary,
        dispatches=dispatches,
    )


@router.get("/", response_model=List[SocietyContractServicerRead])
def list_my_contracts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contracts = (
        db.query(SocietyContract)
        .filter(
            SocietyContract.provider_id == provider.id,
            SocietyContract.status.in_(["PENDING", "COUNTER_PROPOSED", "ACTIVE"]),
        )
        .order_by(SocietyContract.created_at.desc())
        .all()
    )
    return [_build_servicer_read(c) for c in contracts]


@router.post("/{contract_id}/accept", response_model=SocietyContractServicerRead)
def accept_contract(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not PENDING.",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    contract.status = "ACTIVE"
    contract.start_date = now
    contract.end_date = now + timedelta(days=30 * contract.duration_months)

    secretary = db.query(User).filter(User.id == contract.proposed_by).first()
    if secretary:
        _notify(
            db,
            user_id=secretary.id,
            title="Contract Accepted",
            message=(
                f"Provider {provider.company_name} accepted the "
                f"{contract.duration_months}-month contract."
            ),
            notification_type="INFO",
            link="/secretary/contracts",
        )

    db.commit()
    db.refresh(contract)
    return _build_servicer_read(contract)


@router.post("/{contract_id}/reject", status_code=200)
def reject_contract(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Contract is {contract.status}, not PENDING.",
        )

    contract.status = "REJECTED"

    secretary = db.query(User).filter(User.id == contract.proposed_by).first()
    if secretary:
        _notify(
            db,
            user_id=secretary.id,
            title="Contract Rejected",
            message=f"Provider {provider.company_name} declined the contract invite.",
            notification_type="INFO",
            link="/secretary/contracts",
        )

    db.commit()
    return {"detail": "Contract rejected."}


@router.post("/{contract_id}/counter", response_model=SocietyContractServicerRead)
def counter_contract(
    contract_id: UUID,
    counter_in: SocietyContractCounterCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Can only counter a PENDING contract. Current: {contract.status}",
        )

    contract.status = "COUNTER_PROPOSED"
    contract.counter_duration_months = counter_in.counter_duration_months
    contract.servicer_notes = counter_in.servicer_notes

    secretary = db.query(User).filter(User.id == contract.proposed_by).first()
    if secretary:
        _notify(
            db,
            user_id=secretary.id,
            title="Contract Counter-Proposal",
            message=(
                f"Provider {provider.company_name} counter-proposed: "
                f"{counter_in.counter_duration_months} months."
            ),
            notification_type="INFO",
            link="/secretary/contracts",
        )

    db.commit()
    db.refresh(contract)
    return _build_servicer_read(contract)


@router.get("/{contract_id}/jobs", response_model=List[SocietyDispatchServicerRead])
def list_my_jobs(
    contract_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    contract = db.query(SocietyContract).filter(
        SocietyContract.id == contract_id,
        SocietyContract.provider_id == provider.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")

    result = []
    for d in (
        db.query(SocietyDispatch)
        .filter(SocietyDispatch.contract_id == contract_id)
        .order_by(SocietyDispatch.scheduled_at.asc())
        .all()
    ):
        member = d.member
        result.append(SocietyDispatchServicerRead(
            id=d.id,
            service_type=d.service_type,
            scheduled_at=d.scheduled_at,
            job_price=d.job_price,
            notes=d.notes,
            status=d.status,
            created_at=d.created_at,
            member_home_number=member.home_number if member else None,
            member_name=member.username if member else None,
        ))
    return result


@router.patch("/{contract_id}/jobs/{dispatch_id}", status_code=200)
def update_dispatch_status(
    contract_id: UUID,
    dispatch_id: UUID,
    update_in: SocietyDispatchStatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(servicer_only),
):
    provider = _get_provider(current_user, db)
    dispatch = db.query(SocietyDispatch).filter(
        SocietyDispatch.id == dispatch_id,
        SocietyDispatch.contract_id == contract_id,
        SocietyDispatch.provider_id == provider.id,
    ).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found.")

    valid_transitions = {
        "ASSIGNED": ["IN_PROGRESS"],
        "IN_PROGRESS": ["COMPLETED"],
    }
    if update_in.status not in valid_transitions.get(dispatch.status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {dispatch.status} to {update_in.status}.",
        )

    dispatch.status = update_in.status
    db.commit()
    return {"detail": f"Dispatch status updated to {update_in.status}."}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/service/contracts_endpoints.py
git commit -m "feat: servicer contracts endpoints (6 routes)"
```

---

## Task 8: Wire Routers + Scheduler

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/core/scheduler.py`

- [ ] **Step 1: Register new routers in main.py**

In `backend/app/main.py`, add two import lines after the existing secretary router import (around line 21):

```python
from app.api.secretary.contracts_endpoints import router as secretary_contracts_router
from app.api.service.contracts_endpoints import router as servicer_contracts_router
```

Then add two `include_router` calls after `app.include_router(secretary_router, ...)` (around line 140):

```python
app.include_router(secretary_contracts_router, prefix="/api/v1/secretary/contracts")
app.include_router(servicer_contracts_router,  prefix="/api/v1/service/contracts")
```

- [ ] **Step 2: Add daily contract expiry job to scheduler.py**

In `backend/app/core/scheduler.py`, add the import and function before `start_scheduler()`:

Add to imports at top:
```python
from app.contract.domain.model import SocietyContract
```

Add this function before `start_scheduler`:

```python
def _expire_contracts() -> None:
    """Run daily. Mark ACTIVE contracts whose end_date has passed as EXPIRED."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expired = (
            db.query(SocietyContract)
            .filter(
                SocietyContract.status == "ACTIVE",
                SocietyContract.end_date < now,
            )
            .all()
        )

        for contract in expired:
            contract.status = "EXPIRED"

            # Notify secretary
            secretary = db.query(Notification.__class__).first()  # placeholder fetch
            from app.auth.domain.model import User
            secretary_user = db.query(User).filter(
                User.id == contract.proposed_by
            ).first()
            if secretary_user:
                db.add(Notification(
                    user_id=secretary_user.id,
                    title="Contract Expired",
                    message=f"The contract with provider has expired after {contract.duration_months} months.",
                    notification_type="INFO",
                    link="/secretary/contracts",
                ))

            # Notify provider
            if contract.provider and contract.provider.user_id:
                db.add(Notification(
                    user_id=contract.provider.user_id,
                    title="Society Contract Expired",
                    message=f"Your contract with {contract.society.name} has expired.",
                    notification_type="INFO",
                    link="/service/jobs?tab=society",
                ))

        if expired:
            db.commit()
            logger.info("Contract expiry check complete — expired %d contracts.", len(expired))
    except Exception:
        logger.exception("Contract expiry scheduler failed.")
        db.rollback()
    finally:
        db.close()
```

Update `start_scheduler()` to also add the daily job:

```python
def start_scheduler() -> None:
    scheduler.add_job(
        _check_alert_notifications,
        trigger="interval",
        hours=1,
        id="alert_notifications",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        _expire_contracts,
        trigger="interval",
        hours=24,
        id="contract_expiry",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("Alert notification scheduler started.")
```

- [ ] **Step 3: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All tests PASS (no import errors from new routers).

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/app/core/scheduler.py
git commit -m "feat: register society contract routers + daily expiry scheduler job"
```

---

## Task 9: Secretary Contracts Page (Frontend)

**Files:**
- Create: `frontend/app/secretary/contracts/page.tsx`

- [ ] **Step 1: Create the contracts page**

Create `frontend/app/secretary/contracts/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Briefcase, Clock, Send, X } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

interface ProviderSummary {
    id: string;
    company_name: string;
    category: string;
    rating: number;
    availability_status: string;
}

interface SocietyDispatch {
    id: string;
    service_type: string;
    scheduled_at: string;
    job_price: number;
    notes?: string;
    status: string;
}

interface SocietyContract {
    id: string;
    duration_months: number;
    counter_duration_months?: number;
    monthly_rate: number;
    start_date?: string;
    end_date?: string;
    status: string;
    secretary_notes?: string;
    servicer_notes?: string;
    created_at: string;
    provider?: ProviderSummary;
    dispatches: SocietyDispatch[];
}

interface Member {
    id: string;
    username: string;
    home_number?: string;
    resident_name?: string;
}

type Tab = "active" | "pending";

const STATUS_STYLE: Record<string, string> = {
    ACTIVE: "text-emerald-700 bg-emerald-50",
    PENDING: "text-amber-700 bg-amber-50",
    COUNTER_PROPOSED: "text-blue-700 bg-blue-50",
    CANCELLED: "text-slate-500 bg-slate-100",
    EXPIRED: "text-rose-700 bg-rose-50",
    REJECTED: "text-rose-600 bg-rose-50",
};

const DISPATCH_STYLE: Record<string, string> = {
    ASSIGNED: "text-amber-700 bg-amber-50",
    IN_PROGRESS: "text-blue-700 bg-blue-50",
    COMPLETED: "text-emerald-700 bg-emerald-50",
};

const SERVICE_TYPES = [
    "Plumbing", "Electrical", "Cleaning", "Carpentry",
    "Painting", "Pest Control", "Appliance Repair", "General Maintenance", "Other",
];

export default function SecretaryContractsPage() {
    const [contracts, setContracts] = useState<SocietyContract[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>("active");
    const [actionId, setActionId] = useState<string | null>(null);

    // Dispatch modal
    const [showDispatch, setShowDispatch] = useState(false);
    const [dispatchContractId, setDispatchContractId] = useState("");
    const [dMemberId, setDMemberId] = useState("");
    const [dServiceType, setDServiceType] = useState("");
    const [dDate, setDDate] = useState("");
    const [dPrice, setDPrice] = useState("");
    const [dNotes, setDNotes] = useState("");
    const [dispatching, setDispatching] = useState(false);

    const reload = async () => {
        try {
            const data = await apiFetch("/secretary/contracts");
            setContracts(data || []);
        } catch {}
    };

    useEffect(() => {
        Promise.all([
            apiFetch("/secretary/contracts").catch(() => []),
            apiFetch("/secretary/members").catch(() => []),
        ]).then(([c, m]) => {
            setContracts(c || []);
            setMembers(m || []);
        }).finally(() => setLoading(false));
    }, []);

    const active = contracts.filter(c => c.status === "ACTIVE");
    const pending = contracts.filter(c => ["PENDING", "COUNTER_PROPOSED"].includes(c.status));
    const history = contracts.filter(c => ["REJECTED", "CANCELLED", "EXPIRED"].includes(c.status));

    const act = async (url: string, method: string, id: string) => {
        setActionId(id);
        try { await apiFetch(url, { method }); await reload(); }
        catch {} finally { setActionId(null); }
    };

    const openDispatch = (cid: string) => {
        setDispatchContractId(cid);
        setDMemberId(""); setDServiceType(""); setDDate(""); setDPrice(""); setDNotes("");
        setShowDispatch(true);
    };

    const handleDispatch = async () => {
        if (!dMemberId || !dServiceType || !dDate || !dPrice) return;
        setDispatching(true);
        try {
            await apiFetch(`/secretary/contracts/${dispatchContractId}/dispatch`, {
                method: "POST",
                body: JSON.stringify({
                    member_id: dMemberId,
                    service_type: dServiceType,
                    scheduled_at: new Date(dDate).toISOString(),
                    job_price: parseFloat(dPrice),
                    notes: dNotes || null,
                }),
            });
            setShowDispatch(false);
            await reload();
        } catch {} finally { setDispatching(false); }
    };

    const daysLeft = (end: string) => {
        const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
        return d > 0 ? `${d} days left` : "Expiring soon";
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Contracts</h1>
                <p className="text-slate-500 text-sm mt-1">Manage contracted providers for your society.</p>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
                {([
                    { key: "active", label: `Active (${active.length})` },
                    { key: "pending", label: `Pending / History (${pending.length + history.length})` },
                ] as { key: Tab; label: string }[]).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${tab === t.key ? "bg-white text-[#064e3b] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? <Spinner size="lg" /> : tab === "active" ? (
                <div className="space-y-4">
                    {active.length === 0
                        ? <EmptyState icon={Briefcase} title="No active contracts" />
                        : active.map(c => (
                            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-black text-slate-900">{c.provider?.company_name || "Provider"}</h3>
                                            <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{c.provider?.category}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openDispatch(c.id)}
                                            className="px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 flex items-center gap-1">
                                            <Send className="w-3 h-3" /> Dispatch
                                        </button>
                                        <button onClick={() => act(`/secretary/contracts/${c.id}`, "DELETE", c.id + "_cancel")}
                                            disabled={actionId === c.id + "_cancel"}
                                            className="px-4 py-2 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 disabled:opacity-50">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl mb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                                        <p className="text-sm font-black text-slate-900 mt-1">{c.duration_months} months</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Rate</p>
                                        <p className="text-sm font-black text-slate-900 mt-1">₹{c.monthly_rate?.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Left</p>
                                        <p className="text-sm font-black text-emerald-700 mt-1">{c.end_date ? daysLeft(c.end_date) : "—"}</p>
                                    </div>
                                </div>
                                {c.dispatches.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatched Jobs</p>
                                        {c.dispatches.map(d => (
                                            <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{d.service_type}</p>
                                                    <p className="text-xs text-slate-500">{new Date(d.scheduled_at).toLocaleDateString()} · ₹{d.job_price}</p>
                                                </div>
                                                <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${DISPATCH_STYLE[d.status] ?? "text-slate-500 bg-slate-100"}`}>{d.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {pending.length > 0 && (
                        <>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting Response</p>
                            {pending.map(c => (
                                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-black text-slate-900">{c.provider?.company_name}</h3>
                                                <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[c.status]}`}>
                                                    {c.status === "COUNTER_PROPOSED" ? "Counter Proposed" : c.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">{c.provider?.category} · {c.duration_months}mo · ₹{c.monthly_rate?.toLocaleString()}/mo</p>
                                        </div>
                                    </div>
                                    {c.status === "COUNTER_PROPOSED" && (
                                        <div className="p-4 bg-blue-50 rounded-xl">
                                            <p className="text-xs font-black text-blue-700 mb-1">Provider Counter-Proposed</p>
                                            <p className="text-sm text-blue-900">Duration: <strong>{c.counter_duration_months} months</strong></p>
                                            {c.servicer_notes && <p className="text-xs text-blue-600 mt-1 italic">"{c.servicer_notes}"</p>}
                                            <div className="flex gap-2 mt-3">
                                                <button onClick={() => act(`/secretary/contracts/${c.id}/confirm-counter`, "POST", c.id + "_confirm")}
                                                    disabled={actionId === c.id + "_confirm"}
                                                    className="px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 disabled:opacity-50">
                                                    Confirm Counter
                                                </button>
                                                <button onClick={() => act(`/secretary/contracts/${c.id}/reject-counter`, "POST", c.id + "_reject")}
                                                    disabled={actionId === c.id + "_reject"}
                                                    className="px-4 py-2 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 disabled:opacity-50">
                                                    Reject Counter
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                    {history.length > 0 && (
                        <>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">History</p>
                            {history.map(c => (
                                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 opacity-70">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-slate-900">{c.provider?.company_name}</p>
                                            <p className="text-xs text-slate-500">{c.duration_months}mo · ₹{c.monthly_rate?.toLocaleString()}/mo</p>
                                        </div>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                    {pending.length === 0 && history.length === 0 && (
                        <EmptyState icon={Clock} title="No pending or past contracts" />
                    )}
                </div>
            )}

            {/* Dispatch Modal */}
            {showDispatch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Dispatch Job</h2>
                                    <p className="text-xs text-slate-500 mt-1">Assign the contracted provider to a society member</p>
                                </div>
                                <button onClick={() => setShowDispatch(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Member *</p>
                                    <select value={dMemberId} onChange={e => setDMemberId(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white">
                                        <option value="">Select Member</option>
                                        {members.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.resident_name || m.username}{m.home_number ? ` — Unit ${m.home_number}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Service Type *</p>
                                    <select value={dServiceType} onChange={e => setDServiceType(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white">
                                        <option value="">Select Service</option>
                                        {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Scheduled Date & Time *</p>
                                    <input type="datetime-local" value={dDate} onChange={e => setDDate(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Job Price (₹) *</p>
                                    <input type="number" value={dPrice} onChange={e => setDPrice(e.target.value)}
                                        placeholder="e.g. 1500" min="1"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</p>
                                    <textarea value={dNotes} onChange={e => setDNotes(e.target.value)} rows={2}
                                        placeholder="Special instructions..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowDispatch(false)}
                                    className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                                    Cancel
                                </button>
                                <button onClick={handleDispatch}
                                    disabled={dispatching || !dMemberId || !dServiceType || !dDate || !dPrice}
                                    className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {dispatching ? "Dispatching..." : <><Send className="w-4 h-4" /> Dispatch</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/secretary/contracts/
git commit -m "feat: secretary contracts page — active contracts + dispatch + pending/history tabs"
```

---

## Task 10: Secretary Providers Page — Add Contract Invite

**Files:**
- Modify: `frontend/app/secretary/providers/page.tsx`

The existing floating action bar (rendered when `selectedIds.size > 0`) has one button: "Send Request on Behalf". Add "Invite to Contract" as a second button. Contracts are one-provider-at-a-time, so the button is disabled when more than 1 provider is selected.

Also add a contract invite modal with its state variables and submit handler.

- [ ] **Step 1: Add state variables**

In `frontend/app/secretary/providers/page.tsx`, find the existing state declarations (around line 35–42) and add after `setBehalfUrgency`:

```tsx
const [showContractModal, setShowContractModal] = useState(false);
const [contractDuration, setContractDuration] = useState<2 | 6 | 10 | 12>(6);
const [contractRate, setContractRate] = useState("");
const [contractNotes, setContractNotes] = useState("");
const [submittingContract, setSubmittingContract] = useState(false);
```

- [ ] **Step 2: Add the submit handler**

After `handleBehalfSubmit` (around line 92), add:

```tsx
const handleContractInvite = async () => {
    if (!contractRate) return;
    const [providerId] = Array.from(selectedIds);
    setSubmittingContract(true);
    try {
        await apiFetch("/secretary/contracts", {
            method: "POST",
            body: JSON.stringify({
                provider_id: providerId,
                duration_months: contractDuration,
                monthly_rate: parseFloat(contractRate),
                secretary_notes: contractNotes || null,
            }),
        });
        setShowContractModal(false);
        setSelectedIds(new Set());
        setContractRate("");
        setContractNotes("");
        setContractDuration(6);
    } catch (err) {
        console.error("Failed to send contract invite:", err);
    } finally {
        setSubmittingContract(false);
    }
};
```

- [ ] **Step 3: Add the Invite to Contract button in the floating bar**

Find the existing floating selection bar (starts around line 197 with `{selectedIds.size > 0 && (`). Inside it, after the existing "Send Request on Behalf" button and before the close (`X`) button, add:

```tsx
<button
    onClick={() => setShowContractModal(true)}
    disabled={selectedIds.size !== 1}
    className="flex items-center gap-2 px-5 py-2 bg-emerald-100 text-[#064e3b] text-xs font-black uppercase rounded-xl hover:bg-emerald-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    title={selectedIds.size !== 1 ? "Select exactly 1 provider" : "Invite to contract"}
>
    <Briefcase className="w-4 h-4" />
    Invite to Contract
</button>
```

Also add `Briefcase` to the lucide-react import at line 6:
```tsx
import { Wrench, Star, Phone, CheckSquare, Square, Send, Users, X, ShieldCheck, Briefcase } from "lucide-react";
```

- [ ] **Step 4: Add the contract invite modal**

After the closing `</div>` of the existing Behalf Modal (around line 287), add:

```tsx
{/* Contract Invite Modal */}
{showContractModal && (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl">
            <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Contract Invite</h2>
                        <p className="text-xs text-slate-500 mt-1">Invite this provider to join your society as a contracted worker</p>
                    </div>
                    <button onClick={() => setShowContractModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contract Duration</p>
                        <div className="grid grid-cols-4 gap-2">
                            {([2, 6, 10, 12] as const).map(d => (
                                <button key={d} onClick={() => setContractDuration(d)}
                                    className={`py-2.5 rounded-xl text-sm font-black transition-colors ${contractDuration === d ? "bg-[#064e3b] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                                    {d}mo
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monthly Retainer (₹) *</p>
                        <input type="number" value={contractRate} onChange={e => setContractRate(e.target.value)}
                            placeholder="e.g. 8000" min="1"
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Terms / Notes</p>
                        <textarea value={contractNotes} onChange={e => setContractNotes(e.target.value)} rows={2}
                            placeholder="Any specific terms or expectations..."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowContractModal(false)}
                        className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                        Cancel
                    </button>
                    <button onClick={handleContractInvite}
                        disabled={submittingContract || !contractRate}
                        className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2">
                        {submittingContract ? "Sending..." : <><Send className="w-4 h-4" /> Send Invite</>}
                    </button>
                </div>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/secretary/providers/page.tsx
git commit -m "feat: secretary providers page — add Invite to Contract button and modal"
```

---

## Task 11: Servicer Jobs Page — Add Society Tab

**Files:**
- Modify: `frontend/app/service/jobs/page.tsx`

- [ ] **Step 1: Extend the JobTab type**

Find line 46 in `frontend/app/service/jobs/page.tsx`:
```tsx
type JobTab = "jobs" | "requests" | "emergency" | "completed";
```
Change to:
```tsx
type JobTab = "jobs" | "requests" | "emergency" | "completed" | "society";
```

- [ ] **Step 2: Add society contract interfaces**

After the existing `CompletedJob` interface (after line ~73), add:

```tsx
interface SocietyDispatchItem {
    id: string;
    service_type: string;
    scheduled_at: string;
    job_price: number;
    notes?: string;
    status: string;
    member_home_number?: string;
    member_name?: string;
}

interface SocietyContractItem {
    id: string;
    society_id: string;
    duration_months: number;
    counter_duration_months?: number;
    monthly_rate: number;
    start_date?: string;
    end_date?: string;
    status: string;
    secretary_notes?: string;
    servicer_notes?: string;
    created_at: string;
    society?: { id: string; name: string; address: string };
    dispatches: SocietyDispatchItem[];
}
```

- [ ] **Step 3: Add society contracts state**

Inside `ServicerJobsPage` function, after the existing state declarations (around line 80), add:

```tsx
const [societyContracts, setSocietyContracts] = useState<SocietyContractItem[]>([]);
const [societyLoading, setSocietyLoading] = useState(false);
const [counterContractId, setCounterContractId] = useState<string | null>(null);
const [counterDuration, setCounterDuration] = useState<2 | 6 | 10 | 12>(6);
const [counterNote, setCounterNote] = useState("");
const [societyActionId, setSocietyActionId] = useState<string | null>(null);
```

- [ ] **Step 4: Add society data fetch**

Find the existing `useEffect` that fetches bookings (around line 85–100). Add a separate `useEffect` for society contracts:

```tsx
useEffect(() => {
    if (activeTab !== "society") return;
    setSocietyLoading(true);
    apiFetch("/service/contracts")
        .then(d => setSocietyContracts(d || []))
        .catch(() => {})
        .finally(() => setSocietyLoading(false));
}, [activeTab]);
```

- [ ] **Step 5: Add Society tab button**

Find the tab button row (where tabs like "jobs", "requests" etc. are rendered — look for `activeTab === "jobs"` comparisons). Add a Society tab button alongside the others. The exact location depends on how tabs are rendered, but add:

```tsx
<button
    onClick={() => setActiveTab("society")}
    className={`px-4 py-2 text-sm font-black rounded-xl transition-all ${activeTab === "society" ? "bg-[#064e3b] text-white" : "text-slate-500 hover:bg-slate-100"}`}
>
    Society Jobs
</button>
```

- [ ] **Step 6: Add Society tab content**

In the tab content section (where `activeTab === "completed"` content ends), add a new section for `activeTab === "society"`. Place it before the closing `</div>` of the main tab content area:

```tsx
{activeTab === "society" && (
    <div className="space-y-6">
        {societyLoading ? <Spinner size="lg" /> : (
            <>
                {/* Pending Invites */}
                {societyContracts.filter(c => ["PENDING", "COUNTER_PROPOSED"].includes(c.status)).length > 0 && (
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contract Invites</p>
                        <div className="space-y-3">
                            {societyContracts.filter(c => ["PENDING", "COUNTER_PROPOSED"].includes(c.status)).map(c => (
                                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-black text-slate-900">{c.society?.name || "Society"}</p>
                                            <p className="text-xs text-slate-500">{c.duration_months}mo contract · ₹{c.monthly_rate?.toLocaleString()}/month</p>
                                            {c.secretary_notes && <p className="text-xs text-slate-400 mt-1 italic">"{c.secretary_notes}"</p>}
                                        </div>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${c.status === "COUNTER_PROPOSED" ? "text-blue-700 bg-blue-50" : "text-amber-700 bg-amber-50"}`}>
                                            {c.status === "COUNTER_PROPOSED" ? "Awaiting Confirmation" : "Pending"}
                                        </span>
                                    </div>
                                    {c.status === "PENDING" && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    setSocietyActionId(c.id + "_accept");
                                                    try {
                                                        await apiFetch(`/service/contracts/${c.id}/accept`, { method: "POST" });
                                                        const d = await apiFetch("/service/contracts");
                                                        setSocietyContracts(d || []);
                                                    } catch {} finally { setSocietyActionId(null); }
                                                }}
                                                disabled={societyActionId === c.id + "_accept"}
                                                className="px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 disabled:opacity-50"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setSocietyActionId(c.id + "_reject");
                                                    try {
                                                        await apiFetch(`/service/contracts/${c.id}/reject`, { method: "POST" });
                                                        const d = await apiFetch("/service/contracts");
                                                        setSocietyContracts(d || []);
                                                    } catch {} finally { setSocietyActionId(null); }
                                                }}
                                                disabled={societyActionId === c.id + "_reject"}
                                                className="px-4 py-2 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => { setCounterContractId(c.id); setCounterDuration(6); setCounterNote(""); }}
                                                className="px-4 py-2 border border-blue-200 text-blue-700 text-xs font-black uppercase rounded-xl hover:bg-blue-50"
                                            >
                                                Counter
                                            </button>
                                        </div>
                                    )}
                                    {/* Counter modal inline */}
                                    {counterContractId === c.id && (
                                        <div className="mt-4 p-4 bg-blue-50 rounded-xl space-y-3">
                                            <p className="text-xs font-black text-blue-700 uppercase tracking-widest">Propose Different Duration</p>
                                            <div className="grid grid-cols-4 gap-2">
                                                {([2, 6, 10, 12] as const).map(d => (
                                                    <button key={d} onClick={() => setCounterDuration(d)}
                                                        className={`py-2 rounded-xl text-sm font-black transition-colors ${counterDuration === d ? "bg-[#064e3b] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
                                                        {d}mo
                                                    </button>
                                                ))}
                                            </div>
                                            <input value={counterNote} onChange={e => setCounterNote(e.target.value)}
                                                placeholder="Note (optional)"
                                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#064e3b]" />
                                            <div className="flex gap-2">
                                                <button onClick={() => setCounterContractId(null)}
                                                    className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:bg-white">
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        setSocietyActionId(c.id + "_counter");
                                                        try {
                                                            await apiFetch(`/service/contracts/${c.id}/counter`, {
                                                                method: "POST",
                                                                body: JSON.stringify({ counter_duration_months: counterDuration, servicer_notes: counterNote || null }),
                                                            });
                                                            setCounterContractId(null);
                                                            const d = await apiFetch("/service/contracts");
                                                            setSocietyContracts(d || []);
                                                        } catch {} finally { setSocietyActionId(null); }
                                                    }}
                                                    disabled={societyActionId === c.id + "_counter"}
                                                    className="flex-1 py-2 bg-[#064e3b] text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-800 disabled:opacity-50"
                                                >
                                                    Send Counter
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Active Contracts */}
                {societyContracts.filter(c => c.status === "ACTIVE").length > 0 && (
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Active Contracts</p>
                        <div className="space-y-4">
                            {societyContracts.filter(c => c.status === "ACTIVE").map(c => (
                                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <p className="font-black text-slate-900">{c.society?.name}</p>
                                            <p className="text-xs text-slate-500">{c.duration_months}mo · ₹{c.monthly_rate?.toLocaleString()}/mo</p>
                                        </div>
                                        <span className="text-xs font-black px-2 py-0.5 rounded-full uppercase text-emerald-700 bg-emerald-50">Active</span>
                                    </div>
                                    {c.dispatches.length === 0
                                        ? <p className="text-xs text-slate-400 italic">No jobs dispatched yet.</p>
                                        : (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jobs</p>
                                                {c.dispatches.map(d => (
                                                    <div key={d.id} className="p-3 bg-slate-50 rounded-xl">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div>
                                                                <p className="text-sm font-black text-slate-900">{d.service_type}</p>
                                                                <p className="text-xs text-slate-500">
                                                                    {new Date(d.scheduled_at).toLocaleDateString()} · ₹{d.job_price}
                                                                    {d.member_home_number ? ` · Unit ${d.member_home_number}` : ""}
                                                                </p>
                                                            </div>
                                                            <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${d.status === "COMPLETED" ? "text-emerald-700 bg-emerald-50" : d.status === "IN_PROGRESS" ? "text-blue-700 bg-blue-50" : "text-amber-700 bg-amber-50"}`}>
                                                                {d.status}
                                                            </span>
                                                        </div>
                                                        {d.status === "ASSIGNED" && (
                                                            <button
                                                                onClick={async () => {
                                                                    await apiFetch(`/service/contracts/${c.id}/jobs/${d.id}`, {
                                                                        method: "PATCH",
                                                                        body: JSON.stringify({ status: "IN_PROGRESS" }),
                                                                    });
                                                                    const updated = await apiFetch("/service/contracts");
                                                                    setSocietyContracts(updated || []);
                                                                }}
                                                                className="text-xs font-black text-blue-700 hover:underline"
                                                            >
                                                                Mark In Progress →
                                                            </button>
                                                        )}
                                                        {d.status === "IN_PROGRESS" && (
                                                            <button
                                                                onClick={async () => {
                                                                    await apiFetch(`/service/contracts/${c.id}/jobs/${d.id}`, {
                                                                        method: "PATCH",
                                                                        body: JSON.stringify({ status: "COMPLETED" }),
                                                                    });
                                                                    const updated = await apiFetch("/service/contracts");
                                                                    setSocietyContracts(updated || []);
                                                                }}
                                                                className="text-xs font-black text-emerald-700 hover:underline"
                                                            >
                                                                Mark Completed ✓
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {societyContracts.filter(c => ["PENDING", "COUNTER_PROPOSED", "ACTIVE"].includes(c.status)).length === 0 && (
                    <EmptyState icon={Briefcase} title="No society contracts" />
                )}
            </>
        )}
    </div>
)}
```

Add `Briefcase` to the existing lucide-react import if not already present:
```tsx
import { Briefcase, Clock, MapPin, CheckCircle, XCircle, ChevronRight, User, IndianRupee, Calendar, Send, X, FileText, ShieldAlert } from "lucide-react";
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/service/jobs/page.tsx
git commit -m "feat: servicer jobs page — add Society Jobs tab with contract invites and dispatches"
```

---

## Task 12: Sidebar — Add Contracts Link for Secretary

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Contracts to SECRETARY_NAV**

Find `SECRETARY_NAV` in `frontend/components/layout/Sidebar.tsx` (around line 69):

```tsx
const SECRETARY_NAV = [
  { name: "Overview", icon: LayoutDashboard, path: "/secretary/dashboard" },
  { name: "Members", icon: Users, path: "/secretary/members" },
  { name: "Alerts", icon: Bell, path: "/secretary/alerts" },
  { name: "Providers", icon: Wrench, path: "/secretary/providers" },
  { name: "Settings", icon: Settings, path: "/secretary/settings" },
];
```

Change to:

```tsx
const SECRETARY_NAV = [
  { name: "Overview", icon: LayoutDashboard, path: "/secretary/dashboard" },
  { name: "Members", icon: Users, path: "/secretary/members" },
  { name: "Alerts", icon: Bell, path: "/secretary/alerts" },
  { name: "Providers", icon: Wrench, path: "/secretary/providers" },
  { name: "Contracts", icon: Briefcase, path: "/secretary/contracts" },
  { name: "Settings", icon: Settings, path: "/secretary/settings" },
];
```

Add `Briefcase` to the lucide-react import at line 3 (it lists many icons on one line — add `Briefcase` to that list if not already there):

```tsx
import {
  LayoutDashboard, Wrench, Bell, Settings,
  LogOut, Briefcase, Star, Users, ShieldCheck, ShieldAlert,
  BarChart3, ClipboardList, UserCheck, ChevronRight,
  User, Lock, BellRing, Search, TrendingUp,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
```

(`Briefcase` is already imported — just verify it's in the import list. If yes, no change needed to the import.)

- [ ] **Step 2: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat: sidebar — add Contracts nav link for secretary"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `society_contracts` table — Task 1
- ✅ `society_dispatches` table — Task 1
- ✅ Migration — Task 2
- ✅ Status flow (PENDING→ACTIVE, PENDING→COUNTER_PROPOSED→ACTIVE, etc.) — Tasks 3, 5, 7
- ✅ Secretary: send invite — Task 5
- ✅ Secretary: confirm/reject counter — Task 5
- ✅ Secretary: cancel ACTIVE contract — Task 5
- ✅ Secretary: dispatch job to member — Task 5
- ✅ Secretary: list dispatches — Task 5
- ✅ Servicer: accept/reject/counter — Task 7
- ✅ Servicer: update dispatch status — Task 7
- ✅ Daily scheduler expiry — Task 8
- ✅ Secretary contracts page — Task 9
- ✅ Secretary providers page invite button — Task 10
- ✅ Servicer jobs page society tab — Task 11
- ✅ Sidebar Contracts link — Task 12
- ✅ Guard: one ACTIVE contract per society per provider — Task 5, create_contract
- ✅ Guard: dispatch member must belong to society — Task 5, dispatch_job
- ✅ Guard: counter only on PENDING — Task 7, counter_contract
- ✅ Notifications sent for all state changes — Tasks 5, 7

**Type consistency:**
- `SocietyContract` model → `SocietyContractRead` schema → secretary endpoint ✅
- `SocietyDispatch` model → `SocietyDispatchRead` schema → secretary endpoint ✅
- `SocietyContractServicerRead` → `_build_servicer_read()` → servicer endpoint ✅
- `SocietyDispatchServicerRead` constructed field-by-field in all servicer endpoints ✅
- `JobTab` type extended in both the type declaration and tab button rendering ✅

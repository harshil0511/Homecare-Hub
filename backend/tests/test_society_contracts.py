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

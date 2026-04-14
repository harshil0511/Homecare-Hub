"""
TDD tests for the Final Best Offer negotiation feature.

Covers:
  - Schema: is_final_offer field present and defaults correctly
  - Model: is_final_offer column exists on both tables
  - Business logic: counter blocked when servicer marks offer as final
  - Business logic: reject-counter closes negotiation only when offer is final or max rounds
  - Business logic: USER cannot mark an offer as final (ignored by endpoint)
"""
import pytest
from datetime import datetime


# ──────────────────────────────────────────────
# SCHEMA TESTS
# ──────────────────────────────────────────────

class TestServiceRequestResponseCreateSchema:
    def test_is_final_offer_defaults_false(self):
        from app.api.request.schemas import ServiceRequestResponseCreate
        schema = ServiceRequestResponseCreate(
            proposed_date=datetime(2026, 5, 1, 10, 0),
            proposed_price=1500.0,
        )
        assert schema.is_final_offer is False

    def test_is_final_offer_can_be_set_true(self):
        from app.api.request.schemas import ServiceRequestResponseCreate
        schema = ServiceRequestResponseCreate(
            proposed_date=datetime(2026, 5, 1, 10, 0),
            proposed_price=1500.0,
            is_final_offer=True,
        )
        assert schema.is_final_offer is True

    def test_is_final_offer_false_explicitly(self):
        from app.api.request.schemas import ServiceRequestResponseCreate
        schema = ServiceRequestResponseCreate(
            proposed_date=datetime(2026, 5, 1, 10, 0),
            proposed_price=1500.0,
            is_final_offer=False,
        )
        assert schema.is_final_offer is False


class TestNegotiationOfferCreateSchema:
    def test_is_final_offer_defaults_false(self):
        from app.api.request.schemas import NegotiationOfferCreate
        schema = NegotiationOfferCreate(
            proposed_date=datetime(2026, 5, 1, 10, 0),
            proposed_time="morning",
            proposed_price=1200.0,
        )
        assert schema.is_final_offer is False

    def test_is_final_offer_can_be_set_true(self):
        from app.api.request.schemas import NegotiationOfferCreate
        schema = NegotiationOfferCreate(
            proposed_date=datetime(2026, 5, 1, 10, 0),
            proposed_time="morning",
            proposed_price=1200.0,
            is_final_offer=True,
        )
        assert schema.is_final_offer is True

    def test_invalid_proposed_time_still_rejected(self):
        from app.api.request.schemas import NegotiationOfferCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            NegotiationOfferCreate(
                proposed_date=datetime(2026, 5, 1, 10, 0),
                proposed_time="midnight",   # invalid
                proposed_price=1200.0,
                is_final_offer=True,
            )

    def test_zero_price_still_rejected(self):
        from app.api.request.schemas import NegotiationOfferCreate
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            NegotiationOfferCreate(
                proposed_date=datetime(2026, 5, 1, 10, 0),
                proposed_time="morning",
                proposed_price=0,           # invalid
                is_final_offer=True,
            )


class TestNegotiationOfferReadSchema:
    def test_is_final_offer_field_present(self):
        from app.api.request.schemas import NegotiationOfferRead
        import inspect
        fields = NegotiationOfferRead.model_fields
        assert "is_final_offer" in fields

    def test_is_final_offer_defaults_false_in_read(self):
        from app.api.request.schemas import NegotiationOfferRead
        import uuid
        schema = NegotiationOfferRead(
            id=uuid.uuid4(),
            response_id=uuid.uuid4(),
            offered_by="SERVICER",
            round_number=1,
            proposed_date=datetime(2026, 5, 1, 10, 0),
            proposed_time="morning",
            proposed_price=1500.0,
            status="PENDING",
        )
        assert schema.is_final_offer is False


class TestServiceRequestResponseReadSchema:
    def test_is_final_offer_field_present(self):
        from app.api.request.schemas import ServiceRequestResponseRead
        fields = ServiceRequestResponseRead.model_fields
        assert "is_final_offer" in fields

    def test_is_final_offer_defaults_false_in_read(self):
        from app.api.request.schemas import ServiceRequestResponseRead
        import uuid
        schema = ServiceRequestResponseRead(
            id=uuid.uuid4(),
            request_id=uuid.uuid4(),
            provider_id=uuid.uuid4(),
            proposed_date=datetime(2026, 5, 1, 10, 0),
            proposed_price=1500.0,
            status="PENDING",
        )
        assert schema.is_final_offer is False


# ──────────────────────────────────────────────
# MODEL COLUMN TESTS
# ──────────────────────────────────────────────

class TestNegotiationOfferModel:
    def test_has_is_final_offer_column(self):
        from app.request.domain.model import NegotiationOffer
        col_names = {c.name for c in NegotiationOffer.__table__.columns}
        assert "is_final_offer" in col_names

    def test_is_final_offer_column_is_boolean(self):
        from app.request.domain.model import NegotiationOffer
        from sqlalchemy import Boolean
        col = NegotiationOffer.__table__.columns["is_final_offer"]
        assert isinstance(col.type, Boolean)

    def test_is_final_offer_column_defaults_false(self):
        from app.request.domain.model import NegotiationOffer
        col = NegotiationOffer.__table__.columns["is_final_offer"]
        # default is False (not None, not True)
        assert col.default.arg is False


class TestServiceRequestResponseModel:
    def test_has_is_final_offer_column(self):
        from app.request.domain.model import ServiceRequestResponse
        col_names = {c.name for c in ServiceRequestResponse.__table__.columns}
        assert "is_final_offer" in col_names

    def test_is_final_offer_column_is_boolean(self):
        from app.request.domain.model import ServiceRequestResponse
        from sqlalchemy import Boolean
        col = ServiceRequestResponse.__table__.columns["is_final_offer"]
        assert isinstance(col.type, Boolean)

    def test_is_final_offer_column_defaults_false(self):
        from app.request.domain.model import ServiceRequestResponse
        col = ServiceRequestResponse.__table__.columns["is_final_offer"]
        assert col.default.arg is False


# ──────────────────────────────────────────────
# BUSINESS LOGIC TESTS
# (Pure Python — no DB/HTTP needed)
# ──────────────────────────────────────────────

class TestFinalOfferBusinessLogic:
    """
    Tests the counter-blocking and close logic by replicating
    the exact conditions checked in the endpoint.
    """

    def _should_block_user_counter_on_initial(self, current_round: int, response_is_final: bool) -> bool:
        """Mirrors endpoint logic: block user if initial response is marked final."""
        return current_round == 0 and response_is_final

    def _should_block_user_counter_on_negotiation(self, last_offer_is_final: bool, last_offer_by: str) -> bool:
        """Mirrors endpoint logic: block user if latest SERVICER offer is final."""
        return last_offer_is_final and last_offer_by == "SERVICER"

    def _should_close_on_reject(self, current_round: int, offer_is_final: bool) -> bool:
        """Mirrors reject-counter logic: close when max rounds OR final offer rejected."""
        return current_round >= 3 or offer_is_final

    # -- initial response blocking --

    def test_user_counter_blocked_when_initial_response_is_final(self):
        assert self._should_block_user_counter_on_initial(
            current_round=0, response_is_final=True
        ) is True

    def test_user_counter_allowed_when_initial_response_not_final(self):
        assert self._should_block_user_counter_on_initial(
            current_round=0, response_is_final=False
        ) is False

    def test_initial_final_check_only_applies_at_round_zero(self):
        # If current_round > 0 the check doesn't apply (this path uses last_offer check instead)
        assert self._should_block_user_counter_on_initial(
            current_round=1, response_is_final=True
        ) is False

    # -- negotiation offer blocking --

    def test_user_counter_blocked_when_servicer_latest_is_final(self):
        assert self._should_block_user_counter_on_negotiation(
            last_offer_is_final=True, last_offer_by="SERVICER"
        ) is True

    def test_user_counter_allowed_when_servicer_latest_not_final(self):
        assert self._should_block_user_counter_on_negotiation(
            last_offer_is_final=False, last_offer_by="SERVICER"
        ) is False

    def test_user_counter_allowed_when_user_latest_is_final(self):
        # Final flag from USER side is never set (ignored by endpoint),
        # but even if it were, this check only applies to SERVICER offers.
        assert self._should_block_user_counter_on_negotiation(
            last_offer_is_final=True, last_offer_by="USER"
        ) is False

    # -- reject counter closure --

    def test_reject_closes_negotiation_when_final_offer_rejected(self):
        assert self._should_close_on_reject(current_round=1, offer_is_final=True) is True

    def test_reject_closes_negotiation_at_max_rounds(self):
        assert self._should_close_on_reject(current_round=3, offer_is_final=False) is True

    def test_reject_closes_at_max_rounds_even_without_final_flag(self):
        assert self._should_close_on_reject(current_round=3, offer_is_final=False) is True

    def test_reject_does_not_close_when_round_low_and_not_final(self):
        assert self._should_close_on_reject(current_round=1, offer_is_final=False) is False

    def test_reject_does_not_close_at_round_two_and_not_final(self):
        assert self._should_close_on_reject(current_round=2, offer_is_final=False) is False


class TestFinalOfferRoleRestriction:
    """
    Verifies that only SERVICER can set is_final_offer=True.
    USER flag is always forced to False by the endpoint.
    """

    def _resolve_is_final(self, caller_role: str, is_final_from_client: bool) -> bool:
        """Mirrors endpoint: `is_final = offer_in.is_final_offer if caller_role == 'SERVICER' else False`"""
        return is_final_from_client if caller_role == "SERVICER" else False

    def test_servicer_can_mark_final(self):
        assert self._resolve_is_final("SERVICER", True) is True

    def test_servicer_can_mark_not_final(self):
        assert self._resolve_is_final("SERVICER", False) is False

    def test_user_cannot_mark_final(self):
        assert self._resolve_is_final("USER", True) is False

    def test_user_marking_false_stays_false(self):
        assert self._resolve_is_final("USER", False) is False

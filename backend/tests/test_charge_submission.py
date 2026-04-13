"""
TDD tests for Charge Submission & Payment Confirmation flow.
No live DB — schema/model/logic tests only.
"""


class TestIsFlaggedColumn:
    def test_is_flagged_column_exists_on_model(self):
        from app.booking.domain.model import ServiceBooking
        assert hasattr(ServiceBooking, "is_flagged"), "ServiceBooking must have is_flagged column"

    def test_is_flagged_column_has_default_false(self):
        from app.booking.domain.model import ServiceBooking
        col = ServiceBooking.__table__.columns["is_flagged"]
        assert col.default is not None or col.server_default is not None, \
            "is_flagged must have a default value"
        assert not col.nullable, "is_flagged must not be nullable"

    def test_is_flagged_default_value_is_false(self):
        from app.booking.domain.model import ServiceBooking
        col = ServiceBooking.__table__.columns["is_flagged"]
        if col.default is not None:
            assert col.default.arg is False, "is_flagged Python default must be False"
        if col.server_default is not None:
            assert col.server_default.arg == "false", "is_flagged server_default must be 'false'"


class TestChargeSubmitCreateSchema:
    def test_requires_actual_hours_and_charge_amount(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import ChargeSubmitCreate
        with pytest.raises(ValidationError):
            ChargeSubmitCreate()  # missing required fields

    def test_valid_schema(self):
        from app.api.booking.schemas import ChargeSubmitCreate
        s = ChargeSubmitCreate(actual_hours=2.5, charge_amount=400.0)
        assert s.actual_hours == 2.5
        assert s.charge_amount == 400.0
        assert s.charge_description is None

    def test_charge_amount_must_be_positive(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import ChargeSubmitCreate
        with pytest.raises(ValidationError):
            ChargeSubmitCreate(actual_hours=1.0, charge_amount=0.0)

    def test_actual_hours_must_be_positive(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import ChargeSubmitCreate
        with pytest.raises(ValidationError):
            ChargeSubmitCreate(actual_hours=0.0, charge_amount=100.0)

    def test_description_is_optional(self):
        from app.api.booking.schemas import ChargeSubmitCreate
        s = ChargeSubmitCreate(actual_hours=1.0, charge_amount=200.0, charge_description="Fixed pipe")
        assert s.charge_description == "Fixed pipe"


class TestFlagCreateSchema:
    def test_flag_reason_required(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import FlagCreate
        with pytest.raises(ValidationError):
            FlagCreate()

    def test_valid_flag(self):
        from app.api.booking.schemas import FlagCreate
        f = FlagCreate(flag_reason="Overcharged by 2 hours")
        assert f.flag_reason == "Overcharged by 2 hours"


class TestBookingReadIncludesIsFlagged:
    def test_is_flagged_field_present_in_booking_read(self):
        from app.api.booking.schemas import BookingRead
        assert "is_flagged" in BookingRead.model_fields, \
            "BookingRead must expose is_flagged"


class TestBookingReadCompletedAt:
    def test_completed_at_field_present_in_booking_read(self):
        from app.api.booking.schemas import BookingRead
        assert "completed_at" in BookingRead.model_fields
        field = BookingRead.model_fields["completed_at"]
        assert field.default is None  # Optional with None default

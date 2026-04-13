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

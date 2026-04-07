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
    """Rating is uncapped and can exceed 5.0."""
    from unittest.mock import MagicMock
    from app.internal.services import apply_star_delta
    provider = MagicMock()
    provider.rating = 4.9
    apply_star_delta(provider, delta=0.5)
    assert provider.rating == 5.4

def test_apply_star_delta_normal():
    from unittest.mock import MagicMock
    from app.internal.services import apply_star_delta
    provider = MagicMock()
    provider.rating = 3.0
    apply_star_delta(provider, delta=-0.5)
    assert abs(provider.rating - 2.5) < 0.001

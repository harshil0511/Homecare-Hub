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

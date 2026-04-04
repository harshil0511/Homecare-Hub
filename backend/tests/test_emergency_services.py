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

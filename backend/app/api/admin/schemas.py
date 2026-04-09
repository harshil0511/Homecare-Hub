from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from app.api.auth.schemas import UserResponse  # noqa: F401
from app.api.service.schemas import ProviderResponse  # noqa: F401
from app.api.emergency.schemas import (  # noqa: F401
    EmergencyConfigRead,
    EmergencyConfigCreate,
    EmergencyConfigUpdate,
    EmergencyPenaltyConfigRead,
    EmergencyPenaltyConfigUpdate,
    EmergencyStarAdjustCreate,
    EmergencyStarAdjustRead,
    EmergencyRequestRead,
)


class AdminVerifyUpdate(BaseModel):
    is_verified: bool
    reason: Optional[str] = None


class AdminRoleUpdate(BaseModel):
    role: str

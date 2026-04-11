from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

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


class ComplaintAdminRead(BaseModel):
    id: UUID
    booking_id: UUID
    filed_by: UUID
    reason: str
    status: str
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ComplaintAdminUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None


class SecretaryComplaintRead(BaseModel):
    id: UUID
    society_id: UUID
    filed_by: UUID
    subject: str
    description: str
    status: str
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SecretaryComplaintAdminUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None

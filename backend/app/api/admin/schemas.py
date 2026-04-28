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
    filed_by_username: Optional[str] = None
    reason: str
    status: str
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    service_type: Optional[str] = None
    booking_status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    final_cost: Optional[float] = None
    estimated_cost: Optional[float] = None
    provider_name: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class ComplaintAdminUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    action: Optional[str] = None          # "cancel_bill" | "override_amount"
    override_amount: Optional[float] = None


class ServiceRequestResponseAdminRead(BaseModel):
    id: UUID
    provider_name: Optional[str] = None
    proposed_price: Optional[float] = None
    proposed_date: Optional[datetime] = None
    status: str
    negotiation_status: str
    message: Optional[str] = None

    class Config:
        from_attributes = True


class ServiceRequestAdminRead(BaseModel):
    id: UUID
    device_or_issue: str
    urgency: str
    status: str
    contact_name: str
    location: str
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    user_name: Optional[str] = None
    response_count: int = 0
    responses: list[ServiceRequestResponseAdminRead] = []

    class Config:
        from_attributes = True


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

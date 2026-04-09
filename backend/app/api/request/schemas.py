import json
from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from app.api.service.schemas import ProviderResponse


class ServiceRequestCreate(BaseModel):
    provider_ids: List[UUID]
    contact_name: str
    contact_mobile: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str = "Normal"

    @field_validator("provider_ids")
    @classmethod
    def validate_provider_count(cls, v):
        if not (1 <= len(v) <= 10):
            raise ValueError("Must select between 1 and 10 providers")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate provider IDs are not allowed")
        return v

    @field_validator("urgency")
    @classmethod
    def validate_urgency(cls, v):
        allowed = {"Normal", "High", "Emergency"}
        if v not in allowed:
            raise ValueError(f"urgency must be one of: {', '.join(sorted(allowed))}")
        return v


class ServiceRequestResponseCreate(BaseModel):
    proposed_date: datetime
    proposed_price: float
    estimated_hours: Optional[float] = None
    message: Optional[str] = None

    @field_validator("proposed_price")
    @classmethod
    def validate_price(cls, v):
        if v <= 0:
            raise ValueError("proposed_price must be greater than 0")
        return v


class ServiceRequestRecipientRead(BaseModel):
    id: UUID
    provider_id: UUID
    is_read: bool
    notified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ServiceRequestResponseRead(BaseModel):
    id: UUID
    request_id: UUID
    provider_id: UUID
    proposed_date: datetime
    proposed_price: float
    estimated_hours: Optional[float] = None
    message: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    provider: Optional[ProviderResponse] = None

    class Config:
        from_attributes = True


class ServiceRequestRead(BaseModel):
    id: UUID
    user_id: UUID
    contact_name: str
    contact_mobile: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str
    status: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resulting_booking_id: Optional[UUID] = None
    recipients: List[ServiceRequestRecipientRead] = []
    responses: List[ServiceRequestResponseRead] = []

    @field_validator("photos", "preferred_dates", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True


class ServiceRequestDetailRead(ServiceRequestRead):
    pass

    class Config:
        from_attributes = True


class IncomingServiceRequestRead(BaseModel):
    id: UUID
    contact_name: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str
    status: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    is_read: bool = False
    has_responded: bool = False

    @field_validator("photos", "preferred_dates", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True

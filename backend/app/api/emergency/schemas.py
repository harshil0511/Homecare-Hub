import json
from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from app.api.service.schemas import ProviderResponse

EMERGENCY_CATEGORY_OPTIONS = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
]


class EmergencyConfigCreate(BaseModel):
    category: str
    callout_fee: float
    hourly_rate: float

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EMERGENCY_CATEGORY_OPTIONS:
            raise ValueError(f"category must be one of: {EMERGENCY_CATEGORY_OPTIONS}")
        return v

    @field_validator("callout_fee", "hourly_rate")
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Fee/rate cannot be negative")
        return v


class EmergencyConfigUpdate(BaseModel):
    callout_fee: Optional[float] = None
    hourly_rate: Optional[float] = None

    @field_validator("callout_fee", "hourly_rate")
    @classmethod
    def validate_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Fee/rate cannot be negative")
        return v


class EmergencyConfigRead(BaseModel):
    id: UUID
    category: str
    callout_fee: float
    hourly_rate: float
    updated_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmergencyPenaltyConfigUpdate(BaseModel):
    star_deduction: float

    @field_validator("star_deduction")
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("star_deduction cannot be negative")
        return v


class EmergencyPenaltyConfigRead(BaseModel):
    id: UUID
    event_type: str
    star_deduction: float
    updated_by: Optional[UUID] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmergencyRequestCreate(BaseModel):
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    provider_ids: Optional[List[UUID]] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EMERGENCY_CATEGORY_OPTIONS:
            raise ValueError(f"category must be one of: {EMERGENCY_CATEGORY_OPTIONS}")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description cannot be empty")
        if len(v) > 500:
            raise ValueError("description cannot exceed 500 characters")
        return v

    @field_validator("photos")
    @classmethod
    def validate_photos(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v and len(v) > 3:
            raise ValueError("Maximum 3 photos allowed")
        return v


class EmergencyResponseRead(BaseModel):
    id: UUID
    request_id: UUID
    provider_id: UUID
    arrival_time: datetime
    status: str
    penalty_count: int
    created_at: Optional[datetime] = None
    provider: Optional[ProviderResponse] = None

    class Config:
        from_attributes = True


class EmergencyRequestRead(BaseModel):
    id: UUID
    user_id: UUID
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    status: str
    config_id: Optional[UUID] = None
    expires_at: datetime
    resulting_booking_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    responses: List[EmergencyResponseRead] = []
    config: Optional[EmergencyConfigRead] = None

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return []
        return v or []

    class Config:
        from_attributes = True


class EmergencyResponseCreate(BaseModel):
    arrival_time: datetime

    @field_validator("arrival_time")
    @classmethod
    def arrival_must_be_future(cls, v: datetime) -> datetime:
        from datetime import timezone as _tz
        # Normalize to naive UTC (DB stores naive UTC datetimes)
        if v.tzinfo is not None:
            v = v.astimezone(_tz.utc).replace(tzinfo=None)
        if v <= datetime.utcnow():
            raise ValueError("arrival_time must be in the future")
        return v


class EmergencyStarAdjustCreate(BaseModel):
    delta: float
    reason: str

    @field_validator("delta")
    @classmethod
    def validate_delta_bounds(cls, v: float) -> float:
        if abs(v) > 5.0:
            raise ValueError("delta cannot exceed ±5.0 stars")
        return v

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("reason cannot be empty")
        return v


class EmergencyStarAdjustRead(BaseModel):
    id: UUID
    provider_id: UUID
    adjusted_by: UUID
    delta: float
    reason: str
    event_type: str
    emergency_request_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminProviderStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


class IncomingEmergencyRead(BaseModel):
    id: UUID
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    callout_fee: Optional[float] = None
    hourly_rate: Optional[float] = None
    has_responded: bool = False

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return []
        return v or []

    class Config:
        from_attributes = True

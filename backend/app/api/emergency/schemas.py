import json
import re as _re
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


_PHONE_RE = _re.compile(r"^(\+91[\s\-]?)?[6-9]\d{9}$")
_NAME_RE  = _re.compile(r"^[a-zA-Z\s\-\.]{2,100}$")


class EmergencyRequestCreate(BaseModel):
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: Optional[str] = None
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    provider_ids: Optional[List[UUID]] = None
    flow_type: str = "systematic"

    @field_validator("society_name", "building_name", "landmark", "flat_no", mode="before")
    @classmethod
    def validate_nonempty_str(cls, v: str, info) -> str:
        v = str(v).strip()
        if len(v) < 1:
            raise ValueError(f"{info.field_name} cannot be empty")
        if len(v) > 200:
            raise ValueError(f"{info.field_name} cannot exceed 200 characters")
        return v

    @field_validator("full_address", mode="before")
    @classmethod
    def validate_address(cls, v: str) -> str:
        v = str(v).strip()
        if len(v) < 5:
            raise ValueError("full_address must be at least 5 characters")
        if len(v) > 500:
            raise ValueError("full_address cannot exceed 500 characters")
        return v

    @field_validator("contact_name", mode="before")
    @classmethod
    def validate_contact_name(cls, v: str) -> str:
        v = str(v).strip()
        if not _NAME_RE.match(v):
            raise ValueError("contact_name must contain only letters (min 2 characters, max 100)")
        return v

    @field_validator("contact_phone", mode="before")
    @classmethod
    def validate_contact_phone(cls, v: str) -> str:
        v = str(v).strip()
        if not _PHONE_RE.match(v):
            raise ValueError("contact_phone must be a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 9876543210)")
        return v

    @field_validator("flow_type")
    @classmethod
    def validate_flow_type(cls, v: str) -> str:
        if v not in ("direct", "systematic"):
            raise ValueError("flow_type must be 'direct' or 'systematic'")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EMERGENCY_CATEGORY_OPTIONS:
            raise ValueError(f"category must be one of: {EMERGENCY_CATEGORY_OPTIONS}")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("description cannot exceed 500 characters")
        return v or None

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
    description: Optional[str] = None
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    flow_type: str = "systematic"
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
    description: Optional[str] = None
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    flow_type: str = "systematic"
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

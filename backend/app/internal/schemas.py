import json
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Literal
from datetime import datetime, date

class UserRole(str, Enum):
    USER = "USER"
    SERVICER = "SERVICER"
    ADMIN = "ADMIN"
    SECRETARY = "SECRETARY"

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: Optional[UserRole] = UserRole.USER

class UserCreate(UserBase):
    password: str
    society_name: Optional[str] = None     # secretary provides this to create a new society
    society_address: Optional[str] = None  # secretary provides this to create a new society

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    society_id: Optional[UUID] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str       # USER | SERVICER | ADMIN | SECRETARY
    user_uuid: str
    username: str

class TokenData(BaseModel):
    user_uuid: Optional[str] = None
    role: Optional[str] = None

class ForgotPassword(BaseModel):
    email: EmailStr
    new_password: str

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

# Society Schemas
class SocietyBase(BaseModel):
    name: str
    address: str
    registration_number: Optional[str] = None # Used during creation
    secretary_name: Optional[str] = None
    is_legal: bool = True
    creator_role: str = "OWNER" # OWNER or SECRETARY

class SocietyCreate(SocietyBase):
    pass

class SocietyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    registration_number: Optional[str] = None
    secretary_name: Optional[str] = None
    is_legal: Optional[bool] = None

class SocietyResponse(BaseModel): # Changed to inherit from BaseModel
    id: UUID
    name: str
    address: str
    registration_number: Optional[str] = None
    secretary_name: Optional[str] = None
    is_legal: Optional[bool] = True
    creator_role: Optional[str] = "OWNER"
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class SocietyDetailResponse(SocietyResponse):
    # This can be used for the owner/secretary to see the registration number if needed
    registration_number: Optional[str] = None

# Service Provider Schemas
class ProviderBase(BaseModel):
    company_name: Optional[str] = "Unknown"
    owner_name: Optional[str] = "Unknown"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    category: Optional[str] = "General"
    categories: Optional[List[str]] = []
    phone: Optional[str] = ""
    email: Optional[str] = ""
    hourly_rate: Optional[float] = 0.0
    availability: Optional[str] = None
    bio: Optional[str] = None
    education: Optional[str] = None
    experience_years: Optional[int] = 0
    availability_status: Optional[str] = "AVAILABLE"
    qualification: Optional[str] = None
    government_id: Optional[str] = None
    certification_url: Optional[str] = None
    location: Optional[str] = None
    profile_photo_url: Optional[str] = None
    society_id: Optional[UUID] = None

class ProviderCreate(ProviderBase):
    company_name: str = "Unknown"
    owner_name: str = "Unknown"
    category: str = "General"
    phone: str = ""
    email: str = ""

class ProviderResponse(ProviderBase):
    id: UUID
    user_id: Optional[UUID] = None
    is_verified: Optional[bool] = False
    rating: Optional[float] = 5.0
    certificates: List["CertificateResponse"] = []

    @field_validator('categories', mode='before')
    @classmethod
    def parse_categories(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v or []

    class Config:
        from_attributes = True

class CertificateBase(BaseModel):
    category: str
    title: Optional[str] = None
    certificate_url: str
    is_verified: bool = False

class CertificateCreate(CertificateBase):
    pass

class CertificateResponse(CertificateBase):
    id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True

class ProviderUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    education: Optional[str] = None
    experience_years: Optional[int] = None
    categories: Optional[List[str]] = None
    hourly_rate: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    profile_photo_url: Optional[str] = None

class AvailabilityUpdate(BaseModel):
    status: str # AVAILABLE, WORKING, VACATION

# Booking Schemas
class BookingBase(BaseModel):
    provider_id: UUID
    service_type: str
    scheduled_at: datetime
    priority: str = "Normal"
    issue_description: Optional[str] = None
    property_details: Optional[str] = None
    estimated_cost: float = 0.0

class BookingCreate(BookingBase):
    task_id: Optional[UUID] = None  # Link booking to a specific pending task

class BookingUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class BookingStatusUpdate(BaseModel):
    status: str
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None

class BookingReschedule(BaseModel):
    new_date: datetime

class BookingCancel(BaseModel):
    reason: str


class BookingStatusHistoryRead(BaseModel):
    id: UUID
    status: str
    notes: Optional[str] = None
    timestamp: datetime
    class Config:
        from_attributes = True

class ChatBase(BaseModel):
    message: str

class ChatCreate(ChatBase):
    pass

class ChatRead(ChatBase):
    id: UUID
    booking_id: UUID
    sender_id: UUID
    timestamp: datetime
    class Config:
        from_attributes = True

class ReviewBase(BaseModel):
    rating: int
    review_text: Optional[str] = None
    quality_rating: int = 5
    punctuality_rating: int = 5
    professionalism_rating: int = 5

class ReviewCreate(ReviewBase):
    pass

class ReviewRead(ReviewBase):
    id: UUID
    booking_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class BookingRead(BookingBase):
    id: UUID
    user_id: UUID
    status: str
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    completion_photos: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BookingDetailRead(BookingRead):
    status_history: List[BookingStatusHistoryRead] = []
    chats: List[ChatRead] = []
    review: Optional[ReviewRead] = None
    provider: ProviderResponse

    class Config:
        from_attributes = True

class ReceiptRead(BaseModel):
    booking_id: UUID
    service_type: str
    status: str
    scheduled_at: datetime
    estimated_cost: float
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    provider_name: str
    provider_id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Maintenance Task Schemas
class TaskCreate(BaseModel):
    title: str                            # Device Name
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "Pending"
    priority: str = "Routine"             # Routine, Mandatory, Urgent
    category: Optional[str] = None        # Service category for Find Servicer
    service_provider_id: Optional[UUID] = None

class TaskResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    priority: str
    category: Optional[str] = None
    location: Optional[str] = None
    task_type: Optional[str] = "standard"
    booking_id: Optional[UUID] = None
    warning_sent: bool = False
    final_sent: bool = False
    overdue_sent: bool = False
    completed_at: Optional[datetime] = None
    completion_method: Optional[str] = None
    created_at: Optional[datetime] = None
    provider: Optional[ProviderResponse] = None

    class Config:
        from_attributes = True

class MaintenanceTaskUpdate(BaseModel):
    status: Optional[Literal["Pending", "Active", "Triggered", "Overdue", "Assigned", "Completed", "Cancelled", "Expired"]] = None
    completion_method: Optional[Literal["booked", "manual", "cancelled"]] = None
    task_type: Optional[str] = None

# Routine Task Schemas
class RoutineTaskCreate(BaseModel):
    title: str                          # Device name
    description: Optional[str] = None   # Notes
    category: str                       # Routine category
    location: Optional[str] = None      # User location
    priority: str = "Routine"           # Routine / Mandatory / Urgent

class RoutineTaskResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    priority: str
    status: str
    task_type: str
    user_id: UUID
    booking_id: Optional[UUID] = None
    service_provider_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RoutineTaskAssign(BaseModel):
    provider_id: UUID
    scheduled_at: datetime

# Notification Schemas
class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str = "INFO" # INFO, WARNING, URGENT
    link: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: UUID

class NotificationResponse(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationUpdate(BaseModel):
    is_read: bool

# Society Request Schemas
class SocietyRequestBase(BaseModel):
    society_id: UUID
    provider_id: UUID
    message: Optional[str] = None

class SocietyRequestCreate(SocietyRequestBase):
    pass

class SocietyRequestResponse(SocietyRequestBase):
    id: UUID
    sender_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SocietyRequestAction(BaseModel):
    status: str # ACCEPTED, REJECTED


# ────────────────────────────────────────────────────────────
# Service Request Workflow Schemas
# ────────────────────────────────────────────────────────────

class ServiceRequestCreate(BaseModel):
    provider_ids: List[UUID]
    contact_name: str
    contact_mobile: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []        # ISO date strings
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


# ────────────────────────────────────────────────────────────
# Emergency SOS Schemas
# ────────────────────────────────────────────────────────────

EMERGENCY_CATEGORY_OPTIONS = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
]

# --- Config (Admin manages) ---

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


# --- Penalty Config ---

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


# --- Emergency Request ---

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
    provider_ids: List[UUID]

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

    @field_validator("provider_ids")
    @classmethod
    def validate_providers(cls, v: List[UUID]) -> List[UUID]:
        if not v:
            raise ValueError("At least one provider must be selected")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate provider IDs are not allowed")
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


# --- Servicer Response ---

class EmergencyResponseCreate(BaseModel):
    arrival_time: datetime

    @field_validator("arrival_time")
    @classmethod
    def arrival_must_be_future(cls, v: datetime) -> datetime:
        if v <= datetime.utcnow():
            raise ValueError("arrival_time must be in the future")
        return v


# --- Star Adjustments ---

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


# --- Admin Provider Status ---

class AdminProviderStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


# --- Incoming Emergency (Servicer side) ---

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

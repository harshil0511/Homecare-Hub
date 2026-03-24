import json
from enum import Enum
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime, date

class UserRole(str, Enum):
    USER = "USER"
    SERVICER = "SERVICER"
    ADMIN = "ADMIN"

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: Optional[UserRole] = UserRole.USER

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    user_uuid: str
    is_active: bool
    society_id: Optional[int] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str       # USER | SERVICER | ADMIN
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
    id: int
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
    company_name: str
    owner_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    category: str
    categories: Optional[List[str]] = [] # Role list
    phone: str
    email: str
    hourly_rate: float = 0.0
    availability: Optional[str] = None
    bio: Optional[str] = None
    education: Optional[str] = None
    experience_years: int = 0
    availability_status: str = "AVAILABLE"
    qualification: Optional[str] = None
    government_id: Optional[str] = None
    certification_url: Optional[str] = None
    location: Optional[str] = None
    profile_photo_url: Optional[str] = None
    society_id: Optional[int] = None

class ProviderCreate(ProviderBase):
    pass

class ProviderResponse(ProviderBase):
    id: int
    user_id: Optional[int] = None
    is_verified: bool
    rating: float
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
    certificate_url: str
    is_verified: bool = False

class CertificateCreate(CertificateBase):
    pass

class CertificateResponse(CertificateBase):
    id: int
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
    provider_id: int
    service_type: str
    scheduled_at: datetime
    priority: str = "Normal"
    issue_description: Optional[str] = None
    property_details: Optional[str] = None
    estimated_cost: float = 0.0

class BookingCreate(BookingBase):
    pass

class BookingUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class BookingReschedule(BaseModel):
    new_date: datetime

class BookingCancel(BaseModel):
    reason: str

class BookingStatusHistoryRead(BaseModel):
    id: int
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
    id: int
    booking_id: int
    sender_id: int
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
    id: int
    booking_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class BookingRead(BookingBase):
    id: int
    user_id: int
    status: str
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

# Maintenance Task Schemas
class TaskCreate(BaseModel):
    title: str
    description: str = None
    due_date: date
    status: str = "Pending"

class TaskResponse(TaskCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str = "INFO" # INFO, WARNING, URGENT
    link: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: int

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationUpdate(BaseModel):
    is_read: bool

# Society Request Schemas
class SocietyRequestBase(BaseModel):
    society_id: int
    provider_id: int
    message: Optional[str] = None

class SocietyRequestCreate(SocietyRequestBase):
    pass

class SocietyRequestResponse(SocietyRequestBase):
    id: int
    sender_id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SocietyRequestAction(BaseModel):
    status: str # ACCEPTED, REJECTED

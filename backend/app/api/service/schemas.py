import json
from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class SocietyBase(BaseModel):
    name: str
    address: str
    registration_number: Optional[str] = None
    secretary_name: Optional[str] = None
    is_legal: bool = True
    creator_role: str = "OWNER"


class SocietyCreate(SocietyBase):
    pass


class SocietyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    registration_number: Optional[str] = None
    secretary_name: Optional[str] = None
    is_legal: Optional[bool] = None


class SocietyResponse(BaseModel):
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
    registration_number: Optional[str] = None


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
    rating: Optional[float] = 0.0
    completed_jobs: Optional[int] = 0
    emergency_jobs: Optional[int] = 0
    certificates: List[CertificateResponse] = []

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
    status: str


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
    status: str


class PointLogEntry(BaseModel):
    created_at: Optional[datetime] = None
    event_type: str
    delta: float
    note: Optional[str] = None

    class Config:
        from_attributes = True


class MonthlyStatEntry(BaseModel):
    month: str
    jobs: int
    points_earned: float
    rating_end: float


class PointsBreakdown(BaseModel):
    emergency: float = 0.0
    urgent: float = 0.0
    regular: float = 0.0
    feedback: float = 0.0
    penalties: float = 0.0


class ProviderAnalyticsRead(BaseModel):
    total_jobs: int
    emergency_jobs: int
    urgent_jobs: int
    regular_jobs: int
    cancelled_jobs: int
    total_points: float
    current_rating: float
    completion_rate: float
    points_breakdown: PointsBreakdown
    recent_point_log: List[PointLogEntry] = []
    monthly_stats: List[MonthlyStatEntry] = []

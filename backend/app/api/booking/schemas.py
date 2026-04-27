from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from app.api.service.schemas import ProviderResponse


class UserBasicRead(BaseModel):
    id: UUID
    username: str
    email: str
    home_number: Optional[str] = None

    class Config:
        from_attributes = True


class BookingBase(BaseModel):
    provider_id: UUID
    service_type: str
    scheduled_at: datetime
    priority: str = "Normal"
    issue_description: Optional[str] = None
    property_details: Optional[str] = None
    estimated_cost: float = 0.0

    @field_validator("estimated_cost")
    @classmethod
    def estimated_cost_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Estimated cost cannot be negative.")
        return v


class BookingCreate(BookingBase):
    task_id: Optional[UUID] = None


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
    source_type: Optional[str] = None
    source_id: Optional[UUID] = None
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    completion_photos: Optional[str] = None
    completed_at: Optional[datetime] = None
    is_flagged: bool = False
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


class BookingWithUserRead(BookingDetailRead):
    """BookingDetailRead extended with the booking's user info — for servicer's completed jobs view."""
    user: Optional[UserBasicRead] = None

    class Config:
        from_attributes = True


class ChargeSubmitCreate(BaseModel):
    actual_hours: float
    charge_description: Optional[str] = None

    @field_validator("actual_hours")
    @classmethod
    def validate_hours(cls, v: float) -> float:
        import math
        if not math.isfinite(v):
            raise ValueError("actual_hours must be a finite number")
        if v <= 0:
            raise ValueError("actual_hours must be greater than 0")
        return v


class FlagCreate(BaseModel):
    flag_reason: str

    @field_validator("flag_reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("flag_reason must not be blank")
        return v


class EmergencyCompleteCreate(BaseModel):
    actual_hours: float
    completion_notes: Optional[str] = None

    @field_validator("actual_hours")
    @classmethod
    def validate_hours(cls, v: float) -> float:
        import math
        if not math.isfinite(v):
            raise ValueError("actual_hours must be a finite number")
        if v <= 0:
            raise ValueError("actual_hours must be greater than 0")
        return v


class ReceiptRead(BaseModel):
    booking_id: UUID
    service_type: str
    servicer_name: str
    is_emergency: bool = False
    callout_fee: float = 0.0
    base_price: float
    extra_hours: float
    hourly_rate: float
    extra_charge: float
    final_amount: float
    completed_at: Optional[datetime] = None
    negotiated: bool = False

    class Config:
        from_attributes = True


class ComplaintCreate(BaseModel):
    reason: str


class ComplaintRead(BaseModel):
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

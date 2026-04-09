from uuid import UUID
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.api.service.schemas import ProviderResponse


class BookingBase(BaseModel):
    provider_id: UUID
    service_type: str
    scheduled_at: datetime
    priority: str = "Normal"
    issue_description: Optional[str] = None
    property_details: Optional[str] = None
    estimated_cost: float = 0.0


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

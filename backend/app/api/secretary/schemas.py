from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.api.auth.schemas import UserResponse  # noqa: F401
from app.api.service.schemas import SocietyResponse, SocietyUpdate, ProviderResponse  # noqa: F401


class HomeAssign(BaseModel):
    home_number: str
    resident_name: str


class SecretaryComplaintCreate(BaseModel):
    subject: str
    description: str


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


class HomeMemberCreate(BaseModel):
    full_name: str
    family_members: int
    house_no: str
    mobile: str


class HomeMemberRead(BaseModel):
    id: UUID
    society_id: UUID
    full_name: str
    family_members: int
    house_no: str
    mobile: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


class SocietyContractCounterCreate(BaseModel):
    counter_duration_months: int
    servicer_notes: Optional[str] = None

    @field_validator("counter_duration_months")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v not in (2, 6, 10, 12):
            raise ValueError("counter_duration_months must be 2, 6, 10, or 12")
        return v


class SocietyDispatchStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("IN_PROGRESS", "COMPLETED"):
            raise ValueError("status must be IN_PROGRESS or COMPLETED")
        return v


class SocietySummary(BaseModel):
    id: UUID
    name: str
    address: str

    class Config:
        from_attributes = True


class SocietyDispatchServicerRead(BaseModel):
    id: UUID
    service_type: str
    scheduled_at: datetime
    job_price: float
    notes: Optional[str] = None
    status: str
    created_at: datetime
    member_home_number: Optional[str] = None
    member_name: Optional[str] = None


class SocietyContractServicerRead(BaseModel):
    id: UUID
    society_id: UUID
    duration_months: int
    counter_duration_months: Optional[int] = None
    monthly_rate: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str
    secretary_notes: Optional[str] = None
    servicer_notes: Optional[str] = None
    created_at: datetime
    society: Optional[SocietySummary] = None
    dispatches: List[SocietyDispatchServicerRead] = []

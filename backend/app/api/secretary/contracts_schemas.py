from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


class SocietyContractCreate(BaseModel):
    provider_id: UUID
    duration_months: int
    monthly_rate: float
    secretary_notes: Optional[str] = None

    @field_validator("duration_months")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v not in (2, 6, 10, 12):
            raise ValueError("duration_months must be 2, 6, 10, or 12")
        return v

    @field_validator("monthly_rate")
    @classmethod
    def validate_rate(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("monthly_rate must be positive")
        return v


class SocietyDispatchCreate(BaseModel):
    member_id: UUID
    service_type: str
    scheduled_at: datetime
    job_price: float
    notes: Optional[str] = None

    @field_validator("job_price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("job_price must be positive")
        return v


class ProviderSummary(BaseModel):
    id: UUID
    company_name: str
    category: str
    rating: float
    phone: Optional[str] = None
    availability_status: str

    class Config:
        from_attributes = True


class SocietyDispatchRead(BaseModel):
    id: UUID
    contract_id: UUID
    society_id: UUID
    provider_id: UUID
    member_id: UUID
    service_type: str
    scheduled_at: datetime
    job_price: float
    notes: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SocietyContractRead(BaseModel):
    id: UUID
    society_id: UUID
    provider_id: UUID
    proposed_by: UUID
    duration_months: int
    counter_duration_months: Optional[int] = None
    monthly_rate: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str
    secretary_notes: Optional[str] = None
    servicer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    provider: Optional[ProviderSummary] = None
    dispatches: List[SocietyDispatchRead] = []

    class Config:
        from_attributes = True

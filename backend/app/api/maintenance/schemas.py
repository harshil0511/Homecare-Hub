from uuid import UUID
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, date

from app.api.service.schemas import ProviderResponse


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "Pending"
    priority: str = "Routine"
    category: Optional[str] = None
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



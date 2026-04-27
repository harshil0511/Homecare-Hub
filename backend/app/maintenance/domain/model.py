import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Date, Time
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String, default="Pending")
    priority = Column(String, default="Routine")

    category = Column(String, nullable=True)
    location = Column(String, nullable=True)
    task_type = Column(String, default="standard")
    booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    due_time = Column(Time, nullable=True)

    warning_sent = Column(Boolean, default=False)
    final_sent = Column(Boolean, default=False)
    overdue_sent = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    completion_method = Column(String, nullable=True)

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    service_provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=True)

    owner = relationship("User", back_populates="tasks")
    provider = relationship("ServiceProvider")
    booking = relationship("ServiceBooking")

import uuid
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class EmergencyConfig(Base):
    __tablename__ = "emergency_config"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    category = Column(String, unique=True, nullable=False)
    callout_fee = Column(Float, nullable=False, default=0.0)
    hourly_rate = Column(Float, nullable=False, default=0.0)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    requests = relationship("EmergencyRequest", back_populates="config")


class EmergencyPenaltyConfig(Base):
    __tablename__ = "emergency_penalty_config"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    event_type = Column(String, unique=True, nullable=False)
    star_deduction = Column(Float, nullable=False, default=0.5)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    society_name = Column(String, nullable=False)
    building_name = Column(String, nullable=False)
    flat_no = Column(String, nullable=False)
    landmark = Column(String, nullable=False)
    full_address = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    device_name = Column(String, nullable=True)
    photos = Column(Text, nullable=True)
    contact_name = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    status = Column(String, default="PENDING", nullable=False, index=True)
    config_id = Column(PG_UUID(as_uuid=True), ForeignKey("emergency_config.id"), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    resulting_booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="emergency_requests")
    config = relationship("EmergencyConfig", back_populates="requests")
    responses = relationship("EmergencyResponse", back_populates="request", cascade="all, delete-orphan")
    resulting_booking = relationship("ServiceBooking", foreign_keys=[resulting_booking_id])


class EmergencyResponse(Base):
    __tablename__ = "emergency_responses"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_id = Column(PG_UUID(as_uuid=True), ForeignKey("emergency_requests.id"), nullable=False)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    arrival_time = Column(DateTime, nullable=False)
    status = Column(String, default="PENDING", nullable=False, index=True)
    penalty_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    request = relationship("EmergencyRequest", back_populates="responses")
    provider = relationship("ServiceProvider", back_populates="emergency_responses")


class EmergencyStarAdjustment(Base):
    __tablename__ = "emergency_star_adjustments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    adjusted_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    delta = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    event_type = Column(String, nullable=False)
    emergency_request_id = Column(PG_UUID(as_uuid=True), ForeignKey("emergency_requests.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", back_populates="star_adjustments")
    admin_user = relationship("User", foreign_keys=[adjusted_by])

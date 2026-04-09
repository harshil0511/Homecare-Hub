import uuid
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class ServiceProvider(Base):
    __tablename__ = "service_providers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    company_name = Column(String, index=True)
    owner_name = Column(String)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    category = Column(String, index=True)
    categories = Column(Text, nullable=True)
    phone = Column(String)
    email = Column(String)

    hourly_rate = Column(Float, default=0.0)
    availability = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    education = Column(String, nullable=True)
    experience_years = Column(Integer, default=0)
    availability_status = Column(String, default="AVAILABLE")

    is_verified = Column(Boolean, default=False)
    certification_url = Column(String, nullable=True)
    qualification = Column(String, nullable=True)
    government_id = Column(String, nullable=True)

    location = Column(String, nullable=True)
    profile_photo_url = Column(String, nullable=True)

    rating = Column(Float, default=0.0)
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=True)

    user = relationship("User", back_populates="provider_profile")
    society = relationship("Society", back_populates="service_providers")
    bookings = relationship("ServiceBooking", back_populates="provider")
    certificates = relationship("ServiceCertificate", back_populates="provider")
    received_requests = relationship("ServiceRequestRecipient", back_populates="provider")
    submitted_responses = relationship("ServiceRequestResponse", back_populates="provider")
    emergency_responses = relationship("EmergencyResponse", back_populates="provider")
    star_adjustments = relationship("EmergencyStarAdjustment", back_populates="provider")


class ServiceCertificate(Base):
    __tablename__ = "service_certificates"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"))
    category = Column(String)
    title = Column(String, nullable=True)
    certificate_url = Column(String)
    is_verified = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", back_populates="certificates")


class SocietyRequest(Base):
    __tablename__ = "society_requests"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"))
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"))
    sender_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(String, default="PENDING")
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    society = relationship("Society", back_populates="requests")
    provider = relationship("ServiceProvider")


class ProviderPoints(Base):
    __tablename__ = "provider_points"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    delta = Column(Float, nullable=False)
    event_type = Column(String, nullable=False)
    source_id = Column(PG_UUID(as_uuid=True), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", backref="points_log")

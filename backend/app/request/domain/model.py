import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Float, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    contact_name = Column(String, nullable=False)
    contact_mobile = Column(String, nullable=False)
    location = Column(String, nullable=False)
    device_or_issue = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)
    preferred_dates = Column(Text, nullable=True)
    urgency = Column(String, default="Normal")
    status = Column(String, default="OPEN")
    expires_at = Column(DateTime, nullable=False)
    resulting_booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="service_requests")
    recipients = relationship("ServiceRequestRecipient", back_populates="request", cascade="all, delete-orphan")
    responses = relationship("ServiceRequestResponse", back_populates="request", cascade="all, delete-orphan")
    resulting_booking = relationship("ServiceBooking", foreign_keys=[resulting_booking_id])


class ServiceRequestRecipient(Base):
    __tablename__ = "service_request_recipients"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_requests.id"), nullable=False)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    is_read = Column(Boolean, default=False)
    notified_at = Column(DateTime, default=datetime.datetime.utcnow)

    request = relationship("ServiceRequest", back_populates="recipients")
    provider = relationship("ServiceProvider", back_populates="received_requests")


class ServiceRequestResponse(Base):
    __tablename__ = "service_request_responses"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_requests.id"), nullable=False)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    proposed_date = Column(DateTime, nullable=False)
    proposed_price = Column(Float, nullable=False)
    estimated_hours = Column(Float, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="PENDING")
    is_final_offer = Column(Boolean, default=False)  # servicer marks initial offer as final
    # Negotiation fields
    negotiation_status = Column(String, default="NONE")  # NONE | NEGOTIATING | AGREED | CLOSED
    agreed_price = Column(Float, nullable=True)
    agreed_date = Column(DateTime, nullable=True)
    current_round = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    request = relationship("ServiceRequest", back_populates="responses")
    provider = relationship("ServiceProvider", back_populates="submitted_responses")
    negotiation_offers = relationship("NegotiationOffer", back_populates="response", cascade="all, delete-orphan")


class NegotiationOffer(Base):
    __tablename__ = "negotiation_offers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    response_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_request_responses.id", ondelete="CASCADE"), nullable=False)
    offered_by = Column(String, nullable=False)   # "USER" or "SERVICER"
    round_number = Column(Integer, nullable=False)
    proposed_date = Column(DateTime, nullable=False)
    proposed_time = Column(String(50), nullable=False)  # "morning" | "afternoon" | "evening"
    proposed_price = Column(Float, nullable=False)
    message = Column(Text, nullable=True)
    is_final_offer = Column(Boolean, default=False)  # servicer marks counter as final
    status = Column(String, default="PENDING")  # PENDING | ACCEPTED | REJECTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    response = relationship("ServiceRequestResponse", back_populates="negotiation_offers")

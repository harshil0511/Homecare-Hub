import uuid
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class ServiceBooking(Base):
    __tablename__ = "service_bookings"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"))
    service_type = Column(String)
    scheduled_at = Column(DateTime)
    status = Column(String, default="Pending")

    priority = Column(String, default="Normal")
    issue_description = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)
    estimated_cost = Column(Float, default=0.0)
    final_cost = Column(Float, default=0.0)
    actual_hours = Column(Float, nullable=True)
    completion_notes = Column(Text, nullable=True)
    completion_photos = Column(Text, nullable=True)
    property_details = Column(Text, nullable=True)
    source_type = Column(String, nullable=True)
    source_id = Column(PG_UUID(as_uuid=True), nullable=True)
    completed_at = Column(DateTime, nullable=True)  # set when servicer clicks Final Complete
    is_flagged = Column(Boolean, default=False, nullable=False, server_default="false")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    provider = relationship("ServiceProvider", back_populates="bookings")
    status_history = relationship("BookingStatusHistory", back_populates="booking")
    chats = relationship("BookingChat", back_populates="booking")
    review = relationship("BookingReview", back_populates="booking", uselist=False)
    complaints = relationship("BookingComplaint", back_populates="booking", cascade="all, delete-orphan")


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"))
    status = Column(String)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="status_history")


class BookingChat(Base):
    __tablename__ = "booking_chats"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"))
    sender_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="chats")


class BookingReview(Base):
    __tablename__ = "booking_reviews"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"))
    rating = Column(Integer)
    review_text = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)

    quality_rating = Column(Integer, default=5)
    punctuality_rating = Column(Integer, default=5)
    professionalism_rating = Column(Integer, default=5)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="review")


class BookingComplaint(Base):
    __tablename__ = "booking_complaints"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"), nullable=False, index=True)
    filed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    status = Column(String, default="OPEN")   # OPEN | UNDER_REVIEW | RESOLVED
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    booking = relationship("ServiceBooking", back_populates="complaints")
    user = relationship("User", foreign_keys=[filed_by])

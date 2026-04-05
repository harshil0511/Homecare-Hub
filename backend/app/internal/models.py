import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Table, Date, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

# Association table for trusted providers in a society
society_trusted_providers = Table(
    "society_trusted_providers",
    Base.metadata,
    Column("society_id", PG_UUID(as_uuid=True), ForeignKey("societies.id"), primary_key=True),
    Column("provider_id", PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), primary_key=True),
    Column("created_at", DateTime, default=datetime.datetime.utcnow)
)

class User(Base):
    __tablename__ = "users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="USER")

    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=True)
    home_number = Column(String, nullable=True)
    resident_name = Column(String, nullable=True)

    society = relationship("Society", back_populates="users", foreign_keys=[society_id])
    tasks = relationship("MaintenanceTask", back_populates="owner")
    bookings = relationship("ServiceBooking", back_populates="user")
    provider_profile = relationship("ServiceProvider", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    service_requests = relationship("ServiceRequest", back_populates="user")
    emergency_requests = relationship("EmergencyRequest", back_populates="user")

class Society(Base):
    __tablename__ = "societies"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, unique=True, index=True)
    address = Column(String)
    secretary_name = Column(String, nullable=True)
    is_legal = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    creator_role = Column(String, default="OWNER")
    registration_number = Column(String, unique=True, nullable=True)

    owner_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    secretary_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    manager_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    users = relationship("User", back_populates="society", foreign_keys="[User.society_id]")
    service_providers = relationship("ServiceProvider", back_populates="society")
    trusted_providers = relationship(
        "ServiceProvider",
        secondary=society_trusted_providers,
        backref="trusted_by_societies"
    )
    requests = relationship("SocietyRequest", back_populates="society")
    owner_user = relationship("User", foreign_keys=[owner_id])
    secretary_user = relationship("User", foreign_keys=[secretary_id])
    manager_user = relationship("User", foreign_keys=[manager_id])

class ServiceProvider(Base):
    __tablename__ = "service_providers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    company_name = Column(String, index=True)
    owner_name = Column(String)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    age = Column(Float, nullable=True)
    gender = Column(String, nullable=True)
    category = Column(String, index=True)
    categories = Column(Text, nullable=True)
    phone = Column(String)
    email = Column(String)

    hourly_rate = Column(Float, default=0.0)
    availability = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    education = Column(String, nullable=True)
    experience_years = Column(Float, default=0)
    availability_status = Column(String, default="AVAILABLE")

    is_verified = Column(Boolean, default=False)
    certification_url = Column(String, nullable=True)
    qualification = Column(String, nullable=True)
    government_id = Column(String, nullable=True)

    location = Column(String, nullable=True)
    profile_photo_url = Column(String, nullable=True)

    rating = Column(Float, default=5.0)
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

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    provider = relationship("ServiceProvider", back_populates="bookings")
    status_history = relationship("BookingStatusHistory", back_populates="booking")
    chats = relationship("BookingChat", back_populates="booking")
    review = relationship("BookingReview", back_populates="booking", uselist=False)

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
    rating = Column(Float)
    review_text = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)

    quality_rating = Column(Float, default=5)
    punctuality_rating = Column(Float, default=5)
    professionalism_rating = Column(Float, default=5)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="review")

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

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String)
    message = Column(Text)
    notification_type = Column(String, default="INFO")
    is_read = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notifications")

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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    request = relationship("ServiceRequest", back_populates="responses")
    provider = relationship("ServiceProvider", back_populates="submitted_responses")

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
    penalty_count = Column(Float, nullable=False, default=0)
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

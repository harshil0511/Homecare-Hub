import uuid
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Table, Date, Float, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

# Association table for trusted providers in a society
society_trusted_providers = Table(
    "society_trusted_providers",
    Base.metadata,
    Column("society_id", Integer, ForeignKey("societies.id"), primary_key=True),
    Column("provider_id", Integer, ForeignKey("service_providers.id"), primary_key=True),
    Column("created_at", DateTime, default=datetime.datetime.utcnow)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_uuid = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="USER") # USER, SERVICER, ADMIN
    
    society_id = Column(Integer, ForeignKey("societies.id"), nullable=True)
    home_number = Column(String, nullable=True)
    resident_name = Column(String, nullable=True)

    society = relationship("Society", back_populates="users", foreign_keys=[society_id])
    tasks = relationship("MaintenanceTask", back_populates="owner")
    bookings = relationship("ServiceBooking", back_populates="user")
    provider_profile = relationship("ServiceProvider", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    service_requests = relationship("ServiceRequest", back_populates="user")

class Society(Base):
    __tablename__ = "societies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    address = Column(String)
    secretary_name = Column(String, nullable=True)
    is_legal = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Authority Management
    creator_role = Column(String, default="OWNER") # OWNER or SECRETARY

    # Security & Identification
    registration_number = Column(String, unique=True, nullable=True) # Sensitive, shown only to owner/secretary
    
    # Ownership and Management
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    secretary_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    users = relationship("User", back_populates="society", foreign_keys="[User.society_id]")
    service_providers = relationship("ServiceProvider", back_populates="society")
    
    # Unified Trusted Providers Relationship
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

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    company_name = Column(String, index=True)
    owner_name = Column(String)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    category = Column(String, index=True) # Main category
    categories = Column(Text, nullable=True) # JSON list of roles
    phone = Column(String)
    email = Column(String)
    
    # New fields for pricing and availability
    hourly_rate = Column(Float, default=0.0)
    availability = Column(Text, nullable=True) # JSON string or comma-separated days
    bio = Column(Text, nullable=True)
    education = Column(String, nullable=True)
    experience_years = Column(Integer, default=0)
    availability_status = Column(String, default="AVAILABLE") # AVAILABLE, WORKING, VACATION
    
    is_verified = Column(Boolean, default=False)
    certification_url = Column(String, nullable=True)
    qualification = Column(String, nullable=True)
    government_id = Column(String, nullable=True)
    
    location = Column(String, nullable=True)
    profile_photo_url = Column(String, nullable=True)

    rating = Column(Float, default=5.0)
    society_id = Column(Integer, ForeignKey("societies.id"), nullable=True)
    
    user = relationship("User", back_populates="provider_profile")
    society = relationship("Society", back_populates="service_providers")
    bookings = relationship("ServiceBooking", back_populates="provider")
    certificates = relationship("ServiceCertificate", back_populates="provider")
    received_requests = relationship("ServiceRequestRecipient", back_populates="provider")
    submitted_responses = relationship("ServiceRequestResponse", back_populates="provider")

class ServiceCertificate(Base):
    __tablename__ = "service_certificates"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("service_providers.id"))
    category = Column(String)
    certificate_url = Column(String)
    is_verified = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", back_populates="certificates")

class ServiceBooking(Base):
    __tablename__ = "service_bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    provider_id = Column(Integer, ForeignKey("service_providers.id"))
    service_type = Column(String)
    scheduled_at = Column(DateTime)
    status = Column(String, default="Pending") # Pending, Accepted, In Progress, Completed, Cancelled
    
    # Advanced Booking Fields
    priority = Column(String, default="Normal") # Normal, High, Emergency
    issue_description = Column(Text, nullable=True)
    photos = Column(Text, nullable=True) # JSON string of image URLs
    estimated_cost = Column(Float, default=0.0)
    final_cost = Column(Float, default=0.0)
    actual_hours = Column(Float, nullable=True)
    completion_notes = Column(Text, nullable=True)
    completion_photos = Column(Text, nullable=True)  # JSON string of URLs
    property_details = Column(Text, nullable=True) # Quick property info
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    provider = relationship("ServiceProvider", back_populates="bookings")
    status_history = relationship("BookingStatusHistory", back_populates="booking")
    chats = relationship("BookingChat", back_populates="booking")
    review = relationship("BookingReview", back_populates="booking", uselist=False)

class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("service_bookings.id"))
    status = Column(String)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="status_history")

class BookingChat(Base):
    __tablename__ = "booking_chats"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("service_bookings.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="chats")

class BookingReview(Base):
    __tablename__ = "booking_reviews"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("service_bookings.id"))
    rating = Column(Integer) # 1-5
    review_text = Column(Text, nullable=True)
    photos = Column(Text, nullable=True) # JSON string
    
    # Categorized ratings
    quality_rating = Column(Integer, default=5)
    punctuality_rating = Column(Integer, default=5)
    professionalism_rating = Column(Integer, default=5)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="review")

class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True) # Device Name
    description = Column(String, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String, default="Pending")
    priority = Column(String, default="Routine") # Routine, Mandatory, Urgent

    # Routine task fields
    category = Column(String, nullable=True)
    location = Column(String, nullable=True)
    task_type = Column(String, default="standard") # standard, routine
    booking_id = Column(Integer, ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"))
    service_provider_id = Column(Integer, ForeignKey("service_providers.id"), nullable=True)

    owner = relationship("User", back_populates="tasks")
    provider = relationship("ServiceProvider")
    booking = relationship("ServiceBooking")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(Text)
    notification_type = Column(String, default="INFO") # INFO, WARNING, URGENT
    is_read = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class SocietyRequest(Base):
    __tablename__ = "society_requests"

    id = Column(Integer, primary_key=True, index=True)
    society_id = Column(Integer, ForeignKey("societies.id"))
    provider_id = Column(Integer, ForeignKey("service_providers.id"))
    sender_id = Column(Integer, ForeignKey("users.id")) # Person who initiated (Secretary/Owner)
    status = Column(String, default="PENDING") # PENDING, ACCEPTED, REJECTED
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    society = relationship("Society", back_populates="requests")
    provider = relationship("ServiceProvider")


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    contact_name = Column(String, nullable=False)
    contact_mobile = Column(String, nullable=False)
    location = Column(String, nullable=False)
    device_or_issue = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)              # JSON list of image URLs
    preferred_dates = Column(Text, nullable=True)     # JSON list of ISO datetime strings
    urgency = Column(String, default="Normal")        # Normal, High, Emergency
    status = Column(String, default="OPEN")           # OPEN, ACCEPTED, CANCELLED, EXPIRED
    expires_at = Column(DateTime, nullable=False)
    resulting_booking_id = Column(Integer, ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="service_requests")
    recipients = relationship("ServiceRequestRecipient", back_populates="request", cascade="all, delete-orphan")
    responses = relationship("ServiceRequestResponse", back_populates="request", cascade="all, delete-orphan")
    resulting_booking = relationship("ServiceBooking", foreign_keys=[resulting_booking_id])


class ServiceRequestRecipient(Base):
    __tablename__ = "service_request_recipients"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False)
    provider_id = Column(Integer, ForeignKey("service_providers.id"), nullable=False)
    is_read = Column(Boolean, default=False)
    notified_at = Column(DateTime, default=datetime.datetime.utcnow)

    request = relationship("ServiceRequest", back_populates="recipients")
    provider = relationship("ServiceProvider", back_populates="received_requests")


class ServiceRequestResponse(Base):
    __tablename__ = "service_request_responses"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False)
    provider_id = Column(Integer, ForeignKey("service_providers.id"), nullable=False)
    proposed_date = Column(DateTime, nullable=False)
    proposed_price = Column(Float, nullable=False)
    estimated_hours = Column(Float, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="PENDING")        # PENDING, ACCEPTED, REJECTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    request = relationship("ServiceRequest", back_populates="responses")
    provider = relationship("ServiceProvider", back_populates="submitted_responses")

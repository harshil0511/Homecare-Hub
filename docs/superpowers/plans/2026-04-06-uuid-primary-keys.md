# UUID Primary Keys Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Integer primary key and foreign key in `homecare_db` with PostgreSQL native UUID, keeping all existing functionality intact.

**Architecture:** Update `models.py` (SQLAlchemy) → `schemas.py` (Pydantic) → all API endpoints (FastAPI path params) → write one Alembic migration that drops all old tables and recreates with UUID columns → run migration on the clean dev DB.

**Tech Stack:** Python 3.x, FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL, Alembic

---

## File Map

| File | Change |
|---|---|
| `backend/app/internal/models.py` | Replace all Integer PKs/FKs with `PG_UUID(as_uuid=True)`, remove `user_uuid` col from User |
| `backend/app/internal/schemas.py` | Replace all `id: int` and FK `int` fields with `UUID` |
| `backend/app/internal/deps.py` | Look up user by `User.id` (UUID) instead of `User.user_uuid` |
| `backend/app/api/auth/endpoint.py` | JWT sub and login response use `str(user.id)` |
| `backend/app/api/admin/endpoint.py` | `provider_id: int` → `UUID`, `booking_id: int` → `UUID` |
| `backend/app/api/admin/emergency_endpoint.py` | `config_id: int`, `request_id: int`, `provider_id: int` → `UUID` |
| `backend/app/api/booking/endpoint.py` | All `booking_id: int` → `UUID` |
| `backend/app/api/request/endpoint.py` | All `request_id: int`, `response_id: int` → `UUID` |
| `backend/app/api/service/endpoint.py` | All `society_id: int`, `provider_id: int`, `cert_id: int`, `request_id: int`, `booking_id: int` → `UUID` |
| `backend/app/api/emergency/endpoint.py` | All `request_id: int`, `response_id: int` → `UUID` |
| `backend/app/api/task/endpoint.py` | All `task_id: int` → `UUID` |
| `backend/app/api/notification/endpoint.py` | All `notification_id: int` → `UUID` |
| `backend/app/api/secretary/endpoint.py` | `member_id: int` → `UUID` |
| `backend/alembic/versions/06_04_2026_uuid_primary_keys.py` | New migration: drop all + recreate with UUID |

---

## Task 1: Update models.py

**Files:**
- Modify: `backend/app/internal/models.py`

- [ ] **Step 1: Replace the import block at the top of models.py**

Replace lines 1-6 with:

```python
import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Table, Date, Float, Enum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
```

Note: `Integer` is removed from the sqlalchemy import. `PG_UUID` is added.

- [ ] **Step 2: Replace the `society_trusted_providers` association table**

Replace lines 8-14 with:

```python
society_trusted_providers = Table(
    "society_trusted_providers",
    Base.metadata,
    Column("society_id", PG_UUID(as_uuid=True), ForeignKey("societies.id"), primary_key=True),
    Column("provider_id", PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), primary_key=True),
    Column("created_at", DateTime, default=datetime.datetime.utcnow)
)
```

- [ ] **Step 3: Replace the `User` class**

Replace the entire `User` class (lines 16-37) with:

```python
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
```

Key change: `user_uuid` column is gone. `id` is now `PG_UUID`.

- [ ] **Step 4: Replace the `Society` class**

Replace the entire `Society` class (lines 39-74) with:

```python
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
```

- [ ] **Step 5: Replace the `ServiceProvider` class**

Replace the entire `ServiceProvider` class (lines 76-118) with:

```python
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
```

- [ ] **Step 6: Replace remaining model classes**

Replace `ServiceCertificate` (lines 120-131) with:

```python
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
```

Replace `ServiceBooking` (lines 133-163) with:

```python
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
```

Replace `BookingStatusHistory` (lines 165-174) with:

```python
class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"))
    status = Column(String)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="status_history")
```

Replace `BookingChat` (lines 176-185) with:

```python
class BookingChat(Base):
    __tablename__ = "booking_chats"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    booking_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_bookings.id"))
    sender_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="chats")
```

Replace `BookingReview` (lines 187-203) with:

```python
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
```

Replace `MaintenanceTask` (lines 205-234) with:

```python
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
```

Replace `Notification` (lines 236-248) with:

```python
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
```

Replace `SocietyRequest` (lines 250-263) with:

```python
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
```

Replace `ServiceRequest` (lines 266-288) with:

```python
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
```

Replace `ServiceRequestRecipient` (lines 291-301) with:

```python
class ServiceRequestRecipient(Base):
    __tablename__ = "service_request_recipients"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_requests.id"), nullable=False)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    is_read = Column(Boolean, default=False)
    notified_at = Column(DateTime, default=datetime.datetime.utcnow)

    request = relationship("ServiceRequest", back_populates="recipients")
    provider = relationship("ServiceProvider", back_populates="received_requests")
```

Replace `ServiceRequestResponse` (lines 304-319) with:

```python
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
```

Replace `EmergencyConfig` (lines 322-333) with:

```python
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
```

Replace `EmergencyPenaltyConfig` (lines 336-345) with:

```python
class EmergencyPenaltyConfig(Base):
    __tablename__ = "emergency_penalty_config"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    event_type = Column(String, unique=True, nullable=False)
    star_deduction = Column(Float, nullable=False, default=0.5)
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
```

Replace `EmergencyRequest` (lines 348-375) with:

```python
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
```

Replace `EmergencyResponse` (lines 378-390) with:

```python
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
```

Replace `EmergencyStarAdjustment` (lines 393-409) with:

```python
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
```

- [ ] **Step 7: Commit models.py changes**

```bash
cd backend
git add app/internal/models.py
git commit -m "feat: replace all Integer PKs/FKs with PostgreSQL UUID in models"
```

---

## Task 2: Update schemas.py

**Files:**
- Modify: `backend/app/internal/schemas.py`

- [ ] **Step 1: Add UUID import**

At line 1, add `from uuid import UUID` after the existing imports. Change the first 5 lines to:

```python
import json
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Literal
from datetime import datetime, date
```

- [ ] **Step 2: Update UserCreate and UserResponse**

Replace `UserCreate` (lines 19-23):

```python
class UserCreate(UserBase):
    password: str
    society_name: Optional[str] = None
    society_address: Optional[str] = None
```

Replace `UserResponse` (lines 29-36):

```python
class UserResponse(UserBase):
    id: UUID
    is_active: bool
    society_id: Optional[UUID] = None

    class Config:
        from_attributes = True
```

Replace `Token` (lines 38-43):

```python
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_uuid: str   # populated with str(user.id) — kept for frontend compatibility
    username: str
```

- [ ] **Step 3: Update SocietyResponse**

Replace `SocietyResponse` (lines 76-87):

```python
class SocietyResponse(BaseModel):
    id: UUID
    name: str
    address: str
    registration_number: Optional[str] = None
    secretary_name: Optional[str] = None
    is_legal: Optional[bool] = True
    creator_role: Optional[str] = "OWNER"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
```

- [ ] **Step 4: Update ProviderBase, ProviderResponse, CertificateResponse**

In `ProviderBase`, change `society_id: Optional[int] = None` → `society_id: Optional[UUID] = None`.

Replace `ProviderResponse` (lines 125-143):

```python
class ProviderResponse(ProviderBase):
    id: UUID
    user_id: Optional[UUID] = None
    is_verified: Optional[bool] = False
    rating: Optional[float] = 5.0
    certificates: List["CertificateResponse"] = []

    @field_validator('categories', mode='before')
    @classmethod
    def parse_categories(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v or []

    class Config:
        from_attributes = True
```

Replace `CertificateResponse` (lines 154-159):

```python
class CertificateResponse(CertificateBase):
    id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 5: Update Booking schemas**

In `BookingBase`, change `provider_id: int` → `provider_id: UUID`.

In `BookingCreate`, change `task_id: Optional[int] = None` → `task_id: Optional[UUID] = None`.

Replace `BookingStatusHistoryRead`:

```python
class BookingStatusHistoryRead(BaseModel):
    id: UUID
    status: str
    notes: Optional[str] = None
    timestamp: datetime
    class Config:
        from_attributes = True
```

Replace `ChatRead`:

```python
class ChatRead(ChatBase):
    id: UUID
    booking_id: UUID
    sender_id: UUID
    timestamp: datetime
    class Config:
        from_attributes = True
```

Replace `ReviewRead`:

```python
class ReviewRead(ReviewBase):
    id: UUID
    booking_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True
```

Replace `BookingRead`:

```python
class BookingRead(BookingBase):
    id: UUID
    user_id: UUID
    status: str
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    completion_photos: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

Replace `ReceiptRead`:

```python
class ReceiptRead(BaseModel):
    booking_id: UUID
    service_type: str
    status: str
    scheduled_at: datetime
    estimated_cost: float
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    provider_name: str
    provider_id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 6: Update Task schemas**

In `TaskCreate`, change `service_provider_id: Optional[int] = None` → `service_provider_id: Optional[UUID] = None`.

Replace `TaskResponse`:

```python
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
```

Replace `RoutineTaskResponse`:

```python
class RoutineTaskResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    priority: str
    status: str
    task_type: str
    user_id: UUID
    booking_id: Optional[UUID] = None
    service_provider_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
```

In `RoutineTaskAssign`, change `provider_id: int` → `provider_id: UUID`.

- [ ] **Step 7: Update Notification schemas**

In `NotificationCreate`, change `user_id: int` → `user_id: UUID`.

Replace `NotificationResponse`:

```python
class NotificationResponse(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 8: Update SocietyRequest schemas**

Replace `SocietyRequestBase`:

```python
class SocietyRequestBase(BaseModel):
    society_id: UUID
    provider_id: UUID
    message: Optional[str] = None
```

Replace `SocietyRequestResponse`:

```python
class SocietyRequestResponse(SocietyRequestBase):
    id: UUID
    sender_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 9: Update ServiceRequest schemas**

In `ServiceRequestCreate`, change `provider_ids: List[int]` → `provider_ids: List[UUID]`.
Also update the validator — UUID objects are hashable, so `set(v)` still works.

Replace `ServiceRequestRecipientRead`:

```python
class ServiceRequestRecipientRead(BaseModel):
    id: UUID
    provider_id: UUID
    is_read: bool
    notified_at: Optional[datetime] = None

    class Config:
        from_attributes = True
```

Replace `ServiceRequestResponseRead`:

```python
class ServiceRequestResponseRead(BaseModel):
    id: UUID
    request_id: UUID
    provider_id: UUID
    proposed_date: datetime
    proposed_price: float
    estimated_hours: Optional[float] = None
    message: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    provider: Optional[ProviderResponse] = None

    class Config:
        from_attributes = True
```

Replace `ServiceRequestRead`:

```python
class ServiceRequestRead(BaseModel):
    id: UUID
    user_id: UUID
    contact_name: str
    contact_mobile: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str
    status: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resulting_booking_id: Optional[UUID] = None
    recipients: List[ServiceRequestRecipientRead] = []
    responses: List[ServiceRequestResponseRead] = []

    @field_validator("photos", "preferred_dates", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True
```

Replace `IncomingServiceRequestRead`:

```python
class IncomingServiceRequestRead(BaseModel):
    id: UUID
    contact_name: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str
    status: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    is_read: bool = False
    has_responded: bool = False

    @field_validator("photos", "preferred_dates", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True
```

- [ ] **Step 10: Update Emergency schemas**

Replace `EmergencyConfigRead`:

```python
class EmergencyConfigRead(BaseModel):
    id: UUID
    category: str
    callout_fee: float
    hourly_rate: float
    updated_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
```

Replace `EmergencyPenaltyConfigRead`:

```python
class EmergencyPenaltyConfigRead(BaseModel):
    id: UUID
    event_type: str
    star_deduction: float
    updated_by: Optional[UUID] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
```

In `EmergencyRequestCreate`, change `provider_ids: List[int]` → `provider_ids: List[UUID]`.

Replace `EmergencyResponseRead`:

```python
class EmergencyResponseRead(BaseModel):
    id: UUID
    request_id: UUID
    provider_id: UUID
    arrival_time: datetime
    status: str
    penalty_count: int
    created_at: Optional[datetime] = None
    provider: Optional[ProviderResponse] = None

    class Config:
        from_attributes = True
```

Replace `EmergencyRequestRead`:

```python
class EmergencyRequestRead(BaseModel):
    id: UUID
    user_id: UUID
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    status: str
    config_id: Optional[UUID] = None
    expires_at: datetime
    resulting_booking_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    responses: List[EmergencyResponseRead] = []
    config: Optional[EmergencyConfigRead] = None

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return []
        return v or []

    class Config:
        from_attributes = True
```

Replace `EmergencyStarAdjustRead`:

```python
class EmergencyStarAdjustRead(BaseModel):
    id: UUID
    provider_id: UUID
    adjusted_by: UUID
    delta: float
    reason: str
    event_type: str
    emergency_request_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
```

Replace `IncomingEmergencyRead`:

```python
class IncomingEmergencyRead(BaseModel):
    id: UUID
    society_name: str
    building_name: str
    flat_no: str
    landmark: str
    full_address: str
    category: str
    description: str
    device_name: Optional[str] = None
    photos: Optional[List[str]] = []
    contact_name: str
    contact_phone: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    callout_fee: Optional[float] = None
    hourly_rate: Optional[float] = None
    has_responded: bool = False

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return []
        return v or []

    class Config:
        from_attributes = True
```

- [ ] **Step 11: Commit schemas.py changes**

```bash
git add app/internal/schemas.py
git commit -m "feat: replace all int ID fields with UUID in Pydantic schemas"
```

---

## Task 3: Update deps.py and auth/endpoint.py

**Files:**
- Modify: `backend/app/internal/deps.py`
- Modify: `backend/app/api/auth/endpoint.py`

These two files are changed together because they both deal with the `user_uuid` ↔ `user.id` mapping in JWT tokens.

- [ ] **Step 1: Update deps.py — look up user by `User.id` instead of `User.user_uuid`**

Add `import uuid` at the top of `deps.py` (after existing imports).

Replace the `get_current_user` function (lines 32-57):

```python
def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(security.oauth2_scheme)
) -> User:
    """
    Decode JWT, extract user id (stored as UUID string in 'sub' claim),
    then fetch the full user object from the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        token_data = TokenData(user_uuid=user_id_str, role=payload.get("role"))
    except JWTError:
        raise credentials_exception

    try:
        user_id = uuid.UUID(token_data.user_uuid)
    except (ValueError, AttributeError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user
```

- [ ] **Step 2: Update auth/endpoint.py — JWT payload and login response use `str(user.id)`**

In `login()`, replace lines 80-92:

```python
    access_token = security.create_access_token(data={
        "sub": str(user.id),
        "role": user.role,
        "email": user.email
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_uuid": str(user.id),
        "username": user.username
    }
```

- [ ] **Step 3: Update admin/endpoint.py — admin delete self check**

The admin endpoint at line 89 compares `current_admin.user_uuid == user_uuid`. After migration `user_uuid` field is gone. Update lines 82-103 to compare UUIDs using the path param:

In `delete_user`, the route is `/users/{user_uuid}` where `user_uuid: str`. That's fine — keep as string comparison since `str(user.id)` gives the same string. No change needed here since both sides are compared as strings.

Similarly `toggle_user_active` and `change_user_role` use `User.user_uuid == user_uuid` in DB filter. Replace those queries:

Find line 54: `user = db.query(User).filter(User.user_uuid == user_uuid).first()`
Replace with: `user = db.query(User).filter(User.id == uuid.UUID(user_uuid)).first()`

Find line 72: `user = db.query(User).filter(User.user_uuid == user_uuid).first()`
Replace with: `user = db.query(User).filter(User.id == uuid.UUID(user_uuid)).first()`

Find line 89: `if current_admin.user_uuid == user_uuid:`
Replace with: `if str(current_admin.id) == user_uuid:`

Find line 92: `user = db.query(User).filter(User.user_uuid == user_uuid).first()`
Replace with: `user = db.query(User).filter(User.id == uuid.UUID(user_uuid)).first()`

Find line 365: `user = db.query(User).filter(User.user_uuid == user_uuid).first()`
Replace with: `user = db.query(User).filter(User.id == uuid.UUID(user_uuid)).first()`

Add `import uuid` to `admin/endpoint.py` imports.

- [ ] **Step 4: Commit**

```bash
git add app/internal/deps.py app/api/auth/endpoint.py app/api/admin/endpoint.py
git commit -m "feat: update JWT lookup and admin user queries to use UUID id instead of user_uuid"
```

---

## Task 4: Update admin/endpoint.py — integer path params to UUID

**Files:**
- Modify: `backend/app/api/admin/endpoint.py`

- [ ] **Step 1: Add UUID import and update integer path params**

Add to imports at the top:

```python
from uuid import UUID
```

Find line 176: `provider_id: int,`
Replace with: `provider_id: UUID,`

Find line 280: `booking_id: int,`
Replace with: `booking_id: UUID,`

Find line 316: `provider_id: int,`
Replace with: `provider_id: UUID,`

The DB filter calls like `.filter(ServiceProvider.id == provider_id)` and `.filter(ServiceBooking.id == booking_id)` do not need to change — SQLAlchemy handles UUID comparison natively.

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/endpoint.py
git commit -m "feat: update admin endpoint integer path params to UUID"
```

---

## Task 5: Update admin/emergency_endpoint.py

**Files:**
- Modify: `backend/app/api/admin/emergency_endpoint.py`

- [ ] **Step 1: Add UUID import and update integer path params**

Add to imports:

```python
from uuid import UUID
```

Find line 61: `config_id: int,`
Replace with: `config_id: UUID,`

Find line 136: `request_id: int,`
Replace with: `request_id: UUID,`

Find line 153: `provider_id: int,`
Replace with: `provider_id: UUID,`

Find line 183: `provider_id: int,`
Replace with: `provider_id: UUID,`

Find line 206: `provider_id: int,`
Replace with: `provider_id: UUID,`

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/emergency_endpoint.py
git commit -m "feat: update admin emergency endpoint integer path params to UUID"
```

---

## Task 6: Update booking/endpoint.py

**Files:**
- Modify: `backend/app/api/booking/endpoint.py`

- [ ] **Step 1: Add UUID import and update all `booking_id: int` path params**

Add to imports:

```python
from uuid import UUID
```

Find and replace ALL occurrences (lines 138, 204, 228, 271, 314, 349, 394, 403):

```
booking_id: int,
```
→
```
booking_id: UUID,
```

There are 8 occurrences total. Use search-and-replace within the file.

- [ ] **Step 2: Commit**

```bash
git add app/api/booking/endpoint.py
git commit -m "feat: update booking endpoint integer path params to UUID"
```

---

## Task 7: Update request/endpoint.py

**Files:**
- Modify: `backend/app/api/request/endpoint.py`

- [ ] **Step 1: Add UUID import and update integer path params**

Add to imports:

```python
from uuid import UUID
```

Replace ALL occurrences of `request_id: int,` → `request_id: UUID,` (lines 182, 201, 223, 286, 414, 460).

Replace ALL occurrences of `response_id: int,` → `response_id: UUID,` (lines 287, 415).

The internal helper `_notify(db, user_id: int, ...)` does not need to change — Python does not enforce type hints at runtime and the value passed will be a UUID object which SQLAlchemy handles correctly. However, for clarity, change `user_id: int` → `user_id` (remove type hint) in the `_notify` signature at line 28.

- [ ] **Step 2: Commit**

```bash
git add app/api/request/endpoint.py
git commit -m "feat: update request endpoint integer path params to UUID"
```

---

## Task 8: Update service/endpoint.py

**Files:**
- Modify: `backend/app/api/service/endpoint.py`

- [ ] **Step 1: Add UUID import and update all integer path params**

Add to imports:

```python
from uuid import UUID
```

Replace ALL occurrences of `society_id: int,` → `society_id: UUID,` (lines 74, 97, 120, 485, 508, 555, 645, 670).

Replace ALL occurrences of `provider_id: int,` → `provider_id: UUID,` (lines 508 second param, 509, 646).

Replace `cert_id: int,` → `cert_id: UUID,` (line 408).

Replace `request_id: int,` → `request_id: UUID,` (line 615).

Replace `booking_id: int,` → `booking_id: UUID,` (line 724).

- [ ] **Step 2: Commit**

```bash
git add app/api/service/endpoint.py
git commit -m "feat: update service endpoint integer path params to UUID"
```

---

## Task 9: Update emergency, task, notification, secretary endpoints

**Files:**
- Modify: `backend/app/api/emergency/endpoint.py`
- Modify: `backend/app/api/task/endpoint.py`
- Modify: `backend/app/api/notification/endpoint.py`
- Modify: `backend/app/api/secretary/endpoint.py`

- [ ] **Step 1: Update emergency/endpoint.py**

Add to imports: `from uuid import UUID`

Replace ALL `request_id: int,` → `request_id: UUID,` (lines 218, 235, 322, 379, 440).
Replace `response_id: int,` → `response_id: UUID,` (line 236).

The internal `_notify` helper at line 24 takes `user_id: int` — remove the `: int` type hint for consistency.

- [ ] **Step 2: Update task/endpoint.py**

Add to imports: `from uuid import UUID`

Replace ALL `task_id: int,` → `task_id: UUID,` (lines 60, 151, 190).

- [ ] **Step 3: Update notification/endpoint.py**

Add to imports: `from uuid import UUID`

Replace ALL `notification_id: int,` → `notification_id: UUID,` (lines 19, 38).

- [ ] **Step 4: Update secretary/endpoint.py**

Add to imports: `from uuid import UUID`

Replace `member_id: int,` → `member_id: UUID,` (line 125).

- [ ] **Step 5: Commit all**

```bash
git add app/api/emergency/endpoint.py app/api/task/endpoint.py app/api/notification/endpoint.py app/api/secretary/endpoint.py
git commit -m "feat: update emergency, task, notification, secretary endpoints to UUID path params"
```

---

## Task 10: Write the Alembic migration file

**Files:**
- Create: `backend/alembic/versions/06_04_2026_uuid_primary_keys.py`

- [ ] **Step 1: Create the migration file**

Create `backend/alembic/versions/06_04_2026_uuid_primary_keys.py` with the following content:

```python
"""UUID primary keys — replace all Integer PKs and FKs with PostgreSQL UUID

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Drop everything in safe reverse-FK order ───────────────────────
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_star_adjustments CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_penalty_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_recipients CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS notifications CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS maintenance_tasks CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_reviews CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_chats CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_status_history CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_bookings CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_certificates CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_trusted_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS societies CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))

    # ── 2. Recreate with UUID PKs ──────────────────────────────────────────
    # users — create without society_id FK first (circular with societies)
    conn.execute(sa.text("""
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR,
            email VARCHAR UNIQUE NOT NULL,
            hashed_password VARCHAR NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            role VARCHAR DEFAULT 'USER',
            society_id UUID,
            home_number VARCHAR,
            resident_name VARCHAR
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_users_id ON users (id)"))
    conn.execute(sa.text("CREATE INDEX ix_users_username ON users (username)"))
    conn.execute(sa.text("CREATE UNIQUE INDEX ix_users_email ON users (email)"))

    # societies — references users (owner/secretary/manager)
    conn.execute(sa.text("""
        CREATE TABLE societies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR UNIQUE NOT NULL,
            address VARCHAR,
            secretary_name VARCHAR,
            is_legal BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            creator_role VARCHAR DEFAULT 'OWNER',
            registration_number VARCHAR UNIQUE,
            owner_id UUID REFERENCES users(id),
            secretary_id UUID REFERENCES users(id),
            manager_id UUID REFERENCES users(id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_societies_id ON societies (id)"))
    conn.execute(sa.text("CREATE UNIQUE INDEX ix_societies_name ON societies (name)"))

    # Now add the circular FK: users.society_id → societies.id
    conn.execute(sa.text("""
        ALTER TABLE users ADD CONSTRAINT fk_users_society_id
        FOREIGN KEY (society_id) REFERENCES societies(id)
    """))

    # service_providers — references users, societies
    conn.execute(sa.text("""
        CREATE TABLE service_providers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            company_name VARCHAR,
            owner_name VARCHAR,
            first_name VARCHAR,
            last_name VARCHAR,
            age FLOAT,
            gender VARCHAR,
            category VARCHAR,
            categories TEXT,
            phone VARCHAR,
            email VARCHAR,
            hourly_rate FLOAT DEFAULT 0.0,
            availability TEXT,
            bio TEXT,
            education VARCHAR,
            experience_years FLOAT DEFAULT 0,
            availability_status VARCHAR DEFAULT 'AVAILABLE',
            is_verified BOOLEAN DEFAULT FALSE,
            certification_url VARCHAR,
            qualification VARCHAR,
            government_id VARCHAR,
            location VARCHAR,
            profile_photo_url VARCHAR,
            rating FLOAT DEFAULT 5.0,
            society_id UUID REFERENCES societies(id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_providers_id ON service_providers (id)"))
    conn.execute(sa.text("CREATE INDEX ix_service_providers_company_name ON service_providers (company_name)"))
    conn.execute(sa.text("CREATE INDEX ix_service_providers_category ON service_providers (category)"))

    # service_certificates — references service_providers
    conn.execute(sa.text("""
        CREATE TABLE service_certificates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID REFERENCES service_providers(id),
            category VARCHAR,
            title VARCHAR,
            certificate_url VARCHAR,
            is_verified BOOLEAN DEFAULT FALSE,
            uploaded_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_certificates_id ON service_certificates (id)"))

    # society_trusted_providers — association table
    conn.execute(sa.text("""
        CREATE TABLE society_trusted_providers (
            society_id UUID REFERENCES societies(id),
            provider_id UUID REFERENCES service_providers(id),
            created_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (society_id, provider_id)
        )
    """))

    # service_bookings — references users, service_providers
    conn.execute(sa.text("""
        CREATE TABLE service_bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            provider_id UUID REFERENCES service_providers(id),
            service_type VARCHAR,
            scheduled_at TIMESTAMP,
            status VARCHAR DEFAULT 'Pending',
            priority VARCHAR DEFAULT 'Normal',
            issue_description TEXT,
            photos TEXT,
            estimated_cost FLOAT DEFAULT 0.0,
            final_cost FLOAT DEFAULT 0.0,
            actual_hours FLOAT,
            completion_notes TEXT,
            completion_photos TEXT,
            property_details TEXT,
            source_type VARCHAR,
            source_id UUID,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_bookings_id ON service_bookings (id)"))

    # booking_status_history — references service_bookings
    conn.execute(sa.text("""
        CREATE TABLE booking_status_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES service_bookings(id),
            status VARCHAR,
            notes TEXT,
            timestamp TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_booking_status_history_id ON booking_status_history (id)"))

    # booking_chats — references service_bookings, users
    conn.execute(sa.text("""
        CREATE TABLE booking_chats (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES service_bookings(id),
            sender_id UUID REFERENCES users(id),
            message TEXT,
            timestamp TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_booking_chats_id ON booking_chats (id)"))

    # booking_reviews — references service_bookings
    conn.execute(sa.text("""
        CREATE TABLE booking_reviews (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES service_bookings(id),
            rating FLOAT,
            review_text TEXT,
            photos TEXT,
            quality_rating FLOAT DEFAULT 5,
            punctuality_rating FLOAT DEFAULT 5,
            professionalism_rating FLOAT DEFAULT 5,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_booking_reviews_id ON booking_reviews (id)"))

    # maintenance_tasks — references users, service_providers, service_bookings
    conn.execute(sa.text("""
        CREATE TABLE maintenance_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR,
            description VARCHAR,
            due_date DATE,
            status VARCHAR DEFAULT 'Pending',
            priority VARCHAR DEFAULT 'Routine',
            category VARCHAR,
            location VARCHAR,
            task_type VARCHAR DEFAULT 'standard',
            booking_id UUID REFERENCES service_bookings(id),
            created_at TIMESTAMP DEFAULT NOW(),
            warning_sent BOOLEAN DEFAULT FALSE,
            final_sent BOOLEAN DEFAULT FALSE,
            overdue_sent BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMP,
            completion_method VARCHAR,
            user_id UUID REFERENCES users(id),
            service_provider_id UUID REFERENCES service_providers(id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_maintenance_tasks_id ON maintenance_tasks (id)"))
    conn.execute(sa.text("CREATE INDEX ix_maintenance_tasks_title ON maintenance_tasks (title)"))

    # notifications — references users
    conn.execute(sa.text("""
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            title VARCHAR,
            message TEXT,
            notification_type VARCHAR DEFAULT 'INFO',
            is_read BOOLEAN DEFAULT FALSE,
            link VARCHAR,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_notifications_id ON notifications (id)"))

    # society_requests — references societies, service_providers, users
    conn.execute(sa.text("""
        CREATE TABLE society_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id UUID REFERENCES societies(id),
            provider_id UUID REFERENCES service_providers(id),
            sender_id UUID REFERENCES users(id),
            status VARCHAR DEFAULT 'PENDING',
            message TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_society_requests_id ON society_requests (id)"))

    # service_requests — references users, service_bookings
    conn.execute(sa.text("""
        CREATE TABLE service_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            contact_name VARCHAR NOT NULL,
            contact_mobile VARCHAR NOT NULL,
            location VARCHAR NOT NULL,
            device_or_issue VARCHAR NOT NULL,
            description TEXT,
            photos TEXT,
            preferred_dates TEXT,
            urgency VARCHAR DEFAULT 'Normal',
            status VARCHAR DEFAULT 'OPEN',
            expires_at TIMESTAMP NOT NULL,
            resulting_booking_id UUID REFERENCES service_bookings(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_requests_id ON service_requests (id)"))

    # service_request_recipients — references service_requests, service_providers
    conn.execute(sa.text("""
        CREATE TABLE service_request_recipients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES service_requests(id),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            is_read BOOLEAN DEFAULT FALSE,
            notified_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_request_recipients_id ON service_request_recipients (id)"))

    # service_request_responses — references service_requests, service_providers
    conn.execute(sa.text("""
        CREATE TABLE service_request_responses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES service_requests(id),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            proposed_date TIMESTAMP NOT NULL,
            proposed_price FLOAT NOT NULL,
            estimated_hours FLOAT,
            message TEXT,
            status VARCHAR DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_request_responses_id ON service_request_responses (id)"))

    # emergency_config — references users
    conn.execute(sa.text("""
        CREATE TABLE emergency_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category VARCHAR UNIQUE NOT NULL,
            callout_fee FLOAT NOT NULL DEFAULT 0.0,
            hourly_rate FLOAT NOT NULL DEFAULT 0.0,
            updated_by UUID REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_config_id ON emergency_config (id)"))

    # emergency_penalty_config — references users
    conn.execute(sa.text("""
        CREATE TABLE emergency_penalty_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR UNIQUE NOT NULL,
            star_deduction FLOAT NOT NULL DEFAULT 0.5,
            updated_by UUID REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_penalty_config_id ON emergency_penalty_config (id)"))

    # emergency_requests — references users, emergency_config, service_bookings
    conn.execute(sa.text("""
        CREATE TABLE emergency_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            society_name VARCHAR NOT NULL,
            building_name VARCHAR NOT NULL,
            flat_no VARCHAR NOT NULL,
            landmark VARCHAR NOT NULL,
            full_address TEXT NOT NULL,
            category VARCHAR NOT NULL,
            description TEXT NOT NULL,
            device_name VARCHAR,
            photos TEXT,
            contact_name VARCHAR NOT NULL,
            contact_phone VARCHAR NOT NULL,
            status VARCHAR NOT NULL DEFAULT 'PENDING',
            config_id UUID REFERENCES emergency_config(id),
            expires_at TIMESTAMP NOT NULL,
            resulting_booking_id UUID REFERENCES service_bookings(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_requests_id ON emergency_requests (id)"))
    conn.execute(sa.text("CREATE INDEX ix_emergency_requests_status ON emergency_requests (status)"))

    # emergency_responses — references emergency_requests, service_providers
    conn.execute(sa.text("""
        CREATE TABLE emergency_responses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES emergency_requests(id),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            arrival_time TIMESTAMP NOT NULL,
            status VARCHAR NOT NULL DEFAULT 'PENDING',
            penalty_count FLOAT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_responses_id ON emergency_responses (id)"))
    conn.execute(sa.text("CREATE INDEX ix_emergency_responses_status ON emergency_responses (status)"))

    # emergency_star_adjustments — references service_providers, users, emergency_requests
    conn.execute(sa.text("""
        CREATE TABLE emergency_star_adjustments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            adjusted_by UUID NOT NULL REFERENCES users(id),
            delta FLOAT NOT NULL,
            reason TEXT NOT NULL,
            event_type VARCHAR NOT NULL,
            emergency_request_id UUID REFERENCES emergency_requests(id),
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_star_adjustments_id ON emergency_star_adjustments (id)"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_star_adjustments CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_penalty_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_recipients CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS notifications CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS maintenance_tasks CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_reviews CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_chats CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_status_history CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_bookings CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_certificates CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_trusted_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS societies CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))
```

- [ ] **Step 2: Commit**

```bash
git add alembic/versions/06_04_2026_uuid_primary_keys.py
git commit -m "feat: add Alembic migration to recreate all tables with UUID primary keys"
```

---

## Task 11: Run migration and verify

**Files:** None — this task runs commands only.

- [ ] **Step 1: Ensure backend virtual environment is active and DB is accessible**

```bash
cd backend
# Confirm DB is reachable
alembic current
```

Expected: shows the current revision (e.g. `f2a3b4c5d6e7`), or `<base>` if tables never existed.

- [ ] **Step 2: Run the migration**

```bash
alembic upgrade head
```

Expected output ends with:
```
Running upgrade ... -> a1b2c3d4e5f6, UUID primary keys — replace all Integer PKs and FKs with PostgreSQL UUID
```

If alembic current shows no revision (clean DB), stamp first:
```bash
alembic stamp f2a3b4c5d6e7
alembic upgrade head
```

- [ ] **Step 3: Verify the schema in psql**

```bash
psql -d homecare_db -c "\d users"
```

Expected: `id` column shows type `uuid`, no `user_uuid` column present.

```bash
psql -d homecare_db -c "\d service_bookings"
```

Expected: `id`, `user_id`, `provider_id`, `source_id` all show type `uuid`.

- [ ] **Step 4: Start the backend and verify no import errors**

```bash
uvicorn app.main:app --reload --port 8000
```

Expected: server starts with no errors. No `AttributeError: 'User' object has no attribute 'user_uuid'` errors.

- [ ] **Step 5: Test signup and login via API**

```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"Test@1234","role":"USER"}'
```

Expected: response contains `"id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"` (UUID format), no `user_uuid` field.

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@1234"}'
```

Expected: response contains `"user_uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"` (UUID string, for frontend compatibility).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verified UUID migration — all tables use UUID PKs, backend starts cleanly"
```

# Backend Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `backend/app/` from a flat monolithic layout into a domain-driven structure where every module owns its models, services, and API layer independently.

**Architecture:** Keep `backend/` as the Python root so `uvicorn app.main:app` and Docker config stay unchanged. Split `core/database.py` into `core/db/base.py` + `core/db/session.py`. Move shared deps/constants into `app/common/`. Split the monolithic `internal/models.py` and `internal/schemas.py` across per-domain files. Rename all `endpoint.py` → `endpoints.py` and update every import path.

**Tech Stack:** FastAPI, SQLAlchemy 2.x (ORM mapped classes), Pydantic v2, Alembic, Python 3.11+

**IMPORTANT:** Never touch `.env`, `backend/.env`, `alembic.ini`, `docker-compose.yml`, or any migration version files.

---

## File Map

### Files to CREATE
| New Path | Source |
|---|---|
| `app/core/db/__init__.py` | empty |
| `app/core/db/base.py` | extracted from `core/database.py` |
| `app/core/db/session.py` | extracted from `core/database.py` |
| `app/common/__init__.py` | empty |
| `app/common/deps.py` | moved from `internal/deps.py` |
| `app/common/constants.py` | extracted from `internal/services.py` |
| `app/auth/__init__.py` | empty |
| `app/auth/domain/__init__.py` | empty |
| `app/auth/domain/model.py` | split from `internal/models.py` — User, Society |
| `app/auth/services.py` | thin — auth helpers |
| `app/service/__init__.py` | empty |
| `app/service/domain/__init__.py` | empty |
| `app/service/domain/model.py` | split from `internal/models.py` — ServiceProvider, ServiceCertificate, SocietyRequest, ProviderPoints, society_trusted_providers |
| `app/service/services.py` | moved from `internal/services.py` — find_verified_provider, get_provider_display_name |
| `app/service/point_engine.py` | moved from `internal/point_engine.py` |
| `app/booking/__init__.py` | empty |
| `app/booking/domain/__init__.py` | empty |
| `app/booking/domain/model.py` | split from `internal/models.py` — ServiceBooking, BookingStatusHistory, BookingChat, BookingReview |
| `app/booking/services.py` | thin |
| `app/maintenance/__init__.py` | empty |
| `app/maintenance/domain/__init__.py` | empty |
| `app/maintenance/domain/model.py` | split from `internal/models.py` — MaintenanceTask |
| `app/maintenance/services.py` | thin |
| `app/notification/__init__.py` | empty |
| `app/notification/domain/__init__.py` | empty |
| `app/notification/domain/model.py` | split from `internal/models.py` — Notification |
| `app/notification/services.py` | thin |
| `app/request/__init__.py` | empty |
| `app/request/domain/__init__.py` | empty |
| `app/request/domain/model.py` | split from `internal/models.py` — ServiceRequest, ServiceRequestRecipient, ServiceRequestResponse |
| `app/request/services.py` | thin |
| `app/emergency/__init__.py` | empty |
| `app/emergency/domain/__init__.py` | empty |
| `app/emergency/domain/model.py` | split from `internal/models.py` — EmergencyConfig, EmergencyPenaltyConfig, EmergencyRequest, EmergencyResponse, EmergencyStarAdjustment |
| `app/emergency/services.py` | moved from `internal/services.py` — apply_star_delta, calculate_emergency_bill |
| `app/secretary/__init__.py` | empty |
| `app/secretary/services.py` | thin |
| `app/admin/__init__.py` | empty |
| `app/admin/services.py` | thin |
| `app/api/auth/schemas.py` | split from `internal/schemas.py` |
| `app/api/user/schemas.py` | split from `internal/schemas.py` |
| `app/api/service/schemas.py` | split from `internal/schemas.py` |
| `app/api/booking/schemas.py` | split from `internal/schemas.py` |
| `app/api/maintenance/__init__.py` | empty |
| `app/api/maintenance/schemas.py` | split from `internal/schemas.py` |
| `app/api/maintenance/endpoints.py` | moved from `api/task/endpoint.py` |
| `app/api/admin/schemas.py` | split from `internal/schemas.py` |
| `app/api/emergency/schemas.py` | split from `internal/schemas.py` |
| `app/api/secretary/schemas.py` | split from `internal/schemas.py` |
| `app/api/request/schemas.py` | split from `internal/schemas.py` |
| `app/api/notification/schemas.py` | split from `internal/schemas.py` |
| `app/api/ai/schemas.py` | inline Pydantic model extracted from endpoint |

### Files to MODIFY (imports only, logic untouched)
| Path | What changes |
|---|---|
| `app/core/scheduler.py` | imports: database → db.session, internal.models → domain models |
| `app/api/auth/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/user/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/service/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/service/analytics_endpoint.py` → renamed `analytics_endpoints.py` | imports + file renamed |
| `app/api/booking/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/admin/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/admin/emergency_endpoint.py` → renamed `emergency_endpoints.py` | imports + file renamed |
| `app/api/emergency/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/secretary/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/request/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/notification/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/api/ai/endpoint.py` → renamed `endpoints.py` | imports + file renamed |
| `app/main.py` | router import paths |
| `alembic/env.py` | Base import + domain model imports |

### Files to DELETE (after all above is done)
- `app/internal/models.py`
- `app/internal/schemas.py`
- `app/internal/deps.py`
- `app/internal/services.py`
- `app/internal/point_engine.py`
- `app/internal/__init__.py`
- `app/core/database.py`
- `app/api/task/` (entire folder — moved to `api/maintenance/`)
- All old `endpoint.py` files (after new `endpoints.py` confirmed working)

---

## Task 1: Create `core/db/` — Split database.py

**Files:**
- Create: `app/core/db/__init__.py`
- Create: `app/core/db/base.py`
- Create: `app/core/db/session.py`

- [ ] **Step 1: Create `app/core/db/__init__.py`** (empty package marker)

```python
```

- [ ] **Step 2: Create `app/core/db/base.py`**

```python
from sqlalchemy.orm import declarative_base

Base = declarative_base()
```

- [ ] **Step 3: Create `app/core/db/session.py`**

```python
import logging
import threading
import time
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.db.base import Base

logger = logging.getLogger(__name__)

engine = None
SessionLocal = None

_retry_thread: threading.Thread | None = None


def _build_engine():
    urls_to_try = [
        settings.DATABASE_URL,
        settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql+psycopg2://"),
        settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://"),
    ]
    seen = set()
    unique_urls = []
    for u in urls_to_try:
        if u not in seen:
            seen.add(u)
            unique_urls.append(u)

    for url in unique_urls:
        try:
            eng = create_engine(
                url,
                echo=False,
                pool_pre_ping=True,
                pool_recycle=1800,
                connect_args={"connect_timeout": 10},
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("✅ Database connected via: %s", url.split("@")[-1])
            return eng
        except Exception as e:
            logger.warning("⚠️  Could not connect with URL (%s): %s", url.split("@")[-1], e)

    return None


def _apply_engine(eng):
    global engine, SessionLocal
    engine = eng
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    try:
        # Import all domain models to register them with Base.metadata
        from app.auth.domain import model as _auth  # noqa
        from app.service.domain import model as _service  # noqa
        from app.booking.domain import model as _booking  # noqa
        from app.maintenance.domain import model as _maintenance  # noqa
        from app.notification.domain import model as _notification  # noqa
        from app.request.domain import model as _request  # noqa
        from app.emergency.domain import model as _emergency  # noqa

        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created/verified.")
    except Exception as e:
        logger.warning("⚠️  create_all failed: %s", e)

    try:
        from app.core import security
        from app.core.config import settings as cfg
        from app.auth.domain.model import User
        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.email == cfg.SUPERADMIN_EMAIL).first()
            if not existing:
                admin = User(
                    username=cfg.SUPERADMIN_USERNAME,
                    email=cfg.SUPERADMIN_EMAIL,
                    hashed_password=security.get_password_hash(cfg.SUPERADMIN_PASSWORD),
                    role="ADMIN",
                    is_active=True,
                )
                db.add(admin)
                db.commit()
                logger.info("✅ Superadmin seeded: %s", cfg.SUPERADMIN_EMAIL)
        finally:
            db.close()
    except Exception as e:
        logger.warning("⚠️  Could not seed superadmin: %s", e)


def _retry_loop():
    global engine
    attempt = 0
    while True:
        time.sleep(5)
        if engine is not None:
            break
        attempt += 1
        logger.info("🔄 DB retry attempt #%d ...", attempt)
        eng = _build_engine()
        if eng is not None:
            _apply_engine(eng)
            logger.info("✅ Database auto-reconnected after %d attempt(s).", attempt)
            break
        else:
            logger.warning("⏳ DB still unavailable, retrying in 5s ...")


def init_db() -> bool:
    global _retry_thread
    eng = _build_engine()
    if eng is not None:
        _apply_engine(eng)
        return True

    logger.warning(
        "⚠️  DB unavailable at startup — background retry started. "
        "API will return 503 until the database is reachable."
    )
    _retry_thread = threading.Thread(target=_retry_loop, daemon=True, name="db-retry")
    _retry_thread.start()
    return False
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/db/
git commit -m "refactor: split core/database.py into core/db/base.py and core/db/session.py"
```

---

## Task 2: Create `common/` — Deps and Constants

**Files:**
- Create: `app/common/__init__.py`
- Create: `app/common/deps.py`
- Create: `app/common/constants.py`

- [ ] **Step 1: Create `app/common/__init__.py`** (empty)

```python
```

- [ ] **Step 2: Create `app/common/deps.py`**

```python
import uuid
from typing import Generator, List
from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core import security
from app.auth.domain.model import User
from app.api.auth.schemas import TokenData


def get_db() -> Generator:
    """Provide a database session for each request, then close it."""
    from app.core.db.session import SessionLocal
    if SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable. Please ensure the database server is running.",
        )
    db = SessionLocal()
    try:
        yield db
    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="Database connection lost. Please try again in a moment.",
        )
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(security.oauth2_scheme)
) -> User:
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


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {self.allowed_roles}"
            )
        return user
```

- [ ] **Step 3: Create `app/common/constants.py`**

```python
"""Shared constants used across multiple modules."""

BOOKING_CONFLICT_WINDOW_HOURS = 3
EMERGENCY_RATE_MULTIPLIER = 1.5

ALLOWED_CATEGORIES = [
    "AC Service",
    "Appliance Repair",
    "Home Cleaning",
    "Plumbing",
    "Electrical",
    "Pest Control",
    "Painting",
    "Carpentry",
    "General Maintenance",
]

ROUTINE_CATEGORY_MAP: dict[str, list[str]] = {
    "AC Service": ["HVAC", "Air Conditioning", "AC Service"],
    "Appliance Repair": ["Appliance Repair", "Electrical", "General"],
    "Home Cleaning": ["Cleaning", "Home Cleaning"],
    "Plumbing": ["Plumbing"],
    "Electrical": ["Electrical"],
    "Pest Control": ["Pest Control"],
    "Painting": ["Painting"],
    "Carpentry": ["Carpentry"],
    "General Maintenance": ["General", "General Maintenance"],
}

EMERGENCY_CATEGORIES = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
]
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/common/
git commit -m "refactor: create common/ package with deps and constants"
```

---

## Task 3: Create Domain Model Files

**Files:** 7 domain packages with `__init__.py` + `model.py`

All model files import `Base` from `app.core.db.base`. All cross-domain relationships use string names (e.g. `relationship("User", ...)`).

- [ ] **Step 1: Create `app/auth/__init__.py`** and **`app/auth/domain/__init__.py`** (both empty)

- [ ] **Step 2: Create `app/auth/domain/model.py`**

```python
import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base

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

    society = relationship("Society", back_populates="users", foreign_keys="[User.society_id]")
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
```

- [ ] **Step 3: Create `app/service/__init__.py`** and **`app/service/domain/__init__.py`** (both empty)

- [ ] **Step 4: Create `app/service/domain/model.py`**

```python
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
```

- [ ] **Step 5: Create `app/booking/__init__.py`** and **`app/booking/domain/__init__.py`** (both empty)

- [ ] **Step 6: Create `app/booking/domain/model.py`**

```python
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
    rating = Column(Integer)
    review_text = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)

    quality_rating = Column(Integer, default=5)
    punctuality_rating = Column(Integer, default=5)
    professionalism_rating = Column(Integer, default=5)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("ServiceBooking", back_populates="review")
```

- [ ] **Step 7: Create `app/maintenance/__init__.py`** and **`app/maintenance/domain/__init__.py`** (both empty)

- [ ] **Step 8: Create `app/maintenance/domain/model.py`**

```python
import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Date
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

- [ ] **Step 9: Create `app/notification/__init__.py`** and **`app/notification/domain/__init__.py`** (both empty)

- [ ] **Step 10: Create `app/notification/domain/model.py`**

```python
import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


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

- [ ] **Step 11: Create `app/request/__init__.py`** and **`app/request/domain/__init__.py`** (both empty)

- [ ] **Step 12: Create `app/request/domain/model.py`**

```python
import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Float
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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    request = relationship("ServiceRequest", back_populates="responses")
    provider = relationship("ServiceProvider", back_populates="submitted_responses")
```

- [ ] **Step 13: Create `app/emergency/__init__.py`** and **`app/emergency/domain/__init__.py`** (both empty)

- [ ] **Step 14: Create `app/emergency/domain/model.py`**

```python
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
```

- [ ] **Step 15: Create remaining domain `__init__.py` files**

Create empty files:
- `app/secretary/__init__.py`
- `app/admin/__init__.py`

- [ ] **Step 16: Commit all domain models**

```bash
git add backend/app/auth/ backend/app/service/ backend/app/booking/ backend/app/maintenance/ backend/app/notification/ backend/app/request/ backend/app/emergency/ backend/app/secretary/ backend/app/admin/
git commit -m "refactor: split internal/models.py into per-domain model files"
```

---

## Task 4: Create Service Helpers and Point Engine

**Files:**
- Create: `app/service/point_engine.py`
- Create: `app/service/services.py`
- Create: `app/emergency/services.py`
- Create: `app/auth/services.py`
- Create: `app/booking/services.py`
- Create: `app/maintenance/services.py`
- Create: `app/notification/services.py`
- Create: `app/request/services.py`
- Create: `app/secretary/services.py`
- Create: `app/admin/services.py`

- [ ] **Step 1: Create `app/service/point_engine.py`**

```python
"""Point engine — awards/deducts points for a provider and recalculates their star rating."""

import uuid
import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.service.domain.model import ServiceProvider, ProviderPoints
from app.notification.domain.model import Notification


POINTS = {
    "EMERGENCY_COMPLETE": 35.0,
    "URGENT_COMPLETE": 20.0,
    "REGULAR_COMPLETE": 15.0,
    "EMERGENCY_CANCEL": -20.0,
    "REGULAR_CANCEL": -10.0,
    "FEEDBACK_5_STAR": 10.0,
    "FEEDBACK_4_STAR": 8.0,
    "FEEDBACK_3_STAR": 5.0,
    "FEEDBACK_2_STAR": 2.0,
    "FEEDBACK_1_STAR": 0.0,
    "REVIEW_WRITTEN": 2.0,
}

POINTS_PER_STAR = 100.0


def award_points(
    db: Session,
    provider_id: uuid.UUID,
    event_type: str,
    source_id: Optional[uuid.UUID] = None,
    note: Optional[str] = None,
    custom_delta: Optional[float] = None,
) -> None:
    """
    Insert a provider_points row and recalculate ServiceProvider.rating.
    Uses custom_delta if provided, otherwise looks up the event_type in POINTS.
    Commits all changes.
    """
    delta = custom_delta if custom_delta is not None else POINTS.get(event_type, 0.0)
    if delta == 0.0 and event_type not in ("FEEDBACK_1_STAR", "ADMIN_ADJUSTMENT"):
        return

    row = ProviderPoints(
        id=uuid.uuid4(),
        provider_id=provider_id,
        delta=delta,
        event_type=event_type,
        source_id=source_id,
        note=note,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(row)

    existing_total: float = db.query(func.sum(ProviderPoints.delta)).filter(
        ProviderPoints.provider_id == provider_id
    ).scalar() or 0.0
    total = existing_total + delta

    new_rating = max(0.0, total / POINTS_PER_STAR)

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if provider:
        provider.rating = round(new_rating, 2)
        if new_rating >= 10.0 and not provider.is_verified:
            provider.is_verified = True
            notif = Notification(
                id=uuid.uuid4(),
                user_id=provider.user_id,
                title="You've been automatically verified!",
                message=(
                    "Congratulations! You've earned 10 stars through your outstanding work. "
                    "Your profile is now automatically verified."
                ),
                notification_type="SYSTEM",
                is_read=False,
                created_at=datetime.datetime.utcnow(),
            )
            db.add(notif)

    db.commit()
```

- [ ] **Step 2: Create `app/service/services.py`**

```python
"""Service domain business logic helpers."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.service.domain.model import ServiceProvider, ServiceCertificate
from app.booking.domain.model import ServiceBooking
from app.common.constants import BOOKING_CONFLICT_WINDOW_HOURS, ROUTINE_CATEGORY_MAP


def get_provider_display_name(provider: ServiceProvider) -> str:
    """Return a human-readable name for a provider."""
    return (
        provider.first_name
        or provider.company_name
        or provider.owner_name
        or "Unknown Provider"
    )


def find_verified_provider(
    db: Session,
    category: Optional[str],
    location: Optional[str] = None,
    society_id: Optional[int] = None,
) -> Optional[ServiceProvider]:
    """Find the best available verified provider with a matching certificate."""
    if not category:
        return None

    mapped_categories = ROUTINE_CATEGORY_MAP.get(category, [category])
    category_filters = []
    for cat in mapped_categories:
        category_filters.append(ServiceProvider.category == cat)
        category_filters.append(ServiceProvider.categories.like(f"%{cat}%"))

    query = db.query(ServiceProvider).filter(
        or_(*category_filters),
        ServiceProvider.is_verified == True,
        ServiceProvider.availability_status == "AVAILABLE",
    )

    cert_category_filters = []
    for cat in mapped_categories:
        cert_category_filters.append(ServiceCertificate.category.ilike(f"%{cat}%"))
    query = query.join(ServiceCertificate).filter(or_(*cert_category_filters))

    if location:
        query = query.filter(ServiceProvider.location.ilike(f"%{location}%"))

    if society_id:
        query = query.filter(
            (ServiceProvider.society_id == society_id)
            | (ServiceProvider.society_id == None)
        )

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)
    window_end = now + timedelta(hours=BOOKING_CONFLICT_WINDOW_HOURS)

    providers = query.order_by(ServiceProvider.rating.desc()).all()
    for provider in providers:
        conflict = (
            db.query(ServiceBooking)
            .filter(
                ServiceBooking.provider_id == provider.id,
                ServiceBooking.status.in_(["Pending", "Accepted", "In Progress"]),
                ServiceBooking.scheduled_at >= window_start,
                ServiceBooking.scheduled_at <= window_end,
            )
            .first()
        )
        if not conflict:
            return provider

    return None
```

- [ ] **Step 3: Create `app/emergency/services.py`**

```python
"""Emergency domain business logic helpers."""

from app.service.domain.model import ServiceProvider


def calculate_emergency_bill(callout_fee: float, hourly_rate: float, actual_hours: float) -> float:
    """
    Billing formula:
      - callout_fee covers the first hour (minimum charge)
      - each hour beyond the first is billed at hourly_rate
    """
    extra_hours = max(0.0, actual_hours - 1.0)
    return callout_fee + (extra_hours * hourly_rate)


def apply_star_delta(provider: ServiceProvider, delta: float) -> None:
    """Mutates provider.rating, clamped to [0.0, ∞). Caller must commit."""
    provider.rating = max(0.0, provider.rating + delta)
```

- [ ] **Step 4: Create thin services files for remaining domains**

`app/auth/services.py`:
```python
"""Auth domain services."""
```

`app/booking/services.py`:
```python
"""Booking domain services."""
```

`app/maintenance/services.py`:
```python
"""Maintenance domain services."""
```

`app/notification/services.py`:
```python
"""Notification domain services."""
```

`app/request/services.py`:
```python
"""Service request domain services."""
```

`app/secretary/services.py`:
```python
"""Secretary domain services."""
```

`app/admin/services.py`:
```python
"""Admin domain services."""
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/service/point_engine.py backend/app/service/services.py backend/app/emergency/services.py backend/app/auth/services.py backend/app/booking/services.py backend/app/maintenance/services.py backend/app/notification/services.py backend/app/request/services.py backend/app/secretary/services.py backend/app/admin/services.py
git commit -m "refactor: extract service helpers, point engine, and domain services"
```

---

## Task 5: Create API Schema Files

**Files:** 11 schema files, each containing the schemas from `internal/schemas.py` scoped to their domain. Cross-domain references (e.g. `ProviderResponse` used in booking schemas) are handled via imports.

- [ ] **Step 1: Create `app/api/auth/schemas.py`**

```python
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRole(str, Enum):
    USER = "USER"
    SERVICER = "SERVICER"
    ADMIN = "ADMIN"
    SECRETARY = "SECRETARY"


class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: Optional[UserRole] = UserRole.USER


class UserCreate(UserBase):
    password: str
    society_name: Optional[str] = None
    society_address: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    society_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_uuid: str
    username: str


class TokenData(BaseModel):
    user_uuid: Optional[str] = None
    role: Optional[str] = None


class ForgotPassword(BaseModel):
    email: EmailStr
    new_password: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str
```

- [ ] **Step 2: Create `app/api/user/schemas.py`**

```python
# User API re-exports auth schemas relevant to user profile endpoints
from app.api.auth.schemas import UserResponse, ChangePassword  # noqa: F401
```

- [ ] **Step 3: Create `app/api/service/schemas.py`**

```python
import json
from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class SocietyBase(BaseModel):
    name: str
    address: str
    registration_number: Optional[str] = None
    secretary_name: Optional[str] = None
    is_legal: bool = True
    creator_role: str = "OWNER"


class SocietyCreate(SocietyBase):
    pass


class SocietyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    registration_number: Optional[str] = None
    secretary_name: Optional[str] = None
    is_legal: Optional[bool] = None


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


class SocietyDetailResponse(SocietyResponse):
    registration_number: Optional[str] = None


class CertificateBase(BaseModel):
    category: str
    title: Optional[str] = None
    certificate_url: str
    is_verified: bool = False


class CertificateCreate(CertificateBase):
    pass


class CertificateResponse(CertificateBase):
    id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ProviderBase(BaseModel):
    company_name: Optional[str] = "Unknown"
    owner_name: Optional[str] = "Unknown"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    category: Optional[str] = "General"
    categories: Optional[List[str]] = []
    phone: Optional[str] = ""
    email: Optional[str] = ""
    hourly_rate: Optional[float] = 0.0
    availability: Optional[str] = None
    bio: Optional[str] = None
    education: Optional[str] = None
    experience_years: Optional[int] = 0
    availability_status: Optional[str] = "AVAILABLE"
    qualification: Optional[str] = None
    government_id: Optional[str] = None
    certification_url: Optional[str] = None
    location: Optional[str] = None
    profile_photo_url: Optional[str] = None
    society_id: Optional[UUID] = None


class ProviderCreate(ProviderBase):
    company_name: str = "Unknown"
    owner_name: str = "Unknown"
    category: str = "General"
    phone: str = ""
    email: str = ""


class ProviderResponse(ProviderBase):
    id: UUID
    user_id: Optional[UUID] = None
    is_verified: Optional[bool] = False
    rating: Optional[float] = 0.0
    completed_jobs: Optional[int] = 0
    emergency_jobs: Optional[int] = 0
    certificates: List[CertificateResponse] = []

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


class ProviderUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    education: Optional[str] = None
    experience_years: Optional[int] = None
    categories: Optional[List[str]] = None
    hourly_rate: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    profile_photo_url: Optional[str] = None


class AvailabilityUpdate(BaseModel):
    status: str


class SocietyRequestBase(BaseModel):
    society_id: UUID
    provider_id: UUID
    message: Optional[str] = None


class SocietyRequestCreate(SocietyRequestBase):
    pass


class SocietyRequestResponse(SocietyRequestBase):
    id: UUID
    sender_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SocietyRequestAction(BaseModel):
    status: str


class PointLogEntry(BaseModel):
    created_at: Optional[datetime] = None
    event_type: str
    delta: float
    note: Optional[str] = None

    class Config:
        from_attributes = True


class MonthlyStatEntry(BaseModel):
    month: str
    jobs: int
    points_earned: float
    rating_end: float


class PointsBreakdown(BaseModel):
    emergency: float = 0.0
    urgent: float = 0.0
    regular: float = 0.0
    feedback: float = 0.0
    penalties: float = 0.0


class ProviderAnalyticsRead(BaseModel):
    total_jobs: int
    emergency_jobs: int
    urgent_jobs: int
    regular_jobs: int
    cancelled_jobs: int
    total_points: float
    current_rating: float
    completion_rate: float
    points_breakdown: PointsBreakdown
    recent_point_log: List[PointLogEntry] = []
    monthly_stats: List[MonthlyStatEntry] = []
```

- [ ] **Step 4: Create `app/api/booking/schemas.py`**

```python
from uuid import UUID
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.api.service.schemas import ProviderResponse


class BookingBase(BaseModel):
    provider_id: UUID
    service_type: str
    scheduled_at: datetime
    priority: str = "Normal"
    issue_description: Optional[str] = None
    property_details: Optional[str] = None
    estimated_cost: float = 0.0


class BookingCreate(BookingBase):
    task_id: Optional[UUID] = None


class BookingUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class BookingStatusUpdate(BaseModel):
    status: str
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None


class BookingReschedule(BaseModel):
    new_date: datetime


class BookingCancel(BaseModel):
    reason: str


class BookingStatusHistoryRead(BaseModel):
    id: UUID
    status: str
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class ChatBase(BaseModel):
    message: str


class ChatCreate(ChatBase):
    pass


class ChatRead(ChatBase):
    id: UUID
    booking_id: UUID
    sender_id: UUID
    timestamp: datetime

    class Config:
        from_attributes = True


class ReviewBase(BaseModel):
    rating: int
    review_text: Optional[str] = None
    quality_rating: int = 5
    punctuality_rating: int = 5
    professionalism_rating: int = 5


class ReviewCreate(ReviewBase):
    pass


class ReviewRead(ReviewBase):
    id: UUID
    booking_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


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


class BookingDetailRead(BookingRead):
    status_history: List[BookingStatusHistoryRead] = []
    chats: List[ChatRead] = []
    review: Optional[ReviewRead] = None
    provider: ProviderResponse

    class Config:
        from_attributes = True


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

- [ ] **Step 5: Create `app/api/maintenance/schemas.py`**

```python
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


class RoutineTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    location: Optional[str] = None
    priority: str = "Routine"


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


class RoutineTaskAssign(BaseModel):
    provider_id: UUID
    scheduled_at: datetime
```

- [ ] **Step 6: Create `app/api/notification/schemas.py`**

```python
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str = "INFO"
    link: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_id: UUID


class NotificationResponse(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    is_read: bool
```

- [ ] **Step 7: Create `app/api/request/schemas.py`**

```python
import json
from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from app.api.service.schemas import ProviderResponse


class ServiceRequestCreate(BaseModel):
    provider_ids: List[UUID]
    contact_name: str
    contact_mobile: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str = "Normal"

    @field_validator("provider_ids")
    @classmethod
    def validate_provider_count(cls, v):
        if not (1 <= len(v) <= 10):
            raise ValueError("Must select between 1 and 10 providers")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate provider IDs are not allowed")
        return v

    @field_validator("urgency")
    @classmethod
    def validate_urgency(cls, v):
        allowed = {"Normal", "High", "Emergency"}
        if v not in allowed:
            raise ValueError(f"urgency must be one of: {', '.join(sorted(allowed))}")
        return v


class ServiceRequestResponseCreate(BaseModel):
    proposed_date: datetime
    proposed_price: float
    estimated_hours: Optional[float] = None
    message: Optional[str] = None

    @field_validator("proposed_price")
    @classmethod
    def validate_price(cls, v):
        if v <= 0:
            raise ValueError("proposed_price must be greater than 0")
        return v


class ServiceRequestRecipientRead(BaseModel):
    id: UUID
    provider_id: UUID
    is_read: bool
    notified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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


class ServiceRequestDetailRead(ServiceRequestRead):
    pass

    class Config:
        from_attributes = True


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

- [ ] **Step 8: Create `app/api/emergency/schemas.py`**

```python
import json
from uuid import UUID
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

from app.api.service.schemas import ProviderResponse

EMERGENCY_CATEGORY_OPTIONS = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
]


class EmergencyConfigCreate(BaseModel):
    category: str
    callout_fee: float
    hourly_rate: float

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EMERGENCY_CATEGORY_OPTIONS:
            raise ValueError(f"category must be one of: {EMERGENCY_CATEGORY_OPTIONS}")
        return v

    @field_validator("callout_fee", "hourly_rate")
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Fee/rate cannot be negative")
        return v


class EmergencyConfigUpdate(BaseModel):
    callout_fee: Optional[float] = None
    hourly_rate: Optional[float] = None

    @field_validator("callout_fee", "hourly_rate")
    @classmethod
    def validate_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Fee/rate cannot be negative")
        return v


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


class EmergencyPenaltyConfigUpdate(BaseModel):
    star_deduction: float

    @field_validator("star_deduction")
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("star_deduction cannot be negative")
        return v


class EmergencyPenaltyConfigRead(BaseModel):
    id: UUID
    event_type: str
    star_deduction: float
    updated_by: Optional[UUID] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmergencyRequestCreate(BaseModel):
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
    provider_ids: List[UUID]

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in EMERGENCY_CATEGORY_OPTIONS:
            raise ValueError(f"category must be one of: {EMERGENCY_CATEGORY_OPTIONS}")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description cannot be empty")
        if len(v) > 500:
            raise ValueError("description cannot exceed 500 characters")
        return v

    @field_validator("photos")
    @classmethod
    def validate_photos(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v and len(v) > 3:
            raise ValueError("Maximum 3 photos allowed")
        return v

    @field_validator("provider_ids")
    @classmethod
    def validate_providers(cls, v: List[UUID]) -> List[UUID]:
        if not v:
            raise ValueError("At least one provider must be selected")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate provider IDs are not allowed")
        return v


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


class EmergencyResponseCreate(BaseModel):
    arrival_time: datetime

    @field_validator("arrival_time")
    @classmethod
    def arrival_must_be_future(cls, v: datetime) -> datetime:
        if v <= datetime.utcnow():
            raise ValueError("arrival_time must be in the future")
        return v


class EmergencyStarAdjustCreate(BaseModel):
    delta: float
    reason: str

    @field_validator("delta")
    @classmethod
    def validate_delta_bounds(cls, v: float) -> float:
        if abs(v) > 5.0:
            raise ValueError("delta cannot exceed ±5.0 stars")
        return v

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("reason cannot be empty")
        return v


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


class AdminProviderStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


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

- [ ] **Step 9: Create `app/api/secretary/schemas.py`**

```python
from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from app.api.auth.schemas import UserResponse  # noqa: F401
from app.api.service.schemas import SocietyResponse, SocietyUpdate, ProviderResponse  # noqa: F401


class HomeAssign(BaseModel):
    home_number: str
    resident_name: str
```

- [ ] **Step 10: Create `app/api/admin/schemas.py`**

```python
from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from app.api.auth.schemas import UserResponse  # noqa: F401
from app.api.service.schemas import ProviderResponse  # noqa: F401
from app.api.emergency.schemas import (  # noqa: F401
    EmergencyConfigRead,
    EmergencyConfigCreate,
    EmergencyConfigUpdate,
    EmergencyPenaltyConfigRead,
    EmergencyPenaltyConfigUpdate,
    EmergencyStarAdjustCreate,
    EmergencyStarAdjustRead,
    EmergencyRequestRead,
)


class AdminVerifyUpdate(BaseModel):
    is_verified: bool
    reason: Optional[str] = None


class AdminRoleUpdate(BaseModel):
    role: str
```

- [ ] **Step 11: Create `app/api/ai/schemas.py`**

```python
from pydantic import BaseModel


class DiagnosticRequest(BaseModel):
    context: str
```

- [ ] **Step 12: Commit**

```bash
git add backend/app/api/auth/schemas.py backend/app/api/user/schemas.py backend/app/api/service/schemas.py backend/app/api/booking/schemas.py backend/app/api/maintenance/ backend/app/api/notification/schemas.py backend/app/api/request/schemas.py backend/app/api/emergency/schemas.py backend/app/api/secretary/schemas.py backend/app/api/admin/schemas.py backend/app/api/ai/schemas.py
git commit -m "refactor: split internal/schemas.py into per-module api schema files"
```

---

## Task 6: Rename and Update `api/auth/endpoints.py`

**Files:**
- Create: `app/api/auth/endpoints.py` (renamed from `endpoint.py`, imports updated)

- [ ] **Step 1: Create `app/api/auth/endpoints.py`**

Replace the old imports block:
```python
# OLD
from app.internal import deps
from app.internal.models import User, Society
from app.internal.schemas import UserCreate, UserLogin, UserResponse, Token, ForgotPassword
```

With:
```python
from app.common import deps
from app.auth.domain.model import User, Society
from app.api.auth.schemas import UserCreate, UserLogin, UserResponse, Token, ForgotPassword
```

All endpoint function bodies stay exactly the same. Full file:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.common import deps
from app.core import security
from app.core.security import validate_password
from app.core.config import settings
from app.auth.domain.model import User, Society
from app.api.auth.schemas import UserCreate, UserLogin, UserResponse, Token, ForgotPassword

router = APIRouter(tags=["Authentication API"])


@router.post("/signup", response_model=UserResponse)
def signup(user_in: UserCreate, db: Session = Depends(deps.get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    validate_password(user_in.password)

    role = user_in.role
    if user_in.email == settings.SUPERADMIN_EMAIL:
        role = "ADMIN"

    society_id = None
    if role == "SECRETARY":
        if not user_in.society_name or not user_in.society_address:
            raise HTTPException(status_code=400, detail="Secretary must provide a society name and location.")
        new_society = Society(
            name=user_in.society_name.strip(),
            address=user_in.society_address.strip(),
            secretary_name=user_in.username,
            creator_role="SECRETARY",
        )
        db.add(new_society)
        db.flush()
        society_id = new_society.id

    db_user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        role=role,
        society_id=society_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(deps.get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email address not found. Please check your email or sign up."
        )

    if not security.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong password. Please try again."
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact support.")

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


@router.post("/forgot-password")
def forgot_password(data: ForgotPassword, db: Session = Depends(deps.get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    validate_password(data.new_password)

    user.hashed_password = security.get_password_hash(data.new_password)
    db.add(user)
    db.commit()
    return {"message": "Password updated successfully. Please sign in with your new password."}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/auth/endpoints.py
git commit -m "refactor: api/auth endpoint.py → endpoints.py with updated imports"
```

---

## Task 7: Update Remaining API Endpoint Files (imports only)

For each file below: the endpoint logic is untouched — only the top import block changes.

**Files:**
- Create: `app/api/user/endpoints.py`
- Create: `app/api/service/endpoints.py`
- Create: `app/api/service/analytics_endpoints.py`
- Create: `app/api/booking/endpoints.py`
- Create: `app/api/maintenance/endpoints.py`
- Create: `app/api/admin/endpoints.py`
- Create: `app/api/admin/emergency_endpoints.py`
- Create: `app/api/emergency/endpoints.py`
- Create: `app/api/secretary/endpoints.py`
- Create: `app/api/request/endpoints.py`
- Create: `app/api/notification/endpoints.py`
- Create: `app/api/ai/endpoints.py`

- [ ] **Step 1: Update `app/api/user/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import deps
from app.internal.models import User
from app.internal.schemas import UserResponse, ChangePassword
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.api.auth.schemas import UserResponse, ChangePassword
```
Copy all endpoint function bodies from `api/user/endpoint.py` unchanged.

- [ ] **Step 2: Update `app/api/service/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import deps
from app.internal.models import User, Society, ServiceProvider, ServiceBooking, BookingReview, ServiceCertificate, SocietyRequest, society_trusted_providers
from app.internal.schemas import (
    SocietyCreate, SocietyResponse, SocietyUpdate,
    ProviderCreate, ProviderResponse, ProviderUpdate, AvailabilityUpdate,
    BookingCreate, BookingUpdate, BookingRead,
    CertificateCreate, CertificateResponse,
    SocietyRequestCreate, SocietyRequestResponse, SocietyRequestAction
    ...
)
```
With:
```python
from app.common import deps
from app.auth.domain.model import User, Society
from app.service.domain.model import ServiceProvider, ServiceCertificate, SocietyRequest, society_trusted_providers
from app.booking.domain.model import ServiceBooking, BookingReview
from app.api.service.schemas import (
    SocietyCreate, SocietyResponse, SocietyUpdate,
    ProviderCreate, ProviderResponse, ProviderUpdate, AvailabilityUpdate,
    CertificateCreate, CertificateResponse,
    SocietyRequestCreate, SocietyRequestResponse, SocietyRequestAction,
)
from app.api.booking.schemas import BookingCreate, BookingUpdate, BookingRead
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 3: Update `app/api/service/analytics_endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import models, schemas, deps
from app.internal.models import ProviderPoints, ServiceProvider, ServiceBooking
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ProviderPoints, ServiceProvider
from app.booking.domain.model import ServiceBooking
from app.api.service.schemas import ProviderAnalyticsRead, PointLogEntry, MonthlyStatEntry, PointsBreakdown
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 4: Update `app/api/booking/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import models, schemas, deps
from app.internal.services import (
    get_provider_display_name,
    ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS,
)
from app.internal.point_engine import award_points
```
With:
```python
from app.common import deps
from app.common.constants import ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.booking.domain.model import ServiceBooking, BookingStatusHistory, BookingChat, BookingReview
from app.notification.domain.model import Notification
from app.service.services import get_provider_display_name
from app.service.point_engine import award_points
from app.api.booking.schemas import (
    BookingCreate, BookingUpdate, BookingStatusUpdate,
    BookingReschedule, BookingCancel,
    BookingRead, BookingDetailRead,
    ChatCreate, ChatRead, ReviewCreate, ReviewRead,
    BookingStatusHistoryRead,
)
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 5: Update `app/api/maintenance/endpoints.py`** (moved from `api/task/endpoint.py`)

Replace old imports:
```python
# OLD
from app.internal import deps
from app.internal.models import (
    MaintenanceTask, User, Notification,
    ServiceProvider, ServiceBooking, BookingStatusHistory,
)
from app.internal.schemas import (
    TaskCreate, TaskResponse, MaintenanceTaskUpdate,
    RoutineTaskCreate, RoutineTaskResponse, RoutineTaskAssign,
    ProviderResponse
)
from app.internal.services import (
    find_verified_provider, get_provider_display_name,
    ROUTINE_CATEGORY_MAP, BOOKING_CONFLICT_WINDOW_HOURS,
)
```
With:
```python
from app.common import deps
from app.common.constants import ROUTINE_CATEGORY_MAP, BOOKING_CONFLICT_WINDOW_HOURS
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.booking.domain.model import ServiceBooking, BookingStatusHistory
from app.maintenance.domain.model import MaintenanceTask
from app.notification.domain.model import Notification
from app.service.services import find_verified_provider, get_provider_display_name
from app.api.maintenance.schemas import (
    TaskCreate, TaskResponse, MaintenanceTaskUpdate,
    RoutineTaskCreate, RoutineTaskResponse, RoutineTaskAssign,
)
from app.api.service.schemas import ProviderResponse
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 6: Update `app/api/admin/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import deps, models, schemas
from app.internal.models import User, ServiceProvider, ServiceBooking, MaintenanceTask
from app.internal.schemas import UserResponse
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.booking.domain.model import ServiceBooking
from app.maintenance.domain.model import MaintenanceTask
from app.api.auth.schemas import UserResponse
from app.api.service.schemas import ProviderResponse
from app.api.admin.schemas import AdminVerifyUpdate
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 7: Update `app/api/admin/emergency_endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import models, schemas, deps
from app.internal.services import apply_star_delta
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.emergency.domain.model import (
    EmergencyConfig, EmergencyPenaltyConfig,
    EmergencyRequest, EmergencyResponse, EmergencyStarAdjustment,
)
from app.emergency.services import apply_star_delta
from app.api.emergency.schemas import (
    EmergencyConfigCreate, EmergencyConfigUpdate, EmergencyConfigRead,
    EmergencyPenaltyConfigUpdate, EmergencyPenaltyConfigRead,
    EmergencyStarAdjustCreate, EmergencyStarAdjustRead,
    EmergencyRequestRead,
)
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 8: Update `app/api/emergency/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import models, schemas, deps
from app.websockets.emergency import emergency_manager
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.emergency.domain.model import (
    EmergencyConfig, EmergencyRequest, EmergencyResponse,
)
from app.notification.domain.model import Notification
from app.websockets.emergency import emergency_manager
from app.api.emergency.schemas import (
    EmergencyRequestCreate, EmergencyRequestRead,
    EmergencyResponseCreate, EmergencyResponseRead,
    IncomingEmergencyRead,
)
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 9: Update `app/api/secretary/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import deps
from app.internal.models import User, Society, MaintenanceTask
from app.internal.schemas import SocietyResponse, SocietyUpdate, UserResponse
```
With:
```python
from app.common import deps
from app.auth.domain.model import User, Society
from app.maintenance.domain.model import MaintenanceTask
from app.service.domain.model import ServiceProvider, SocietyRequest
from app.api.auth.schemas import UserResponse
from app.api.service.schemas import SocietyResponse, SocietyUpdate, ProviderResponse, SocietyRequestResponse, SocietyRequestAction
from app.api.secretary.schemas import HomeAssign
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 10: Update `app/api/request/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import models, schemas, deps
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.service.domain.model import ServiceProvider
from app.request.domain.model import ServiceRequest, ServiceRequestRecipient, ServiceRequestResponse
from app.booking.domain.model import ServiceBooking, BookingStatusHistory
from app.notification.domain.model import Notification
from app.api.request.schemas import (
    ServiceRequestCreate, ServiceRequestResponseCreate,
    ServiceRequestRead, ServiceRequestDetailRead,
    ServiceRequestResponseRead, IncomingServiceRequestRead,
)
from app.api.booking.schemas import BookingRead
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 11: Update `app/api/notification/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import deps, models, schemas
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.notification.domain.model import Notification
from app.api.notification.schemas import NotificationResponse, NotificationUpdate
```
Copy all endpoint function bodies unchanged.

- [ ] **Step 12: Update `app/api/ai/endpoints.py`**

Replace old imports:
```python
# OLD
from app.internal import deps
from app.internal.models import User
from pydantic import BaseModel
```
With:
```python
from app.common import deps
from app.auth.domain.model import User
from app.api.ai.schemas import DiagnosticRequest
```
Remove the inline `class DiagnosticRequest(BaseModel)` definition from the file body (it's now in `api/ai/schemas.py`).
Copy all endpoint function bodies unchanged.

- [ ] **Step 13: Commit all endpoint renames**

```bash
git add backend/app/api/
git commit -m "refactor: rename all endpoint.py → endpoints.py and update imports to new domain paths"
```

---

## Task 8: Update `core/scheduler.py`, `main.py`, and `alembic/env.py`

**Files:**
- Modify: `app/core/scheduler.py`
- Modify: `app/main.py`
- Modify: `alembic/env.py`

- [ ] **Step 1: Update `app/core/scheduler.py` imports**

Replace:
```python
from app.core.database import SessionLocal
from app.internal.models import MaintenanceTask, Notification
```
With:
```python
from app.core.db.session import SessionLocal
from app.maintenance.domain.model import MaintenanceTask
from app.notification.domain.model import Notification
```

- [ ] **Step 2: Update `app/main.py` router imports**

Replace the entire import block (lines 11–27):
```python
# OLD
from app.api.auth.endpoint import router as auth_router
from app.api.user.endpoint import router as user_router
from app.api.service.endpoint import router as service_router
from app.api.service.analytics_endpoint import router as analytics_router
from app.api.task.endpoint import router as task_router
from app.api.admin.endpoint import router as admin_router
from app.api.admin.emergency_endpoint import router as admin_emergency_router
from app.api.booking.endpoint import router as booking_router
from app.api.ai.endpoint import router as ai_router
from app.api.notification.endpoint import router as notification_router
from app.api.secretary.endpoint import router as secretary_router
from app.api.request.endpoint import router as request_router
from app.api.emergency.endpoint import router as emergency_router, servicer_router as emergency_servicer_router
from app.core.database import init_db, SessionLocal
```
With:
```python
from app.api.auth.endpoints import router as auth_router
from app.api.user.endpoints import router as user_router
from app.api.service.endpoints import router as service_router
from app.api.service.analytics_endpoints import router as analytics_router
from app.api.maintenance.endpoints import router as task_router
from app.api.admin.endpoints import router as admin_router
from app.api.admin.emergency_endpoints import router as admin_emergency_router
from app.api.booking.endpoints import router as booking_router
from app.api.ai.endpoints import router as ai_router
from app.api.notification.endpoints import router as notification_router
from app.api.secretary.endpoints import router as secretary_router
from app.api.request.endpoints import router as request_router
from app.api.emergency.endpoints import router as emergency_router, servicer_router as emergency_servicer_router
from app.core.db.session import init_db, SessionLocal
```

Also update the `_seed_penalty_configs` function inside `main.py`:
```python
# OLD
from app.internal.models import EmergencyPenaltyConfig
```
With:
```python
from app.emergency.domain.model import EmergencyPenaltyConfig
```

- [ ] **Step 3: Update `alembic/env.py`**

Replace:
```python
from app.internal.models import Base
target_metadata = Base.metadata
```
With:
```python
from app.core.db.base import Base

# Register all domain models with Base.metadata
from app.auth.domain import model as _auth  # noqa
from app.service.domain import model as _service  # noqa
from app.booking.domain import model as _booking  # noqa
from app.maintenance.domain import model as _maintenance  # noqa
from app.notification.domain import model as _notification  # noqa
from app.request.domain import model as _request  # noqa
from app.emergency.domain import model as _emergency  # noqa

target_metadata = Base.metadata
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/scheduler.py backend/app/main.py backend/alembic/env.py
git commit -m "refactor: update scheduler, main.py, and alembic/env.py to new import paths"
```

---

## Task 9: Smoke Test — Start the Server

- [ ] **Step 1: Start the backend and verify it starts cleanly**

From `backend/`:
```bash
uvicorn app.main:app --reload --port 8000
```

Expected output (no errors):
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     ✅ Database connected via: ...
INFO:     ✅ Database tables created/verified.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

- [ ] **Step 2: Verify API docs load**

Open `http://localhost:8000/api/v1/docs` — Swagger UI must show all routers (auth, user, services, bookings, maintenance, admin, emergency, secretary, requests, notifications, ai).

- [ ] **Step 3: Hit the health endpoint**

```bash
curl http://localhost:8000/api/v1/health
```

Expected:
```json
{"status": "healthy", "database": "connected", "timestamp": "..."}
```

- [ ] **Step 4: If any ImportError appears, fix the import in the reported file.** Only cross-domain model imports are likely to be wrong — check which model belongs to which domain file.

---

## Task 10: Delete Old Files

Only do this **after Task 9 passes cleanly**.

- [ ] **Step 1: Delete `app/internal/` folder**

```bash
rm -rf backend/app/internal/
```

- [ ] **Step 2: Delete old `endpoint.py` files** (the renamed ones)

```bash
rm backend/app/api/auth/endpoint.py
rm backend/app/api/user/endpoint.py
rm backend/app/api/service/endpoint.py
rm backend/app/api/service/analytics_endpoint.py
rm backend/app/api/booking/endpoint.py
rm backend/app/api/admin/endpoint.py
rm backend/app/api/admin/emergency_endpoint.py
rm backend/app/api/emergency/endpoint.py
rm backend/app/api/secretary/endpoint.py
rm backend/app/api/request/endpoint.py
rm backend/app/api/notification/endpoint.py
rm backend/app/api/ai/endpoint.py
```

- [ ] **Step 3: Delete old `api/task/` folder**

```bash
rm -rf backend/app/api/task/
```

- [ ] **Step 4: Delete `app/core/database.py`**

```bash
rm backend/app/core/database.py
```

- [ ] **Step 5: Restart server and verify no errors**

```bash
uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 6: Commit cleanup**

```bash
git add -A
git commit -m "refactor: remove old internal/ monolith and stale endpoint files after restructure"
```

---

## Task 11: Update CLAUDE.md and BACKEND.md References

- [ ] **Step 1: Update `backend/BACKEND.md`** (if it references `internal/` paths or `database.py`)

Search for any references to old paths and update them to the new structure. Do not change any logic descriptions — only file path references.

- [ ] **Step 2: Commit**

```bash
git add backend/BACKEND.md
git commit -m "docs: update BACKEND.md with new directory structure paths"
```

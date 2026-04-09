# ⚙️ Backend — Structure & Developer Guide

**Stack**: FastAPI · SQLAlchemy 2.0 · PostgreSQL · Pydantic v2 · Alembic · APScheduler · Anthropic SDK

---

## 🚀 Commands

```bash
# from /backend
pip install -r requirements.txt            # install dependencies
uvicorn app.main:app --reload --port 8000  # dev server → http://localhost:8000
pytest                                     # run tests
alembic current                            # current DB revision
alembic upgrade head                       # apply all migrations
alembic revision -m "description"          # new migration (auto-named DD_MM_YYYY_slug.py)
```

---

## 📁 Directory Structure

Domain-driven design: each domain owns its models, services, and API layer.

```
backend/
├── app/
│   ├── main.py                      # FastAPI app, CORS, routers, lifespan, exception handler
│   │
│   ├── core/
│   │   ├── config.py                # Pydantic Settings — loads from .env
│   │   ├── security.py              # JWT creation, password hashing (PBKDF2-SHA256)
│   │   ├── scheduler.py             # APScheduler — hourly maintenance alert jobs
│   │   └── db/
│   │       ├── base.py              # SQLAlchemy declarative Base (import from here only)
│   │       └── session.py           # engine, SessionLocal, init_db(), retry thread
│   │
│   ├── common/
│   │   ├── deps.py                  # get_db, get_current_user, RoleChecker
│   │   └── constants.py             # ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS, etc.
│   │
│   ├── api/                         # HTTP layer — one folder per domain
│   │   ├── auth/endpoints.py + schemas.py
│   │   ├── user/endpoints.py + schemas.py
│   │   ├── service/endpoints.py + analytics_endpoints.py + schemas.py
│   │   ├── booking/endpoints.py + schemas.py
│   │   ├── maintenance/endpoints.py + schemas.py
│   │   ├── admin/endpoints.py + emergency_endpoints.py + schemas.py
│   │   ├── emergency/endpoints.py + schemas.py
│   │   ├── secretary/endpoints.py + schemas.py
│   │   ├── request/endpoints.py + schemas.py
│   │   ├── notification/endpoints.py + schemas.py
│   │   └── ai/endpoints.py + schemas.py
│   │
│   ├── auth/
│   │   ├── domain/model.py          # User, Society, society_trusted_providers
│   │   └── services.py
│   │
│   ├── service/
│   │   ├── domain/model.py          # ServiceProvider, ServiceCertificate, SocietyRequest, ProviderPoints
│   │   ├── services.py              # find_verified_provider, get_provider_display_name
│   │   └── point_engine.py          # award_points() — ONLY way to mutate provider rating
│   │
│   ├── booking/
│   │   ├── domain/model.py          # ServiceBooking, BookingStatusHistory, BookingChat, BookingReview
│   │   └── services.py
│   │
│   ├── maintenance/
│   │   ├── domain/model.py          # MaintenanceTask
│   │   └── services.py
│   │
│   ├── notification/
│   │   ├── domain/model.py          # Notification
│   │   └── services.py
│   │
│   ├── request/
│   │   ├── domain/model.py          # ServiceRequest, ServiceRequestRecipient, ServiceRequestResponse
│   │   └── services.py
│   │
│   ├── emergency/
│   │   ├── domain/model.py          # EmergencyConfig, EmergencyPenaltyConfig, EmergencyRequest, EmergencyResponse, EmergencyStarAdjustment
│   │   └── services.py              # apply_star_delta, calculate_emergency_bill
│   │
│   ├── secretary/services.py
│   ├── admin/services.py
│   │
│   └── websockets/
│       └── emergency.py             # Singleton EmergencyConnectionManager
│
├── alembic/
│   ├── env.py                       # Imports Base + all domain models for autogenerate
│   └── versions/                    # Migration files (13 versions)
│
├── alembic.ini                      # Migration config — file naming: DD_MM_YYYY_slug.py
├── requirements.txt
├── pyproject.toml
└── Dockerfile
```

---

## 🔑 Import Rules

| What you need | Import from |
|---|---|
| `Base` | `app.core.db.base` |
| `SessionLocal`, `init_db` | `app.core.db.session` |
| `get_db`, `get_current_user`, `RoleChecker` | `app.common.deps` |
| Constants | `app.common.constants` |
| `User`, `Society`, `society_trusted_providers` | `app.auth.domain.model` |
| `ServiceProvider`, `ProviderPoints` | `app.service.domain.model` |
| `ServiceBooking`, `BookingReview` | `app.booking.domain.model` |
| `MaintenanceTask` | `app.maintenance.domain.model` |
| `Notification` | `app.notification.domain.model` |
| `ServiceRequest`, `ServiceRequestRecipient` | `app.request.domain.model` |
| `EmergencyRequest`, `EmergencyConfig` | `app.emergency.domain.model` |
| `award_points` | `app.service.point_engine` |
| Auth schemas | `app.api.auth.schemas` |
| Domain schemas | `app.api.<domain>.schemas` |

**Never import from `app.internal.*` — that package was deleted in the domain-driven restructure.**

---

## 🏗️ Application Entry Point (`app/main.py`)

- FastAPI app with **lifespan** context manager
- **CORS** origins: `localhost:3000`, `localhost:3001`, `localhost:8000`
- **Static files** served from `/uploads` directory
- **14 routers** registered under `/api/v1`
- **WebSocket endpoints**: `/ws/emergency/{request_id}`, `/ws/servicer/alerts`
- **Exception handler** for unhandled errors — includes CORS headers in error responses
- **Startup**: seeds default `EmergencyPenaltyConfig` rows if missing

---

## ⚙️ Core Layer

### `core/config.py`
Pydantic `Settings` class — reads from `backend/.env`:
```python
DATABASE_URL, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_USERNAME,
FRONTEND_URL, ANTHROPIC_API_KEY
```

### `core/db/base.py`
Single source of `Base = declarative_base()`. All domain models import from here.

### `core/db/session.py`
- Builds SQLAlchemy engine with fallback URL variants (`psycopg`, `psycopg2`, `postgresql`)
- Pool: `pool_pre_ping=True`, recycle 1800s
- **Auto-seed**: creates superadmin user on first successful connection
- **Retry thread**: background thread retries DB connection if unavailable at startup
- `init_db()` → called in `main.py` lifespan; `SessionLocal` yields sessions via `get_db()`

### `core/security.py`
- **JWT**: `create_access_token(data)` → signed HS256 token
  - Claims: `sub` (user UUID), `role`, `email`, `exp`
- **Password hashing**: `pbkdf2_sha256` via `passlib`
- **Password rules**: min 6 chars, ≥1 uppercase, ≥1 special char (`@#$!%*?&`)
- **OAuth2**: `OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")`

### `core/scheduler.py`
APScheduler `BackgroundScheduler` (UTC) — runs **hourly**:

| Stage | Trigger | Action |
|---|---|---|
| WARNING | 2 days before due_date | Notification + `warning_sent=True` |
| FINAL | On due_date | Notification + `final_sent=True` |
| OVERDUE | After due_date | Notification + `overdue_sent=True` |
| AUTO-EXPIRE | 7 days overdue | Sets task status = `EXPIRED` |

---

## 🔌 Dependencies (`common/deps.py`)

```python
get_db()              # Yields DB session; raises 503 on OperationalError
get_current_user()    # Validates JWT, extracts UUID from 'sub', fetches User object
RoleChecker([roles])  # Dependency class; raises 403 if user role not in allowed list
```

**Usage in routes:**
```python
@router.get("/admin/stats")
def get_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.RoleChecker(["ADMIN"]))
):
```

---

## 🗄️ Database Models (per-domain)

All tables use **UUID primary keys** (`postgresql.UUID`). Models live in `<domain>/domain/model.py`.

### Tables Overview

| Model | Table | Domain file |
|---|---|---|
| `User` | `users` | `auth/domain/model.py` |
| `Society` | `societies` | `auth/domain/model.py` |
| `society_trusted_providers` | (M2M) | `auth/domain/model.py` |
| `ServiceProvider` | `service_providers` | `service/domain/model.py` |
| `ServiceCertificate` | `service_certificates` | `service/domain/model.py` |
| `SocietyRequest` | `society_requests` | `service/domain/model.py` |
| `ProviderPoints` | `provider_points` | `service/domain/model.py` |
| `ServiceBooking` | `service_bookings` | `booking/domain/model.py` |
| `BookingStatusHistory` | `booking_status_history` | `booking/domain/model.py` |
| `BookingChat` | `booking_chats` | `booking/domain/model.py` |
| `BookingReview` | `booking_reviews` | `booking/domain/model.py` |
| `MaintenanceTask` | `maintenance_tasks` | `maintenance/domain/model.py` |
| `Notification` | `notifications` | `notification/domain/model.py` |
| `ServiceRequest` | `service_requests` | `request/domain/model.py` |
| `ServiceRequestRecipient` | `service_request_recipients` | `request/domain/model.py` |
| `ServiceRequestResponse` | `service_request_responses` | `request/domain/model.py` |
| `EmergencyConfig` | `emergency_config` | `emergency/domain/model.py` |
| `EmergencyPenaltyConfig` | `emergency_penalty_config` | `emergency/domain/model.py` |
| `EmergencyRequest` | `emergency_requests` | `emergency/domain/model.py` |
| `EmergencyResponse` | `emergency_responses` | `emergency/domain/model.py` |
| `EmergencyStarAdjustment` | `emergency_star_adjustments` | `emergency/domain/model.py` |

### Key Relationships
- `User` → 1:1 → `ServiceProvider` (`.provider_profile`)
- `Society` → M2M → `ServiceProvider` (via `society_trusted_providers`)
- `ServiceBooking` → has many → `BookingStatusHistory`, `BookingChat`; 1:1 → `BookingReview`
- `ServiceRequest` → cascade delete → `ServiceRequestRecipient[]`, `ServiceRequestResponse[]`
- `EmergencyRequest` → cascade delete → `EmergencyResponse[]`

### JSON Fields (stored as Text)
`categories`, `availability`, `photos`, `preferred_dates` — serialize/deserialize manually with `json.dumps/loads`.

### Cross-domain relationships
Use string class names in `relationship()` to avoid circular imports:
```python
user = relationship("User", back_populates="bookings")  # not: from app.auth.domain.model import User
```

---

## 📋 Pydantic Schemas (per-domain in `api/<domain>/schemas.py`)

### Enums
```python
UserRole: USER | SERVICER | ADMIN | SECRETARY
```

### Allowed Values (from `common/constants.py`)
```python
ALLOWED_CATEGORIES = [
    "AC Service", "Appliance Repair", "Home Cleaning", "Plumbing",
    "Electrical", "Pest Control", "Painting", "Carpentry", "General Maintenance"
]
EMERGENCY_CATEGORY_OPTIONS = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other"
]
```

### Schema Locations
| Group | File |
|---|---|
| Auth, User | `api/auth/schemas.py` |
| Society, Provider, Analytics | `api/service/schemas.py` |
| Booking, Chat, Review | `api/booking/schemas.py` |
| Maintenance, Routine tasks | `api/maintenance/schemas.py` |
| Notifications | `api/notification/schemas.py` |
| Service requests | `api/request/schemas.py` |
| Emergency | `api/emergency/schemas.py` |
| Secretary | `api/secretary/schemas.py` |
| Admin | `api/admin/schemas.py` |
| AI | `api/ai/schemas.py` |

---

## 🌐 API Routers

All routes prefixed with `/api/v1`.

| Router | Prefix | File |
|---|---|---|
| Auth | `/auth` | `api/auth/endpoints.py` |
| User | `/user` | `api/user/endpoints.py` |
| Services | `/services` | `api/service/endpoints.py` |
| Analytics | `/services` | `api/service/analytics_endpoints.py` |
| Bookings | `/bookings` | `api/booking/endpoints.py` |
| Maintenance | `/maintenance` | `api/maintenance/endpoints.py` |
| Admin | `/admin` | `api/admin/endpoints.py` |
| Admin Emergency | `/admin/emergency` | `api/admin/emergency_endpoints.py` |
| Emergency | `/emergency` | `api/emergency/endpoints.py` |
| Requests | `/requests` | `api/request/endpoints.py` |
| Secretary | `/secretary` | `api/secretary/endpoints.py` |
| Notifications | `/notifications` | `api/notification/endpoints.py` |
| AI | `/ai` | `api/ai/endpoints.py` |

---

## 🧠 Business Logic (`service/point_engine.py`, `service/services.py`, `emergency/services.py`)

### Point Engine (`service/point_engine.py`)
**Always use `award_points()`** — never mutate `ServiceProvider.rating` directly:
```python
from app.service.point_engine import award_points
award_points(db, provider_id=provider.id, event_type="REGULAR_COMPLETE", source_id=booking.id)
```

| Event | Points |
|---|---|
| `EMERGENCY_COMPLETE` | +35 |
| `URGENT_COMPLETE` | +20 |
| `REGULAR_COMPLETE` | +15 |
| `FEEDBACK_5_STAR` | +10 |
| `FEEDBACK_4_STAR` | +8 |
| `FEEDBACK_3_STAR` | +5 |
| `FEEDBACK_2_STAR` | +2 |
| `REGULAR_CANCEL` | −10 |
| `EMERGENCY_CANCEL` | −20 |

100 pts = 1 star. Auto-verify triggers at ≥ 1000 pts (10.0 stars).

### Service Helpers (`service/services.py`)
- `get_provider_display_name(provider)` — `first_name` > `company_name` > `owner_name` > `"Unknown Provider"`
- `find_verified_provider(db, category)` — finds best available verified provider with matching category, certificate, and no booking conflict

### Emergency Helpers (`emergency/services.py`)
- `apply_star_delta(provider, delta)` — mutates `provider.rating`, clamped to 0+
- `calculate_emergency_bill(callout_fee, hourly_rate, actual_hours)` — billing formula

---

## 🔌 WebSocket Manager (`websockets/emergency.py`)

Singleton `EmergencyConnectionManager` with two connection pools:

```python
user_connections: dict[str, WebSocket]      # request_id → user socket
servicer_connections: dict[str, WebSocket]  # provider_id → servicer socket
```

| Endpoint | Who connects | Purpose |
|---|---|---|
| `/ws/emergency/{request_id}` | User | Watch SOS request status in real time |
| `/ws/servicer/alerts` | Servicer | Receive new emergency alert broadcasts |

---

## 📊 Status Enumerations

| Entity | Valid Statuses |
|---|---|
| `ServiceBooking.status` | `Pending`, `Accepted`, `In Progress`, `Completed`, `Cancelled` |
| `MaintenanceTask.status` | `Pending`, `In Progress`, `Completed`, `Expired` |
| `ServiceRequest.status` | `OPEN`, `CLOSED`, `EXPIRED` |
| `EmergencyRequest.status` | `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED` |
| `EmergencyResponse.status` | `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED` |
| `ServiceProvider.availability_status` | `AVAILABLE`, `WORKING`, `VACATION` |
| `EmergencyPenaltyConfig.event_type` | `LATE_ARRIVAL`, `CANCELLATION`, `NO_SHOW` |
| `SocietyRequest.status` | `PENDING`, `ACCEPTED`, `REJECTED` |

---

## 🗃️ Migration History (`alembic/versions/`)

| Migration | Description |
|---|---|
| `17_03_2026_add_location_and_profile_photo_to_provider` | `location`, `profile_photo_url` fields |
| `17_03_2026_add_society_security_and_servicer_mastery` | Registration number, mastery fields |
| `17_03_2026_expand_provider_profile_and_certificates` | Education, experience, bio, government ID |
| `17_03_2026_fix_society_relationships_and_add_servicer_fields` | FK relationship fixes |
| `24_03_2026_add_routine_task_fields_to_maintenance_tasks` | `task_type`, routine task support |
| `30_03_2026_add_service_request_workflow` | `service_requests`, `recipients`, `responses` tables |
| `01_04_2026_add_completion_fields_to_bookings` | `completion_notes`, `completion_photos`, `actual_hours` |
| `04_04_2026_add_emergency_sos_system` | Emergency config, requests, responses, star adjustment tables |
| `04_04_2026_add_home_number_to_users` | `home_number`, `resident_name` on User |
| `04_04_2026_add_title_to_service_certificates` | `title` field on certificates |
| `05_04_2026_add_alert_fields` | `warning_sent`, `final_sent`, `overdue_sent` on maintenance tasks |
| `06_04_2026_uuid_primary_keys` | Convert all integer PKs → UUID |

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `fastapi` | HTTP framework |
| `uvicorn` | ASGI server |
| `sqlalchemy` | ORM (2.0 style) |
| `psycopg2` / `psycopg` | PostgreSQL driver |
| `pydantic` / `pydantic-settings` | Schemas + config |
| `alembic` | DB migrations |
| `python-jose` | JWT (HS256) |
| `passlib` | Password hashing (PBKDF2-SHA256) |
| `apscheduler` | Background scheduled jobs |
| `anthropic` | Claude AI SDK |
| `python-multipart` | File/form upload support |

---

## 🔑 Coding Rules

- All route files: one `APIRouter` per file, registered in `main.py`
- All DB operations: use `Session` from `Depends(deps.get_db)` — never create sessions manually
- Role enforcement: use `Depends(deps.RoleChecker(["ROLE"]))` — never check `current_user.role` manually in routes
- All schema changes require an Alembic migration — never modify models and assume it's safe
- All provider rating changes must go through `award_points()` — never mutate `rating` directly
- Cross-domain model references in SQLAlchemy must use string class names (no circular imports)

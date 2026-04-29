# Backend Reference — HomeCare Hub

FastAPI backend for HomeCare Hub. Python root is `backend/`. Run with `uvicorn app.main:app --reload --port 8000`.

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                  ← FastAPI app, CORS, lifespan, router mounts, WebSocket endpoints
│   ├── core/
│   │   ├── config.py            ← Pydantic settings (DATABASE_URL, SECRET_KEY, etc.)
│   │   ├── security.py          ← JWT creation, password hashing, oauth2_scheme
│   │   ├── scheduler.py         ← APScheduler: hourly maintenance alert checks
│   │   └── db/
│   │       ├── base.py          ← SQLAlchemy declarative Base (import from here only)
│   │       └── session.py       ← engine, SessionLocal, init_db() with retry logic
│   ├── common/
│   │   ├── deps.py              ← get_db, get_current_user, RoleChecker
│   │   └── constants.py         ← ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS, etc.
│   ├── api/                     ← HTTP layer: endpoints + schemas, one folder per domain
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
│   │   ├── payment/endpoints.py + schemas.py
│   │   └── ai/endpoints.py + schemas.py
│   ├── auth/domain/model.py     ← User, Society, society_trusted_providers
│   ├── service/
│   │   ├── domain/model.py      ← ServiceProvider, ServiceCertificate, SocietyRequest, ProviderPoints
│   │   ├── services.py          ← find_verified_provider, get_provider_display_name
│   │   └── point_engine.py      ← award_points() — ONLY way to mutate provider rating
│   ├── booking/domain/model.py  ← ServiceBooking, BookingStatusHistory, BookingChat, BookingReview, BookingComplaint
│   ├── maintenance/domain/model.py ← MaintenanceTask
│   ├── notification/domain/model.py ← Notification
│   ├── request/domain/model.py  ← ServiceRequest, ServiceRequestRecipient, ServiceRequestResponse, NegotiationOffer
│   ├── emergency/
│   │   ├── domain/model.py      ← EmergencyConfig, EmergencyPenaltyConfig, EmergencyRequest, EmergencyResponse, EmergencyStarAdjustment
│   │   └── services.py          ← apply_star_delta, calculate_emergency_bill
│   ├── secretary/domain/model.py ← SecretaryComplaint, HomeMember
│   ├── contract/domain/model.py  ← SocietyContract, SocietyDispatch
│   ├── payment/domain/model.py   ← PaymentProfile
│   └── websockets/emergency.py  ← EmergencyConnectionManager singleton
├── alembic/                     ← Migration files (23 versions, never edit existing)
│   └── env.py                   ← Imports Base + all domain models for autogenerate
└── alembic.ini
```

---

## Import Rules (Critical)

| What you need | Where to import from |
|---|---|
| `Base` | `app.core.db.base` |
| `SessionLocal`, `init_db` | `app.core.db.session` |
| `get_db`, `get_current_user`, `RoleChecker` | `app.common.deps` |
| `ALLOWED_CATEGORIES`, constants | `app.common.constants` |
| `User`, `Society`, `society_trusted_providers` | `app.auth.domain.model` |
| `ServiceProvider`, `ServiceCertificate`, `ProviderPoints` | `app.service.domain.model` |
| `ServiceBooking`, `BookingReview`, `BookingComplaint` | `app.booking.domain.model` |
| `MaintenanceTask` | `app.maintenance.domain.model` |
| `Notification` | `app.notification.domain.model` |
| `ServiceRequest`, `ServiceRequestRecipient`, `NegotiationOffer` | `app.request.domain.model` |
| `EmergencyRequest`, `EmergencyConfig` | `app.emergency.domain.model` |
| `SecretaryComplaint`, `HomeMember` | `app.secretary.domain.model` |
| `SocietyContract`, `SocietyDispatch` | `app.contract.domain.model` |
| `PaymentProfile` | `app.payment.domain.model` |
| `award_points` | `app.service.point_engine` |
| Auth schemas (`TokenData`, etc.) | `app.api.auth.schemas` |
| Domain schemas | `app.api.<domain>.schemas` |

**Never import from `app.internal.*` — that package was deleted.**

---

## Router Mounts (`main.py`)

| Router variable | Prefix |
|---|---|
| `auth_router` | `/api/v1/auth` |
| `user_router` | `/api/v1/user` |
| `service_router` | `/api/v1/services` |
| `analytics_router` | `/api/v1/services` |
| `task_router` | `/api/v1/maintenance` |
| `admin_router` | `/api/v1/admin` |
| `ai_router` | `/api/v1/ai` |
| `booking_router` | `/api/v1/bookings` |
| `notification_router` | `/api/v1/notifications` |
| `secretary_router` | `/api/v1/secretary` |
| `request_router` | `/api/v1/requests` |
| `emergency_router` | `/api/v1/emergency` |
| `emergency_servicer_router` | `/api/v1/emergency` |
| `admin_emergency_router` | `/api/v1/admin/emergency` |
| `payment_router` | `/api/v1/payment` |

---

## Key Patterns

### Adding a new endpoint
1. Add handler function to `app/api/<domain>/endpoints.py`
2. Add any new request/response types to `app/api/<domain>/schemas.py`
3. If new DB columns needed → create Alembic migration (ask user first)

### Adding a new domain
1. Create `app/<domain>/__init__.py`, `app/<domain>/domain/__init__.py`, `app/<domain>/domain/model.py`
2. Import `Base` from `app.core.db.base`
3. Create `app/api/<domain>/endpoints.py` + `schemas.py`
4. Register router in `main.py`
5. Add domain model import to `alembic/env.py`

### Awarding provider points
**Always use `award_points()`** — never mutate `ServiceProvider.rating` directly:
```python
from app.service.point_engine import award_points
award_points(db, provider_id=provider.id, event_type="REGULAR_COMPLETE", source_id=booking.id)
```

Point events: `EMERGENCY_COMPLETE` +35, `URGENT_COMPLETE` +20, `REGULAR_COMPLETE` +15, `FEEDBACK_5_STAR` +10 ... `EMERGENCY_CANCEL` -20, `REGULAR_CANCEL` -10. Auto-verify triggers at ≥ 1000 pts (10.0 stars).

### Dependency injection pattern
```python
from app.common import deps

@router.get("/me")
def get_me(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.RoleChecker(["USER", "ADMIN"])),
):
    ...
```

### Sending a notification
```python
from app.notification.domain.model import Notification
db.add(Notification(
    user_id=user.id,
    title="...",
    message="...",
    notification_type="INFO",  # INFO | WARNING | URGENT | SYSTEM
))
db.commit()
```

---

## Database

- **All PKs**: UUID (`PG_UUID(as_uuid=True)`)
- **Datetimes**: Naive UTC (`datetime.datetime.utcnow()`, no tzinfo)
- **JSON fields**: Text columns with `json.dumps/loads` (categories, photos, preferred_dates)
- **Cross-domain FK refs**: Always use string-based relationship names to avoid circular imports
- **Migrations**: `alembic revision -m "description"` → edit → `alembic upgrade head`
- **Naming convention**: `DD_MM_YYYY_slug.py`

---

## Running Locally

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/api/v1/docs`
Health: `http://localhost:8000/api/v1/health`

### Environment (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL (default 480) |
| `SUPERADMIN_EMAIL` | Auto-seeded admin email |
| `SUPERADMIN_PASSWORD` | Auto-seeded admin password |
| `SUPERADMIN_USERNAME` | Display name |
| `FRONTEND_URL` | CORS origin (default `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | Claude AI key |

---

## Frontend Connection

- **Frontend base URL**: `http://localhost:8000` (via `NEXT_PUBLIC_API_URL` in `frontend/.env.local`)
- **Full API base**: `http://localhost:8000/api/v1`
- **CORS**: Backend allows the frontend origin defined in `FRONTEND_URL` env var
- **Auth tokens**: Stored in role-segregated localStorage keys (see `lib/auth.ts` for key names)
- **Token format**: JWT signed with `SECRET_KEY` — claims defined in `app/api/auth/schemas.py`

---

## Emergency SOS Endpoints (`/api/v1/emergency`)

| Method | Path | Description |
|---|---|---|
| GET | `/emergency/config` | Get pricing config |
| GET | `/emergency/providers` | Available emergency providers |
| GET | `/emergency/me/active` | Get current user's active (PENDING/ACTIVE) emergency request |
| POST | `/emergency/` | Create SOS request |
| GET | `/emergency/{request_id}` | Request detail |
| GET | `/emergency/incoming-servicer` | Incoming emergencies for servicer (filtered by targeted_provider_ids) |
| POST | `/emergency/{request_id}/respond` | Servicer submits response with committed arrival time |
| POST | `/emergency/{request_id}/ignore` | Servicer ignores emergency — records dismissal and deducts points |
| POST | `/emergency/{request_id}/accept/{response_id}` | User accepts servicer response — creates ServiceBooking |
| POST | `/emergency/{request_id}/cancel` | User cancels emergency before any response accepted |
| PATCH | `/emergency/{request_id}/status` | Update status |

---

## Emergency Model Fields

`EmergencyRequest` key fields: `id, user_id, category, status, config_id, expires_at, flow_type, targeted_provider_ids`

- `flow_type`: `"direct"` or `"systematic"` — controls emergency billing mode (instant complete vs charge submit + confirm)
- `targeted_provider_ids`: JSON text list of provider UUIDs; `NULL` = broadcast to all available providers

---

## Scheduler

`app/core/scheduler.py` runs the following APScheduler jobs:

| Job | Interval | Description |
|---|---|---|
| Maintenance alert checks | Every 1 hour | WARNING (2 days before), FINAL (day of), OVERDUE (past due), AUTO-EXPIRE (7 days overdue) |
| `_expire_stale_emergencies` | Every 1 minute | Marks PENDING emergency requests past `expires_at` as EXPIRED; sends notification to user |

---

## Emergency Schema Validators

`EmergencyRequestCreate` enforces strict field validation:

| Field | Rule |
|---|---|
| `contact_name` | Letters, spaces, hyphens, and dots only; 2–100 chars |
| `contact_phone` | Indian mobile format — `^(\+91[\s-]?)?[6-9]\d{9}$` |
| `full_address` | 5–500 chars |
| `society_name`, `building_name`, `landmark`, `flat_no` | 1–200 chars, non-empty strings |

---

## WebSocket Endpoints

| Path | Purpose |
|---|---|
| `ws://localhost:8000/ws/emergency/{request_id}` | User watches SOS request in real-time |
| `ws://localhost:8000/ws/servicer/alerts` | Servicer receives emergency broadcasts |

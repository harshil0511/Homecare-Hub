# Backend Restructure Design
**Date:** 2026-04-09  
**Status:** Approved

## Goal
Reorganize `backend/app/` from a flat, monolithic layout into a domain-driven structure where each module owns its models, services, and API layer independently. Matches the reference structure provided by the user.

## Decisions
- **Python root:** `backend/` stays as-is. `uvicorn app.main:app` unchanged. No `src/` wrapper.
- **Models + schemas:** Full split — each domain gets `domain/model.py` and `api/<module>/schemas.py`.
- **Approach:** Full Reference Mirror (Approach 1) — domain/model, adapters/repository, services, api layer per module.

## Target Layout (inside `backend/app/`)

```
app/
├── main.py
├── core/
│   ├── config.py
│   ├── security.py
│   ├── scheduler.py
│   └── db/
│       ├── base.py        ← declarative Base
│       └── session.py     ← engine, SessionLocal, init_db
├── common/
│   ├── deps.py            ← get_db, get_current_user, RoleChecker
│   └── constants.py       ← ALLOWED_CATEGORIES, BOOKING_CONFLICT_WINDOW_HOURS, etc.
├── api/
│   ├── auth/endpoints.py + schemas.py
│   ├── user/endpoints.py + schemas.py + deps.py
│   ├── service/endpoints.py + analytics_endpoints.py + schemas.py
│   ├── booking/endpoints.py + schemas.py
│   ├── maintenance/endpoints.py + schemas.py
│   ├── admin/endpoints.py + emergency_endpoints.py + schemas.py
│   ├── emergency/endpoints.py + schemas.py
│   ├── secretary/endpoints.py + schemas.py
│   ├── request/endpoints.py + schemas.py
│   ├── notification/endpoints.py + schemas.py
│   └── ai/endpoints.py
├── auth/services.py + domain/model.py        ← User, Society
├── service/services.py + point_engine.py + domain/model.py  ← ServiceProvider, ServiceCertificate, SocietyRequest
├── booking/services.py + domain/model.py     ← ServiceBooking, BookingStatusHistory, BookingChat, BookingReview
├── maintenance/services.py + domain/model.py ← MaintenanceTask
├── notification/services.py + domain/model.py ← Notification
├── request/services.py + domain/model.py     ← ServiceRequest, ServiceRequestRecipient, ServiceRequestResponse
├── emergency/services.py + domain/model.py   ← EmergencyConfig, EmergencyPenaltyConfig, EmergencyRequest, EmergencyResponse, EmergencyStarAdjustment
├── secretary/services.py
├── admin/services.py
└── websockets/emergency.py  ← unchanged
```

## File Mapping (old → new)

| Old Path | New Path |
|---|---|
| `core/database.py` | `core/db/base.py` + `core/db/session.py` |
| `internal/deps.py` | `common/deps.py` |
| `internal/services.py` (constants) | `common/constants.py` |
| `internal/services.py` (helpers) | `service/services.py`, `booking/services.py`, etc. per domain |
| `internal/models.py` | Split across `*/domain/model.py` per domain |
| `internal/schemas.py` | Split across `api/*/schemas.py` per domain |
| `internal/point_engine.py` | `service/point_engine.py` |
| `api/auth/endpoint.py` | `api/auth/endpoints.py` |
| `api/user/endpoint.py` | `api/user/endpoints.py` |
| `api/service/endpoint.py` | `api/service/endpoints.py` |
| `api/service/analytics_endpoint.py` | `api/service/analytics_endpoints.py` |
| `api/task/endpoint.py` | `api/maintenance/endpoints.py` |
| `api/booking/endpoint.py` | `api/booking/endpoints.py` |
| `api/admin/endpoint.py` | `api/admin/endpoints.py` |
| `api/admin/emergency_endpoint.py` | `api/admin/emergency_endpoints.py` |
| `api/emergency/endpoint.py` | `api/emergency/endpoints.py` |
| `api/secretary/endpoint.py` | `api/secretary/endpoints.py` |
| `api/request/endpoint.py` | `api/request/endpoints.py` |
| `api/notification/endpoint.py` | `api/notification/endpoints.py` |
| `api/ai/endpoint.py` | `api/ai/endpoints.py` |

## Domain → Model Mapping

| Domain | Models |
|---|---|
| `auth/domain/model.py` | `User`, `Society`, `society_trusted_providers` |
| `service/domain/model.py` | `ServiceProvider`, `ServiceCertificate`, `SocietyRequest`, `ProviderPoints` |
| `booking/domain/model.py` | `ServiceBooking`, `BookingStatusHistory`, `BookingChat`, `BookingReview` |
| `maintenance/domain/model.py` | `MaintenanceTask` |
| `notification/domain/model.py` | `Notification` |
| `request/domain/model.py` | `ServiceRequest`, `ServiceRequestRecipient`, `ServiceRequestResponse` |
| `emergency/domain/model.py` | `EmergencyConfig`, `EmergencyPenaltyConfig`, `EmergencyRequest`, `EmergencyResponse`, `EmergencyStarAdjustment` |

## Import Rules
- All domain `model.py` files import `Base` from `app.core.db.base`
- All endpoints import schemas from their own `api/<module>/schemas.py`
- All endpoints import deps from `app.common.deps` (or module-level `api/<module>/deps.py`)
- `main.py` router imports update from `api/<module>/endpoints.py`
- Alembic `env.py` imports all domain models explicitly to register them with `Base.metadata`
- Cross-domain model references (e.g. `ServiceProvider` referencing `User`) use string-based SQLAlchemy relationship names — no circular imports

## Key Constraints
- `uvicorn app.main:app` command unchanged
- Docker, docker-compose, alembic.ini unchanged
- Frontend API calls unchanged (no URL changes)
- Alembic migration files untouched — only `alembic/env.py` import updated
- Old `internal/` folder deleted after all files migrated
- Old `api/task/` folder deleted after rename to `api/maintenance/`

# UUID Primary Keys Migration — Design Spec
**Date:** 2026-04-06  
**Status:** Approved

---

## Overview

Migrate every table in `homecare_db` from `Integer` primary keys to PostgreSQL native `UUID` primary keys. All foreign key columns are updated to match. The database is a clean dev/test instance with no existing data to preserve.

---

## Goals

- Every record in every table is globally uniquely identifiable by a UUID.
- No sequential integer IDs exposed in any API response or URL.
- PostgreSQL native `UUID` type (16-byte storage, efficient indexing).
- Zero frontend breaking changes — JSON serializes UUIDs as strings, same as before.

---

## Tables Affected

| Table | Current PK | New PK | Notes |
|---|---|---|---|
| `users` | `Integer id` + `String user_uuid` | `UUID id` | Remove redundant `user_uuid` column |
| `societies` | `Integer id` | `UUID id` | |
| `service_providers` | `Integer id` | `UUID id` | |
| `service_certificates` | `Integer id` | `UUID id` | |
| `service_bookings` | `Integer id` | `UUID id` | `source_id` (nullable, untyped) → `UUID` |
| `booking_status_history` | `Integer id` | `UUID id` | |
| `booking_chats` | `Integer id` | `UUID id` | |
| `booking_reviews` | `Integer id` | `UUID id` | |
| `maintenance_tasks` | `Integer id` | `UUID id` | |
| `notifications` | `Integer id` | `UUID id` | |
| `society_requests` | `Integer id` | `UUID id` | |
| `service_requests` | `Integer id` | `UUID id` | |
| `service_request_recipients` | `Integer id` | `UUID id` | |
| `service_request_responses` | `Integer id` | `UUID id` | |
| `emergency_config` | `Integer id` | `UUID id` | |
| `emergency_penalty_config` | `Integer id` | `UUID id` | |
| `emergency_requests` | `Integer id` | `UUID id` | |
| `emergency_responses` | `Integer id` | `UUID id` | |
| `emergency_star_adjustments` | `Integer id` | `UUID id` | |
| `society_trusted_providers` | Composite Integer FKs | Composite UUID FKs | Association table |

---

## Model Changes (`models.py`)

- Replace `from sqlalchemy import ..., Integer` with UUID imports:
  ```python
  from sqlalchemy.dialects.postgresql import UUID as PG_UUID
  import uuid
  ```
- Every `id = Column(Integer, primary_key=True, index=True)` becomes:
  ```python
  id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
  ```
- Every FK `Column(Integer, ForeignKey("table.id"))` becomes:
  ```python
  Column(PG_UUID(as_uuid=True), ForeignKey("table.id"))
  ```
- Remove `user_uuid` field from `User` model entirely.
- `ServiceBooking.source_id`: change from `Column(Integer, nullable=True)` to `Column(PG_UUID(as_uuid=True), nullable=True)`.

---

## Schema Changes (`schemas.py`)

- Add `from uuid import UUID` import.
- All `id: int` fields in response/base schemas → `id: UUID`.
- All FK reference fields (`user_id: int`, `provider_id: int`, etc.) → `UUID`.
- Pydantic v2 serializes `UUID` objects as strings automatically in JSON responses.

---

## API Endpoint Changes

Every path parameter typed as `int` that represents a record ID changes to `UUID`:

| File | Parameters to update |
|---|---|
| `api/booking/endpoint.py` | `booking_id`, `provider_id` |
| `api/request/endpoint.py` | `request_id`, `response_id`, `provider_id` |
| `api/emergency/endpoint.py` | `request_id`, `response_id` |
| `api/admin/endpoint.py` | `provider_id`, `user_id`, `society_id`, `request_id`, `task_id` |
| `api/admin/emergency_endpoint.py` | `request_id`, `config_id`, `adjustment_id` |
| `api/service/endpoint.py` | `booking_id`, `request_id`, `response_id` |
| `api/user/endpoint.py` | `task_id`, `booking_id`, `request_id` |
| `api/secretary/endpoint.py` | `society_id`, `provider_id`, `request_id` |
| `api/task/endpoint.py` | `task_id` |
| `api/notification/endpoint.py` | `notification_id` |

Import `from uuid import UUID` in each endpoint file.

---

## Migration Strategy

**Approach:** Add one new Alembic migration on top of existing history. Run full downgrade then upgrade on the clean dev DB.

### New Migration File
`backend/alembic/versions/06_04_2026_uuid_primary_keys.py`

The migration:
1. Drops all tables in reverse FK dependency order (no constraint violations).
2. Recreates all tables using `op.create_table()` with UUID columns.

### Drop Order (reverse FK dependency)
1. `emergency_star_adjustments`
2. `emergency_responses`
3. `emergency_requests`
4. `emergency_penalty_config`
5. `emergency_config`
6. `service_request_responses`
7. `service_request_recipients`
8. `service_requests`
9. `society_requests`
10. `notifications`
11. `maintenance_tasks`
12. `booking_reviews`
13. `booking_chats`
14. `booking_status_history`
15. `service_bookings`
16. `service_certificates`
17. `society_trusted_providers`
18. `service_providers`
19. `societies`
20. `users`

### Run Commands
```bash
cd backend
alembic downgrade base
alembic upgrade head
```

---

## Frontend Impact

**None.** The frontend communicates with the backend via JSON. Integer IDs and UUID strings are both serialized as JSON values. The frontend never does arithmetic on IDs — it passes them around as strings in URL paths and request bodies. No frontend code needs to change.

---

## Out of Scope

- No changes to authentication logic (JWT tokens remain username/email based).
- No changes to WebSocket logic.
- No changes to frontend components or pages.
- No data migration scripts (clean DB).

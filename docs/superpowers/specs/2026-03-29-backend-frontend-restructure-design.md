# Homecare Hub — Backend & Frontend Restructure Design
**Date:** 2026-03-29
**Approach:** Option B — Backend first, then Frontend
**Constraint:** No empty directories or placeholder files. Only create what has real content.

---

## 1. Goals

1. Migrate backend from `app/` flat structure to `src/` domain-based structure.
2. Split monolithic `models.py`, `schemas.py`, and `services.py` into per-domain files.
3. Rename `endpoint.py` → `router.py` in every API domain.
4. Add `src/auth/` (JWT/permissions logic) and `src/common/` (exceptions/logger) by extracting from existing files.
5. Update `alembic/env.py` import to point at `src.models`.
6. Frontend: add `types/` directory with extracted TypeScript interfaces; resolve duplicate `ProviderCard` component; leave all pages and URLs unchanged.

---

## 2. Backend Architecture

### 2.1 Directory Mapping

#### Core layer (straight moves)
| Old path | New path |
|---|---|
| `app/main.py` | `src/main.py` |
| `app/core/config.py` | `src/core/config.py` |
| `app/core/database.py` | `src/core/database.py` |
| `app/core/security.py` | `src/core/security.py` |
| `app/internal/deps.py` | `src/core/dependencies.py` |

#### Models — split `app/internal/models.py`
| New file | Contains |
|---|---|
| `src/models/user.py` | User model |
| `src/models/society.py` | Society, SecurityStaff models |
| `src/models/servicer.py` | ProviderProfile, Certificate models |
| `src/models/booking.py` | ServiceRequest, BookingStatus models |
| `src/models/maintenance.py` | MaintenanceTask model |
| `src/models/notification.py` | Notification model |
| `src/models/task.py` | RoutineTask model |
| `src/models/__init__.py` | Re-exports all models (used by alembic) |

#### API endpoints — rename + split schemas
| Old path | New router | New schemas |
|---|---|---|
| `app/api/auth/endpoint.py` | `src/api/auth/router.py` | `src/api/auth/schemas.py` |
| `app/api/user/endpoint.py` | `src/api/user/router.py` | `src/api/user/schemas.py` |
| `app/api/booking/endpoint.py` | `src/api/booking/router.py` | `src/api/booking/schemas.py` |
| `app/api/service/endpoint.py` | `src/api/service/router.py` | `src/api/service/schemas.py` |
| `app/api/task/endpoint.py` | `src/api/task/router.py` | `src/api/task/schemas.py` |
| `app/api/admin/endpoint.py` | `src/api/admin/router.py` | `src/api/admin/schemas.py` |
| `app/api/notification/endpoint.py` | `src/api/notification/router.py` | `src/api/notification/schemas.py` |
| `app/api/ai/endpoint.py` | `src/api/ai/router.py` | *(no schemas, inline only)* |

#### Services — split `app/internal/services.py`
| New file | Covers |
|---|---|
| `src/services/auth_service.py` | Login, token, password reset logic |
| `src/services/user_service.py` | User CRUD, profile ops |
| `src/services/booking_service.py` | Service request lifecycle |
| `src/services/servicer_service.py` | Provider profile, certs, ratings |
| `src/services/society_service.py` | Society management |
| `src/services/maintenance_service.py` | Maintenance tasks, routine tasks |
| `src/services/notification_service.py` | Alert creation and retrieval |

#### New additions (content extracted from existing files)
| New file | Source |
|---|---|
| `src/auth/jwt.py` | JWT encode/decode from `security.py` |
| `src/auth/permissions.py` | Role checks from `deps.py` |
| `src/auth/roles.py` | `UserRole` enum from `schemas.py` |
| `src/common/exceptions.py` | Custom HTTP exception classes |
| `src/common/logger.py` | Centralized logging setup |

### 2.2 Import Convention
- All files inside `src/` use absolute imports: `from src.x.y import z`
- Old pattern `from app.x.y import z` is fully replaced everywhere
- `alembic/env.py` updated: `from src.models import Base`
- `scripts/` files updated to use `src.` imports where applicable

### 2.3 What Does NOT Change
- `alembic/` directory structure and migrations — untouched
- `scripts/` directory — files stay, only imports updated
- `backend/.env` — untouched
- `alembic.ini` naming convention — untouched

---

## 3. Frontend Architecture

### 3.1 What Does NOT Change
- All `app/` pages — no moves, no URL changes
- `components/bookings/`, `components/dashboard/`, `components/layout/`, `components/ui/`
- `hooks/useServicerProfile.ts`
- `lib/api.ts`, `lib/auth.ts`, `lib/design-tokens.ts`
- `styles/globals.css`

### 3.2 Add `types/` Directory
Extract TypeScript interfaces currently scattered across component and page files:

| New file | Contains |
|---|---|
| `frontend/types/user.ts` | `User`, `UserRole`, `UserProfile` interfaces |
| `frontend/types/booking.ts` | `Booking`, `BookingStatus`, `ServiceRequest` interfaces |
| `frontend/types/servicer.ts` | `Servicer`, `ServicerProfile`, `Rating` interfaces |
| `frontend/types/society.ts` | `Society`, `SocietyMember` interfaces |
| `frontend/types/api.ts` | `APIResponse<T>`, `PaginatedResponse<T>` generics |

Only created if real types are extracted. No empty files.

### 3.3 Resolve Duplicate ProviderCard
Two files with the same name exist:
- `components/bookings/ProviderCard.tsx`
- `components/community/ProviderCard.tsx`

These will be read and compared. The less-featured one will be deleted and any consumers updated to import from the surviving file.

---

## 4. Data Flow (unchanged)

```
React → apiFetch (lib/api.ts) → Bearer Token → FastAPI (src/main.py)
     → src/api/<domain>/router.py
     → src/services/<domain>_service.py
     → src/models/<model>.py (SQLAlchemy)
     → PostgreSQL
```

---

## 5. Error Handling

- `src/common/exceptions.py` defines `NotFoundError`, `UnauthorizedError`, `ValidationError` as typed `HTTPException` subclasses
- All routers raise these instead of raw `HTTPException` where applicable
- No changes to existing error behavior — only consolidation

---

## 6. Testing

- Existing test files (`test_db.py`, `test_routine_api.py`, `test_signup.py`) stay at `backend/` root
- Imports in test files updated from `app.` → `src.`
- No new test files created as part of this refactor

---

## 7. Implementation Order

### Phase 1 — Backend
1. Create `src/` directory skeleton (only dirs that will have files)
2. Move and split `models.py` into `src/models/`
3. Move `core/` files, rename `deps.py` → `dependencies.py`
4. Extract `src/auth/` content from `security.py` and `deps.py`
5. Create `src/common/exceptions.py` and `src/common/logger.py`
6. Split `schemas.py` — move schemas into each `src/api/<domain>/schemas.py`
7. Split `services.py` → `src/services/` domain files
8. Move and rename each `endpoint.py` → `src/api/<domain>/router.py`, update imports
9. Write `src/main.py` with updated router registrations
10. Update `alembic/env.py` and `scripts/` imports
11. Verify: `python -c "from src.main import app"` and `alembic current`

### Phase 2 — Frontend
12. Read and compare duplicate `ProviderCard` components, delete the lesser one
13. Extract TypeScript interfaces into `frontend/types/`
14. Update imports in files that used the deleted ProviderCard
15. Verify: `npm run build` passes in `frontend/`

---

## 8. Success Criteria

- [ ] `python -c "from src.main import app; print('OK')"` succeeds from `backend/`
- [ ] `alembic current` resolves without import errors
- [ ] All existing API routers registered and reachable
- [ ] `npm run build` passes in `frontend/` with no type errors
- [ ] No file in the codebase contains `from app.` imports
- [ ] No empty `__init__.py`-only directories in `src/`

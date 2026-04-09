# Architecture — Homecare Hub

Technical deep-dive into system design, data models, and logic flows.

---

## System Overview

Homecare Hub is a **decoupled monorepo**:

| Layer | Technology | Version |
| :--- | :--- | :--- |
| Frontend | Next.js (App Router) | 16.1.6 |
| UI Runtime | React | 19.2.3 |
| Backend | FastAPI (Python) | Latest stable |
| ORM | SQLAlchemy | 2.0 |
| Schema validation | Pydantic | v2 |
| Database | PostgreSQL | Any modern |
| Migrations | Alembic | — |

Communication: The frontend calls the backend exclusively via the central `apiFetch` wrapper in `lib/api.ts`, which injects the Bearer token and handles 401 redirects.

---

## Data Architecture

### Entity Relationship Overview

| Entity | Description | Key Relationships |
| :--- | :--- | :--- |
| **User** | System identity with role enum | Creates bookings & requests; owns society (if SECRETARY) |
| **ServiceProvider** | Professional profile attached to a User | Accepts bookings; belongs to Society trust list |
| **Society** | A residential community/building | Groups Users (residents); has a Secretary; curates Providers |
| **MaintenanceTask** | A logged home maintenance need | Linked to a ServiceBooking when a provider is assigned |
| **ServiceBooking** | The transactional record of a service event | Joins User + ServiceProvider + MaintenanceTask |
| **ServiceRequest** | A service request before assignment | Connects User → Provider (multi-provider accept/reject flow) |
| **ServiceCertificate** | Professional credential | Belongs to ServiceProvider |

### Role Enum (User.role)

```
ADMIN      — system superuser (seeded on startup)
SECRETARY  — society manager (self-register with society_id)
USER       — resident/homeowner (self-register)
SERVICER   — service professional (self-register)
```

### Booking State Machine

```
ServiceRequest created → Provider notified
    → Provider ACCEPTS → ServiceBooking created (status: PENDING)
    → Provider REJECTS → Request closed / re-broadcast
    
ServiceBooking:
  PENDING → IN_PROGRESS → COMPLETED
                        → CANCELLED
```

---

## Security & Identity

### Authentication

- **Token type**: JWT (JSON Web Tokens)
- **Expiry**: 24 hours (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Algorithm**: HS256 (configurable via `ALGORITHM` env var)
- **Password hashing**: PBKDF2 with SHA-256 via `passlib`

### Token Storage (Role-Segregated)

On login success, the frontend stores the token in role-specific localStorage keys, supporting multiple simultaneous sessions:

```typescript
// Role-specific keys: hc_token_ADMIN | hc_token_USER | hc_token_SERVICER | hc_token_SECRETARY
localStorage.setItem(`hc_token_${role}`, token)
localStorage.setItem(`hc_username_${role}`, username)
localStorage.setItem(`hc_uuid_${role}`, user_uuid)
// Cookie for Next.js middleware (server-side edge reads):
document.cookie = `hc_token_${role}=${token}; path=/; SameSite=Strict; Max-Age=28800`
```

On logout (role-specific):
```typescript
localStorage.removeItem(`hc_token_${role}`)
localStorage.removeItem(`hc_username_${role}`)
localStorage.removeItem(`hc_uuid_${role}`)
document.cookie = `hc_token_${role}=; path=/; Max-Age=0`
```

### Route Protection — Dual Layer

**Layer 1 — `middleware.ts` (server-side edge, runs before render)**
- Reads `hc_token` cookie
- No token on protected route → `302` to `/login`
- Valid token on `/login` → `302` to role's portal home
- Wrong role prefix (e.g., SECRETARY hitting `/admin/`) → `302` to correct home

**Layer 2 — `<AuthGuard>` (client-side React, each layout.tsx)**
- Reads `hc_role` from localStorage
- Verifies role matches the portal tree
- Shows full-page spinner while checking (prevents content flash)
- Redirects if mismatch (catches edge cases middleware may miss)

### Authorization (Backend)

FastAPI dependency `RoleChecker(["ROLE1", "ROLE2"])` applied at endpoint level:
- `admin_only` = `RoleChecker(["ADMIN"])`
- `secretary_only` = `RoleChecker(["SECRETARY"])`
- `get_current_user` = any authenticated user

### Super Admin Protection

The super admin account (`SUPERADMIN_EMAIL` in `.env`) is protected at two layers:
- Backend: role-change and delete endpoints reject requests targeting the super admin email
- Frontend: admin users page shows "Super Admin" badge instead of role dropdown; no delete button rendered for ADMIN-role rows

---

## Logic Flows

### 1. Login & Redirect Flow

```
POST /api/v1/auth/login
  → JWT returned
  → Frontend: set localStorage + cookie
  → Frontend: read role → redirect to portal root
  → middleware.ts: validates cookie on every subsequent request
```

### 2. Routine Service Booking Flow

```
USER opens Routine Wizard (/user/routine)
  → Selects service category (Plumbing / AC / Electrical / etc.)
  → Backend: GET /services/providers?category=X&location=Y
  → USER selects provider
  → POST /maintenance/routine/{provider_id}/assign
  → Backend: atomically creates MaintenanceTask + ServiceBooking
  → Booking appears in USER's ledger + Servicer's job board
```

### 3. Multi-Servicer Request Flow

```
USER creates ServiceRequest
  → Request broadcast to available providers in category
  → SERVICER: GET /service/jobs → sees incoming request
  → SERVICER accepts → ServiceBooking created (status: PENDING)
  → Other providers' copies of request are marked as closed
  → USER sees booking status update
```

### 4. Secretary Alert Flow

```
USER raises alert (/user/alerts)
  → POST /maintenance/alerts
  → MaintenanceTask created (unassigned)
  → SECRETARY: GET /secretary/alerts → sees new alert
  → SECRETARY assigns provider or closes alert
  → PATCH /secretary/alerts/{id}
```

---

## API Design

All endpoints versioned under `/api/v1`. Swagger UI at `http://localhost:8000/api/v1/docs`.

### Controller Responsibility Matrix

| Controller | Auth Required | Role Scope | Key Operations |
| :--- | :--- | :--- | :--- |
| `auth` | No (public) | All | Login, Register, Refresh |
| `user` | Yes | Self only | Profile read/update |
| `services` | Yes | USER + SECRETARY | Provider search, bookings, societies |
| `maintenance` | Yes | USER | Task creation, incident logging, assignment |
| `secretary` | Yes | SECRETARY only | Society CRUD, member list, alerts, trusted providers |
| `admin` | Yes | ADMIN only | User management, provider verification, booking audit, health check |

---

## Frontend Architecture

### Data Flow

```
React Component
  → calls apiFetch(path, options) from lib/api.ts
    → injects Authorization: Bearer <token>
    → on 401: clears localStorage/cookie → redirects /login
  → returns typed JSON response
  → setState → re-render
```

### Auth State

```
localStorage: { hc_token_ADMIN, hc_token_USER, hc_token_SERVICER, hc_token_SECRETARY }
              { hc_username_ROLE, hc_uuid_ROLE }  ← per-role metadata
Cookie:       { hc_token_ROLE: string }   ← role-specific, for middleware only
```

### Design System: ShigenTech Premium

- **Primary accent**: Emerald (`#064e3b` dark, `emerald-500` / `emerald-600` mid)
- **Backgrounds**: Slate scale (`slate-50` through `slate-900`)
- **Typography**: `font-black uppercase tracking-widest` for labels; `font-bold` for values
- **Card radius**: `rounded-2xl` / `rounded-[2.5rem]` for modals
- **Atomic components**: `Button.tsx`, `Card.tsx`, `Badge.tsx` in `components/ui/`
- **Icons**: `lucide-react` exclusively — no other icon library

---

## Database Migrations

- Tool: Alembic
- Config: `backend/alembic.ini`
- Naming: `DD_MM_YYYY_slug.py` (e.g., `29_03_2026_add_secretary_role.py`)
- Strategy: linear versioned migrations with `down_revision` tracking

```bash
alembic current          # show current migration head
alembic upgrade head     # apply all pending migrations
alembic revision -m "description"   # create new migration file
```

---

<div align="center">
  <p>For setup instructions see <a href="../README.md">README.md</a>. For file-by-file navigation see <a href="../PROJECT_MAP.md">PROJECT_MAP.md</a>.</p>
</div>

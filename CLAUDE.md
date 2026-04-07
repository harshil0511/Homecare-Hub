# 🛠️ CLAUDE.md - Development Playbook

Welcome to the **Homecare Hub** developer guide. This is the complete ground truth for local development, architecture, coding standards, and project-specific protocols.

> **IMPORTANT**: Before any code change, Claude must follow the rules in [`.claude/RULES.md`](.claude/RULES.md) and run the [`homecare-hub-safety`](.claude/skills/homecare-hub-safety.md) skill checklist.

## 📚 Detailed Structure References

For deep understanding of each layer, always refer to these files before working:

| Layer | Reference File | What it covers |
|---|---|---|
| Frontend (Next.js) | [`frontend/FRONTEND.md`](frontend/FRONTEND.md) | Pages, components, auth, API client, design system, coding rules |
| Backend (FastAPI) | [`backend/BACKEND.md`](backend/BACKEND.md) | Routers, models, schemas, deps, WebSocket, migrations, coding rules |

> Claude must read the relevant reference file before making any changes to frontend or backend code.

---

## 🚀 Quick-Start Commands

### Frontend (Next.js)
- **Install**: `npm install` (from `/frontend`)
- **Dev**: `npm run dev` (Port 3000)
- **Lint**: `npm run lint`
- **Build**: `npm run build`

### Backend (FastAPI)
- **Install**: `pip install -r requirements.txt` (from `/backend`)
- **Dev**: `uvicorn app.main:app --reload --port 8000` (from `/backend`)
- **Test**: `pytest`

### Database (Alembic)
- **Current**: `alembic current`
- **Upgrade**: `alembic upgrade head`
- **New Migration**: `alembic revision -m "description"`
  - *Naming Style*: `DD_MM_YYYY_slug.py` (managed by `alembic.ini`)

### Docker
- **Start all**: `docker-compose up --build`
- **Backend Port**: 8002, **Frontend Port**: 3000, **PostgreSQL Port**: 5435

---

## 📍 Environment Configuration

**Backend** (`backend/.env`):
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL (currently `480` = 8 hours) |
| `SUPERADMIN_EMAIL` | Auto-seeded admin email |
| `SUPERADMIN_PASSWORD` | Auto-seeded admin password |
| `SUPERADMIN_USERNAME` | Display name (default: `Super Admin`) |
| `FRONTEND_URL` | CORS origin (default: `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | Claude AI integration key |

**Frontend** (`frontend/.env.local`):
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | e.g. `http://localhost:8000/api/v1` |

---

## 🎨 Coding Standards

### Python (Backend)
- **Style**: PEP 8, 4-space indentation
- **Typing**: Strict type hints on all function arguments and return types
- **Models**: SQLAlchemy 2.0 style (`Mapped` / `mapped_column`)
- **Schemas**: Pydantic v2 for validation and serialization
- **Error Handling**: `HTTPException` with meaningful status codes and `detail` messages

### TypeScript / React (Frontend)
- **Style**: Modern functional components with Hooks, `"use client"` where needed
- **Props**: Defined via `interface ComponentProps { ... }`
- **Icons**: `lucide-react` for all icons
- **Design System**: "ShigenTech Premium" — Emerald/Charcoal palette
- **Fonts**: Manrope + Inter (Google Fonts via `layout.tsx`)
- **Styling**: Tailwind CSS utility-first; light theme only (dark mode disabled)

---

## 🔧 Project Architecture

### Directory Structure
```
homecare-hub/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, routers, lifespan
│   │   ├── api/                 # Route handlers by domain
│   │   │   ├── auth/endpoint.py
│   │   │   ├── user/endpoint.py
│   │   │   ├── services/endpoint.py
│   │   │   ├── booking/endpoint.py
│   │   │   ├── maintenance/endpoint.py
│   │   │   ├── admin/endpoint.py
│   │   │   ├── emergency/endpoint.py
│   │   │   ├── requests/endpoint.py
│   │   │   ├── secretary/endpoint.py
│   │   │   └── notifications/endpoint.py
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings
│   │   │   ├── database.py      # SQLAlchemy engine, session, auto-seed
│   │   │   ├── security.py      # JWT creation, password hashing
│   │   │   └── scheduler.py     # APScheduler background jobs
│   │   ├── internal/
│   │   │   ├── models.py        # SQLAlchemy ORM models (22 tables)
│   │   │   ├── schemas.py       # Pydantic request/response schemas
│   │   │   ├── deps.py          # FastAPI dependencies (auth, role check)
│   │   │   └── services.py      # Business logic helpers
│   │   └── websockets/
│   │       └── emergency.py     # WebSocket connection manager
│   ├── alembic/                 # Migration files (13 versions)
│   └── alembic.ini
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout (fonts, global styles)
│   │   ├── globals.css
│   │   ├── (public)/            # login, register, landing
│   │   ├── user/                # User portal pages
│   │   ├── service/             # Servicer portal pages
│   │   ├── admin/               # Admin portal pages
│   │   └── secretary/           # Secretary portal pages
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx       # Top nav with user info + logout
│   │   │   ├── Sidebar.tsx      # Role-based nav menu
│   │   │   ├── AuthGuard.tsx    # Client-side auth check
│   │   │   └── BackendStatus.tsx
│   │   ├── booking/             # Booking-related UI components
│   │   ├── dashboard/           # Dashboard widgets
│   │   └── ui/                  # Shared UI components
│   └── lib/
│       ├── api.ts               # apiFetch(), WebSocket helpers, API objects
│       ├── auth.ts              # Token storage, role utilities
│       ├── toast-context.tsx    # Toast notification context
│       └── ui.ts                # Tailwind class utilities
└── docker-compose.yml
```

### Data Flow
```
React Component
  → apiFetch() (lib/api.ts)
    → Bearer Token (role-specific localStorage key)
      → FastAPI Router
        → RoleChecker dependency
          → SQLAlchemy ORM
            → PostgreSQL
          → Pydantic response schema
        → JSON Response
  → Frontend State/Hook update
```

---

## 🔐 Role & Authentication System

### Four Roles
| Role | Portal Root | Capabilities |
|---|---|---|
| `ADMIN` | `/admin/dashboard` | Full system management, user/provider/emergency control |
| `SECRETARY` | `/secretary/dashboard` | Manage society, members, trusted providers |
| `USER` | `/user/dashboard` | Book services, create tasks, emergency SOS |
| `SERVICER` | `/service/dashboard` | Respond to requests, manage jobs and availability |

### JWT Implementation
- **Algorithm**: HS256
- **Token Claims**: `sub` (user UUID), `role`, `email`, `exp`
- **Token TTL**: `ACCESS_TOKEN_EXPIRE_MINUTES` (currently 480 = 8 hours)
- **Storage**: Role-segregated localStorage keys:
  - `hc_token_ADMIN`, `hc_token_USER`, `hc_token_SERVICER`, `hc_token_SECRETARY`
  - Also stores: `hc_username_{ROLE}`, `hc_uuid_{ROLE}`
- **Multi-session**: Same browser can be logged into multiple roles simultaneously

### Route Protection (Dual-Layer)
1. `frontend/middleware.ts` — server-side token check per route prefix (`/admin`, `/user`, `/service`, `/secretary`)
2. `<AuthGuard>` component — client-side check on page render

### Superadmin Rules
- User with `SUPERADMIN_EMAIL` is auto-assigned `ADMIN` role at startup
- Cannot be demoted via the role-change API endpoint

---

## 🗄️ Database Models (22 Tables)

All tables use **UUID primary keys**.

| Table | Key Fields |
|---|---|
| `users` | id, username, email, hashed_password, role, society_id, home_number |
| `societies` | id, name, address, owner_id, secretary_id, registration_number |
| `service_providers` | id, user_id, company_name, category, categories (JSON), is_verified, rating |
| `service_certificates` | id, provider_id, category, title, certificate_url, is_verified |
| `service_bookings` | id, user_id, provider_id, service_type, scheduled_at, status, source_type |
| `booking_status_history` | id, booking_id, status, notes, timestamp |
| `booking_chats` | id, booking_id, sender_id, message, timestamp |
| `booking_reviews` | id, booking_id, rating, quality_rating, punctuality_rating, professionalism_rating |
| `maintenance_tasks` | id, user_id, title, due_date, status, category, task_type, warning_sent, final_sent, overdue_sent |
| `notifications` | id, user_id, title, message, notification_type, is_read |
| `society_requests` | id, society_id, provider_id, sender_id, status |
| `service_requests` | id, user_id, device_or_issue, urgency, status, expires_at |
| `service_request_recipients` | id, request_id, provider_id, is_read |
| `service_request_responses` | id, request_id, provider_id, proposed_date, proposed_price, status |
| `emergency_config` | id, category (unique), callout_fee, hourly_rate |
| `emergency_penalty_config` | id, event_type (unique), star_deduction |
| `emergency_requests` | id, user_id, category, status, config_id, expires_at |
| `emergency_responses` | id, request_id, provider_id, arrival_time, status, penalty_count |
| `emergency_star_adjustments` | id, provider_id, delta, reason, event_type |
| `society_trusted_providers` | M2M: society_id ↔ provider_id (with created_at) |

### Key Relationships
- `User` → 1:1 → `ServiceProvider` (provider profile)
- `Society` → M2M → `ServiceProvider` (via `society_trusted_providers`)
- `ServiceBooking` → has → `BookingStatusHistory`, `BookingChat`, `BookingReview`
- `EmergencyRequest` → has → `EmergencyResponse[]` (cascade delete)
- `ServiceRequest` → has → `ServiceRequestRecipient[]`, `ServiceRequestResponse[]` (cascade delete)

---

## 🌐 API Endpoints (All prefixed `/api/v1`)

### Auth (`/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Register new user, create society for secretaries |
| POST | `/auth/login` | Login, returns JWT token |
| POST | `/auth/forgot-password` | Password reset (no auth) |

### User Profile (`/user`)
| Method | Path | Description |
|---|---|---|
| GET | `/user/me` | Get current user |
| PATCH | `/user/me` | Update username |
| POST | `/user/me/change-password` | Change password |

### Services & Societies (`/services`)
| Method | Path | Description |
|---|---|---|
| POST | `/services/societies` | Create society |
| GET | `/services/societies` | List all societies |
| POST | `/services/societies/join/{society_id}` | Join society |
| PATCH | `/services/societies/{society_id}` | Update society |
| GET | `/services/societies/{society_id}/providers` | Get trusted providers |
| POST | `/services/societies/{society_id}/trust/{provider_id}` | Add to trust list |
| POST | `/services/providers` | Register as provider |
| GET | `/services/providers` | List providers (sorted by rating DESC, with filters) |
| GET | `/services/providers/{provider_id}` | Provider detail |
| PATCH | `/services/providers/{provider_id}` | Update provider profile |
| POST | `/services/providers/{provider_id}/certificates` | Upload certificate |
| PATCH | `/services/providers/{provider_id}/availability` | Update availability |

### Bookings (`/bookings`)
| Method | Path | Description |
|---|---|---|
| POST | `/bookings/create` | Create booking (3-hour conflict check) |
| GET | `/bookings/` | List bookings |
| GET | `/bookings/{booking_id}` | Booking detail with history + chat |
| PATCH | `/bookings/{booking_id}` | Update status |
| POST | `/bookings/{booking_id}/reschedule` | Reschedule |
| POST | `/bookings/{booking_id}/cancel` | Cancel |
| POST | `/bookings/{booking_id}/chat` | Add chat message |
| POST | `/bookings/{booking_id}/review` | Submit review/rating |

### Maintenance Tasks (`/maintenance`)
| Method | Path | Description |
|---|---|---|
| POST | `/maintenance/` | Create task |
| GET | `/maintenance/` | List tasks |
| PATCH | `/maintenance/{task_id}` | Update task |
| POST | `/maintenance/{task_id}/assign` | Assign to provider |
| GET | `/maintenance/routine` | List routine tasks |
| POST | `/maintenance/routine` | Create routine task |

### Service Requests (`/requests`)
| Method | Path | Description |
|---|---|---|
| POST | `/requests/` | Create request (broadcast to 1–10 providers) |
| GET | `/requests/` | List user's requests |
| GET | `/requests/{request_id}` | Request detail |
| PATCH | `/requests/{request_id}` | Update status |
| POST | `/requests/{request_id}/response` | Provider submits proposal |
| PATCH | `/requests/{request_id}/response/{response_id}` | Accept/reject proposal |
| GET | `/requests/incoming` | Incoming requests for servicer |

### Emergency SOS (`/emergency`)
| Method | Path | Description |
|---|---|---|
| GET | `/emergency/config` | Get pricing config |
| GET | `/emergency/providers` | Available emergency providers |
| POST | `/emergency/` | Create SOS request |
| GET | `/emergency/{request_id}` | Request detail |
| PATCH | `/emergency/{request_id}/status` | Update status |
| POST | `/emergency/{request_id}/response` | Servicer submits response |
| PATCH | `/emergency/{request_id}/response/{response_id}` | Update response status |

### Notifications (`/notifications`)
| Method | Path | Description |
|---|---|---|
| GET | `/notifications/` | List notifications |
| PATCH | `/notifications/{id}` | Mark as read |
| DELETE | `/notifications/{id}` | Delete |

### Admin (`/admin`)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | Dashboard stats |
| GET | `/admin/users` | All users |
| PATCH | `/admin/users/{uuid}/role` | Change role (cannot assign ADMIN) |
| PATCH | `/admin/users/{uuid}/activate` | Toggle active |
| DELETE | `/admin/users/{uuid}` | Delete user |
| GET | `/admin/bookings` | All bookings |
| GET | `/admin/providers` | All providers (sorted by rating DESC) |
| PATCH | `/admin/providers/{id}/verify` | Verify provider |
| PATCH | `/admin/providers/{id}/revoke-verify` | Revoke provider verification |
| GET | `/admin/logs` | Activity logs |
| GET | `/admin/health` | System health check |

### Admin Emergency (`/admin/emergency`)
| Method | Path | Description |
|---|---|---|
| GET/POST | `/admin/emergency/config` | Manage category pricing configs |
| PATCH | `/admin/emergency/config/{id}` | Update config |
| GET/PATCH | `/admin/emergency/penalty-config` | Manage penalty configs |
| GET | `/admin/emergency/requests` | All emergency requests |
| POST | `/admin/emergency/requests/{id}/penalty` | Apply penalty to servicer |

### Secretary (`/secretary`)
| Method | Path | Description |
|---|---|---|
| GET | `/secretary/society` | Get assigned society |
| PATCH | `/secretary/society` | Update society |
| GET | `/secretary/members` | List society members |
| POST | `/secretary/members/{user_id}/assign` | Assign home number |
| GET | `/secretary/alerts` | Member maintenance alerts |
| GET | `/secretary/providers` | Trusted providers |
| POST | `/secretary/providers` | Request to trust provider |
| PATCH | `/secretary/provider-requests/{id}` | Accept/reject request |

### AI (`/ai`)
| Method | Path | Description |
|---|---|---|
| POST | `/ai/chat` | Chat with Claude AI (Anthropic SDK) |

### WebSocket Endpoints
| Path | Description |
|---|---|
| `/ws/emergency/{request_id}` | User watches SOS request (real-time) |
| `/ws/servicer/alerts` | Servicer receives emergency broadcasts |

---

## 📱 Frontend Pages

### User Portal (`/user`)
| Page | Path |
|---|---|
| Dashboard | `/user/dashboard` |
| Bookings & Requests | `/user/bookings` |
| Booking Detail | `/user/bookings/[id]` |
| Emergency History | `/user/bookings/emergency` |
| Find Providers | `/user/providers` |
| Routine Tasks | `/user/routine` |
| Alerts | `/user/alerts` |
| Settings | `/user/settings/{profile,password,notifications,account}` |

### Servicer Portal (`/service`)
| Page | Path |
|---|---|
| Dashboard | `/service/dashboard` |
| Jobs | `/service/jobs` |
| Ratings | `/service/ratings` |
| Analytics | `/service/analytics` |
| Profile | `/service/profile` |
| Settings | `/service/settings/...` |

### Admin Portal (`/admin`)
| Page | Path |
|---|---|
| Dashboard | `/admin/dashboard` |
| Users | `/admin/users` |
| Providers | `/admin/providers` |
| Bookings | `/admin/bookings` |
| Emergency SOS | `/admin/emergency` |
| System Logs | `/admin/logs` |
| Settings | `/admin/settings/...` |

### Secretary Portal (`/secretary`)
| Page | Path |
|---|---|
| Dashboard | `/secretary/dashboard` |
| Members | `/secretary/members` |
| Alerts | `/secretary/alerts` |
| Providers | `/secretary/providers` |
| Society Edit | `/secretary/society` |
| Settings | `/secretary/settings/...` |

---

## ⚙️ Background Jobs & Automation

**APScheduler** runs hourly maintenance task alert checks:

| Alert Stage | Trigger | Action |
|---|---|---|
| WARNING | 2 days before due date | Sends notification, sets `warning_sent=True` |
| FINAL | Day of due date | Sends notification, sets `final_sent=True` |
| OVERDUE | Past due date | Sends notification, sets `overdue_sent=True` |
| AUTO-EXPIRE | 7 days after overdue | Marks task as expired |

**Emergency SOS Penalty Events** (via `emergency_penalty_config`):
- `LATE_ARRIVAL` — provider arrives late
- `CANCELLATION` — provider cancels
- `NO_SHOW` — provider does not show up

Each event deducts star rating from provider per configured `star_deduction`.

---

## 🔑 Business Logic Rules

- **Booking Conflict Window**: 3 hours (`BOOKING_CONFLICT_WINDOW_HOURS = 3`)
- **Emergency Rate Multiplier**: 1.5× (`EMERGENCY_RATE_MULTIPLIER = 1.5`)
- **Service Request Recipients**: 1–10 providers (Pydantic validated)
- **Password Rules**: min 6 chars, at least 1 uppercase, 1 special char (`@#$!%*?&`)
- **Provider Availability States**: `AVAILABLE`, `WORKING`, `VACATION`
- **Booking Statuses**: `Pending`, `Accepted`, `In Progress`, `Completed`, `Cancelled`
- **Task Statuses**: `Pending`, `In Progress`, `Completed`, `Expired`
- **Request Statuses**: `OPEN`, `CLOSED`, `EXPIRED`
- **Emergency Statuses**: `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED`
- **Allowed Service Categories**: AC Service, Appliance Repair, Home Cleaning, Plumbing, Electrical, Pest Control, Painting, Carpentry, General Maintenance
- **Emergency Categories**: Electrical, Plumbing, Gas Leak, Lock/Door, Appliance Failure, Structural, Pest, Other
- **JSON Stored as Text**: `categories`, `availability`, `photos`, `preferred_dates` fields use JSON serialized as text columns
- **Provider Star Rating**: Points-based, uncapped. `100 pts = 1 star`. New providers start at `0.0`. Auto-verify triggers at `≥ 10.0` stars (1000 pts) — sets `is_verified = True` and sends a `SYSTEM` notification. All provider list endpoints sorted by `rating DESC`
- **Point Events** (`point_engine.py`): `EMERGENCY_COMPLETE` +35, `URGENT_COMPLETE` +20, `REGULAR_COMPLETE` +15, `FEEDBACK_5_STAR` +10, `FEEDBACK_4_STAR` +8, `FEEDBACK_3_STAR` +5, `FEEDBACK_2_STAR` +2, `EMERGENCY_CANCEL` −20, `REGULAR_CANCEL` −10
- **Provider Response Fields**: `completed_jobs` and `emergency_jobs` are computed via batch SQL queries and annotated on every provider list response (not stored in DB)
- **Star Display (UI)**: All provider star ratings shown as `★ X.X` numeric format (e.g. `★ 8.4`). New providers (0 pts) show `★ New`

---

## 🔧 Key Technical Patterns

### Backend
- **Dependency Injection**: `Depends(get_db)`, `Depends(get_current_user)`, `Depends(RoleChecker([...]))`
- **UUID Foreign Keys**: All cross-table references use UUID strings
- **Cascade Deletes**: `ServiceRequest → recipients/responses`, `EmergencyRequest → responses`
- **Naive UTC Datetimes**: All DB datetimes stored without timezone (`tzinfo=None`)
- **WebSocket Manager**: Singleton `EmergencyConnectionManager` with two connection dicts
- **Point Engine**: `app/internal/point_engine.py` — `award_points()` inserts a `ProviderPoints` row, recalculates `ServiceProvider.rating` from total points, and triggers auto-verify. Call this for all job completion, review, and cancellation events — never mutate `rating` directly elsewhere

### Frontend
- **API Client**: `apiFetch()` in `lib/api.ts` — handles auth headers, 401 redirect, timeouts, FormData
- **Multi-session Tokens**: Role-segregated localStorage, multiple simultaneous logins supported
- **Pathname Role Detection**: `getRoleFromPath()` reads current URL to pick correct token
- **WebSocket Helpers**: `createUserEmergencySocket()`, `createServicerAlertSocket()` in `lib/api.ts`

### Database
- **UUID PKs**: All tables (converted in migration `06_04_2026_uuid_primary_keys.py`)
- **Superadmin Seeding**: Auto-seeded on first DB connection in `database.py`
- **Connection Retry**: Background thread retries DB connection if unavailable at startup
- **Pool Settings**: `pool_pre_ping=True`, recycle every 1800 seconds

---

## 📦 Dependencies

### Backend (key packages)
- `fastapi`, `uvicorn` — HTTP server
- `sqlalchemy`, `psycopg2`/`psycopg` — ORM + PostgreSQL driver
- `pydantic`, `pydantic-settings` — schemas and config
- `alembic` — migrations
- `python-jose` — JWT
- `passlib` — password hashing (PBKDF2-SHA256)
- `apscheduler` — background jobs
- `anthropic` — Claude AI SDK

### Frontend (key packages)
- `next` 16.x, `react` 19.x — framework
- `tailwindcss` 4.x — styling
- `lucide-react` — icons
- `axios` — HTTP client
- `date-fns` — date utilities

---

## 📋 Migration History

| File | What Changed |
|---|---|
| `17_03_2026_add_location_and_profile_photo_to_provider` | Location, profile_photo_url |
| `17_03_2026_add_society_security_and_servicer_mastery` | Registration number, mastery fields |
| `17_03_2026_expand_provider_profile_and_certificates` | Expanded provider profiles |
| `17_03_2026_fix_society_relationships_and_add_servicer_fields` | Relationship fixes |
| `24_03_2026_add_routine_task_fields_to_maintenance_tasks` | Routine task support |
| `30_03_2026_add_service_request_workflow` | Service request tables |
| `01_04_2026_add_completion_fields_to_bookings` | Booking completion tracking |
| `04_04_2026_add_emergency_sos_system` | Emergency SOS core tables |
| `04_04_2026_add_home_number_to_users` | Home number assignment |
| `04_04_2026_add_title_to_service_certificates` | Certificate title field |
| `05_04_2026_add_alert_fields` | Alert notification fields |
| `06_04_2026_uuid_primary_keys` | UUID PK conversion (all tables) |

---

<div align="center">
  <p>Refer to <a href="README.md">README.md</a> for high-level project goals.</p>
</div>

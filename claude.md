# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Commands

### Frontend (Next.js) — run from `frontend/`
```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run dev:clean    # Clear .next cache then start dev
```

### Backend (FastAPI) — run from `backend/`
```bash
npm run dev          # Start uvicorn on 0.0.0.0:8000 (uses venv Python)
```
The backend dev script uses `.\venv\Scripts\python.exe` directly — the venv must exist at `backend/venv/`. Install dependencies manually into the venv when needed.

### Database Migrations (Alembic) — run from `backend/`
```bash
.\venv\Scripts\python.exe -m alembic revision --autogenerate -m "description"
.\venv\Scripts\python.exe -m alembic upgrade head
```
SQLite is used for local dev (`homecare.db` in `backend/`). Tables are also auto-created on startup via `Base.metadata.create_all` in `main.py`.

### API Docs
Swagger UI: `http://localhost:8000/api/v1/docs`

---

## Architecture

**Monorepo** with two independent apps sharing no build system:
- `frontend/` — Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- `backend/` — FastAPI, SQLAlchemy, Pydantic, python-jose (JWT)

### Backend Structure
- **`app/main.py`** — FastAPI app creation, CORS config, router registration, static file serving for `/uploads`
- **`app/core/`** — `config.py` (pydantic-settings from `.env`), `security.py` (JWT + password hashing with pbkdf2_sha256), `database.py` (SQLAlchemy engine/session)
- **`app/internal/models.py`** — All SQLAlchemy ORM models
- **`app/internal/schemas.py`** — All Pydantic request/response schemas
- **`app/api/`** — Route modules, each with `endpoint.py`: `auth`, `user`, `service`, `task`, `admin`, `booking`, `ai`, `notification`

API prefix pattern: all routes mounted under `/api/v1/<module>`.

### Frontend Structure
- **`app/`** — Next.js App Router pages
- **`components/layout/`** — `Sidebar.tsx` (role-based nav), `AuthGuard.tsx` (route protection), `BackendStatus.tsx` (API health)
- **`components/ui/`** — Atomic components: `Button`, `Card`, `Input`, `Badge`
- **`components/bookings/`** — `ProviderCard`, `ServiceSelector`, `TimeSlotPicker`, `BookingStatusTimeline`, `ReviewModal`
- **`components/dashboard/`** — `StatsCards`, `RecentActivity`, `AlertsPreview`, `BookingModal`
- **`lib/api.ts`** — `apiFetch()` wrapper: auto-attaches JWT from localStorage (`hc_token`), handles 401 redirect, 10s timeout
- **`lib/auth.ts`** — LocalStorage helpers. Keys: `hc_token`, `hc_role`, `hc_username`, `hc_uuid`
- **`lib/design-tokens.ts`** — Design system tokens (colors, typography, shadows)

---

## All Routes & Pages

### Auth
| Route | Description |
|-------|-------------|
| `/login` | Login page |
| `/register` | Registration |

### User Dashboard (requires AuthGuard)
| Route | Description |
|-------|-------------|
| `/dashboard` | Home — stats, recent activity |
| `/dashboard/bookings` | My bookings list |
| `/dashboard/bookings/new` | Create booking (5-step wizard, task-linking, URL params) |
| `/dashboard/bookings/[id]` | Booking detail, chat, cancel/reschedule |
| `/dashboard/bookings/history` | Booking history |
| `/dashboard/bookings/emergency` | Emergency booking flow |
| `/dashboard/providers` | Browse & search providers (keyboard nav ↑↓) |
| `/dashboard/maintenance` | Maintenance tasks |
| `/dashboard/routine` | Routine/recurring service tasks |
| `/dashboard/societies` | My societies/communities |
| `/dashboard/societies/recruit` | Recruit providers to a society |
| `/dashboard/alerts` | Notifications/alerts |
| `/dashboard/logs` | Activity ledger |
| `/dashboard/reports` | Analytics & reports |
| `/dashboard/contacts` | Community contacts |
| `/dashboard/settings/profile` | Profile settings |
| `/dashboard/settings/password` | Change password |
| `/dashboard/settings/notifications` | Notification preferences |
| `/dashboard/settings/account` | Account settings |

### Servicer Dashboard (SERVICER role)
| Route | Description |
|-------|-------------|
| `/dashboard/servicer` | Servicer home |
| `/dashboard/servicer/jobs` | Incoming job requests |
| `/dashboard/servicer/profile` | Public profile view |
| `/dashboard/servicer/setup` | Setup wizard |
| `/dashboard/servicer/ratings` | Reviews & ratings |
| `/dashboard/provider/setup` | Provider profile setup |

### Admin
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard |
| `/admin/users` | Manage users & roles |
| `/admin/providers` | Verify providers |
| `/admin/bookings` | All bookings |
| `/admin/logs` | System logs |

---

## Backend API Reference

All endpoints prefixed `/api/v1/`.

### Auth (`/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup` | Register user |
| POST | `/login` | Login → returns `{access_token, role, user_uuid, username}` |
| POST | `/forgot-password` | Password reset (open) |

### User (`/user`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Current user profile |
| PATCH | `/me` | Update username |
| POST | `/me/change-password` | Change password |

### Services & Providers (`/services`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/providers` | Register as provider |
| GET | `/providers` | Search providers (params: `category`, `search`, `scheduled_at`) |
| GET | `/providers/me` | My provider profile |
| PATCH | `/providers/me` | Update profile |
| POST | `/providers/setup` | Complete setup wizard |
| PATCH | `/providers/availability` | Set AVAILABLE / WORKING / VACATION |
| POST | `/providers/upload-photo` | Upload profile photo (JPEG/PNG/WebP, max 5MB) |
| POST | `/providers/verify` | Auto-verify based on education keywords |
| POST | `/providers/certificates` | Upload certification |
| GET | `/providers/invitations` | Get society invitations (provider) |

### Societies (`/services/societies`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/societies` | Create society |
| GET | `/societies` | List all societies |
| PATCH | `/societies/{id}` | Update society |
| DELETE | `/societies/{id}` | Decommission society |
| POST | `/societies/join/{id}` | Join society |
| GET | `/societies/me/created` | My created societies |
| GET | `/societies/{id}/find-nearest` | Find nearby providers |
| GET | `/societies/{id}/trusted` | Get trusted providers |
| POST | `/societies/{id}/trust/{provider_id}` | Mark provider as trusted |
| POST | `/societies/{id}/recruit/{provider_id}` | Send recruitment request |
| POST | `/societies/request` | Send invitation (secretary/owner only) |
| GET | `/societies/requests/me` | My received invitations |
| GET | `/societies/{id}/requests` | Society's sent requests |
| POST | `/societies/requests/{id}/action` | Accept / Reject request |

### Bookings (`/booking`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/create` | Create booking (±3hr conflict detection) |
| GET | `/list` | My bookings (role-aware) |
| GET | `/incoming` | Incoming bookings (provider) |
| PATCH | `/{id}/status` | Update status + triggers notifications |
| PATCH | `/{id}/reschedule` | Reschedule |
| PATCH | `/{id}/cancel` | Cancel with reason |
| GET | `/{id}` | Full detail (chat, history, review) |
| POST | `/{id}/review` | Submit review (updates provider rating) |
| GET | `/{id}/chat` | Chat messages |
| POST | `/{id}/chat/message` | Send chat message |

### Tasks (`/maintenance`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | My maintenance tasks |
| POST | `/` | Create maintenance task |
| POST | `/routine` | Create routine task |
| GET | `/routine` | My routine tasks |
| GET | `/routine/{id}/providers` | Matching providers for routine task |
| POST | `/routine/{id}/assign` | Assign provider → auto-creates booking |

### Admin (`/admin`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Platform stats |
| GET | `/users` | All users |
| PATCH | `/users/{uuid}/role` | Change role |
| PATCH | `/users/{uuid}/activate` | Toggle active |
| GET | `/providers/pending` | Unverified providers |
| PATCH | `/providers/{id}/verify` | Verify provider |

### Notifications (`/notification`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | My notifications |
| PATCH | `/{id}` | Mark as read |
| DELETE | `/{id}` | Delete notification |

### AI (`/ai`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/diagnose` | AI diagnostic (Anthropic Claude API) |

---

## Database Models

### User
Fields: `id`, `user_uuid`, `username`, `email`, `hashed_password`, `is_active`, `role` (USER/SERVICER/ADMIN), `society_id`

### Society
Fields: `id`, `name`, `address`, `secretary_name`, `is_legal`, `creator_role` (OWNER/SECRETARY), `registration_number`, `owner_id`, `secretary_id`, `manager_id`
M2M: `society_trusted_providers` association table

### ServiceProvider
Fields: `id`, `user_id`, `company_name`, `owner_name`, `first_name`, `last_name`, `category`, `categories` (JSON array), `hourly_rate`, `availability_status` (AVAILABLE/WORKING/VACATION), `is_verified`, `rating`, `experience_years`, `bio`, `location`, `profile_photo_url`, `society_id`

### ServiceBooking
Fields: `id`, `user_id`, `provider_id`, `service_type`, `scheduled_at`, `status` (Pending/Accepted/In Progress/Completed/Cancelled), `priority` (Normal/High/Emergency), `issue_description`, `estimated_cost`, `final_cost`, `property_details`, `photos` (JSON)
Relations: `status_history`, `chats`, `review`

### MaintenanceTask
Fields: `id`, `title`, `description`, `due_date`, `status` (Pending/Assigned), `priority` (Routine/Mandatory/Urgent), `category`, `location`, `task_type` (standard/routine), `booking_id`, `user_id`, `service_provider_id`

### Notification
Fields: `id`, `user_id`, `title`, `message`, `notification_type` (INFO/WARNING/URGENT), `is_read`, `link`

### SocietyRequest
Fields: `id`, `society_id`, `provider_id`, `sender_id`, `status` (PENDING/ACCEPTED/REJECTED), `message`

---

## Auth Flow

1. Login returns `{access_token, role, username, user_uuid}`
2. Frontend stores all four via `saveAuthData()` in `lib/auth.ts`
   - Keys: `hc_token`, `hc_role`, `hc_username`, `hc_uuid`
3. `apiFetch()` reads `hc_token` and attaches `Authorization: Bearer` header
4. On 401, token is cleared and user redirected to `/login`
5. `AuthGuard` protects all dashboard routes client-side

### Roles
Three roles: `ADMIN`, `SERVICER`, `USER`
Check with: `getRole()`, `isAdmin()`, `isServicer()`, `isUser()` from `lib/auth.ts`

---

## Project Conventions

### Design System — "ShigenTech Premium"
- High contrast text: `#000000` for all headings
- Primary accent: `#064e3b` (emerald dark)
- Professional whitespace, rounded corners (`rounded-2xl`, `rounded-3xl`, `rounded-[3rem]`)
- Typography: Manrope (display/headings), Inter (body)
- Tokens defined in `lib/design-tokens.ts` — always import from there, never hardcode

### Code Rules
- **No ghost routes**: Every nav link must resolve to a real page. Create a placeholder with professional stats if not built.
- **All new dashboard routes** must be wrapped in `AuthGuard` or added to a protected layout.
- **API calls**: Always use `apiFetch()` from `lib/api.ts` — never raw `fetch()`.
- **Icons**: Lucide React (primary). FontAwesome exists in legacy code — do not add new FA usage.
- **Schema changes**: Update `models.py` first, then `schemas.py`, then run Alembic migration.
- **No `window.location.reload()`**: After mutations, refetch data by calling the fetch function directly. Reload destroys React state.
- **No `window.location.href`** for internal navigation: Use `router.push()` from `useRouter()` (Next.js client router).
- **Null guard before accessing optional state**: Always check objects like `selectedProvider` are non-null before accessing properties. Use optional chaining (`?.`) throughout.
- **JSX style props**: Never duplicate a `style` prop on the same element — merge into one object.
- **`useSearchParams()` requires Suspense**: Any component calling `useSearchParams()` must be wrapped in `<Suspense>`. Export a wrapper component that provides the boundary.
- **Categories field**: `ServiceProvider.categories` is stored as JSON in SQLite and may deserialize as a string — always parse defensively on the backend and use `|| []` fallback on the frontend.

### Feature Patterns

**Booking wizard (`/dashboard/bookings/new`)**
- 5-step flow: Category → Provider → Schedule → Details → Review
- Accepts URL params `?provider=<id>&category=<name>` to pre-fill (used by providers page keyboard nav)
- Task linking: fetches unassigned routine tasks from `/maintenance/routine`; linking auto-fills category, priority, description and sends `task_id` in booking payload
- Provider list re-fetches with `?scheduled_at=<iso>` filter when both date and slot are selected

**Providers page (`/dashboard/providers`)**
- Keyboard navigation (↑↓ arrows, Enter to book)
- Shows `fetchError === "backend_offline"` state with a retry button when backend is unreachable
- Book Now links use Next.js `<Link>` component; keyboard Enter uses `router.push()`

**Societies (multi-society)**
- Users can create or join multiple societies
- Society roles: OWNER, SECRETARY, MANAGER (stored in `creator_role`)
- Providers can be invited via `SocietyRequest`; accept/reject flow on provider side
- "Trusted providers" is a M2M association tracked per society

**Routine tasks**
- Created at `/maintenance/routine` (POST)
- Have `task_type = "routine"` and track `booking_id` once assigned
- Unassigned routine tasks (`booking_id === null`) surface in the booking wizard for task linking

---

## Environment Variables

Backend (`.env` in `backend/`):
```
DATABASE_URL=sqlite:///./homecare.db
SECRET_KEY=<jwt_secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ANTHROPIC_API_KEY=<key_for_ai_diagnose>
```

Frontend (`.env.local` in `frontend/`):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

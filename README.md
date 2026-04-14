<div align="center">
  <img src="frontend/public/logo.png" width="120" height="120" alt="Homecare Hub Logo">
  <h1>Homecare Hub</h1>
  <p><strong>A Role-Based Home Services & Community Management Platform</strong></p>

  [![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
</div>

---

## What Is Homecare Hub?

**Homecare Hub** is a full-stack platform for managing home maintenance and community services inside residential societies. It connects four types of users — **residents**, **service providers**, **society secretaries**, and **system admins** — in one unified ecosystem.

A resident can book a plumber, raise an emergency SOS, track maintenance history, chat directly with their provider, and dispute incorrect charges. A secretary manages the society's trusted provider list and responds to member alerts. A service provider sees incoming job requests in real time, submits proposals, and enters job completion details. An admin has complete system visibility: users, bookings, providers, emergency incidents, flagged charge disputes, and full audit logs — all live, no hardcoded data.

**Domain:** Residential property services · Housing society management · Home maintenance marketplace · Emergency response coordination · Billing & dispute resolution.

---

## Roles & Portals

The platform is built around **4 distinct roles**, each with their own fully protected portal:

| Role | Portal Root | What They Do |
| :--- | :--- | :--- |
| **ADMIN** | `/admin/dashboard` | Full system control: users, providers, bookings, emergency config, penalty management, charge dispute review, audit logs, health monitoring |
| **SECRETARY** | `/secretary/dashboard` | Society management: members, home number assignment, trusted providers, maintenance alerts |
| **USER** (Resident) | `/user/dashboard` | Book services, raise emergency SOS, track maintenance tasks, chat with providers, review charges, flag disputes to admin |
| **SERVICER** (Provider) | `/service/dashboard` | Manage incoming job requests and emergency alerts, enter actual job hours for billing, update profile, track ratings and star adjustments |

Route access is enforced by **dual-layer protection**:
1. `middleware.ts` — server-side JWT check before page renders
2. `<AuthGuard>` — client-side role validation to prevent content flash

---

## Core Features (Current System)

### Residents (USER)
- **Service Booking** — Book verified providers by category (Plumbing, AC, Electrical, Carpentry, etc.) with time-conflict detection (3-hour window)
- **Service Request Broadcast** — Describe a problem and broadcast to 1–10 providers simultaneously; review proposals and accept the best one
- **Emergency SOS** — Real-time emergency dispatch via WebSocket; providers are alerted instantly and can submit arrival estimates
- **Maintenance Task Tracker** — Create, track, and assign routine or one-time maintenance tasks; receive staged alerts (2 days before → due → overdue → expired)
- **Booking Chat** — In-booking messaging with the assigned provider
- **Booking Review** — Rate completed jobs with overall + quality + punctuality + professionalism scores
- **Charge Review & Receipt** — When a servicer submits a charge (actual hours × estimated cost), the resident receives a receipt; can accept silently or formally reject with a reason
- **Dispute Flagging** — If a charge is incorrect, resident can flag the booking to admin with a written reason; flagged bookings are highlighted in the admin panel for review
- **Routine Maintenance** — Intelligent category matching to find the right provider automatically
- **AI Assistant** — Ask home service questions via integrated Claude AI chat

### Service Providers (SERVICER)
- **Job Board** — View assigned bookings and incoming service request broadcasts
- **Emergency Alert Feed** — Real-time emergency alerts via WebSocket with 5-minute response window
- **Job Charge Entry** — After job completion, enter actual hours worked; charge is auto-calculated as `hours × estimated_cost (hourly rate)` and sent to the resident
- **Professional Profile** — Bio, category, hourly rate, location, certifications, government ID, profile photo
- **Availability Management** — Toggle between `AVAILABLE`, `WORKING`, `VACATION`
- **Ratings Dashboard** — View detailed feedback: overall, quality, punctuality, professionalism
- **Points-Based Star Rating** — 100 pts = 1 star, uncapped. Earn via completed jobs and reviews; lose via cancellations and penalties. Displayed as `★ X.X` throughout the UI. Providers are sorted by star rating across all listings
- **Auto-Verification** — Providers who earn ≥ 10 stars (1,000 pts) are automatically verified — no admin action needed
- **Analytics Dashboard** — Full performance view: total/emergency/urgent jobs, completion rate, points breakdown by category, recent activity log, and 6-month performance history at `/service/analytics`

### Society Secretaries (SECRETARY)
- **Member Directory** — View all society residents; assign home numbers
- **Trusted Provider Curation** — Manage society-specific verified provider list
- **Maintenance Alerts** — Receive and act on alerts raised by any member
- **Provider Trust Requests** — Send and receive provider approval requests
- **Society Profile** — Edit name, address, registration number, and details

### Admins (ADMIN)
- **User Management** — View all users, change roles, toggle active status, delete accounts; superadmin is protected from demotion
- **Provider Oversight** — Verify providers, revoke verification, view full profile with booking history and certificates; providers listed by star rating
- **Booking Monitor** — All bookings with detailed view; flagged/disputed bookings appear with a visible warning badge so admins can prioritize review
- **Charge Dispute Panel** — When a resident flags an incorrect charge, admin sees full charge details (actual hours, computed amount, rejection reason) in a dedicated panel and can take action
- **Emergency Management** — Configure emergency category pricing (callout fee + hourly rate), manage penalty configs (LATE_ARRIVAL, CANCELLATION, NO_SHOW), view all SOS incidents, apply penalties with star deductions
- **System Logs** — Full activity audit log for security and compliance
- **Health Dashboard** — Live DB / API / backend status indicators
- **Dashboard Stats** — User count, servicer count, booking count, task count, pending verifications

---

## Booking Charge & Billing Flow

When a job is marked complete, the billing cycle works as follows:

```
Servicer enters actual hours worked
        ↓
Charge = actual_hours × provider's estimated_cost (hourly rate)
        ↓
Resident receives receipt in booking detail page
        ↓
    ┌───────────────────────────┐
    │   Resident reviews charge  │
    └───────────────────────────┘
           ↙               ↘
    Accept (silent)     Reject with reason
                              ↓
                    Option to flag to Admin
                              ↓
                  Admin sees flagged badge in booking list
                  + full charge breakdown in detail panel
```

This gives residents transparency and accountability over every billing event, with admin as a neutral dispute arbiter.

---

## Technical Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript | `"use client"` components, App Router file-based routing |
| **Styling** | Tailwind CSS 4, ShigenTech Premium design system | Emerald/Charcoal palette, Manrope + Inter fonts, light theme only |
| **Icons** | `lucide-react` | All icons use this library exclusively |
| **Backend** | FastAPI (Python 3.10+), Uvicorn ASGI | 14 routers, domain-driven structure, WebSocket support |
| **ORM** | SQLAlchemy 2.0 | `Mapped` / `mapped_column` style, 22 tables |
| **Validation** | Pydantic v2 | Request/response schemas with strict validators |
| **Database** | PostgreSQL | UUID primary keys on all tables |
| **Migrations** | Alembic | File naming: `DD_MM_YYYY_slug.py` (13 migrations to date) |
| **Auth** | JWT HS256, PBKDF2/SHA-256 | Token TTL: 480 minutes (8 hours), role-segregated storage |
| **Real-time** | WebSocket (FastAPI) | Emergency SOS dispatch + servicer alert feed |
| **Scheduler** | APScheduler | Hourly maintenance alert jobs (warning → final → overdue → expire) |
| **AI** | Anthropic Claude SDK | Integrated AI chat assistant at `/api/v1/ai/chat` |
| **Containers** | Docker + Docker Compose | Backend: 8002, Frontend: 3000, PostgreSQL: 5435 |
| **API Docs** | Swagger UI | Available at `http://localhost:8000/api/v1/docs` |

---

## Getting Started

### Prerequisites
- Node.js v18+
- Python 3.10+
- PostgreSQL running locally (or use Docker Compose)

### Option A — Docker Compose (Recommended)

```bash
docker-compose up --build
```

Services start automatically:
- Frontend → `http://localhost:3000`
- Backend → `http://localhost:8002`
- PostgreSQL → `localhost:5435`

---

### Option B — Manual Setup

#### 1. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/homecare_hub
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
SUPERADMIN_EMAIL=admin@homecarehub.com
SUPERADMIN_PASSWORD=your-admin-password
SUPERADMIN_USERNAME=Super Admin
FRONTEND_URL=http://localhost:3000
#ANTHROPIC_API_KEY=your-anthropic-key
```

```bash
alembic upgrade head                            # Apply all migrations
uvicorn app.main:app --reload --port 8000       # Start backend
```

The superadmin account is auto-seeded on first startup.

#### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

```bash
npm run dev    # Start frontend on port 3000
```

Visit `http://localhost:3000` — redirects to `/login`.

---

## Project Structure

```
homecare-hub/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app entry — CORS, routers, lifespan
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic Settings (.env loader)
│   │   │   ├── security.py       # JWT, password hashing, OAuth2
│   │   │   ├── scheduler.py      # APScheduler hourly maintenance alerts
│   │   │   └── db/
│   │   │       ├── base.py       # SQLAlchemy declarative Base
│   │   │       └── session.py    # Engine, SessionLocal, init_db, retry thread
│   │   ├── common/
│   │   │   ├── deps.py           # get_db, get_current_user, RoleChecker
│   │   │   └── constants.py      # Shared constants (categories, conflict window)
│   │   ├── api/                  # HTTP layer — endpoints + schemas per domain
│   │   │   ├── auth/             # /auth — signup, login, forgot-password
│   │   │   ├── user/             # /user — profile, password
│   │   │   ├── service/          # /services — societies, providers, certificates
│   │   │   ├── booking/          # /bookings — create, chat, review, reschedule, charge
│   │   │   ├── maintenance/      # /maintenance — tasks, routine tasks
│   │   │   ├── request/          # /requests — service request broadcast workflow
│   │   │   ├── emergency/        # /emergency — SOS requests and responses
│   │   │   ├── admin/            # /admin — users, providers, bookings, charge disputes
│   │   │   ├── secretary/        # /secretary — society, members, trusted providers
│   │   │   ├── notification/     # /notifications — list, read, delete
│   │   │   └── ai/               # /ai — Claude AI chat
│   │   ├── auth/domain/model.py  # User, Society models
│   │   ├── service/              # ServiceProvider models + point_engine + services
│   │   ├── booking/domain/       # ServiceBooking, BookingChat, BookingReview models
│   │   ├── maintenance/domain/   # MaintenanceTask model
│   │   ├── notification/domain/  # Notification model
│   │   ├── request/domain/       # ServiceRequest models
│   │   ├── emergency/domain/     # Emergency models + services
│   │   └── websockets/
│   │       └── emergency.py      # Singleton WebSocket connection manager
│   ├── alembic/versions/         # 13 migration files
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx            # Root layout — fonts, global CSS
│   │   ├── user/                 # Resident portal pages
│   │   ├── service/              # Servicer portal pages
│   │   ├── admin/                # Admin portal pages
│   │   ├── secretary/            # Secretary portal pages
│   │   ├── login/                # Shared login page
│   │   └── register/             # Registration page
│   ├── components/
│   │   ├── layout/               # Navbar, Sidebar, AuthGuard, BackendStatus
│   │   ├── booking/              # Timeline, ProviderCard, ReviewModal, TimeSlotPicker
│   │   ├── dashboard/            # BookingModal
│   │   └── ui/                   # ToastContainer
│   ├── lib/
│   │   ├── api.ts                # apiFetch(), WebSocket helpers, API objects
│   │   ├── auth.ts               # Role-segregated token storage + helpers
│   │   ├── toast-context.tsx     # Toast notification context
│   │   └── ui.ts                 # Tailwind utilities
│   ├── middleware.ts              # Server-side route protection
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## API Overview

All endpoints prefixed `/api/v1`. Docs at `http://localhost:8000/api/v1/docs`

| Router | Prefix | Key Endpoints |
| :--- | :--- | :--- |
| Auth | `/auth` | signup, login, forgot-password |
| User | `/user` | profile, change-password |
| Services | `/services` | societies CRUD, provider registration, certificates, availability |
| Bookings | `/bookings` | create, status update, chat, review, reschedule, cancel, charge submit, charge reject, flag to admin |
| Maintenance | `/maintenance` | tasks, routine tasks, assignment |
| Requests | `/requests` | broadcast to providers, accept/reject proposals |
| Emergency | `/emergency` | SOS create, provider responses, status updates |
| Secretary | `/secretary` | society edit, member management, trusted providers |
| Notifications | `/notifications` | list, mark read, delete |
| Admin | `/admin` | users, providers, bookings (with flagged filter), logs, stats, health |
| Admin Emergency | `/admin/emergency` | pricing config, penalty config, incident management |
| AI | `/ai` | Claude AI chat |

### WebSocket Endpoints
| Path | User | Purpose |
| :--- | :--- | :--- |
| `/ws/emergency/{request_id}` | Resident | Real-time SOS status updates |
| `/ws/servicer/alerts` | Servicer | Instant emergency alert notifications |

---

## Authentication Flow

1. User submits credentials → `POST /api/v1/auth/login`
2. Backend validates, returns JWT (HS256, 8-hour TTL)
3. Frontend stores token in role-specific `localStorage` key (`hc_token_USER`, `hc_token_ADMIN`, etc.)
4. `middleware.ts` reads token on every route — redirects if missing or wrong role
5. `<AuthGuard>` re-validates role client-side to prevent flash
6. `apiFetch()` automatically injects `Authorization: Bearer <token>` on every API call
7. On 401 response: token cleared → redirect to `/login`
8. On logout: all role tokens cleared from localStorage

**Multi-session**: the same browser can be logged in as multiple roles simultaneously using separate token keys.

---

## Database Schema Summary

22 tables, all with UUID primary keys. Key relationships:

```
User ──────────────── 1:1 ── ServiceProvider
User ──────────────── 1:N ── MaintenanceTask
User ──────────────── 1:N ── ServiceBooking
User ──────────────── 1:N ── ServiceRequest
User ──────────────── 1:N ── EmergencyRequest
User ──────────────── 1:N ── Notification
Society ───────────── M:N ── ServiceProvider   (society_trusted_providers)
ServiceBooking ────── 1:N ── BookingStatusHistory
ServiceBooking ────── 1:N ── BookingChat
ServiceBooking ────── 1:1 ── BookingReview
ServiceRequest ────── 1:N ── ServiceRequestRecipient  (cascade delete)
ServiceRequest ────── 1:N ── ServiceRequestResponse   (cascade delete)
EmergencyRequest ──── 1:N ── EmergencyResponse        (cascade delete)
ServiceProvider ───── 1:N ── EmergencyStarAdjustment
```

---

## Future Roadmap

### Phase 1 — Direct Communication (Next Priority)

- [ ] **Direct WebSocket Messaging** — Real-time one-to-one chat channel between a resident and a servicer, independent of any booking. Currently booking-chat exists only within a booking context; this would be a persistent direct message thread so a resident can contact their trusted provider any time, and the servicer can send updates or reminders. Backend: a new `DirectMessage` table + WebSocket room per `(user_id, provider_id)` pair. Frontend: a chat inbox in both the user and service portals.

- [ ] **In-App Voice/Video Call** — WebRTC-based audio/video call between resident and servicer initiated from the booking detail page. No third-party app needed — one click to connect directly through the platform.

### Phase 2 — Native Payment System

- [ ] **QR Code Payment at Completion** — When a servicer completes a job and submits their charge, the system generates a unique payment QR code tied to that booking's computed amount. The resident scans the QR code with any UPI / mobile payment app to pay directly. The backend marks the booking as `PAID` on confirmation, and the receipt updates to show payment status. This removes reliance on cash and provides a verifiable payment trail per booking.

- [ ] **Digital Receipt & Payment History** — Every paid booking produces a downloadable PDF receipt with provider name, service category, actual hours, rate, total, and payment timestamp. Residents and providers each see their full payment history filtered by date range.

- [ ] **Emergency SOS Bill Settlement** — Emergency callouts currently compute a bill (callout fee + hourly rate × hours × 1.5× multiplier) but payment is manual. QR-based settlement would close this loop — servicer generates QR at scene, resident pays instantly.

- [ ] **Wallet / Prepaid Credits** — Residents pre-load credits into a platform wallet. Charges are deducted automatically on job acceptance, removing the payment step entirely at completion.

### Phase 3 — Society Management Expansion

- [ ] **Society Notice Board** — Secretary publishes announcements (maintenance shutdowns, meeting dates, rule changes) pinned to all resident dashboards with read/unread tracking.

- [ ] **Community Group Chat** — Society-wide or floor/wing-wise group messaging channel managed by the secretary. Residents post questions, report issues, or coordinate among neighbors.

- [ ] **Visitor & Delivery Pre-Authorization** — Residents pre-register expected visitors or delivery windows. Secretary or gate staff see the approved list and can mark arrivals.

- [ ] **Society Maintenance Billing** — Monthly society maintenance dues tracked per home number. Secretary raises invoices, residents pay (cash-acknowledged or QR), and history is logged per unit.

- [ ] **Document Vault** — Society-level document storage: NOC certificates, society bylaws, meeting minutes, and compliance papers accessible to secretary and admin.

- [ ] **Multi-Society Admin** — A single admin account manages multiple registered societies, with per-society dashboards and secretary assignments.

### Phase 4 — Intelligence & Automation

- [x] **Points-Based Star Rating** — Uncapped, achievement-driven rating system with auto-verification at 10 stars
- [x] **Provider Analytics Dashboard** — Performance dashboard with job stats, points breakdown, and monthly trends
- [x] **Charge Dispute Resolution** — Resident can reject incorrect charges and flag to admin; admin sees full charge breakdown in booking panel

- [ ] **Smart Provider Matching** — AI-powered provider recommendation based on rating, proximity, category, and past booking satisfaction scores
- [ ] **Predictive Maintenance** — Suggest upcoming maintenance actions based on past task history and seasonal patterns (e.g. "AC service usually needed in April based on your history")
- [ ] **Automated SLA Monitoring** — Alert admin and resident when a booking exceeds expected completion time without a status update
- [ ] **Fraud & Anomaly Detection** — Flag unusual patterns: inflated hours, rapid repeated bookings, suspicious review bursts

### Phase 5 — Platform Scaling

- [ ] **Mobile App (React Native)** — Native iOS/Android app for residents and servicers with push notifications and offline task viewing
- [ ] **Provider Availability Calendar** — Visual calendar UI for selecting booking slots, replacing the manual datetime entry
- [ ] **Multi-City & Multi-Society** — Expand beyond a single-city scope; society onboarding self-service with admin approval
- [ ] **Provider Subscription Tiers** — Free (standard listing) vs. premium (priority placement, lead quota boost, featured badge)
- [ ] **Third-party Integrations** — WhatsApp/SMS booking confirmations, Google Calendar sync for scheduled bookings, email digest for secretaries
- [ ] **Admin Revenue Analytics** — Platform-wide booking volume, revenue estimates, provider churn, and month-over-month growth charts

---

## Developer References

| Document | Purpose |
| :--- | :--- |
| `http://localhost:8000/api/v1/docs` | Live Swagger UI (backend running) |
| [`backend/BACKEND.md`](backend/BACKEND.md) | Backend quick-reference: import rules, router table, patterns |
| [`CLAUDE.md`](CLAUDE.md) | Full project playbook for AI-assisted development (architecture, models, endpoints, business rules) |

---

<div align="center">
  <p>Built with ❤️ for the Homecare Ecosystem</p>
</div>

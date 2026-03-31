<div align="center">
  <img src="frontend/public/logo.png" width="120" height="120" alt="Homecare Hub Logo">
  <h1>Homecare Hub</h1>
  <p><strong>A Role-Based Home Services & Community Management Platform</strong></p>

  [![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
</div>

---

## What Is Homecare Hub?

**Homecare Hub** is a full-stack platform for managing home maintenance and community services inside residential societies. It connects four types of users — **residents**, **service providers**, **society secretaries**, and **system admins** — in one ecosystem.

A resident can book a plumber, track their maintenance history, and raise alerts. A secretary can manage the society's trusted provider list and respond to member alerts. An admin has complete system visibility: users, bookings, providers, and logs — all live, no hardcoded data.

**Domain:** Residential property services / Housing society management / Home maintenance marketplace.

---

## Roles & Portals

The platform is built around **4 distinct roles**, each with their own protected portal:

| Role | Portal Root | What They Do |
| :--- | :--- | :--- |
| **ADMIN** | `/admin/dashboard` | System-wide management: users, providers, bookings, audit logs, health monitoring |
| **SECRETARY** | `/secretary/dashboard` | Society management: members, alerts, trusted providers, society profile |
| **USER** (Resident) | `/user/dashboard` | Book services, track maintenance, raise alerts, view provider network |
| **SERVICER** (Provider) | `/service/dashboard` | Manage incoming jobs, update profile, view ratings and earnings |

Route access is enforced by **dual-layer protection**: server-side middleware checks the JWT cookie, and a client-side `AuthGuard` component validates role against localStorage — preventing any content flash.

---

## Core Features

### For Residents (USER)
- **Service Booking** — Browse and book verified service providers by category (Plumbing, AC, Electrical, etc.)
- **Routine Maintenance Wizard** — Step-by-step flow to describe a maintenance need and get matched to providers instantly
- **Maintenance Ledger** — Track active bookings, history, and incidents
- **Alerts** — Raise and monitor home-related issues

### For Service Providers (SERVICER)
- **Job Board** — View and manage all assigned service requests
- **Professional Profile** — Manage bio, category, location, certifications, and hourly rate
- **Ratings** — See feedback from completed jobs

### For Society Secretaries (SECRETARY)
- **Member Directory** — View and manage residents registered under the secretary's society
- **Trusted Providers** — Curate a society-specific list of verified service professionals
- **Alert Management** — Receive and act on maintenance alerts raised by members
- **Society Profile** — Edit society details

### For Admins (ADMIN)
- **User Management** — View all users, change roles (USER/SERVICER/SECRETARY), delete accounts; super admin is protected
- **Provider Oversight** — Verify providers, view full provider profiles with booking history
- **Booking Monitor** — Real-time view of all bookings with curated detail modals
- **Audit Logs** — System activity log for security and compliance
- **Health Dashboard** — Live DB / API / JWT status indicators

---

## Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS, ShigenTech Premium design system (Emerald/Charcoal palette) |
| **Icons** | `lucide-react` |
| **Backend** | FastAPI (Python 3.10+), Uvicorn ASGI |
| **ORM** | SQLAlchemy 2.0 (`Mapped` / `mapped_column` style) |
| **Validation** | Pydantic v2 |
| **Database** | PostgreSQL |
| **Migrations** | Alembic (naming: `DD_MM_YYYY_slug.py`) |
| **Auth** | JWT (24h expiry) + PBKDF2/SHA-256 password hashing |
| **API Docs** | Swagger UI at `/api/v1/docs` |

---

## Getting Started

### Prerequisites
- Node.js v18+
- Python 3.10+
- PostgreSQL server running locally

### 1. Backend Setup

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
ACCESS_TOKEN_EXPIRE_MINUTES=1440
SUPERADMIN_EMAIL=admin@homecarehub.com
SUPERADMIN_PASSWORD=your-admin-password
SUPERADMIN_USERNAME=Super Admin
FRONTEND_URL=http://localhost:3000
```

```bash
alembic upgrade head    # Run all migrations
npm run dev             # Start FastAPI on port 8000
```

The backend auto-seeds the super admin account on first startup if no admin exists.

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

```bash
npm run dev   # Start Next.js on port 3000
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

---

## Project Structure

```
homecare-hub/
├── backend/
│   ├── app/
│   │   ├── api/              # Route controllers (auth, user, service, task, admin, secretary)
│   │   ├── core/             # Config, security (JWT/hashing), DB session
│   │   └── internal/         # SQLAlchemy models + Pydantic schemas
│   ├── alembic/              # Database migration history
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── admin/            # Admin portal (/admin/*)
│   │   ├── secretary/        # Secretary portal (/secretary/*)
│   │   ├── user/             # Resident portal (/user/*)
│   │   ├── service/          # Servicer portal (/service/*)
│   │   ├── login/            # Public auth
│   │   └── register/         # Public registration (all roles)
│   ├── components/
│   │   ├── auth/             # AuthGuard (role-based client protection)
│   │   ├── layout/           # Sidebar (role-aware nav)
│   │   └── ui/               # Atomic components (Button, Card, Badge)
│   └── lib/
│       ├── api.ts            # Central apiFetch wrapper (token injection, 401 redirect)
│       └── auth.ts           # Token & role helpers (localStorage + cookie)
│
└── docs/                     # Architecture, specs, implementation plans
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Interactive docs: `http://localhost:8000/api/v1/docs`

| Prefix | Description |
| :--- | :--- |
| `/auth` | Login, register, token refresh |
| `/user` | Profile management |
| `/services` | Provider search, booking, societies |
| `/maintenance` | Maintenance tasks and incident tracking |
| `/secretary` | Secretary-scoped society, member, alert, and provider endpoints |
| `/admin` | System management (users, providers, bookings, logs, health) |

---

## Authentication Flow

1. User submits credentials → `POST /api/v1/auth/login`
2. Backend validates and returns a JWT
3. Frontend stores token in `localStorage` **and** as an `hc_token` cookie
4. Next.js middleware reads the cookie on every request — redirects unauthenticated or wrong-role requests
5. `AuthGuard` component on the client side re-validates role from `localStorage` to prevent content flash
6. On logout: both localStorage and the cookie are cleared

---

<div align="center">
  <p>See <a href="docs/ARCHITECTURE.md">ARCHITECTURE.md</a> for data model details and <a href="CLAUDE.md">CLAUDE.md</a> for the developer playbook.</p>
  <p>Built with ❤️ for the Homecare Ecosystem</p>
</div>

# Emergency SOS System — Design Spec

**Date:** 2026-04-04  
**Status:** Approved  
**Project:** Homecare Hub

---

## Overview

Replace the existing single-provider auto-assign emergency endpoint with a full broadcast → response → select → track emergency workflow. The new system is completely separate from normal bookings until a servicer is accepted, at which point a standard `ServiceBooking` (priority = "Emergency") is created and all existing booking infrastructure (chat, status tracking, billing, review) takes over.

---

## Core Decisions

| Decision | Choice |
|---|---|
| Architecture | New dedicated tables (Approach B) |
| Existing emergency flow | Fully replaced |
| Real-time updates | WebSockets (`/ws/emergency/{request_id}`) |
| Pricing model | Callout fee (flat) + hourly rate after hour 1, per category |
| Servicer matching | User manually selects from verified+available list; GPS auto-filter is future work |
| Penalty system | Auto-deduct on events, rates configurable by Super Admin, manual override available |

---

## Role Access

| Role | Can Do |
|---|---|
| USER | Trigger SOS, fill form, select servicers, view responses, accept/cancel |
| SECRETARY | Same as USER (on behalf of residents) |
| SERVICER | Receive alerts, accept with arrival time, ignore |
| ADMIN | View all emergencies, configure prices & penalties, manually adjust stars, suspend/delete providers |

---

## 1. Database Schema

### New Tables (Alembic migrations required)

#### `emergency_config`
One row per emergency category. Super Admin controlled.

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| category | String, unique | Electrical, Plumbing, Gas Leak, Lock/Door, Appliance Failure, Structural, Pest, Other |
| callout_fee | Float | Flat fee charged upfront regardless of duration |
| hourly_rate | Float | Rate applied per hour after the first hour |
| updated_by | FK → users.id | Admin who last modified |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `emergency_penalty_config`
One row per penalty event type. Super Admin controlled.

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| event_type | Enum | LATE_ARRIVAL, CANCELLATION, NO_SHOW |
| star_deduction | Float | How many stars to deduct automatically |
| updated_by | FK → users.id | |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `emergency_requests`
One per SOS trigger. Lives independently until a servicer is accepted.

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| user_id | FK → users.id | |
| society_name | String | |
| building_name | String | |
| flat_no | String | |
| landmark | String | |
| full_address | Text | |
| category | String | Must match an emergency_config row |
| description | Text, max 500 chars | |
| device_name | String, nullable | |
| photos | JSON | List of uploaded photo URLs, max 3 |
| contact_name | String | Auto-filled from user profile at submission |
| contact_phone | String | Auto-filled from user profile at submission |
| status | Enum | PENDING, ACTIVE, COMPLETED, CANCELLED, EXPIRED |
| config_id | FK → emergency_config.id | Snapshot of pricing at time of request |
| expires_at | DateTime | now + 5 minutes |
| resulting_booking_id | FK → service_bookings.id, nullable | Set when user accepts a response |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `emergency_responses`
One per servicer who responds to an emergency request.

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| request_id | FK → emergency_requests.id | |
| provider_id | FK → service_providers.id | |
| arrival_time | DateTime | Committed by servicer on accept |
| status | Enum | PENDING, ACCEPTED, REJECTED, CANCELLED |
| penalty_count | Integer, default 0 | Tracks penalties on this job |
| created_at | DateTime | Determines "fastest responder" ordering |
| updated_at | DateTime | |

#### `emergency_star_adjustments`
Immutable audit log for all star changes (auto-penalty and manual).

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| provider_id | FK → service_providers.id | |
| adjusted_by | FK → users.id | Admin user or system (system user id) |
| delta | Float | Positive = increase, negative = decrease |
| reason | Text | Human-readable explanation |
| event_type | Enum | AUTO_PENALTY, MANUAL_ADJUST, EMERGENCY_BONUS, REVIEW |
| emergency_request_id | FK → emergency_requests.id, nullable | Link to source event |
| created_at | DateTime | |

### Existing Tables — No Changes
- `service_bookings` — reused after servicer accepted, `priority = "Emergency"`
- `service_providers` — `rating` column updated via star adjustment system
- `notifications` — reused for all alerts (URGENT type)
- `users` — no changes

---

## 2. API Endpoints

### Admin Emergency Config — `/api/v1/admin/emergency`
All routes restricted to ADMIN role via `RoleChecker(["ADMIN"])`.

```
GET    /config                        List all category pricing configs
POST   /config                        Create a new category config
PATCH  /config/{config_id}            Update callout_fee or hourly_rate

GET    /penalty-config                List penalty rates per event type
PATCH  /penalty-config/{id}           Update star_deduction for an event type

GET    /requests                      List all emergency requests (filterable: status, category, date)
GET    /requests/{request_id}         Full detail of any emergency request

POST   /providers/{provider_id}/stars Manual star adjustment { delta: float, reason: string }
GET    /providers/{provider_id}/star-history  Full audit log of star changes

GET    /penalties                     All auto-penalty events platform-wide
PATCH  /providers/{provider_id}/status Suspend / reactivate / delete a provider account
```

### User SOS — `/api/v1/emergency`
Allowed roles: USER, SECRETARY.

```
GET    /config                        Fetch all category configs (for price preview in form)
GET    /providers?category=X          List verified + available providers for user to select
POST   /                              Submit SOS form + selected provider IDs → creates emergency_request + notifies providers
GET    /{request_id}                  Get request status + all responses so far
POST   /{request_id}/accept/{response_id}  Accept a servicer → creates ServiceBooking, closes request
POST   /{request_id}/cancel           Cancel before acceptance
```

### Servicer — `/api/v1/emergency/servicer`
Allowed roles: SERVICER.

```
GET    /incoming                      List emergency requests broadcast to this servicer
POST   /{request_id}/respond          Accept: { arrival_time } → creates emergency_response
POST   /{request_id}/ignore           Explicitly ignore (no penalty, removes from incoming)
```

### WebSocket — `/ws/emergency/{request_id}`
Authenticated via JWT token in query param: `?token=<jwt>`

**Events to USER:**
- `new_response` — `{ response_id, provider_id, provider_name, rating, arrival_time, callout_fee, hourly_rate }`
- `response_updated` — status change on an existing response
- `request_expired` — 5-minute window closed, no acceptance made

**Events to SERVICER (on broadcast):**
- `emergency_alert` — full emergency request payload on connection

---

## 3. Background Tasks

Run via FastAPI `BackgroundTasks` or APScheduler:

- **Expiry checker** — runs every 60s, marks `PENDING` requests as `EXPIRED` if `expires_at` has passed, notifies user
- **Penalty trigger** — on booking cancellation or no-show, checks if `service_bookings.resulting_emergency_request_id` exists → auto-applies configured star deduction via `emergency_penalty_config`
- **Late arrival** — user can report late arrival on booking detail → triggers `LATE_ARRIVAL` penalty

---

## 4. Frontend Flow

### User Portal — `/user/bookings/emergency` (full replacement)

**Step 1 — Warning Modal**
Triggered from dashboard "Emergency SOS" button. Full-screen overlay showing:
- Emergency cost warning
- False request penalty warning
- Cancel / "I Understand — Continue" buttons

**Step 2 — Emergency Form**
- Auto-filled: Contact Name (from `user.username`). Contact Phone is a required editable field (User model has no phone column — user must enter it; stored on `emergency_requests.contact_phone`)
- Manual: Society Name, Building, Flat No, Landmark, Full Address
- Category dropdown → on select, fetches `/emergency/config` and shows callout fee + hourly rate preview
- Description (500 char with counter)
- Optional: Device Name, photo upload (max 3)
- Provider list: cards from `/emergency/providers?category=X` (verified + available), user checks one or more
- "SEND EMERGENCY ALERT" button — disabled until mandatory fields filled and at least one provider selected

**Step 3 — Live Response Feed**
- 5-minute countdown timer
- WebSocket connected — new responses appear in real-time without page refresh
- Each response card: servicer name, ⭐ rating, arrival time, fixed price breakdown
- Sort: Fastest (default) | Rating
- Fastest responder tagged with badge
- "Accept" per card → POST to accept endpoint
- "Cancel Request" link

**Step 4 — Confirmed**
- Booking created, shows booking ID
- "Track Job" → navigates to `/user/bookings/[id]` (existing booking detail page, unchanged)

**Expired State**
- Shown when 5-min timer runs out with no acceptance
- "Re-submit Emergency" option

---

### Servicer Portal — `/service/jobs` (extend existing page)

- New "Emergency" tab alongside existing tabs
- Incoming emergency cards with countdown, category, location summary, fixed price display
- Accept → arrival time picker → confirm (POST respond)
- Ignore button (no penalty)
- WebSocket connection maintained while on page — new emergencies pushed in real-time

---

### Admin Portal — `/admin/emergency` (new page, linked from admin sidebar)

- **Emergency Config** table: per-category callout fee + hourly rate, inline editable
- **Penalty Config** table: per event type star deduction, inline editable
- **All Emergencies** list: filterable by status, category, date range
- **Provider Stars Panel**: search provider → star history audit log → manual +/- adjustment form with reason
- **Penalties log**: all auto-penalty events with admin override option

---

## 5. Billing Logic

After job completion on the resulting `ServiceBooking`:

```
total = callout_fee + (hourly_rate × max(0, actual_hours - 1.0))
```

- `callout_fee` covers the first hour
- Each additional hour (decimal) billed at `hourly_rate`
- Minimum charge: callout_fee (covers first hour)
- Example: 2h 15min job at ₹500 callout + ₹400/hr = ₹500 + (1.25 × ₹400) = ₹1,000

Stored on `service_bookings.final_cost` (existing column). No new billing table needed.

---

## 6. Penalty & Rewards Logic

### Auto-Penalties (configurable via `emergency_penalty_config`)
| Event | Trigger |
|---|---|
| CANCELLATION | Servicer cancels accepted emergency response |
| LATE_ARRIVAL | User reports late arrival on booking detail |
| NO_SHOW | Admin marks no-show from admin panel |

On trigger:
1. Look up `star_deduction` from `emergency_penalty_config` for event type
2. Deduct from `service_providers.rating`
3. Insert record into `emergency_star_adjustments` with `event_type = AUTO_PENALTY`
4. Send URGENT notification to servicer

### Manual Admin Adjustment
Admin can POST `{ delta, reason }` to adjust any provider's stars up or down at any time.
Logged to `emergency_star_adjustments` with `event_type = MANUAL_ADJUST`.

### Emergency Acceptance Bonus (existing behavior retained)
Servicer who accepts and completes an emergency gets `+0.2` rating boost (existing logic in booking completion). Logged as `EMERGENCY_BONUS`.

### Escalation
Admin can suspend or delete a provider account from `/admin/emergency` → provider stars panel. No automation on suspension — always requires admin action.

---

## 7. Key Constraints

- Only verified (`is_verified = true`) and available (`availability_status = AVAILABLE`) providers shown in the servicer selection list
- Fixed price is read-only for servicers — they cannot propose a different price
- Only one `emergency_request` can be ACTIVE per user at a time (enforce server-side)
- A servicer cannot respond to the same emergency twice
- Once `resulting_booking_id` is set, the emergency request is immutable
- Super Admin is the only role that can modify emergency config, penalty config, or star records
- All star changes (auto or manual) must produce an `emergency_star_adjustments` record

---

## 8. Files to Create / Modify

### Backend
- `backend/alembic/versions/04_04_2026_add_emergency_sos_tables.py` (new)
- `backend/app/internal/models.py` (add 4 new models)
- `backend/app/internal/schemas.py` (add emergency schemas)
- `backend/app/api/emergency/endpoint.py` (new — user + servicer routes)
- `backend/app/api/admin/emergency.py` (new — admin config + oversight routes)
- `backend/app/websockets/emergency.py` (new — WebSocket manager)
- `backend/app/main.py` (register new routers + WebSocket)

### Frontend
- `frontend/app/user/bookings/emergency/page.tsx` (full replacement)
- `frontend/app/service/jobs/page.tsx` (add Emergency tab)
- `frontend/app/admin/emergency/page.tsx` (new admin panel)
- `frontend/components/layout/Sidebar.tsx` (add Emergency link to admin nav)

---

## Out of Scope (Future Work)

- GPS-based distance filtering (text matching used for now)
- Push notifications / SMS (in-app + WebSocket only for now)
- Live GPS tracking during job
- UPI / Card payment integration (cash noted as option)

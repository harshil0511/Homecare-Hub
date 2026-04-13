# Society Contract System — Design Spec
**Date:** 2026-04-13  
**Status:** Approved  

---

## Overview

A secretary can invite a service provider to enter a time-bound contract with their society. The contracted provider becomes a dedicated "society worker" for the contract duration. The secretary dispatches them to society members' jobs. The provider retains the right to accept outside bookings in parallel.

---

## Data Models

### `society_contracts`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `society_id` | UUID FK → societies | |
| `provider_id` | UUID FK → service_providers | |
| `proposed_by` | UUID FK → users | Secretary who sent the invite |
| `duration_months` | Integer | Secretary's proposed: 2 / 6 / 10 / 12 |
| `counter_duration_months` | Integer nullable | Servicer's counter-proposed duration |
| `monthly_rate` | Float | Monthly retainer in ₹ (set by secretary) |
| `start_date` | DateTime nullable | Set when contract goes ACTIVE |
| `end_date` | DateTime nullable | `start_date + duration_months` |
| `status` | String | See status flow below |
| `secretary_notes` | Text nullable | Secretary's terms/message to provider |
| `servicer_notes` | Text nullable | Servicer's counter note |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Status flow:**
```
PENDING
  ├── (servicer accepts)   → ACTIVE
  ├── (servicer counters)  → COUNTER_PROPOSED
  │       ├── (secretary confirms) → ACTIVE
  │       └── (secretary rejects)  → REJECTED
  └── (servicer rejects)  → REJECTED

ACTIVE
  ├── (secretary cancels)         → CANCELLED
  └── (scheduler: end_date < now) → EXPIRED
```

---

### `society_dispatches`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `contract_id` | UUID FK → society_contracts | |
| `society_id` | UUID FK → societies | Denormalized for fast queries |
| `provider_id` | UUID FK → service_providers | |
| `member_id` | UUID FK → users | Resident being served |
| `service_type` | String | e.g. "Plumbing", "Electrical" |
| `scheduled_at` | DateTime | |
| `job_price` | Float | Secretary can override contract monthly rate per job |
| `notes` | Text nullable | |
| `status` | String | `ASSIGNED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED` |
| `created_at` | DateTime | |

---

## API Endpoints

All endpoints prefixed `/api/v1`.

### Secretary — `/secretary/contracts`

| Method | Path | Description |
|---|---|---|
| `GET` | `/secretary/contracts` | List all contracts for secretary's society (all statuses) |
| `POST` | `/secretary/contracts` | Send contract invite to a provider |
| `POST` | `/secretary/contracts/{id}/confirm-counter` | Confirm servicer's counter-proposed duration → ACTIVE |
| `POST` | `/secretary/contracts/{id}/reject-counter` | Reject servicer's counter → REJECTED |
| `DELETE` | `/secretary/contracts/{id}` | Cancel an ACTIVE contract (secretary only) |
| `POST` | `/secretary/contracts/{id}/dispatch` | Dispatch contracted provider to a member |
| `GET` | `/secretary/contracts/{id}/dispatches` | List all dispatches for a contract |

### Servicer — `/service/contracts`

| Method | Path | Description |
|---|---|---|
| `GET` | `/service/contracts` | List contract invites + active contracts for this provider |
| `POST` | `/service/contracts/{id}/accept` | Accept contract as-is → ACTIVE |
| `POST` | `/service/contracts/{id}/reject` | Reject invite → REJECTED |
| `POST` | `/service/contracts/{id}/counter` | Counter-propose different duration + note |
| `GET` | `/service/contracts/{id}/jobs` | List dispatched jobs for this contract |
| `PATCH` | `/service/contracts/{id}/jobs/{dispatch_id}` | Update dispatch status (IN_PROGRESS / COMPLETED) |

---

## Background Scheduler

Extends existing APScheduler in `backend/app/core/scheduler.py`.

- **Frequency:** Daily
- **Job:** Find all `ACTIVE` contracts where `end_date < now(UTC)`
- **Action:** Set status → `EXPIRED`, send notification to secretary and servicer

---

## Frontend Pages

### Secretary Portal — two touch points

**Touch point 1 — `/secretary/providers` (existing page, small addition)**
The secretary already browses trusted providers here with a multi-select checkbox and floating action bar.
- Add **"Invite to Contract"** as a second button on the existing floating selection bar (alongside "Send Request on Behalf")
- Clicking opens a contract invite modal: duration picker (2/6/10/12 months), monthly rate ₹ input, notes textarea
- On submit → `POST /secretary/contracts`
- No new provider browsing UI needed — reuse the entire existing filter/card/select system

**Touch point 2 — `/secretary/contracts` (new page)**
Contract lifecycle management — secretary lands here after sending invites.

**Tab 1 — Active Contracts**
- Cards per active contracted provider: name, category, duration, monthly rate, start/end date, days remaining
- "Dispatch Job" button → modal (member picker from society members, service type, date/time, job price, notes)
- "Cancel Contract" button

**Tab 2 — Pending / History**
- PENDING invites awaiting servicer response
- COUNTER_PROPOSED cards showing servicer's proposed duration with "Confirm Counter" / "Reject Counter" buttons
- REJECTED / EXPIRED / CANCELLED history

### Servicer Portal — `/service/jobs` (existing page, add one tab)

Existing `JobTab` type: `"jobs" | "requests" | "emergency" | "completed"`
→ Extend to: `"jobs" | "requests" | "emergency" | "completed" | "society"`

**Society tab — two sections:**

**Section A — Invites** (PENDING / COUNTER_PROPOSED)
- Card: society name, proposed duration, monthly rate, secretary notes
- Buttons: **Accept** / **Reject** / **Counter**
- Counter → inline modal: duration selector (2/6/10/12) + note field

**Section B — Active Contracts**
- Card: society name, duration, monthly rate, start/end date, days remaining
- Dispatched jobs list per contract: service type, member home number, scheduled date, price, status
- "Mark In Progress" / "Mark Completed" actions per dispatch

### Sidebar

- Secretary: add **Contracts** entry to `SECRETARY_NAV` → `/secretary/contracts`
- Servicer: no change (Society Jobs is a new tab inside existing `/service/jobs`)

---

## Conflict & Integration Rules

### What does NOT change

| System | Behaviour |
|---|---|
| Regular bookings (`/bookings`) | Unaffected. Contracted providers can still receive normal bookings from any user. |
| Service requests (`/requests`) | Unaffected. Contracted providers still appear in provider lists and can respond. |
| Emergency SOS (`/emergency`) | Unaffected. Contracted providers can still accept emergency calls. |
| `availability_status` | NOT mutated by contract. Secretary manages their contracted provider's schedule. |
| Points / rating engine | Dispatched society jobs do NOT feed into `point_engine.py`. Outside the rating system. |
| `society_trusted_providers` | Accepting a contract does NOT auto-add provider to trusted list. Separate concepts. |

### Guard Rules

| Rule | Enforced at |
|---|---|
| Provider can only have one ACTIVE contract per society | `POST /secretary/contracts` |
| Provider can hold contracts with multiple societies simultaneously | No block |
| Only the secretary who owns the contract's society can cancel | `DELETE /secretary/contracts/{id}` |
| Dispatch only allowed on ACTIVE contracts | `POST /secretary/contracts/{id}/dispatch` |
| Dispatched member must belong to the secretary's society | `POST /secretary/contracts/{id}/dispatch` |
| Counter-propose only allowed when status is PENDING | `POST /service/contracts/{id}/counter` |

---

## Migration

**File:** `backend/alembic/versions/13_04_2026_add_society_contracts.py`

- Creates `society_contracts` table
- Creates `society_dispatches` table
- No changes to any existing table or column

---

## New Files (Backend)

```
backend/app/contract/
  └── domain/
      └── model.py          # SocietyContract, SocietyDispatch models

backend/app/api/secretary/contracts_endpoints.py   # Secretary contract router
backend/app/api/service/contracts_endpoints.py     # Servicer contract router
backend/alembic/versions/13_04_2026_add_society_contracts.py
```

## New Files (Frontend)

```
frontend/app/secretary/contracts/page.tsx          # Secretary contracts page (list + dispatch)
```

## Modified Files (Frontend — minimal, reuse existing)

```
frontend/app/secretary/providers/page.tsx          # Add "Invite to Contract" to floating action bar
frontend/components/layout/Sidebar.tsx             # Add Contracts entry to SECRETARY_NAV only
frontend/app/service/jobs/page.tsx                 # Add "society" to JobTab + Society Jobs tab UI
```

## Modified Files (Backend)

```
backend/app/core/scheduler.py                      # Add daily contract expiry job
backend/app/main.py                                # Register two new routers
```

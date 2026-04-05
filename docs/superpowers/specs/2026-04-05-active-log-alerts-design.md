# Active Log Alerts System — Design Spec

**Date:** 2026-04-05  
**Status:** Approved

---

## Overview

Enhances the existing `MaintenanceTask` model into a full timer-based alert system. Users create alerts for home maintenance tasks (bill payments, device servicing) with a due date. The system automatically sends notifications 2 days before and on the due date. From any alert card the user can find a servicer (routes to existing `/user/routine?taskId=X` flow) or mark the task done manually.

---

## What Already Exists (No New Duplication)

| Thing | Location | Notes |
|---|---|---|
| `MaintenanceTask` model | `backend/app/internal/models.py` | Has title, due_date, status, priority, category, booking_id |
| `/maintenance` GET/POST | `backend/app/api/task/endpoint.py` | List + create standard tasks |
| Find Servicer flow | `/user/routine?taskId=X` | Full provider matching already works |
| `/user/alerts` page | `frontend/app/user/alerts/page.tsx` | Already aggregates notifications + tasks + bookings |
| Notification model | `backend/app/internal/models.py` | INFO / WARNING / URGENT, is_read, link |

---

## Backend Changes

### 1. New Fields — `MaintenanceTask`

```
warning_sent      Boolean  default=False  — 2-day warning notification fired
final_sent        Boolean  default=False  — due-date notification fired  
overdue_sent      Boolean  default=False  — first overdue notification fired
completed_at      DateTime nullable       — when status moved to Completed/Cancelled
completion_method String   nullable       — "booked" | "manual" | "cancelled"
```

Status values extended: `Pending` → `Active` | `Triggered` | `Overdue` | `Completed` | `Expired` | `Cancelled`

### 2. New Fields — `ServiceBooking`

```
source_type  String  nullable  — "alert" | "manual" | null
source_id    Integer nullable  — FK to maintenance_tasks.id (when source_type="alert")
```

### 3. New API Endpoints

`PATCH /maintenance/{task_id}` — update status, completion_method, completed_at  
Body: `{ status?, completion_method? }`  
Auth: current user must own the task

### 4. Background Scheduler (APScheduler)

Added to `app/main.py` startup. Runs every hour. Logic per task:

```
if due_date - today == 2 days AND warning_sent == False:
    create Notification(type=WARNING, title="Maintenance Reminder – 2 Days Left")
    task.warning_sent = True

if due_date == today AND final_sent == False:
    create Notification(type=URGENT, title="MAINTENANCE DUE TODAY")
    task.final_sent = True
    task.status = "Triggered"

if due_date < today AND overdue_sent == False AND status not in (Completed, Cancelled, Expired):
    create Notification(type=URGENT, title="OVERDUE: Maintenance Missed")
    task.overdue_sent = True
    task.status = "Overdue"

if due_date + 7 days < today AND status == "Overdue":
    task.status = "Expired"
```

Notifications include `link = "/user/routine?taskId={id}"` for direct action.

### 5. Migration

New Alembic revision: `05_04_2026_add_alert_fields_to_maintenance_and_bookings.py`

---

## Frontend Changes

### Dashboard (`/user/dashboard`)

**Replace** current mixed task+booking ledger with two separate sections:

**Section 1 — Active Log Alerts**  
Shows `MaintenanceTask` where status in (`Pending`, `Active`, `Triggered`, `Overdue`)  
Sorted: Overdue first → Triggered → nearest due date  

Alert card design:
- Left color border: green=Routine, amber=Mandatory/Urgent, red=Emergency/Overdue
- Header: priority badge | device name | due date | status badge
- Body: description/notes (if any)
- Footer buttons:
  - **Find Servicer →** → `href="/user/routine?taskId={id}"` (primary, green)
  - **Mark Done** → PATCH `/maintenance/{id}` `{status:"Completed", completion_method:"manual"}`
  - **Dismiss** → PATCH `/maintenance/{id}` `{status:"Cancelled", completion_method:"cancelled"}`

**Section 2 — Active Bookings** (small summary below alerts)  
Shows bookings with status `Accepted` or `In Progress`  
Card: service type | provider name | scheduled date | status badge  
Link to `/user/bookings/{id}` for details

**Create Alert form** — add Category dropdown (already in model):
- Options: Plumber, Electrician, HVAC Technician, Appliance Repair, Pest Control, Cleaning Service, General Maintenance, Bill Payment, Other

### `/user/alerts` Page

Add tab toggle: **Active** | **History**

- **Active tab** (default): status in Pending/Active/Triggered/Overdue — same card design as dashboard
- **History tab**: status in Completed/Expired/Cancelled — muted cards, shows completion date + linked booking ID if `source_id` set on booking

---

## Routing — No Conflicts

| Route | Owner | Notes |
|---|---|---|
| `/maintenance` GET/POST | task/endpoint.py | Unchanged |
| `/maintenance/{id}` PATCH | task/endpoint.py | **NEW** |
| `/user/routine?taskId=X` | Frontend | Existing, used as Find Servicer target |
| `/user/alerts` | Frontend | Existing, enhanced with tabs |
| `/user/dashboard` | Frontend | Refactored sections |

---

## Data Flow

```
User creates alert (dashboard form)
    → POST /maintenance  →  MaintenanceTask(status="Pending")

Scheduler runs hourly
    → checks all Pending/Active/Triggered tasks
    → fires Notification records
    → updates task status + warning_sent/final_sent/overdue_sent flags

User clicks "Find Servicer"
    → GET /maintenance/routine/{id}/providers  (existing)
    → User picks provider + schedules
    → POST /maintenance/routine/{id}/assign  (existing)
    → ServiceBooking created with source_type="alert", source_id=task.id
    → PATCH /maintenance/{id} {status:"Completed", completion_method:"booked"}

User clicks "Mark Done"
    → PATCH /maintenance/{id} {status:"Completed", completion_method:"manual"}

Scheduler auto-expires
    → 7 days overdue → status="Expired"
```

---

## Out of Scope

- Email / SMS / push notifications (in-app only)
- Recurring alerts (re-create manually)
- Alert edit form (create new if wrong)

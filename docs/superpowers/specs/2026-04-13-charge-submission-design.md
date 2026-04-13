# Charge Submission & Payment Confirmation Flow

**Date:** 2026-04-13  
**Status:** Approved  
**Scope:** Regular service bookings only — Emergency SOS flow is untouched

---

## Problem

After a servicer completes a job, the home user receives a receipt but has no visibility into the actual hours worked or how the total was calculated. The servicer submits a flat amount and the user is billed without breakdown. There is no formal acceptance step — the booking just closes.

---

## Solution

Add a **charge submission + confirmation step** between `In Progress` and `Completed`. After the servicer marks the job done, they submit actual hours, charge amount, and an optional description. The home user reviews this breakdown and explicitly accepts or rejects it. Accepted charges close the booking as `Completed` with full billing data recorded. Rejected charges close the booking as `Cancelled`, freeing both parties.

---

## New Booking Status Flow

```
Pending → Accepted → In Progress → Awaiting Payment → Completed
                                                     ↘ Cancelled (on reject)
```

Emergency SOS bookings (`source_type = "emergency"`) skip this flow entirely — no charge form, no `Awaiting Payment` status.

---

## Database Changes

**Migration file:** `14_04_2026_add_charge_submission.py`

Add to `service_bookings` table:

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `is_flagged` | Boolean | No | False | Quick flag indicator for admin list view |

All other charge data reuses **existing columns** (no new columns needed):
- `actual_hours` (Float, nullable) — hours servicer worked
- `final_cost` (Float) — charge amount submitted by servicer
- `completion_notes` (Text, nullable) — servicer's charge description
- `completed_at` (DateTime, nullable) — set at charge submission time

Flag reason/detail is stored in the existing `BookingComplaint` table (`filed_by`, `reason`, `status`). The `flag` endpoint creates a `BookingComplaint` row AND sets `is_flagged = True` on the booking for fast admin list queries.

All timestamps use `datetime.now(timezone.utc).replace(tzinfo=None)` — naive UTC, consistent with all other booking timestamps.

---

## API Endpoints

All under `/api/v1/bookings`. Emergency SOS router (`/api/v1/emergency`) is not modified.

### `POST /bookings/{id}/submit-charge` — SERVICER only

**Guard:** Booking must be `In Progress`, `source_type != "emergency"`, current user must be the assigned provider.

**Request body:**
```json
{
  "actual_hours": 2.5,
  "charge_amount": 400.0,
  "charge_description": "Replaced faulty wiring in panel"
}
```

**Actions:**
- Saves `actual_hours`, `final_cost = charge_amount`, `charge_description`, `charge_submitted_at = now()`
- Sets booking status → `Awaiting Payment`
- Appends `BookingStatusHistory` row with status `Awaiting Payment` and notes summary
- Sends notification to home user: "Servicer submitted charge — ₹400 for 2.5 hrs. Review and confirm."

---

### `POST /bookings/{id}/accept-charge` — USER only

**Guard:** Booking must be `Awaiting Payment`, current user must be the booking owner.

**Actions:**
- Sets booking status → `Completed`
- Appends `BookingStatusHistory` row: status `Completed`, notes "Charge accepted by user"
- Sends notification to servicer: "Payment confirmed. Booking closed."
- Awards provider points via `award_points()` with event `REGULAR_COMPLETE` (or `URGENT_COMPLETE` based on priority)

---

### `POST /bookings/{id}/reject-charge` — USER only

**Guard:** Booking must be `Awaiting Payment`, current user must be the booking owner.

**Actions:**
- Sets booking status → `Cancelled`
- Appends `BookingStatusHistory` row: status `Cancelled`, notes "Charge rejected by user"
- Sends notification to servicer: "User rejected the charge. Booking closed."
- Sets provider `availability_status` back to `AVAILABLE`

---

### `POST /bookings/{id}/flag` — USER or ADMIN

**Guard:** Booking must not be `Cancelled`. No status restriction otherwise.

**Request body:**
```json
{
  "flag_reason": "Charged for 5 hours but job took 1 hour"
}
```

**Actions:**
- Sets `is_flagged = True`, saves `flag_reason`
- Sends notification to all admin users: "Booking flagged — [service_type] at [property_details]"

---

## Frontend Changes

### Servicer — `/service/jobs` (active jobs tab)

- Bookings with status `In Progress` and `source_type != "emergency"` show a **"Mark Complete & Submit Charge"** button
- Clicking opens a modal:
  - **Actual hours worked** — number input, required, min 0.1
  - **Charge amount ₹** — number input, required, > 0
  - **Description** — textarea, optional, placeholder: "What work was done?"
  - Submit → calls `POST /bookings/{id}/submit-charge`
- After submit: status badge changes to `Awaiting Payment`, button replaced with "Awaiting user confirmation"

### Home User — `/user/bookings` and booking detail

- Bookings with status `Awaiting Payment` show a **charge review card**:
  - Servicer name
  - Hours worked: `X hrs`
  - Charge amount: `₹X`
  - Description (if provided)
  - Submitted at: real timestamp from `charge_submitted_at`
  - **Accept Charge** (green button) → calls `POST /bookings/{id}/accept-charge`
  - **Reject Charge** (red button) → calls `POST /bookings/{id}/reject-charge`
  - **Flag to Admin** (grey button) → opens inline form for flag reason → calls `POST /bookings/{id}/flag`
- After accept/reject: card replaced with confirmation message and final status

### Admin — `/admin/bookings`

- Flagged bookings show a red `Flagged` badge in the booking list
- Booking detail view shows all charge fields: `actual_hours`, `final_cost`, `charge_description`, `charge_submitted_at`, `is_flagged`, `flag_reason`
- Admin can flag any non-cancelled booking via a flag button in detail view

### Emergency SOS bookings

- `source_type = "emergency"` — charge form buttons are hidden on all views
- Emergency router, endpoints, and WebSocket flows are not modified

---

## Notification Summary

| Event | Who gets notified | Type |
|---|---|---|
| Charge submitted | Home user | `URGENT` |
| Charge accepted | Servicer | `INFO` |
| Charge rejected | Servicer | `INFO` |
| Booking flagged | All admins | `URGENT` |

---

## Timestamp Rules

All datetime fields set server-side using:
```python
datetime.now(timezone.utc).replace(tzinfo=None)
```
No hardcoded times anywhere. Frontend displays timestamps from API response fields directly.

---

## Out of Scope

- Emergency SOS billing (separate flow, untouched)
- Payment gateway integration
- Charge revision / re-submission after rejection
- Admin resolving disputes beyond visibility

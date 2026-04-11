# Booking Completion & Complaint System — Design Spec
**Date:** 2026-04-11  
**Status:** Approved

---

## Overview

Redesign the booking completion flow so both parties (servicer + home user) are involved. Add a two-party receipt confirmation step, a complaint/dispute system for users and servicers (booking-based), and a general issue reporting channel for secretaries. Admin gains bill cancellation and amount override powers.

---

## 1. Booking Status State Machine

### New Status: `Pending Confirmation`

Added between `In Progress` and `Completed`.

```
Pending → Accepted → In Progress → Pending Confirmation → Completed
                                          ↓ (dispute filed)
                                     Admin Review
                                     ↙           ↘
                             Cancel bill        Override amount
                           (→ In Progress)    (→ Completed directly)
```

**Transition rules:**
| Transition | Who | How |
|---|---|---|
| `In Progress` → `Pending Confirmation` | Servicer | `POST /bookings/{id}/final-complete` (hours + notes) |
| `Pending Confirmation` → `Completed` | User | `POST /bookings/{id}/confirm` |
| `Pending Confirmation` → `In Progress` | Admin | `PATCH /admin/complaints/{id}` with `action: "cancel_bill"` |
| `Pending Confirmation` → `Completed` (override) | Admin | `PATCH /admin/complaints/{id}` with `action: "override_amount"` + `amount` |

**Removed flow:** The old `Accepted → Completed` simple path (via `PATCH /bookings/{id}/status`) on the servicer jobs page is removed. All completions must go through `final_complete`.

**Timeline display:** `BookingStatusTimeline` component gains `Pending Confirmation` as a step between `In Progress` and `Completed`.

---

## 2. Backend API Changes

### Modified Endpoints

**`POST /bookings/{id}/final-complete`** (servicer only)
- Currently sets status to `Completed`
- **Change:** Sets status to `Pending Confirmation` instead
- Generates receipt as before (extra_hours, notes)
- Sends notification to home user: *"Work complete — please review and confirm your receipt"* with link `/user/bookings/{id}`

**`POST /bookings/{id}/complaint`** (user or servicer)
- Currently only allows `filed_by == booking.user_id`
- **Change:** Also allow the booking's `provider.user_id` to file
- Complaint status stays `Pending Confirmation` (does not revert booking status on its own — admin decides)

**`PATCH /admin/complaints/{id}`** (admin only)
- Existing: update `status`, `admin_notes`
- **New fields:** `action` (optional string), `override_amount` (optional float)
- If `action == "cancel_bill"`: booking → `In Progress`, `final_cost`/`actual_hours` cleared, servicer notified to re-submit
- If `action == "override_amount"` + `override_amount`: booking → `Completed` with `final_cost = override_amount`, both parties notified

### New Endpoints

**`POST /bookings/{id}/confirm`** (user only)
- Booking must be in `Pending Confirmation` and belong to current user
- Sets status to `Completed`
- Calls `award_points(provider, event="REGULAR_COMPLETE")` (or URGENT/EMERGENCY based on booking priority)
- Notifies servicer: *"User confirmed your receipt — job complete"*
- Returns `BookingRead`

**`POST /secretary/complaints`** (secretary only)
- Creates a `SecretaryComplaint` record linked to the secretary's society
- Fields: `subject` (str), `description` (str)
- Notifies admin

**`GET /secretary/complaints`** (secretary only)
- Returns list of own complaints with status + admin_notes

**`GET /admin/secretary-complaints`** (admin only)
- Returns all secretary complaints, sorted by `created_at DESC`

**`PATCH /admin/secretary-complaints/{id}`** (admin only)
- Updates `status` (`OPEN` / `UNDER_REVIEW` / `RESOLVED`) and `admin_notes`

### New DB Table (migration required)

**`secretary_complaints`**
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `society_id` | UUID FK → societies | |
| `filed_by` | UUID FK → users | secretary's user_id |
| `subject` | String | |
| `description` | Text | |
| `status` | String | `OPEN` / `UNDER_REVIEW` / `RESOLVED` |
| `admin_notes` | Text | nullable |
| `created_at` | DateTime | |
| `resolved_at` | DateTime | nullable |

---

## 3. Frontend Changes

### User — `/user/bookings` (Active Contracts tab)

- `Pending Confirmation` bookings included in the `contracts` tab count badge
- These cards display an amber **"Awaiting Your Confirmation"** badge instead of the normal status badge
- Clicking the card opens a **Receipt Confirmation Modal** (inline modal, no page navigation):
  - Shows: service type, servicer name, hours worked, base price, extra hours/charge, **final amount**
  - Button: **"Confirm Payment"** (green) → calls `POST /bookings/{id}/confirm` → closes modal, refreshes list, review modal opens
  - Button: **"Dispute"** (red) → expands a sub-form with `reason` field → calls `POST /bookings/{id}/complaint` → toast success, modal closes

### User — `/user/bookings/[id]` (Booking Detail)

- `BookingStatusTimeline` updated to show `Pending Confirmation` step
- If status is `Pending Confirmation` and viewer is the booking's user: show an inline receipt confirmation panel above the chat (same data + Confirm/Dispute buttons)
- Review modal auto-opens unchanged — triggered when booking reaches `Completed` without an existing review

### Servicer — `/service/jobs` page and `/user/bookings/[id]` (booking detail)

- Remove `completionTarget` modal on servicer jobs page (the old `Accepted → Completed` path via `PATCH /bookings/{id}/status`)
- Remove the **"Mark Complete"** button on the booking detail page for SERVICER role — replace with a button that opens the `finalCompleteTarget` modal (same as servicer jobs page)
- All completions go through `finalCompleteTarget` modal (existing `final_complete` endpoint) — now sets `Pending Confirmation`
- Bookings in `Pending Confirmation` show **"Awaiting User Confirmation"** amber badge
- New **"Report Issue"** button on each booking card → opens complaint modal (subject + description) → `POST /bookings/{id}/complaint`

### Secretary — `/secretary/dashboard` or settings

- New **"Report an Issue"** button in the dashboard header → opens modal: `subject` + `description` → `POST /secretary/complaints`
- New **"My Reports"** section on dashboard showing filed complaints with status badge and admin notes

### Admin — `/admin/bookings` complaints tab

- Each open complaint card gains two new action buttons:
  - **"Cancel Bill"** → calls `PATCH /admin/complaints/{id}` with `action: "cancel_bill"` → booking reverts, servicer re-submits
  - **"Override Amount"** → shows an inline number input → calls `PATCH /admin/complaints/{id}` with `action: "override_amount"` + entered amount
- New **"Secretary Reports"** tab in `/admin/bookings` (or a separate section in admin dashboard) showing secretary complaints with resolve action

---

## 4. Files to Create / Modify

### Backend
| File | Change |
|---|---|
| `backend/app/booking/domain/model.py` | No change (BookingComplaint already exists) |
| `backend/app/api/booking/endpoints.py` | Modify `final_complete`, `file_complaint`; add `confirm` endpoint |
| `backend/app/api/booking/schemas.py` | Add `ConfirmRead` schema if needed |
| `backend/app/api/admin/endpoints.py` | Extend `PATCH /admin/complaints/{id}` with cancel_bill / override_amount |
| `backend/app/api/secretary/endpoints.py` | Add complaint endpoints |
| `backend/app/api/secretary/schemas.py` | Add `SecretaryComplaintCreate`, `SecretaryComplaintRead` |
| `backend/app/api/admin/schemas.py` | Add `SecretaryComplaintRead` |
| `backend/alembic/versions/` | New migration: `11_04_2026_add_secretary_complaints.py` |
| `backend/app/main.py` | No change (secretary router already registered) |

### Frontend
| File | Change |
|---|---|
| `frontend/app/user/bookings/page.tsx` | Receipt confirmation modal, Pending Confirmation badge |
| `frontend/app/user/bookings/[id]/page.tsx` | Inline confirmation panel, timeline update |
| `frontend/app/service/jobs/page.tsx` | Remove old completion modal, add Report Issue button |
| `frontend/app/admin/bookings/page.tsx` | Cancel Bill / Override Amount buttons, Secretary Reports tab |
| `frontend/app/secretary/dashboard/page.tsx` | Report Issue button + My Reports section |
| `frontend/components/bookings/BookingStatusTimeline.tsx` | Add Pending Confirmation step |

---

## 5. Notification Messages

| Event | Recipient | Message |
|---|---|---|
| Servicer submits final complete | User | "Work complete — review and confirm your receipt" |
| User confirms | Servicer | "User confirmed your receipt — job complete" |
| User disputes | Admin | "New complaint filed on booking #{id}" |
| Admin cancels bill | Servicer | "Admin cancelled your bill — please re-submit the completion" |
| Admin overrides amount | User + Servicer | "Admin resolved the dispute — final amount: ₹{amount}" |
| Secretary files complaint | Admin | "Secretary complaint: {subject}" |

---

## 6. Out of Scope

- Booking type selector (Routine/Urgent/Emergency) on provider selection page — separate feature
- Payment gateway integration — all amounts are recorded only, no real payment processing
- WebSocket real-time updates for Pending Confirmation — notification-based is sufficient

# Servicer Verification & Analytics System — Design Spec
**Date:** 2026-04-06  
**Approach:** Layered (B) — DB/backend first, then UI, then analytics page

---

## Goals

1. Show ALL servicers (verified and unverified) to home users and secretaries.
2. Display a green verified badge only on verified servicers.
3. Calculate star ratings automatically from points earned through completed work.
4. Give servicers a dedicated analytics page showing performance breakdown.
5. Give admin the ability to revoke a servicer's verified status.

---

## What Is NOT Changing

- Existing dashboard layouts (user, servicer, admin, secretary)
- Existing color scheme and design language ("ShigenTech Premium" — Emerald/Charcoal)
- Existing booking request flow
- Existing payment flow
- Existing notification system
- Existing emergency SOS flow
- Auto-verify flow: uploading ≥1 certificate → `is_verified = true` (unchanged)

---

## Layer 1: Database

### New Table: `provider_points`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `provider_id` | UUID FK → service_providers.id | |
| `delta` | Float | Positive = earned, negative = penalty |
| `event_type` | String | See event types below |
| `source_id` | UUID nullable | booking_id or emergency_request_id |
| `note` | Text nullable | Human-readable description |
| `created_at` | DateTime | UTC, naive |

**Event types:**
- `EMERGENCY_COMPLETE` → +35
- `URGENT_COMPLETE` → +20
- `REGULAR_COMPLETE` → +15
- `EMERGENCY_CANCEL` → -20
- `REGULAR_CANCEL` → -10 (also covers urgent cancel)
- `FEEDBACK_BONUS` → +2 to +10 (based on star rating given)
- `REVIEW_WRITTEN` → +2 (user wrote a text review)
- `RECOMMEND_BONUS` → +5 (user marked "would recommend")
- `ADMIN_ADJUSTMENT` → any (manual admin override)

**Alembic migration:** `07_04_2026_add_provider_points.py`  
Creates `provider_points` table only. No existing table is altered.

---

### Star Rating Recalculation

Stored on existing `ServiceProvider.rating` (Float field — no schema change).

```
total_points  = SUM(delta) WHERE provider_id = X
base_stars    = total_points / 100
display_stars = clamp(base_stars, 0.0, 5.0)
```

- New servicers: 0 points → `rating = 0.0` (shown as "New" in UI)
- Recalculated and committed every time a point event is recorded

---

## Layer 2: Backend API

### Internal Helper (no route)

```python
award_points(db, provider_id, delta, event_type, source_id=None, note=None)
```

1. Inserts row into `provider_points`
2. Recalculates `ServiceProvider.rating` from SUM of all deltas
3. Commits

Called from existing endpoints — not a standalone route.

---

### Hook: Booking completion → points

**Existing endpoint:** `PATCH /bookings/{booking_id}` (in `backend/app/api/booking/endpoint.py`)

Regular and urgent bookings only (emergency jobs are tracked via EmergencyResponse — see below).

When status changes to `Completed` and the booking's `source_type != "EMERGENCY"`:
- `priority == "Normal"` → `award_points(+15, REGULAR_COMPLETE)`
- `priority == "High"` → `award_points(+20, URGENT_COMPLETE)`

When status changes to `Cancelled` AND `current_user` is the provider (not the user):
- `award_points(-10, REGULAR_CANCEL)`

No points deducted when the *user* cancels — penalty only applies to provider-initiated cancellations.

---

### Hook: Emergency response completion → points

**Existing endpoint:** `PATCH /emergency/{request_id}/response/{response_id}` (in `backend/app/api/emergency/endpoint.py`)

When response status changes to `COMPLETED`:
- `award_points(+35, EMERGENCY_COMPLETE, source_id=request_id)`

When response status changes to `CANCELLED` and the canceller is the provider:
- `award_points(-20, EMERGENCY_CANCEL, source_id=request_id)`

---

### Hook: Review submission → feedback points

**Existing endpoint:** `POST /bookings/{booking_id}/review` (in `backend/app/api/booking/endpoint.py`)

After saving the `BookingReview`, call `award_points` based on `rating`:

| Star rating | Points |
|---|---|
| 5 | +10 |
| 4 | +8 |
| 3 | +5 |
| 2 | +2 |
| 1 | 0 |

If `review_text` is non-empty → additional +2 (`REVIEW_WRITTEN`).

---

### New: Analytics Endpoint

```
GET /services/providers/me/analytics
Auth: SERVICER role
```

Returns:

```json
{
  "total_jobs": 156,
  "emergency_jobs": 23,
  "urgent_jobs": 45,
  "regular_jobs": 88,
  "cancelled_jobs": 9,
  "total_points": 2873,
  "current_rating": 4.8,
  "completion_rate": 94.8,
  "points_breakdown": {
    "emergency": 745,
    "urgent": 900,
    "regular": 1260,
    "feedback": 150,
    "penalties": -182
  },
  "recent_point_log": [
    { "created_at": "...", "event_type": "...", "delta": 35, "note": "..." }
  ],
  "monthly_stats": [
    { "month": "2026-03", "jobs": 18, "points_earned": 425, "rating_end": 4.6 }
  ]
}
```

All computed server-side. No new DB queries beyond `provider_points` + `service_bookings`.

---

### New: Admin Revoke Endpoint

```
PATCH /admin/providers/{provider_id}/verify
Auth: ADMIN role
Body: { "is_verified": false, "reason": "string" }
```

- Sets `ServiceProvider.is_verified = False`
- Creates a `Notification` for the servicer's user with the reason
- Returns updated provider

The existing auto-verify endpoint (`POST /services/providers/verify`) is unchanged.

---

## Layer 3: Frontend

### Change 1: Compact Provider Cards + Detail Popup (`/user/providers`)

**Card layout (compact, one row per provider):**
```
[Avatar]  Name  [✓ VERIFIED badge]  ⭐ 3.8  |  Category  |  ₹500/hr  |  🟢 AVAILABLE  [View Details]
```

- Checkbox for multi-select (existing send-request flow) stays on the left
- `[View Details]` button opens a modal

**Detail modal contents:**
- Large avatar photo + name + verified badge (if verified)
- Star rating (filled star icons, e.g. ⭐⭐⭐⭐☆)
- Bio paragraph
- Categories (pill tags)
- Experience years, hourly rate, location
- Completed jobs count
- × close button in top-right corner

**Not in modal:** Send Request button, review count.

**Existing send-request flow:** unchanged — checkbox → floating "Send Request" bar → request modal.

---

### Change 2: New `/service/analytics` Page

New file: `frontend/app/service/analytics/page.tsx`

**Page sections (same card style as existing servicer pages):**

1. **Summary row (4 stat cards):**
   - Total Jobs (emergency / urgent / regular breakdown below number)
   - Current Rating (star visual)
   - Total Points
   - Completion Rate %

2. **Points breakdown (CSS bar chart, no external lib):**
   - One bar per category: Emergency | Urgent | Regular | Feedback | Penalties
   - Width = proportion of total points
   - Colors match existing emerald/blue/rose palette

3. **Recent point activity log (table):**
   - Last 10 events: Date | Event | Points Delta
   - Positive delta = green, negative = rose

4. **Monthly stats table:**
   - Last 6 months: Month | Jobs | Points Earned | Rating

---

### Change 3: Sidebar Link

In `frontend/components/layout/Sidebar.tsx`, add "Analytics" link for SERVICER role between "Ratings" and "Profile" entries. Same styling as other sidebar items.

---

### Change 4: Admin Revoke Panel (`/admin/providers`)

On the existing admin providers page, for each provider row where `is_verified = true`:
- Show a **"Revoke"** button (small, rose-colored)
- Clicking opens a small confirmation popup with a reason text field
- On confirm: calls `PATCH /admin/providers/{id}/verify`
- On success: updates the row in-place (no page reload)

No new admin page needed.

---

## Data Flow Summary

```
Booking Completed
  → award_points() called in booking endpoint
    → provider_points row inserted
    → ServiceProvider.rating recalculated
    → Servicer sees updated rating on dashboard

Review Submitted
  → award_points() called in review endpoint
    → provider_points row inserted (feedback + optional bonuses)
    → ServiceProvider.rating recalculated

Servicer visits /service/analytics
  → GET /services/providers/me/analytics
    → Aggregates provider_points + service_bookings
    → Returns analytics JSON → page renders

Admin revokes verification
  → PATCH /admin/providers/{id}/verify
    → is_verified = false
    → Notification sent to servicer
```

---

## Files to Create / Modify

### Create
- `backend/alembic/versions/07_04_2026_add_provider_points.py`
- `backend/app/internal/point_engine.py` (award_points helper)
- `backend/app/api/service/analytics_endpoint.py` (analytics route, mounted under `/services` prefix in `main.py`)
- `frontend/app/service/analytics/page.tsx`

### Modify
- `backend/app/api/booking/endpoint.py` — hook point awards on complete (regular/urgent) / provider-cancel / review
- `backend/app/api/emergency/endpoint.py` — hook point awards on emergency response complete / provider-cancel
- `backend/app/api/admin/endpoint.py` — add revoke endpoint
- `backend/app/internal/models.py` — add ProviderPoints model
- `backend/app/internal/schemas.py` — add ProviderAnalyticsRead schema
- `backend/app/main.py` — register analytics router
- `frontend/app/user/providers/page.tsx` — compact cards + detail modal
- `frontend/components/layout/Sidebar.tsx` — add Analytics link

---

## Out of Scope (Not Built)

- OTP phone verification during registration
- "Emergency Specialist" badge (can be added later)
- "RISING STAR" badge
- Recommend (yes/no) field on review form — review schema unchanged
- Secretary society-specific servicer stats
- Admin manual point adjustment UI (endpoint exists via ADMIN_ADJUSTMENT event type but no UI)

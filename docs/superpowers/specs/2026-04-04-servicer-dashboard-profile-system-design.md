# Servicer Dashboard & Profile System — Design Spec
**Date:** 2026-04-04  
**Status:** Approved

---

## Overview

Build a complete Servicer profile management system within the existing homecare-hub application without breaking any existing routes, layouts, or design system (ShigenTech Premium — Emerald/Charcoal palette, lucide-react icons).

Two goals:
1. Fix `TypeError: Failed to fetch` — add visible error states so pages degrade gracefully when the backend is unreachable.
2. Implement the full profile + certificate management system across two pages.

---

## Architecture


### Files Changed

| File | Change |
|------|--------|
| `frontend/app/service/dashboard/page.tsx` | Replace complex profile editing block with clean read-only profile card + incomplete-profile banner |
| `frontend/app/service/settings/profile/page.tsx` | Full edit form (always visible) + certificate management section |
| `frontend/app/service/jobs/page.tsx` | Add visible error state for fetch failure |
| `frontend/app/service/ratings/page.tsx` | Add visible error state for fetch failure |
| `backend/app/internal/schemas.py` | Add `title` field to `CertificateBase` / `CertificateCreate` / `CertificateResponse` |
| `backend/app/api/service/endpoint.py` | Add `POST /providers/certificates/upload` and `DELETE /providers/certificates/{cert_id}` |
| `backend/alembic/versions/` | New migration: add `title` column to `service_certificates` |
| `backend/app/internal/models.py` | Add `title = Column(String, nullable=True)` to `ServiceCertificate` |

---

## Section 1 — Fix "Failed to Fetch" (Dashboard, Jobs, Ratings)

**Root cause:** `TypeError: Failed to fetch` is thrown by the browser's `fetch()` when the backend server is unreachable (connection refused). All three pages have `try/catch` but silently call `console.error`, leaving users with a blank or empty screen.

**Fix:** In each page's catch block, set an `error` state string. Render a visible error card:
- Amber/rose banner: "Could not connect to the server. Please ensure the backend is running."
- Show this instead of (or above) the empty state
- Keep the existing empty states for the "no data" case (provider profile not found, no bookings, etc.)

**Pages affected:** `dashboard/page.tsx`, `jobs/page.tsx`, `ratings/page.tsx`

---

## Section 2 — Dashboard Profile Card (Read-Only)

**Route:** `/service/dashboard`

### What changes
Remove the current profile editing block (bio modal, photo upload file ref, edit form states: `editBio`, `editEdu`, `editExp`, `editRate`, `editPhone`, `editEmail`, `editLocation`, `editPhoto`, `showEditBio`). Replace with a single read-only profile card.

### Profile Card UI
- Profile photo (circle, falls back to initials avatar if no photo)
- Name (`first_name last_name` or `owner_name` as fallback)
- Verification badge: "VERIFIED" (emerald) or "NOT YET VERIFIED" (amber)
- Availability status badge (AVAILABLE / WORKING / VACATION) — this toggle stays on dashboard
- Bio text (truncated to 3 lines with expand option if long)
- Info chips: Rate (₹X/hr), Experience (X yrs), Location, Phone
- Categories as tag chips (emerald)
- "Edit Profile" link → navigates to `/service/settings/profile`

### Incomplete Profile Banner
Shown when any of these are missing: `first_name`, `categories` (empty array), `hourly_rate` (0 or null):
- Amber banner at top of the card: "Your profile is incomplete — fill in your details to start receiving jobs."
- CTA button: "Complete Profile →" linking to `/service/settings/profile`

### What stays on dashboard (unchanged)
- Availability toggle
- Jobs/bookings summary section
- Society invitation cards
- Stats cards (total jobs, completed, rating)

---

## Section 3 — Settings > Profile Page

**Route:** `/service/settings/profile`

Two stacked sections on the same page:

---

### 3a — MY PROFILE (Edit Form)

**Behavior:**
- On mount: call `GET /services/providers/me`. If 404 (new servicer, no profile yet), call `POST /services/providers/setup` with minimal data to create the record, then load it.
- Form is always visible (not behind a modal). Pre-filled from API data.
- On save: call `PATCH /services/providers/me` with changed fields only.
- Success: show emerald success banner inline. Error: show rose error banner.

**Fields (in order):**

| Field | Mandatory | Backend field |
|-------|-----------|---------------|
| First Name | ✓ | `first_name` |
| Last Name | ✓ | `last_name` |
| Phone | ✓ | `phone` |
| Bio (textarea) | ✓ | `bio` |
| Service Categories | ✓ | `categories` (multi-select chips) |
| Hourly Rate (₹) | ✓ | `hourly_rate` |
| Experience (years) | — | `experience_years` |
| Education | — | `education` |
| Location | — | `location` |
| Age | — | `age` |
| Gender | — | `gender` (dropdown: Male / Female / Other / Prefer not to say) |

Mandatory fields show a red `*` in the label. Save button is disabled if any mandatory field is empty.

**Category multi-select:** Predefined list of categories matching the backend `ALLOWED_CATEGORIES`. User clicks chips to toggle selection. Selected chips appear in emerald. At least one required.

**Account Details sub-section (read-only):**
Username and email shown as read-only fields (sourced from `GET /user/me`). Username can be edited (calls `PATCH /user/me`).

---

### 3b — YOUR CERTIFICATES

**Behavior:**
- Load certificates from `GET /services/providers/me` response (`certificates` array).
- Each certificate shows: category badge, title, file link (view/download), verification status, upload date.
- "Upload Certificate" button opens an inline upload form (not a separate modal).
- Delete button per certificate calls `DELETE /services/providers/certificates/{id}`.

**Upload Form (inline, toggleable):**
- Category: dropdown (same predefined list as profile categories)
- Title: text input (e.g. "Electrician Safety Certificate")
- File: file picker (accepts PDF, JPG, PNG, max 5MB)
- Submit: calls `POST /services/providers/certificates/upload` (multipart form data)
- On success: closes form, appends new cert to list
- On error: shows inline error

**Empty State:** "No certificates uploaded yet. Upload your qualifications to get verified."

---

## Section 4 — Backend Changes

### 4a — Migration: Add `title` to `service_certificates`

File: `backend/alembic/versions/04_04_2026_add_title_to_service_certificates.py`

```sql
ALTER TABLE service_certificates ADD COLUMN title VARCHAR;
```

Nullable — existing rows have `title = NULL`.

### 4b — Model Update

`backend/app/internal/models.py`, `ServiceCertificate` class:
```python
title = Column(String, nullable=True)
```

### 4c — Schema Update

`backend/app/internal/schemas.py`:

```python
class CertificateBase(BaseModel):
    category: str
    title: Optional[str] = None          # NEW
    certificate_url: str
    is_verified: bool = False

class CertificateResponse(CertificateBase):
    id: int
    uploaded_at: datetime

class CertificateCreate(CertificateBase):
    pass
```

### 4d — New Endpoint: File Upload for Certificates

`POST /services/providers/certificates/upload`

```
Accepts: multipart/form-data
  - file: UploadFile (PDF, JPG, PNG — validated by content_type)
  - category: str = Form(...)
  - title: str = Form(...)

Saves to: /uploads/certificates/{uuid}_{original_filename}
Returns: CertificateResponse
Auth: Bearer token (SERVICER role)
```

File size limit: 5MB (validated server-side, raises 413 if exceeded).  
Provider must exist (404 if no provider profile).

### 4e — New Endpoint: Delete Certificate

`DELETE /services/providers/certificates/{cert_id}`

```
Validates: certificate belongs to current_user's provider (403 if not)
Deletes: DB record (file on disk is left — no orphan cleanup needed for MVP)
Returns: {"message": "Certificate deleted"}
```

---

## Data Flow

```
Servicer logs in
  → JWT stored as hc_token_SERVICER in localStorage
  → Redirected to /service/dashboard

/service/dashboard
  → GET /services/providers/me  (read-only profile card)
  → GET /bookings/list           (jobs summary)
  → GET /services/societies/requests/me  (invitations)
  → If provider 404: show "Complete your profile" banner

/service/settings/profile
  → GET /user/me                 (username, email)
  → GET /services/providers/me  (all profile fields + certificates[])
  → If provider 404: POST /services/providers/setup → then load
  → PATCH /services/providers/me  (on profile save)
  → POST /services/providers/certificates/upload  (on cert upload)
  → DELETE /services/providers/certificates/{id}  (on cert delete)
```

---

## Constraints

- No new routes created — only existing routes enhanced
- No existing sidebar nav changes
- Design system: emerald (`#064e3b`) primary, charcoal slate secondary, rounded-2xl cards, uppercase tracking labels — match existing page style exactly
- lucide-react for all icons
- Certificates are per-provider (scoped by `current_user` on every backend endpoint)
- No multiple profiles — `POST /providers/setup` creates only if no profile exists, otherwise loads existing

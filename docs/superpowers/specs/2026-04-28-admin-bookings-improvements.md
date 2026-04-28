# Admin Bookings Page — Improvements Design Spec

**Date:** 2026-04-28
**Scope:** Three improvements to `/admin/bookings` page — complaints context, and service requests tab.

---

## Problem Summary

The admin bookings page has three existing tabs (Booking Ledger, Complaints, Secretary Reports). Two issues:

1. **Complaints tab is blind** — each complaint card shows only a booking UUID and reason text. Admin cannot see who filed it, which provider is involved, what service type, or what amount is disputed. The `ComplaintAdminRead` schema returns only IDs.

2. **No Service Requests visibility** — admin has no view of service requests (user-to-provider broadcast requests). If a dispute arises from a service request negotiation, admin has no way to investigate.

---

## What Gets Built

### Fix 1 — Enrich Complaint Data (Backend)

**File:** `backend/app/api/admin/schemas.py`

Extend `ComplaintAdminRead` to include joined booking context:

```python
class ComplaintAdminRead(BaseModel):
    id: UUID
    booking_id: UUID
    filed_by: UUID
    filed_by_username: Optional[str] = None      # NEW
    reason: str
    status: str
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    # Booking context — NEW
    service_type: Optional[str] = None
    booking_status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    final_cost: Optional[float] = None
    estimated_cost: Optional[float] = None
    provider_name: Optional[str] = None
    user_name: Optional[str] = None
```

**File:** `backend/app/api/admin/endpoints.py` — `list_complaints` endpoint

Instead of returning ORM objects directly, manually build the response by joining `ServiceBooking`, `User`, and `ServiceProvider`:

```python
@router.get("/complaints", response_model=List[ComplaintAdminRead])
def list_complaints(status, db, _):
    query = db.query(BookingComplaint)
    if status:
        query = query.filter(BookingComplaint.status == status)
    complaints = query.order_by(BookingComplaint.created_at.desc()).all()

    result = []
    for c in complaints:
        booking = db.query(ServiceBooking).filter(ServiceBooking.id == c.booking_id).first()
        filer = db.query(User).filter(User.id == c.filed_by).first()
        provider = None
        provider_name = None
        if booking and booking.provider_id:
            provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
            if provider:
                provider_name = f"{provider.first_name or ''} {provider.last_name or ''}".strip() or provider.company_name
        user = None
        if booking and booking.user_id:
            user = db.query(User).filter(User.id == booking.user_id).first()

        result.append(ComplaintAdminRead(
            id=c.id,
            booking_id=c.booking_id,
            filed_by=c.filed_by,
            filed_by_username=filer.username if filer else None,
            reason=c.reason,
            status=c.status,
            admin_notes=c.admin_notes,
            created_at=c.created_at,
            resolved_at=c.resolved_at,
            service_type=booking.service_type if booking else None,
            booking_status=booking.status if booking else None,
            scheduled_at=booking.scheduled_at if booking else None,
            final_cost=booking.final_cost if booking else None,
            estimated_cost=booking.estimated_cost if booking else None,
            provider_name=provider_name,
            user_name=user.username if user else None,
        ))
    return result
```

---

### Fix 2 — Complaint Card UI (Frontend)

**File:** `frontend/app/admin/bookings/page.tsx`

Update the `Complaint` interface to include new fields. Update the complaint card to show:

- **Header:** Service type + booking status badge (instead of just `Booking #id`)
- **Row 1:** Filed by: `<username>` | Provider: `<provider name>`
- **Row 2:** Amount: `₹<final_cost or estimated_cost>` | Scheduled: `<date>`
- **Reason:** complaint reason text (already shown)
- **Actions:** unchanged (Mark Under Review, Cancel Bill, Override Amount, Resolve)

---

### Add — Service Requests Tab (Backend + Frontend)

**Backend — new endpoint in `backend/app/api/admin/endpoints.py`:**

```
GET  /admin/requests         — list all service requests with requester name, urgency, status, response count
DELETE /admin/requests/{id}  — admin cancels/closes a request (sets status to CANCELLED)
```

Response shape per request:
- id, device_or_issue, urgency, status, created_at, expires_at
- contact_name, location
- user_name (joined from users table)
- response_count (count of ServiceRequestResponse rows)
- responses: list of { provider_name, proposed_price, proposed_date, status, negotiation_status }

**Frontend — new tab in `frontend/app/admin/bookings/page.tsx`:**

Tab label: "Service Requests"

Each request card shows:
- Issue description + urgency badge + status badge
- Filed by: username | Location
- Responses count chip
- Expandable: click to see each provider's response (price, date, negotiation status)
- Cancel button — visible only when status is `OPEN` or `ACCEPTED`, triggers DELETE endpoint

---

## Files Changed

| File | Change |
|---|---|
| `backend/app/api/admin/schemas.py` | Enrich `ComplaintAdminRead` with booking context fields |
| `backend/app/api/admin/endpoints.py` | Fix `list_complaints` to join data; add `GET /admin/requests`; add `DELETE /admin/requests/{id}` |
| `frontend/app/admin/bookings/page.tsx` | Update Complaint interface + card UI; add Service Requests tab |

---

## Constraints

- Admin can only **cancel** service requests (status → CANCELLED). Cannot accept/reject proposals — that is the user's job.
- All Optional fields in schema — if booking is deleted or data is missing, graceful None shown as "—".
- No new pages, no new sidebar links. Everything inside existing `/admin/bookings`.

# Charge Submission & Payment Confirmation Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `extra_hours` auto-calculation in `/final-complete` with a transparent `actual_hours + charge_amount + description` form, add a `reject-charge` endpoint, add booking flagging with admin visibility, and update all three portals (servicer, user, admin) to surface the new flow.

**Architecture:** The `Pending Confirmation` booking status already exists — it is the "Awaiting Payment" state. The existing `/final-complete` and `/confirm` endpoints are modified in-place. Two new endpoints are added: `POST /reject-charge` and `POST /flag`. One migration adds `is_flagged` boolean to `service_bookings`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (mapped_column style not used here — existing models use Column style), Pydantic v2, Alembic, Next.js 16 App Router, Tailwind CSS, lucide-react

---

## File Map

| Action | File |
|---|---|
| **Create** | `backend/alembic/versions/14_04_2026_add_is_flagged.py` |
| **Modify** | `backend/app/booking/domain/model.py` |
| **Modify** | `backend/app/api/booking/schemas.py` |
| **Modify** | `backend/app/api/booking/endpoints.py` |
| **Create** | `backend/tests/test_charge_submission.py` |
| **Modify** | `frontend/app/service/jobs/page.tsx` |
| **Modify** | `frontend/app/user/bookings/page.tsx` |
| **Modify** | `frontend/app/admin/bookings/page.tsx` |

---

## Task 1: Migration — add `is_flagged` to `service_bookings`

**Files:**
- Create: `backend/alembic/versions/14_04_2026_add_is_flagged.py`

- [ ] **Step 1: Write the test**

```python
# backend/tests/test_charge_submission.py
"""
TDD tests for Charge Submission & Payment Confirmation flow.
No live DB — schema/model/logic tests only.
"""


class TestIsFlaggedColumn:
    def test_is_flagged_column_exists_on_model(self):
        from app.booking.domain.model import ServiceBooking
        assert hasattr(ServiceBooking, "is_flagged"), "ServiceBooking must have is_flagged column"

    def test_is_flagged_column_has_default_false(self):
        from app.booking.domain.model import ServiceBooking
        col = ServiceBooking.__table__.columns["is_flagged"]
        assert col.default is not None or col.server_default is not None, \
            "is_flagged must have a default value"
        assert not col.nullable, "is_flagged must not be nullable"
```

- [ ] **Step 2: Run test — expect FAIL**

```
cd backend && pytest tests/test_charge_submission.py::TestIsFlaggedColumn -v
```
Expected: `AttributeError: type object 'ServiceBooking' has no attribute 'is_flagged'`

- [ ] **Step 3: Create migration file**

```python
# backend/alembic/versions/14_04_2026_add_is_flagged.py
"""add is_flagged to service_bookings

Revision ID: 14042026_is_flagged
Revises: 13042026_home_members
Branch_labels: None
Depends_on: None
"""

from alembic import op
import sqlalchemy as sa

revision = "14042026_is_flagged"
down_revision = "13042026_home_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service_bookings",
        sa.Column("is_flagged", sa.Boolean, nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("service_bookings", "is_flagged")
```

- [ ] **Step 4: Add column to SQLAlchemy model**

In `backend/app/booking/domain/model.py`, add after `completed_at`:

```python
    is_flagged = Column(Boolean, default=False, nullable=False, server_default="false")
```

- [ ] **Step 5: Run test — expect PASS**

```
cd backend && pytest tests/test_charge_submission.py::TestIsFlaggedColumn -v
```
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/14_04_2026_add_is_flagged.py backend/app/booking/domain/model.py backend/tests/test_charge_submission.py
git commit -m "feat: add is_flagged column to service_bookings + migration"
```

---

## Task 2: Schemas — `ChargeSubmitCreate`, `FlagCreate`, updated `BookingRead` and `ReceiptRead`

**Files:**
- Modify: `backend/app/api/booking/schemas.py`

- [ ] **Step 1: Write the tests**

Append to `backend/tests/test_charge_submission.py`:

```python
class TestChargeSubmitCreateSchema:
    def test_requires_actual_hours_and_charge_amount(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import ChargeSubmitCreate
        with pytest.raises(ValidationError):
            ChargeSubmitCreate()  # missing required fields

    def test_valid_schema(self):
        from app.api.booking.schemas import ChargeSubmitCreate
        s = ChargeSubmitCreate(actual_hours=2.5, charge_amount=400.0)
        assert s.actual_hours == 2.5
        assert s.charge_amount == 400.0
        assert s.charge_description is None

    def test_charge_amount_must_be_positive(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import ChargeSubmitCreate
        with pytest.raises(ValidationError):
            ChargeSubmitCreate(actual_hours=1.0, charge_amount=0.0)

    def test_actual_hours_must_be_positive(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import ChargeSubmitCreate
        with pytest.raises(ValidationError):
            ChargeSubmitCreate(actual_hours=0.0, charge_amount=100.0)

    def test_description_is_optional(self):
        from app.api.booking.schemas import ChargeSubmitCreate
        s = ChargeSubmitCreate(actual_hours=1.0, charge_amount=200.0, charge_description="Fixed pipe")
        assert s.charge_description == "Fixed pipe"


class TestFlagCreateSchema:
    def test_flag_reason_required(self):
        import pytest
        from pydantic import ValidationError
        from app.api.booking.schemas import FlagCreate
        with pytest.raises(ValidationError):
            FlagCreate()

    def test_valid_flag(self):
        from app.api.booking.schemas import FlagCreate
        f = FlagCreate(flag_reason="Overcharged by 2 hours")
        assert f.flag_reason == "Overcharged by 2 hours"


class TestBookingReadIncludesIsFlagged:
    def test_is_flagged_field_present_in_booking_read(self):
        from app.api.booking.schemas import BookingRead
        assert "is_flagged" in BookingRead.model_fields, \
            "BookingRead must expose is_flagged"
```

- [ ] **Step 2: Run tests — expect FAIL**

```
cd backend && pytest tests/test_charge_submission.py::TestChargeSubmitCreateSchema tests/test_charge_submission.py::TestFlagCreateSchema tests/test_charge_submission.py::TestBookingReadIncludesIsFlagged -v
```
Expected: ImportError / AttributeError

- [ ] **Step 3: Add schemas to `backend/app/api/booking/schemas.py`**

After the existing `FinalCompleteCreate` class, add:

```python
class ChargeSubmitCreate(BaseModel):
    actual_hours: float
    charge_amount: float
    charge_description: Optional[str] = None

    @field_validator("actual_hours")
    @classmethod
    def validate_hours(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("actual_hours must be greater than 0")
        return v

    @field_validator("charge_amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("charge_amount must be greater than 0")
        return v


class FlagCreate(BaseModel):
    flag_reason: str
```

Add the import at the top of schemas.py (after existing imports):
```python
from pydantic import BaseModel, field_validator
```
(Note: `field_validator` may already be imported — check first, add only if missing.)

Update `BookingRead` to expose `is_flagged` and `completed_at`:

```python
class BookingRead(BookingBase):
    id: UUID
    user_id: UUID
    status: str
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    completion_photos: Optional[str] = None
    completed_at: Optional[datetime] = None
    is_flagged: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 4: Run tests — expect PASS**

```
cd backend && pytest tests/test_charge_submission.py::TestChargeSubmitCreateSchema tests/test_charge_submission.py::TestFlagCreateSchema tests/test_charge_submission.py::TestBookingReadIncludesIsFlagged -v
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/booking/schemas.py backend/tests/test_charge_submission.py
git commit -m "feat: add ChargeSubmitCreate, FlagCreate schemas; expose is_flagged in BookingRead"
```

---

## Task 3: Backend — replace `final-complete` logic, fix `confirm` timestamp, add `reject-charge`, add `flag`

**Files:**
- Modify: `backend/app/api/booking/endpoints.py`

- [ ] **Step 1: Write the tests**

Append to `backend/tests/test_charge_submission.py`:

```python
class TestChargeEndpointImports:
    """Smoke-test that all new endpoint functions are importable."""

    def test_final_complete_booking_is_importable(self):
        from app.api.booking.endpoints import final_complete_booking
        assert callable(final_complete_booking)

    def test_reject_charge_is_importable(self):
        from app.api.booking.endpoints import reject_charge
        assert callable(reject_charge)

    def test_flag_booking_is_importable(self):
        from app.api.booking.endpoints import flag_booking
        assert callable(flag_booking)

    def test_confirm_booking_complete_is_importable(self):
        from app.api.booking.endpoints import confirm_booking_complete
        assert callable(confirm_booking_complete)
```

- [ ] **Step 2: Run test — expect FAIL**

```
cd backend && pytest tests/test_charge_submission.py::TestChargeEndpointImports -v
```
Expected: `ImportError: cannot import name 'reject_charge'`

- [ ] **Step 3: Add `ChargeSubmitCreate` and `FlagCreate` to the import in endpoints.py**

In `backend/app/api/booking/endpoints.py`, update the schemas import block:

```python
from app.api.booking.schemas import (
    BookingCreate, BookingUpdate, BookingStatusUpdate,
    BookingReschedule, BookingCancel,
    BookingRead, BookingDetailRead, BookingWithUserRead,
    ChatCreate, ChatRead, ReviewCreate, ReviewRead,
    BookingStatusHistoryRead,
    FinalCompleteCreate, ReceiptRead, ComplaintCreate, ComplaintRead,
    ChargeSubmitCreate, FlagCreate,
)
```

- [ ] **Step 4: Replace `final_complete_booking` endpoint**

Find the entire `final_complete_booking` function (lines ~430–501) and replace it with:

```python
@router.post("/{booking_id}/final-complete", response_model=BookingRead)
def final_complete_booking(
    booking_id: UUID,
    body: ChargeSubmitCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Servicer submits actual hours + charge amount. Booking → Pending Confirmation. User must confirm."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider or provider.id != booking.provider_id:
        raise HTTPException(status_code=403, detail="Only the assigned servicer can submit a charge")

    if booking.source_type == "emergency":
        raise HTTPException(status_code=400, detail="Emergency bookings use the emergency billing flow")

    if booking.status not in ("In Progress", "Accepted"):
        raise HTTPException(
            status_code=400,
            detail=f"Booking is '{booking.status}' — must be 'Accepted' or 'In Progress' to submit charge"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    booking.status = "Pending Confirmation"
    booking.actual_hours = body.actual_hours
    booking.final_cost = body.charge_amount
    booking.completion_notes = body.charge_description
    booking.completed_at = now

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Pending Confirmation",
        notes=(
            f"Servicer submitted charge: {body.actual_hours}h × ₹{body.charge_amount/body.actual_hours:.0f}/h"
            f" = ₹{body.charge_amount:.0f}."
            + (f" Note: {body.charge_description}" if body.charge_description else "")
            + " Awaiting user confirmation."
        ),
        timestamp=now,
    ))

    provider_name = get_provider_display_name(provider)
    _notify_booking(
        db, user_id=booking.user_id,
        title="Charge Submitted — Please Confirm",
        message=(
            f"'{booking.service_type}': {body.actual_hours}h worked, "
            f"charge ₹{body.charge_amount:.0f}. Review and confirm."
        ),
        notification_type="URGENT",
        link=f"/user/bookings/{booking.id}",
    )

    db.commit()
    db.refresh(booking)
    return booking
```

- [ ] **Step 5: Fix timestamp in `confirm_booking_complete`**

Find this line inside `confirm_booking_complete`:
```python
    booking.completed_at = datetime.utcnow()
```
Replace with:
```python
    booking.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
```

- [ ] **Step 6: Add `reject_charge` endpoint**

After the `confirm_booking_complete` function, add:

```python
@router.post("/{booking_id}/reject-charge", response_model=BookingRead)
def reject_charge(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User rejects the submitted charge. Booking is cancelled and both parties are freed."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the booking's user can reject a charge")
    if booking.status != "Pending Confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Booking is '{booking.status}' — must be 'Pending Confirmation' to reject charge"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    booking.status = "Cancelled"

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Cancelled",
        notes="Charge rejected by user. Booking closed.",
        timestamp=now,
    ))

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    if provider:
        provider.availability_status = "AVAILABLE"
        if provider.user_id:
            _notify_booking(
                db, user_id=provider.user_id,
                title="Charge Rejected — Booking Closed",
                message=f"User rejected your charge for '{booking.service_type}'. Booking has been closed.",
                notification_type="INFO",
                link="/service/jobs",
            )

    db.commit()
    db.refresh(booking)
    return booking
```

- [ ] **Step 7: Add `flag_booking` endpoint**

After `reject_charge`, add:

```python
@router.post("/{booking_id}/flag", response_model=ComplaintRead)
def flag_booking(
    booking_id: UUID,
    body: FlagCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User or admin flags a booking as disputed. Creates a complaint and marks booking is_flagged=True."""
    from app.auth.domain.model import User as UserModel

    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    is_user = booking.user_id == current_user.id
    is_servicer = provider is not None and provider.id == booking.provider_id
    is_admin = current_user.role == "ADMIN"

    if not is_user and not is_servicer and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    if booking.status == "Cancelled":
        raise HTTPException(status_code=400, detail="Cannot flag a cancelled booking")

    booking.is_flagged = True

    complaint = BookingComplaint(
        booking_id=booking_id,
        filed_by=current_user.id,
        reason=body.flag_reason,
        status="OPEN",
    )
    db.add(complaint)
    db.flush()

    admins = db.query(UserModel).filter(UserModel.role == "ADMIN").all()
    for admin in admins:
        _notify_booking(
            db, user_id=admin.id,
            title="Booking Flagged",
            message=f"Booking '{booking.service_type}' has been flagged: {body.flag_reason[:80]}",
            notification_type="URGENT",
            link="/admin/bookings",
        )

    db.commit()
    db.refresh(complaint)
    return complaint
```

- [ ] **Step 8: Run all endpoint tests — expect PASS**

```
cd backend && pytest tests/test_charge_submission.py -v
```
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/api/booking/endpoints.py
git commit -m "feat: replace final-complete with direct charge form; add reject-charge, flag endpoints"
```

---

## Task 4: Frontend — Servicer jobs page charge form

**Files:**
- Modify: `frontend/app/service/jobs/page.tsx`

The current form uses `resDuration` for extra hours and calls `/final-complete` with `{ extra_hours, notes }`. Replace with `actual_hours` + `charge_amount` + `charge_description`.

- [ ] **Step 1: Update state variables**

Find the existing state declarations near the top of `ServicerJobsPage`. Replace any `resDuration`/`resPrice` related state used for the completion form. The existing `resDate`, `resTime`, `resPrice`, `resDuration`, `resMessage` are for the *initial request response* form — leave those alone.

Add these new state variables for the charge form (after the existing state block):

```tsx
const [chargingBooking, setChargingBooking] = useState<Booking | null>(null);
const [chargeHours, setChargeHours] = useState<number | "">("");
const [chargeAmount, setChargeAmount] = useState<number | "">("");
const [chargeDesc, setChargeDesc] = useState("");
const [submittingCharge, setSubmittingCharge] = useState(false);
```

- [ ] **Step 2: Add the submit charge handler**

Inside `ServicerJobsPage`, before the return statement, add:

```tsx
async function handleSubmitCharge(booking: Booking) {
    if (!chargeHours || !chargeAmount) return;
    setSubmittingCharge(true);
    try {
        await apiFetch(`/bookings/${booking.id}/final-complete`, {
            method: "POST",
            body: JSON.stringify({
                actual_hours: Number(chargeHours),
                charge_amount: Number(chargeAmount),
                charge_description: chargeDesc.trim() || null,
            }),
        });
        toast.success("Charge submitted. Waiting for user confirmation.");
        setChargingBooking(null);
        setChargeHours("");
        setChargeAmount("");
        setChargeDesc("");
        // Refresh bookings list
        const updated = await apiFetch("/bookings/incoming");
        setBookings(updated);
    } catch (err: any) {
        toast.error(err?.message || "Failed to submit charge");
    } finally {
        setSubmittingCharge(false);
    }
}
```

- [ ] **Step 3: Add "Mark Complete & Submit Charge" button to In Progress bookings**

In the JSX where bookings are rendered, find where the booking status is displayed. For bookings with `status === "In Progress"` and `source_type !== "emergency"`, add the button. The exact location depends on the booking card structure — locate the card's action area and add:

```tsx
{booking.status === "In Progress" && (booking as any).source_type !== "emergency" && (
    <button
        onClick={() => setChargingBooking(booking)}
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
    >
        <CheckCircle className="w-4 h-4" />
        Mark Complete &amp; Submit Charge
    </button>
)}
{booking.status === "Pending Confirmation" && (
    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
        <Clock className="w-4 h-4 shrink-0" />
        Awaiting user payment confirmation
    </div>
)}
```

- [ ] **Step 4: Add the charge submission modal**

At the bottom of the JSX (before the closing `</div>` of the page), add:

```tsx
{chargingBooking && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Submit Charge</h2>
                <button
                    onClick={() => setChargingBooking(null)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
                {chargingBooking.service_type} — fill in actual work details
            </p>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Actual hours worked <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={chargeHours}
                        onChange={e => setChargeHours(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="e.g. 2.5"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Charge amount ₹ <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={chargeAmount}
                        onChange={e => setChargeAmount(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="e.g. 400"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (optional)
                    </label>
                    <textarea
                        rows={3}
                        value={chargeDesc}
                        onChange={e => setChargeDesc(e.target.value)}
                        placeholder="What work was done?"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button
                    onClick={() => setChargingBooking(null)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={() => handleSubmitCharge(chargingBooking)}
                    disabled={!chargeHours || !chargeAmount || submittingCharge}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                    {submittingCharge ? "Submitting…" : "Submit Charge"}
                </button>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/service/jobs/page.tsx
git commit -m "feat: servicer charge form — actual hours + charge amount + description"
```

---

## Task 5: Frontend — User bookings charge review card

**Files:**
- Modify: `frontend/app/user/bookings/page.tsx`

- [ ] **Step 1: Add state for flag modal and charge actions**

Near the top of the user bookings component, add state:

```tsx
const [flaggingBookingId, setFlaggingBookingId] = useState<string | null>(null);
const [flagReason, setFlagReason] = useState("");
const [submittingFlag, setSubmittingFlag] = useState(false);
const [confirmingCharge, setConfirmingCharge] = useState<string | null>(null);
const [rejectingCharge, setRejectingCharge] = useState<string | null>(null);
```

- [ ] **Step 2: Add action handlers**

Before the return statement, add:

```tsx
async function handleAcceptCharge(bookingId: string) {
    setConfirmingCharge(bookingId);
    try {
        await apiFetch(`/bookings/${bookingId}/confirm`, { method: "POST" });
        toast.success("Payment confirmed. Booking complete!");
        fetchBookings(); // call whatever existing refresh function exists
    } catch (err: any) {
        toast.error(err?.message || "Failed to confirm charge");
    } finally {
        setConfirmingCharge(null);
    }
}

async function handleRejectCharge(bookingId: string) {
    setRejectingCharge(bookingId);
    try {
        await apiFetch(`/bookings/${bookingId}/reject-charge`, { method: "POST" });
        toast.success("Charge rejected. Booking closed.");
        fetchBookings();
    } catch (err: any) {
        toast.error(err?.message || "Failed to reject charge");
    } finally {
        setRejectingCharge(null);
    }
}

async function handleFlag(bookingId: string) {
    if (!flagReason.trim()) return;
    setSubmittingFlag(true);
    try {
        await apiFetch(`/bookings/${bookingId}/flag`, {
            method: "POST",
            body: JSON.stringify({ flag_reason: flagReason.trim() }),
        });
        toast.success("Booking flagged. Admin has been notified.");
        setFlaggingBookingId(null);
        setFlagReason("");
        fetchBookings();
    } catch (err: any) {
        toast.error(err?.message || "Failed to flag booking");
    } finally {
        setSubmittingFlag(false);
    }
}
```

- [ ] **Step 3: Add charge review card in booking list**

Locate where individual booking cards are rendered. For bookings with `status === "Pending Confirmation"`, add the charge review card immediately inside or below the booking card:

```tsx
{booking.status === "Pending Confirmation" && (
    <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
        <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <IndianRupee className="w-4 h-4" />
            Charge Submitted — Review &amp; Confirm
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
                <span className="text-gray-500">Hours worked</span>
                <p className="font-medium text-gray-900">{booking.actual_hours ?? "—"} hrs</p>
            </div>
            <div>
                <span className="text-gray-500">Charge amount</span>
                <p className="font-medium text-gray-900">₹{booking.final_cost?.toFixed(0) ?? "—"}</p>
            </div>
        </div>
        {booking.completion_notes && (
            <p className="text-sm text-gray-600 italic">"{booking.completion_notes}"</p>
        )}
        <div className="flex gap-2 pt-1">
            <button
                onClick={() => handleAcceptCharge(String(booking.id))}
                disabled={confirmingCharge === String(booking.id)}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
                {confirmingCharge === String(booking.id) ? "Confirming…" : "Accept Charge"}
            </button>
            <button
                onClick={() => handleRejectCharge(String(booking.id))}
                disabled={rejectingCharge === String(booking.id)}
                className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
                {rejectingCharge === String(booking.id) ? "Rejecting…" : "Reject Charge"}
            </button>
            <button
                onClick={() => setFlaggingBookingId(String(booking.id))}
                className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm transition-colors"
                title="Flag to admin"
            >
                <AlertTriangle className="w-4 h-4" />
            </button>
        </div>
    </div>
)}
```

- [ ] **Step 4: Add flag modal**

At the bottom of the JSX (before the closing tag of the page), add:

```tsx
{flaggingBookingId && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Flag Booking</h2>
                <button
                    onClick={() => { setFlaggingBookingId(null); setFlagReason(""); }}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
                Describe the issue. Admin will be notified immediately.
            </p>
            <textarea
                rows={4}
                value={flagReason}
                onChange={e => setFlagReason(e.target.value)}
                placeholder="e.g. Charged 5 hours but job took 1 hour"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
                <button
                    onClick={() => { setFlaggingBookingId(null); setFlagReason(""); }}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={() => handleFlag(flaggingBookingId)}
                    disabled={!flagReason.trim() || submittingFlag}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                    {submittingFlag ? "Flagging…" : "Flag to Admin"}
                </button>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 5: Ensure `AlertTriangle` and `X` are imported**

Check the lucide-react import at the top of `page.tsx`. If `AlertTriangle` or `X` are missing, add them:

```tsx
import { ..., AlertTriangle, X } from "lucide-react";
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/user/bookings/page.tsx
git commit -m "feat: user bookings — charge review card with accept/reject/flag"
```

---

## Task 6: Frontend — Admin bookings `is_flagged` badge

**Files:**
- Modify: `frontend/app/admin/bookings/page.tsx`

- [ ] **Step 1: Add `is_flagged` to the booking interface**

Find the `Booking` or booking interface in admin bookings. Add:

```tsx
is_flagged?: boolean;
```

- [ ] **Step 2: Add flagged badge in booking list**

Find where booking status or service_type is displayed in the booking list rows/cards. Add a red badge next to the booking's status when `is_flagged` is true:

```tsx
{booking.is_flagged && (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
        <AlertTriangle className="w-3 h-3" />
        Flagged
    </span>
)}
```

- [ ] **Step 3: Add `actual_hours`, `final_cost`, `completion_notes` to booking detail view**

In the admin booking detail/modal, add a "Charge Details" section after the booking info:

```tsx
{(booking.actual_hours || booking.final_cost) && (
    <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Charge Details</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
                <span className="text-gray-500">Hours worked</span>
                <p className="font-medium">{booking.actual_hours ?? "—"} hrs</p>
            </div>
            <div>
                <span className="text-gray-500">Charge amount</span>
                <p className="font-medium">₹{booking.final_cost?.toFixed(0) ?? "—"}</p>
            </div>
        </div>
        {booking.completion_notes && (
            <p className="mt-2 text-sm text-gray-600 italic">"{booking.completion_notes}"</p>
        )}
        {booking.is_flagged && (
            <div className="mt-3 flex items-center gap-2 text-red-700 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                This booking has been flagged
            </div>
        )}
    </div>
)}
```

- [ ] **Step 4: Ensure `AlertTriangle` is imported**

Check the lucide-react import. Add `AlertTriangle` if missing.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin/bookings/page.tsx
git commit -m "feat: admin bookings — flagged badge and charge details panel"
```

---

## Task 7: Run full test suite + verify

- [ ] **Step 1: Run all backend tests**

```
cd backend && pytest tests/ -v
```
Expected: All tests pass, no failures.

- [ ] **Step 2: Verify alembic migration chain**

```
cd backend && alembic history --verbose | head -20
```
Expected: `14042026_is_flagged` appears as the head, chained to `13042026_home_members`.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: charge submission flow — migration, endpoints, all three portals"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `actual_hours + charge_amount + charge_description` form — Task 3 (backend), Task 4 (frontend)
- [x] `Pending Confirmation` status (existing) used for "Awaiting Payment" — Task 3
- [x] User Accept → Completed + points — Task 3 (existing `/confirm` endpoint kept)
- [x] User Reject → Cancelled + provider freed — Task 3 (`reject-charge`)
- [x] Emergency SOS excluded — Task 3 (`source_type == "emergency"` guard)
- [x] Admin auto-visibility — `is_flagged` column + complaint created on flag — Tasks 1, 3
- [x] Manual flag button (user or admin) — Task 3 (`flag_booking`), Task 5 (UI), Task 6 (admin)
- [x] All timestamps use `datetime.now(timezone.utc).replace(tzinfo=None)` — Task 3
- [x] `is_flagged` migration — Task 1
- [x] Admin flagged badge — Task 6
- [x] Charge details in admin booking detail — Task 6

**No placeholders:** All steps contain actual code.

**Type consistency:**
- `ChargeSubmitCreate` uses `actual_hours`, `charge_amount`, `charge_description` — consistent across schemas (Task 2) and endpoints (Task 3)
- `FlagCreate` uses `flag_reason` — consistent across schemas and endpoint body
- `BookingRead.is_flagged` — consistent with model column name
- Frontend calls `apiFetch("/bookings/{id}/final-complete")` with `{ actual_hours, charge_amount, charge_description }` — matches backend schema
- Frontend calls `apiFetch("/bookings/{id}/confirm")` for accept — matches existing endpoint
- Frontend calls `apiFetch("/bookings/{id}/reject-charge")` — matches new endpoint
- Frontend calls `apiFetch("/bookings/{id}/flag")` with `{ flag_reason }` — matches `FlagCreate`

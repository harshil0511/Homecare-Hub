# Booking Completion & Complaint System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-party receipt confirmation flow (new `Pending Confirmation` status), booking-based complaint filing for users and servicers, general issue reporting for secretaries, and admin bill cancellation/override powers.

**Architecture:** One new DB status (`Pending Confirmation`) added between `In Progress` and `Completed`. Servicer submits final-complete → booking pauses at `Pending Confirmation` → user sees receipt and confirms or disputes → admin resolves disputes by cancelling bill or overriding amount. Secretary complaints are separate general-purpose records not tied to a booking.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend), Next.js App Router + Tailwind CSS (frontend), Alembic (migrations), PostgreSQL

---

## Task 1: DB Migration — `secretary_complaints` table

**Files:**
- Create: `backend/alembic/versions/11_04_2026_add_secretary_complaints.py`

- [ ] **Step 1: Create the migration file**

```python
# backend/alembic/versions/11_04_2026_add_secretary_complaints.py
"""add secretary_complaints table

Revision ID: 11042026_secretary_complaints
Revises: 09042026_negotiation
Create Date: 2026-04-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "11042026_secretary_complaints"
down_revision = "09042026_negotiation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "secretary_complaints",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("society_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("societies.id"), nullable=False),
        sa.Column("filed_by", PG_UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="OPEN"),
        sa.Column("admin_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_secretary_complaints_society_id", "secretary_complaints", ["society_id"])
    op.create_index("ix_secretary_complaints_filed_by", "secretary_complaints", ["filed_by"])


def downgrade() -> None:
    op.drop_index("ix_secretary_complaints_filed_by", table_name="secretary_complaints")
    op.drop_index("ix_secretary_complaints_society_id", table_name="secretary_complaints")
    op.drop_table("secretary_complaints")
```

- [ ] **Step 2: Run the migration**

```bash
cd backend
alembic upgrade head
```

Expected output ends with: `Running upgrade 09042026_negotiation -> 11042026_secretary_complaints`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/11_04_2026_add_secretary_complaints.py
git commit -m "feat: add secretary_complaints migration"
```

---

## Task 2: Secretary Domain Model

**Files:**
- Create: `backend/app/secretary/domain/model.py`

- [ ] **Step 1: Create the directory and model file**

```python
# backend/app/secretary/domain/model.py
import uuid
import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class SecretaryComplaint(Base):
    __tablename__ = "secretary_complaints"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=False, index=True)
    filed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="OPEN")   # OPEN | UNDER_REVIEW | RESOLVED
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    society = relationship("Society", foreign_keys=[society_id])
    secretary = relationship("User", foreign_keys=[filed_by])
```

- [ ] **Step 2: Verify the app still starts**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Expected: server starts without import errors. Stop it with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add backend/app/secretary/domain/model.py
git commit -m "feat: add SecretaryComplaint domain model"
```

---

## Task 3: Secretary Complaint Schemas

**Files:**
- Modify: `backend/app/api/secretary/schemas.py`

- [ ] **Step 1: Add complaint schemas**

Open `backend/app/api/secretary/schemas.py`. The current content is:

```python
from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from app.api.auth.schemas import UserResponse  # noqa: F401
from app.api.service.schemas import SocietyResponse, SocietyUpdate, ProviderResponse  # noqa: F401


class HomeAssign(BaseModel):
    home_number: str
    resident_name: str
```

Replace the entire file with:

```python
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.api.auth.schemas import UserResponse  # noqa: F401
from app.api.service.schemas import SocietyResponse, SocietyUpdate, ProviderResponse  # noqa: F401


class HomeAssign(BaseModel):
    home_number: str
    resident_name: str


class SecretaryComplaintCreate(BaseModel):
    subject: str
    description: str


class SecretaryComplaintRead(BaseModel):
    id: UUID
    society_id: UUID
    filed_by: UUID
    subject: str
    description: str
    status: str
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/secretary/schemas.py
git commit -m "feat: add SecretaryComplaint schemas"
```

---

## Task 4: Secretary Complaint Endpoints

**Files:**
- Modify: `backend/app/api/secretary/endpoints.py`

- [ ] **Step 1: Add the file complaint and list endpoints**

Open `backend/app/api/secretary/endpoints.py`. Add these imports at the top (after existing imports):

```python
from typing import List
from app.secretary.domain.model import SecretaryComplaint
from app.notification.domain.model import Notification
from app.api.secretary.schemas import HomeAssign, SecretaryComplaintCreate, SecretaryComplaintRead
from app.auth.domain.model import User as UserModel
```

Then add these two endpoints at the end of the file:

```python
@router.post("/complaints", response_model=SecretaryComplaintRead)
def file_secretary_complaint(
    body: SecretaryComplaintCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    """Secretary files a general complaint to admin."""
    society = get_secretary_society(current_user, db)

    complaint = SecretaryComplaint(
        society_id=society.id,
        filed_by=current_user.id,
        subject=body.subject,
        description=body.description,
        status="OPEN",
    )
    db.add(complaint)
    db.flush()

    admins = db.query(UserModel).filter(UserModel.role == "ADMIN").all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id,
            title="Secretary Report Filed",
            message=f"Secretary complaint: {body.subject}",
            notification_type="WARNING",
            link="/admin/bookings?tab=secretary-reports",
        ))

    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/complaints", response_model=List[SecretaryComplaintRead])
def list_secretary_complaints(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(secretary_only),
):
    """Secretary lists their own filed complaints."""
    return (
        db.query(SecretaryComplaint)
        .filter(SecretaryComplaint.filed_by == current_user.id)
        .order_by(SecretaryComplaint.created_at.desc())
        .all()
    )
```

- [ ] **Step 2: Verify no import errors**

```bash
cd backend
python -c "from app.api.secretary.endpoints import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/secretary/endpoints.py
git commit -m "feat: add secretary complaint file/list endpoints"
```

---

## Task 5: Admin Secretary Complaint Endpoints + Schemas

**Files:**
- Modify: `backend/app/api/admin/schemas.py`
- Modify: `backend/app/api/admin/endpoints.py`

- [ ] **Step 1: Add SecretaryComplaintRead and SecretaryComplaintAdminUpdate to admin schemas**

Open `backend/app/api/admin/schemas.py`. Add at the end:

```python
class SecretaryComplaintRead(BaseModel):
    id: UUID
    society_id: UUID
    filed_by: UUID
    subject: str
    description: str
    status: str
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SecretaryComplaintAdminUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
```

- [ ] **Step 2: Add admin endpoints for secretary complaints**

Open `backend/app/api/admin/endpoints.py`. Add these imports at the top (with existing imports):

```python
from app.secretary.domain.model import SecretaryComplaint
from app.api.admin.schemas import (
    AdminVerifyUpdate, ComplaintAdminRead, ComplaintAdminUpdate,
    SecretaryComplaintRead, SecretaryComplaintAdminUpdate,
)
```

Then add these two endpoints at the end of the file:

```python
@router.get("/secretary-complaints", response_model=List[SecretaryComplaintRead])
def list_secretary_complaints(
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Admin: list all secretary complaints."""
    return (
        db.query(SecretaryComplaint)
        .order_by(SecretaryComplaint.created_at.desc())
        .all()
    )


@router.patch("/secretary-complaints/{complaint_id}", response_model=SecretaryComplaintRead)
def update_secretary_complaint(
    complaint_id: UUID,
    body: SecretaryComplaintAdminUpdate,
    db: Session = Depends(deps.get_db),
    _: User = Depends(admin_only),
):
    """Admin: update secretary complaint status/notes."""
    complaint = db.query(SecretaryComplaint).filter(SecretaryComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if body.status is not None:
        complaint.status = body.status
        if body.status == "RESOLVED":
            complaint.resolved_at = datetime.utcnow()
    if body.admin_notes is not None:
        complaint.admin_notes = body.admin_notes
    db.commit()
    db.refresh(complaint)
    return complaint
```

- [ ] **Step 3: Verify import**

```bash
cd backend
python -c "from app.api.admin.endpoints import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/admin/schemas.py backend/app/api/admin/endpoints.py
git commit -m "feat: add admin secretary-complaints endpoints"
```

---

## Task 6: Backend — Modify `final_complete` + Fix Receipt + Extend `complaint`

**Files:**
- Modify: `backend/app/api/booking/endpoints.py`

This task makes three changes in one file:
1. `final_complete` → status becomes `Pending Confirmation` (not `Completed`), remove `award_points`, update notification
2. Receipt endpoint → also allow `Pending Confirmation` status
3. `file_complaint` → also allow servicer to file, allow `Pending Confirmation` status

- [ ] **Step 1: Modify `final_complete_booking` function**

In `backend/app/api/booking/endpoints.py`, find the `final_complete_booking` function (starts around line 401). Replace the body from the status assignment through the notification, changing these specific lines:

Find:
```python
    booking.status = "Completed"
    booking.completed_at = datetime.utcnow()
    booking.actual_hours = body.extra_hours or 0.0
    booking.final_cost = final_amount
    booking.completion_notes = body.notes

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Completed",
        notes=f"Marked complete by servicer. Extra hours: {body.extra_hours or 0}. Final: \u20b9{final_amount:.0f}.",
    ))

    event = "URGENT_COMPLETE" if booking.priority in ("High", "Emergency") else "REGULAR_COMPLETE"
    try:
        award_points(db, provider_id=provider.id, event_type=event, source_id=booking.id)
    except Exception:
        pass

    provider_name = get_provider_display_name(provider)
    _notify_booking(
        db, user_id=booking.user_id,
        title="Service Completed",
        message=f"'{booking.service_type}' has been marked complete by {provider_name}. Final: \u20b9{final_amount:.0f}.",
        notification_type="INFO",
        link=f"/user/bookings/{booking.id}/receipt",
    )
```

Replace with:
```python
    booking.status = "Pending Confirmation"
    booking.actual_hours = body.extra_hours or 0.0
    booking.final_cost = final_amount
    booking.completion_notes = body.notes

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Pending Confirmation",
        notes=f"Servicer submitted completion. Extra hours: {body.extra_hours or 0}. Final: \u20b9{final_amount:.0f}. Awaiting user confirmation.",
    ))

    provider_name = get_provider_display_name(provider)
    _notify_booking(
        db, user_id=booking.user_id,
        title="Work Complete — Please Confirm",
        message=f"'{booking.service_type}' work is done. Review the receipt and confirm payment of \u20b9{final_amount:.0f}.",
        notification_type="INFO",
        link=f"/user/bookings/{booking.id}",
    )
```

- [ ] **Step 2: Add the `confirm` endpoint**

After the `final_complete_booking` function (before the `get_receipt` function), add:

```python
@router.post("/{booking_id}/confirm", response_model=BookingRead)
def confirm_booking_complete(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """User confirms the receipt — booking moves to Completed and points are awarded."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the booking's user can confirm")
    if booking.status != "Pending Confirmation":
        raise HTTPException(status_code=400, detail=f"Booking is '{booking.status}', must be 'Pending Confirmation' to confirm")

    booking.status = "Completed"
    booking.completed_at = datetime.utcnow()

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Completed",
        notes="User confirmed receipt and payment.",
    ))

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    if provider:
        event = "URGENT_COMPLETE" if booking.priority in ("High", "Emergency") else "REGULAR_COMPLETE"
        try:
            award_points(db, provider_id=provider.id, event_type=event, source_id=booking.id)
        except Exception:
            pass

        provider_user_id = provider.user_id
        _notify_booking(
            db, user_id=provider_user_id,
            title="Payment Confirmed",
            message=f"User confirmed your receipt for '{booking.service_type}'. Job complete!",
            notification_type="SUCCESS",
            link=f"/service/jobs",
        )

    db.commit()
    db.refresh(booking)
    return booking
```

- [ ] **Step 3: Fix receipt endpoint to allow `Pending Confirmation`**

Find in `get_receipt`:
```python
    if booking.status != "Completed":
        raise HTTPException(status_code=400, detail="Receipt only available for completed bookings")
```

Replace with:
```python
    if booking.status not in ("Completed", "Pending Confirmation"):
        raise HTTPException(status_code=400, detail="Receipt only available for completed or pending-confirmation bookings")
```

- [ ] **Step 4: Extend `file_complaint` to allow servicer + `Pending Confirmation` status**

Find the `file_complaint` function. Replace its guard checks:

Find:
```python
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the booking's user can file a complaint")
    if booking.status != "Completed":
        raise HTTPException(status_code=400, detail="Can only file complaints on completed bookings")
```

Replace with:
```python
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    is_user = booking.user_id == current_user.id
    is_servicer = provider is not None and provider.id == booking.provider_id
    if not is_user and not is_servicer:
        raise HTTPException(status_code=403, detail="Only the booking's user or assigned servicer can file a complaint")
    if booking.status not in ("Completed", "Pending Confirmation"):
        raise HTTPException(status_code=400, detail="Can only file complaints on completed or pending-confirmation bookings")
```

- [ ] **Step 5: Verify import (award_points is already imported)**

```bash
cd backend
python -c "from app.api.booking.endpoints import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/booking/endpoints.py
git commit -m "feat: Pending Confirmation flow — final_complete, confirm endpoint, receipt + complaint fixes"
```

---

## Task 7: Backend — Admin Cancel Bill / Override Amount

**Files:**
- Modify: `backend/app/api/admin/schemas.py`
- Modify: `backend/app/api/admin/endpoints.py`

- [ ] **Step 1: Add `action` and `override_amount` to `ComplaintAdminUpdate`**

Open `backend/app/api/admin/schemas.py`. Find `ComplaintAdminUpdate`:

```python
class ComplaintAdminUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
```

Replace with:

```python
class ComplaintAdminUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    action: Optional[str] = None          # "cancel_bill" | "override_amount"
    override_amount: Optional[float] = None
```

- [ ] **Step 2: Update `update_complaint` endpoint to handle actions**

Open `backend/app/api/admin/endpoints.py`. Find `update_complaint`. Replace the entire function body:

```python
@router.patch("/complaints/{complaint_id}", response_model=ComplaintAdminRead)
def update_complaint(
    complaint_id: UUID,
    body: ComplaintAdminUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(admin_only),
):
    """Update complaint status/notes and optionally cancel bill or override amount."""
    from app.notification.domain.model import Notification as NotificationModel
    from app.service.point_engine import award_points

    complaint = db.query(BookingComplaint).filter(BookingComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    booking = db.query(ServiceBooking).filter(ServiceBooking.id == complaint.booking_id).first()

    if body.action == "cancel_bill":
        if not booking or booking.status != "Pending Confirmation":
            raise HTTPException(status_code=400, detail="Booking must be in 'Pending Confirmation' to cancel bill")
        # Revert to In Progress so servicer re-submits
        booking.status = "In Progress"
        booking.final_cost = None
        booking.actual_hours = None
        booking.completion_notes = None
        from app.booking.domain.model import BookingStatusHistory
        db.add(BookingStatusHistory(
            booking_id=booking.id,
            status="In Progress",
            notes="Admin cancelled bill after complaint. Servicer must re-submit completion.",
        ))
        complaint.status = "UNDER_REVIEW"
        if body.admin_notes:
            complaint.admin_notes = body.admin_notes
        # Notify servicer
        from app.service.domain.model import ServiceProvider as SP
        provider = db.query(SP).filter(SP.id == booking.provider_id).first()
        if provider:
            db.add(NotificationModel(
                user_id=provider.user_id,
                title="Bill Cancelled by Admin",
                message=f"Admin cancelled your bill for '{booking.service_type}'. Please re-submit with correct hours.",
                notification_type="WARNING",
                link="/service/jobs",
            ))

    elif body.action == "override_amount":
        if body.override_amount is None:
            raise HTTPException(status_code=400, detail="override_amount is required for override_amount action")
        if not booking or booking.status != "Pending Confirmation":
            raise HTTPException(status_code=400, detail="Booking must be in 'Pending Confirmation' to override amount")
        booking.status = "Completed"
        booking.final_cost = body.override_amount
        booking.completed_at = datetime.utcnow()
        from app.booking.domain.model import BookingStatusHistory
        db.add(BookingStatusHistory(
            booking_id=booking.id,
            status="Completed",
            notes=f"Admin resolved dispute. Final amount overridden to \u20b9{body.override_amount:.0f}.",
        ))
        complaint.status = "RESOLVED"
        complaint.resolved_at = datetime.utcnow()
        if body.admin_notes:
            complaint.admin_notes = body.admin_notes
        # Notify both parties
        msg = f"Admin resolved the dispute — final amount: \u20b9{body.override_amount:.0f}"
        db.add(NotificationModel(
            user_id=booking.user_id,
            title="Dispute Resolved",
            message=msg,
            notification_type="SUCCESS",
            link=f"/user/bookings/{booking.id}",
        ))
        from app.service.domain.model import ServiceProvider as SP
        provider = db.query(SP).filter(SP.id == booking.provider_id).first()
        if provider:
            db.add(NotificationModel(
                user_id=provider.user_id,
                title="Dispute Resolved",
                message=msg,
                notification_type="SUCCESS",
                link="/service/jobs",
            ))

    else:
        # Normal status/notes update
        if body.status is not None:
            complaint.status = body.status
            if body.status == "RESOLVED":
                complaint.resolved_at = datetime.utcnow()
        if body.admin_notes is not None:
            complaint.admin_notes = body.admin_notes

    db.commit()
    db.refresh(complaint)
    return complaint
```

- [ ] **Step 3: Verify**

```bash
cd backend
python -c "from app.api.admin.endpoints import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/admin/schemas.py backend/app/api/admin/endpoints.py
git commit -m "feat: admin cancel_bill and override_amount complaint actions"
```

---

## Task 8: Frontend — BookingStatusTimeline

**Files:**
- Modify: `frontend/components/bookings/BookingStatusTimeline.tsx`

- [ ] **Step 1: Add `Pending Confirmation` stage**

Open `frontend/components/bookings/BookingStatusTimeline.tsx`. Replace the `STAGES` array and add the `Hourglass` import:

Find:
```tsx
import { Check, Clock, Play, CheckCircle2, XCircle } from "lucide-react";

const STAGES = [
    { id: "Pending", label: "Requested", icon: Clock },
    { id: "Accepted", label: "Accepted", icon: Check },
    { id: "In Progress", label: "In Progress", icon: Play },
    { id: "Completed", label: "Completed", icon: CheckCircle2 },
];
```

Replace with:
```tsx
import { Check, Clock, Play, CheckCircle2, XCircle, Hourglass } from "lucide-react";

const STAGES = [
    { id: "Pending", label: "Requested", icon: Clock },
    { id: "Accepted", label: "Accepted", icon: Check },
    { id: "In Progress", label: "In Progress", icon: Play },
    { id: "Pending Confirmation", label: "Awaiting Confirm", icon: Hourglass },
    { id: "Completed", label: "Completed", icon: CheckCircle2 },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/bookings/BookingStatusTimeline.tsx
git commit -m "feat: add Pending Confirmation step to BookingStatusTimeline"
```

---

## Task 9: Frontend — User Bookings Page (Receipt Confirmation Modal)

**Files:**
- Modify: `frontend/app/user/bookings/page.tsx`

- [ ] **Step 1: Add Receipt type and state**

Open `frontend/app/user/bookings/page.tsx`. After the `HistoryBooking` interface, add:

```tsx
interface Receipt {
  booking_id: string;
  service_type: string;
  servicer_name: string;
  base_price: number;
  extra_hours: number;
  hourly_rate: number;
  extra_charge: number;
  final_amount: number;
  completed_at: string | null;
  negotiated: boolean;
}
```

- [ ] **Step 2: Add new state variables**

Inside `UserBookingsPage`, after the existing state declarations (after `const [cancelling, setCancelling]`), add:

```tsx
const [receiptModal, setReceiptModal] = useState<{ booking: ActiveBooking; receipt: Receipt } | null>(null);
const [confirmingPayment, setConfirmingPayment] = useState(false);
const [disputeMode, setDisputeMode] = useState(false);
const [disputeReason, setDisputeReason] = useState("");
const [filingDispute, setFilingDispute] = useState(false);
```

- [ ] **Step 3: Update `activeContracts` to include `Pending Confirmation`**

Find:
```tsx
const activeContracts = bookings.filter(b => b.status === "Accepted" || b.status === "In Progress");
```

Replace with:
```tsx
const activeContracts = bookings.filter(b =>
  b.status === "Accepted" || b.status === "In Progress" || b.status === "Pending Confirmation"
);
```

- [ ] **Step 4: Add confirm and dispute handlers**

After `handleCancelRequest`, add:

```tsx
const handleOpenReceipt = async (booking: ActiveBooking) => {
  try {
    const receipt = await apiFetch(`/bookings/${booking.id}/receipt`);
    setReceiptModal({ booking, receipt });
    setDisputeMode(false);
    setDisputeReason("");
  } catch {
    toast.error("Failed to load receipt");
  }
};

const handleConfirmPayment = async () => {
  if (!receiptModal) return;
  setConfirmingPayment(true);
  try {
    await apiFetch(`/bookings/${receiptModal.booking.id}/confirm`, { method: "POST" });
    setReceiptModal(null);
    toast.success("Payment confirmed — job complete!");
    await loadData();
  } catch (err: any) {
    toast.error(err.message || "Failed to confirm payment");
  } finally {
    setConfirmingPayment(false);
  }
};

const handleFileDispute = async () => {
  if (!receiptModal || !disputeReason.trim()) return;
  setFilingDispute(true);
  try {
    await apiFetch(`/bookings/${receiptModal.booking.id}/complaint`, {
      method: "POST",
      body: JSON.stringify({ reason: disputeReason }),
    });
    setReceiptModal(null);
    toast.success("Dispute submitted — admin will review");
    await loadData();
  } catch (err: any) {
    toast.error(err.message || "Failed to file dispute");
  } finally {
    setFilingDispute(false);
  }
};
```

- [ ] **Step 5: Update contract card rendering to show amber badge and receipt button**

Inside the Active Contracts tab, find the card that renders each booking `b`. Replace the entire card `<div key={b.id}>` content:

Find:
```tsx
activeContracts.map(b => (
  <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-4">
    <div className="flex-1 min-w-0">
      <p className="font-black text-slate-900 text-sm">{b.service_type}</p>
      <p className="text-xs text-slate-500 mt-0.5">{getProviderName(b.provider)}</p>
      {b.scheduled_at && (
        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
          <Calendar className="w-3 h-3" />
          {new Date(b.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
    <div className="flex items-center gap-3">
      {b.estimated_cost && (
        <span className="text-sm font-black text-slate-700">₹{b.estimated_cost.toLocaleString("en-IN")}</span>
      )}
      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
        b.status === "Accepted" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
      }`}>{b.status}</span>
      <button onClick={() => router.push(`/user/bookings/${b.id}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  </div>
))
```

Replace with:
```tsx
activeContracts.map(b => (
  <div key={b.id} className={`bg-white border rounded-2xl p-6 flex items-center gap-4 ${
    b.status === "Pending Confirmation" ? "border-amber-300 border-l-4 border-l-amber-500" : "border-slate-200"
  }`}>
    <div className="flex-1 min-w-0">
      <p className="font-black text-slate-900 text-sm">{b.service_type}</p>
      <p className="text-xs text-slate-500 mt-0.5">{getProviderName(b.provider)}</p>
      {b.scheduled_at && (
        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
          <Calendar className="w-3 h-3" />
          {new Date(b.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
    <div className="flex items-center gap-3">
      {(b.final_cost || b.estimated_cost) && (
        <span className="text-sm font-black text-slate-700">
          ₹{(b.final_cost || b.estimated_cost || 0).toLocaleString("en-IN")}
        </span>
      )}
      {b.status === "Pending Confirmation" ? (
        <button
          onClick={() => handleOpenReceipt(b)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 transition-colors animate-pulse"
        >
          <IndianRupee className="w-3 h-3" /> Confirm Receipt
        </button>
      ) : (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
          b.status === "Accepted" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
        }`}>{b.status}</span>
      )}
      <button onClick={() => router.push(`/user/bookings/${b.id}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  </div>
))
```

- [ ] **Step 6: Add `final_cost` to `ActiveBooking` interface**

Find:
```tsx
interface ActiveBooking {
  id: number;
  service_type: string;
  status: string;
  scheduled_at?: string;
  estimated_cost?: number;
  provider?: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
}
```

Replace with:
```tsx
interface ActiveBooking {
  id: number;
  service_type: string;
  status: string;
  scheduled_at?: string;
  estimated_cost?: number;
  final_cost?: number;
  provider?: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
}
```

- [ ] **Step 7: Add the Receipt Confirmation Modal JSX**

Before the closing `</div>` of the page (before `{/* Reject Confirmation Dialog */}`), add:

```tsx
{/* Receipt Confirmation Modal */}
{receiptModal && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Confirm Receipt</h2>
          <p className="text-xs text-slate-500 mt-1">{receiptModal.receipt.servicer_name} · {receiptModal.receipt.service_type}</p>
        </div>
        <button onClick={() => setReceiptModal(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Base Price</span>
          <span className="font-bold">₹{receiptModal.receipt.base_price.toLocaleString("en-IN")}</span>
        </div>
        {receiptModal.receipt.extra_hours > 0 && (
          <div className="flex justify-between text-sm text-slate-600">
            <span>Extra ({receiptModal.receipt.extra_hours}h × ₹{receiptModal.receipt.hourly_rate.toFixed(0)}/h)</span>
            <span className="font-bold">₹{receiptModal.receipt.extra_charge.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="border-t border-slate-200 pt-3 flex justify-between font-black text-slate-900 text-base">
          <span>Total</span>
          <span className="text-emerald-700">₹{receiptModal.receipt.final_amount.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {!disputeMode ? (
        <div className="flex gap-3">
          <button
            onClick={() => setDisputeMode(true)}
            className="flex-1 py-3 border border-rose-200 text-rose-600 rounded-2xl text-sm font-black uppercase hover:bg-rose-50"
          >
            Dispute
          </button>
          <button
            onClick={handleConfirmPayment}
            disabled={confirmingPayment}
            className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase hover:bg-emerald-800 disabled:opacity-50"
          >
            {confirmingPayment ? "Confirming..." : "Confirm Payment"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Describe the issue with this bill:</p>
          <textarea
            value={disputeReason}
            onChange={e => setDisputeReason(e.target.value)}
            placeholder="e.g. Extra hours are incorrect — job took 1h not 3h"
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
          />
          <div className="flex gap-3">
            <button onClick={() => setDisputeMode(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={handleFileDispute}
              disabled={filingDispute || !disputeReason.trim()}
              className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-black uppercase disabled:opacity-50 hover:bg-rose-700"
            >
              {filingDispute ? "Submitting..." : "File Dispute"}
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/app/user/bookings/page.tsx
git commit -m "feat: receipt confirmation modal on user bookings contracts tab"
```

---

## Task 10: Frontend — User Booking Detail Page (Inline Confirmation Panel)

**Files:**
- Modify: `frontend/app/user/bookings/[id]/page.tsx`

- [ ] **Step 1: Add confirm and dispute state**

Open `frontend/app/user/bookings/[id]/page.tsx`. After `const [receipt, setReceipt] = useState<any>(null);`, add:

```tsx
const [confirming, setConfirming] = useState(false);
const [showDispute, setShowDispute] = useState(false);
const [disputeReason, setDisputeReason] = useState("");
const [filingDispute, setFilingDispute] = useState(false);
```

- [ ] **Step 2: Update receipt fetch to also work for `Pending Confirmation`**

Find:
```tsx
if (data.status === "Completed") {
    apiFetch(`/bookings/${id}/receipt`).then(setReceipt).catch((e) => console.error("Receipt fetch failed:", e));
}
```

Replace with:
```tsx
if (data.status === "Completed" || data.status === "Pending Confirmation") {
    apiFetch(`/bookings/${id}/receipt`).then(setReceipt).catch((e) => console.error("Receipt fetch failed:", e));
}
```

- [ ] **Step 3: Add `handleConfirm` and `handleDispute` functions**

After `handleMarkComplete`, add:

```tsx
const handleConfirm = async () => {
    setConfirming(true);
    try {
        await apiFetch(`/bookings/${id}/confirm`, { method: "POST" });
        toast.success("Payment confirmed — job complete!");
        await fetchData();
    } catch (err: any) {
        toast.error(err.message || "Failed to confirm");
    } finally {
        setConfirming(false);
    }
};

const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    setFilingDispute(true);
    try {
        await apiFetch(`/bookings/${id}/complaint`, {
            method: "POST",
            body: JSON.stringify({ reason: disputeReason }),
        });
        setShowDispute(false);
        toast.success("Dispute filed — admin will review");
        await fetchData();
    } catch (err: any) {
        toast.error(err.message || "Failed to file dispute");
    } finally {
        setFilingDispute(false);
    }
};
```

- [ ] **Step 4: Remove the SERVICER "Mark Complete" button from the detail page header**

Find and remove this block from the header `<div className="flex items-center gap-4">`:
```tsx
{(booking.status === "Accepted" || booking.status === "In Progress") && userRole === "SERVICER" && (
    <button
        onClick={handleMarkComplete}
        disabled={completing}
        className={...}
    >
        <CheckCircle2 size={14} /> {completing ? "Completing..." : "Mark Complete"}
    </button>
)}
```

Also remove `handleMarkComplete`, `completing` state, and `setCompleting` state from the file since they are no longer used here.

- [ ] **Step 5: Add inline confirmation panel for `Pending Confirmation` + USER**

Inside the left column (`lg:col-span-2 space-y-10`), after `<BookingStatusTimeline .../>` and before the grid with Service Location, add:

```tsx
{booking.status === "Pending Confirmation" && userRole === "USER" && receipt && (
    <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-8 mt-8">
        <h3 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <IndianRupee size={12} /> Receipt — Awaiting Your Confirmation
        </h3>
        <div className="space-y-2 mb-6 text-sm text-slate-700">
            <div className="flex justify-between">
                <span>Base Price</span>
                <span className="font-bold">₹{Number(receipt.base_price).toLocaleString("en-IN")}</span>
            </div>
            {receipt.extra_hours > 0 && (
                <div className="flex justify-between">
                    <span>Extra ({receipt.extra_hours}h × ₹{receipt.hourly_rate?.toFixed(0)}/h)</span>
                    <span className="font-bold">₹{Number(receipt.extra_charge).toLocaleString("en-IN")}</span>
                </div>
            )}
            <div className="border-t border-amber-200 pt-2 flex justify-between font-black text-base">
                <span>Total</span>
                <span className="text-emerald-700">₹{Number(receipt.final_amount).toLocaleString("en-IN")}</span>
            </div>
        </div>

        {!showDispute ? (
            <div className="flex gap-3">
                <button
                    onClick={() => setShowDispute(true)}
                    className="flex-1 py-3 border border-rose-200 text-rose-600 rounded-2xl text-sm font-black uppercase hover:bg-rose-50"
                >
                    Dispute
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase hover:bg-emerald-800 disabled:opacity-50"
                >
                    {confirming ? "Confirming..." : "Confirm Payment"}
                </button>
            </div>
        ) : (
            <div className="space-y-3">
                <textarea
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    placeholder="Describe the issue with this bill..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                />
                <div className="flex gap-3">
                    <button onClick={() => setShowDispute(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-black uppercase text-slate-500">
                        Back
                    </button>
                    <button
                        onClick={handleDispute}
                        disabled={filingDispute || !disputeReason.trim()}
                        className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-black uppercase disabled:opacity-50"
                    >
                        {filingDispute ? "Submitting..." : "File Dispute"}
                    </button>
                </div>
            </div>
        )}
    </div>
)}
```

Add `IndianRupee` to the import list from `lucide-react` at the top of this file.

- [ ] **Step 6: Update the auto-prompt review modal condition**

Find:
```tsx
if (!loading && booking && booking.status === "Completed" && userRole === "USER" && !booking.review) {
    setShowReview(true);
}
```

This is already correct — review only auto-opens on `Completed`, not `Pending Confirmation`. No change needed.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/user/bookings/[id]/page.tsx
git commit -m "feat: inline receipt confirmation panel on booking detail page"
```

---

## Task 11: Frontend — Servicer Jobs Page

**Files:**
- Modify: `frontend/app/service/jobs/page.tsx`

- [ ] **Step 1: Remove `completionTarget` state variables**

Open `frontend/app/service/jobs/page.tsx`. Remove these state declarations:

```tsx
const [completionTarget, setCompletionTarget] = useState<Booking | null>(null);
const [compHours, setCompHours] = useState<number | "">("");
const [compFinalCost, setCompFinalCost] = useState<number | "">("");
const [compNotes, setCompNotes] = useState("");
const [submittingCompletion, setSubmittingCompletion] = useState(false);
```

- [ ] **Step 2: Remove `handleSubmitCompletion` function**

Remove the entire `handleSubmitCompletion` function.

- [ ] **Step 3: Add Report Issue state**

After the `finalCompleteTarget` state block, add:

```tsx
const [reportIssueTarget, setReportIssueTarget] = useState<Booking | null>(null);
const [issueReason, setIssueReason] = useState("");
const [submittingIssue, setSubmittingIssue] = useState(false);
```

- [ ] **Step 4: Add `handleReportIssue` handler**

After `handleFinalComplete`, add:

```tsx
const handleReportIssue = async () => {
    if (!reportIssueTarget || !issueReason.trim()) return;
    setSubmittingIssue(true);
    try {
        await apiFetch(`/bookings/${reportIssueTarget.id}/complaint`, {
            method: "POST",
            body: JSON.stringify({ reason: issueReason }),
        });
        setReportIssueTarget(null);
        setIssueReason("");
        toast.success("Issue reported to admin");
    } catch (err: any) {
        toast.error(err.message || "Failed to report issue");
    } finally {
        setSubmittingIssue(false);
    }
};
```

- [ ] **Step 5: Replace `Accepted` button with `finalCompleteTarget` flow**

Find this block for `Accepted` status:
```tsx
{booking.status === "Accepted" && (
    <button
        onClick={() => {
            setCompletionTarget(booking);
            setCompFinalCost(booking.estimated_cost);
            setCompHours("");
            setCompNotes("");
        }}
        className="w-full sm:w-auto px-10 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
    >
        <CheckCircle className="w-4 h-4" />
        Mark Completed
    </button>
)}
```

Replace with:
```tsx
{booking.status === "Accepted" && (
    <button
        onClick={() => {
            setFinalCompleteTarget(booking);
            setExtraHours(0);
            setFinalNotes("");
        }}
        className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
    >
        <CheckCircle className="w-4 h-4" />
        Submit Completion
    </button>
)}
```

- [ ] **Step 6: Add `Pending Confirmation` badge and Report Issue button**

After the `In Progress` button block, add:

```tsx
{booking.status === "Pending Confirmation" && (
    <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full">
        Awaiting User Confirmation
    </span>
)}
{(booking.status === "In Progress" || booking.status === "Pending Confirmation" || booking.status === "Accepted") && (
    <button
        onClick={() => { setReportIssueTarget(booking); setIssueReason(""); }}
        className="w-full sm:w-auto px-6 py-3.5 border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
    >
        <ShieldAlert className="w-4 h-4" />
        Report Issue
    </button>
)}
```

- [ ] **Step 7: Remove the old `completionTarget` modal JSX**

Remove the entire `{/* Completion Form Modal */}` block (the one with `completionTarget &&`).

- [ ] **Step 8: Add Report Issue modal JSX**

Before the closing `</div>` of the page, add:

```tsx
{/* Report Issue Modal */}
{reportIssueTarget && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Report Issue</h2>
                    <p className="text-xs text-slate-500 mt-1">{reportIssueTarget.service_type} — BK-{reportIssueTarget.id}</p>
                </div>
                <button onClick={() => setReportIssueTarget(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Your complaint will be reviewed by admin.</p>
            <textarea
                value={issueReason}
                onChange={e => setIssueReason(e.target.value)}
                placeholder="Describe the issue (e.g. user is disputing unfairly, access denied to property)..."
                rows={4}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none mb-4"
            />
            <div className="flex gap-3">
                <button onClick={() => setReportIssueTarget(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                    Cancel
                </button>
                <button
                    onClick={handleReportIssue}
                    disabled={submittingIssue || !issueReason.trim()}
                    className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black uppercase hover:bg-rose-700 disabled:opacity-50"
                >
                    {submittingIssue ? "Reporting..." : "Submit Report"}
                </button>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 9: Commit**

```bash
git add frontend/app/service/jobs/page.tsx
git commit -m "feat: servicer jobs — remove old completion modal, add Report Issue, Pending Confirmation badge"
```

---

## Task 12: Frontend — Admin Bookings Page (Cancel Bill / Override Amount / Secretary Reports)

**Files:**
- Modify: `frontend/app/admin/bookings/page.tsx`

- [ ] **Step 1: Add state for bill actions and secretary complaints**

Open `frontend/app/admin/bookings/page.tsx`. Add after existing state declarations:

```tsx
const [secretaryComplaints, setSecretaryComplaints] = useState<SecretaryComplaint[]>([]);
const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
const [overrideAmount, setOverrideAmount] = useState<number | "">("");
const [applyingAction, setApplyingAction] = useState<string | null>(null);
```

- [ ] **Step 2: Add `SecretaryComplaint` interface**

At the top, after the `Complaint` interface, add:

```tsx
interface SecretaryComplaint {
    id: string;
    society_id: string;
    filed_by: string;
    subject: string;
    description: string;
    status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
    admin_notes?: string;
    created_at: string;
    resolved_at?: string;
}
```

- [ ] **Step 3: Update tab type to include `secretary-reports`**

Find:
```tsx
const [activeTab, setActiveTab] = useState<"bookings" | "complaints">("bookings");
```
Replace with:
```tsx
const [activeTab, setActiveTab] = useState<"bookings" | "complaints" | "secretary-reports">("bookings");
```

- [ ] **Step 4: Add `fetchSecretaryComplaints` and `handleComplaintAction` functions**

After `handleResolveComplaint`, add:

```tsx
const fetchSecretaryComplaints = async () => {
    const data = await apiFetch("/admin/secretary-complaints").catch(() => []);
    setSecretaryComplaints(Array.isArray(data) ? data : []);
};

const handleComplaintAction = async (
    complaintId: string,
    action: "cancel_bill" | "override_amount",
    amount?: number
) => {
    setApplyingAction(complaintId + action);
    try {
        await apiFetch(`/admin/complaints/${complaintId}`, {
            method: "PATCH",
            body: JSON.stringify({
                action,
                ...(action === "override_amount" && amount !== undefined ? { override_amount: amount } : {}),
            }),
        });
        toast.success(action === "cancel_bill" ? "Bill cancelled — servicer notified" : "Amount overridden — booking completed");
        fetchComplaints();
    } catch (err: any) {
        toast.error(err.message || "Action failed");
    } finally {
        setApplyingAction(null);
        setOverrideTarget(null);
        setOverrideAmount("");
    }
};
```

- [ ] **Step 5: Update `useEffect` for tab changes to include `secretary-reports`**

Find:
```tsx
useEffect(() => {
    if (activeTab === "complaints") {
        fetchComplaints();
    }
}, [activeTab]);
```

Replace with:
```tsx
useEffect(() => {
    if (activeTab === "complaints") fetchComplaints();
    if (activeTab === "secretary-reports") fetchSecretaryComplaints();
}, [activeTab]);
```

- [ ] **Step 6: Update tabs array**

Find:
```tsx
const tabs: { key: "bookings" | "complaints"; label: string; count?: number }[] = [
    { key: "bookings", label: "Bookings" },
    { key: "complaints", label: "Complaints", count: openComplaintCount },
];
```

Replace with:
```tsx
const openSecretaryCount = secretaryComplaints.filter(c => c.status === "OPEN").length;
const tabs: { key: "bookings" | "complaints" | "secretary-reports"; label: string; count?: number }[] = [
    { key: "bookings", label: "Bookings" },
    { key: "complaints", label: "Complaints", count: openComplaintCount },
    { key: "secretary-reports", label: "Secretary Reports", count: openSecretaryCount || undefined },
];
```

- [ ] **Step 7: Add Cancel Bill and Override Amount buttons to each complaint card**

Inside `{activeTab === "complaints" && ...}`, find where existing complaint cards are rendered. Each card has an existing `{c.status === "OPEN" && ...}` block with "Mark Under Review". Add the two new action buttons after that existing block, inside the card:

```tsx
{c.status === "OPEN" && (
    <div className="flex gap-2 mt-3 flex-wrap">
        <button
            onClick={() => apiFetch(`/admin/complaints/${c.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "UNDER_REVIEW" }),
            }).then(fetchComplaints).catch(() => toast.error("Failed"))}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg hover:bg-blue-100"
        >
            Mark Under Review
        </button>
        <button
            onClick={() => handleComplaintAction(c.id, "cancel_bill")}
            disabled={applyingAction === c.id + "cancel_bill"}
            className="px-3 py-1.5 bg-rose-50 text-rose-700 text-[10px] font-black uppercase rounded-lg hover:bg-rose-100 disabled:opacity-50"
        >
            {applyingAction === c.id + "cancel_bill" ? "Cancelling..." : "Cancel Bill"}
        </button>
        {overrideTarget === c.id ? (
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={overrideAmount}
                    onChange={e => setOverrideAmount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="New amount ₹"
                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                    onClick={() => overrideAmount !== "" && handleComplaintAction(c.id, "override_amount", Number(overrideAmount))}
                    disabled={overrideAmount === "" || applyingAction === c.id + "override_amount"}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg disabled:opacity-50"
                >
                    {applyingAction === c.id + "override_amount" ? "Applying..." : "Apply"}
                </button>
                <button onClick={() => setOverrideTarget(null)} className="text-slate-400 hover:text-slate-700">
                    <X className="w-4 h-4" />
                </button>
            </div>
        ) : (
            <button
                onClick={() => { setOverrideTarget(c.id); setOverrideAmount(""); }}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg hover:bg-emerald-100"
            >
                Override Amount
            </button>
        )}
    </div>
)}
```

Note: remove the existing "Mark Under Review" standalone block to avoid duplication — it's now included above.

- [ ] **Step 8: Add Secretary Reports tab content**

After the `{activeTab === "complaints" && ...}` block, add:

```tsx
{activeTab === "secretary-reports" && (
    <div className="space-y-4">
        <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Secretary Reports</h2>
        {secretaryComplaints.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No secretary reports filed</div>
        ) : (
            secretaryComplaints.map(c => (
                <div key={c.id} className={`bg-white border rounded-2xl p-5 border-l-4 ${
                    c.status === "OPEN" ? "border-l-rose-500" :
                    c.status === "UNDER_REVIEW" ? "border-l-amber-500" : "border-l-emerald-500"
                }`}>
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <p className="font-black text-slate-900 text-sm">{c.subject}</p>
                            <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                            c.status === "OPEN" ? "bg-rose-50 text-rose-700" :
                            c.status === "UNDER_REVIEW" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                        }`}>{c.status.replace("_", " ")}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-3">{new Date(c.created_at).toLocaleDateString("en-IN")}</p>
                    {c.admin_notes && (
                        <p className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-3 mb-3">{c.admin_notes}</p>
                    )}
                    {c.status !== "RESOLVED" && (
                        <div className="flex gap-2">
                            {c.status === "OPEN" && (
                                <button
                                    onClick={() => apiFetch(`/admin/secretary-complaints/${c.id}`, {
                                        method: "PATCH",
                                        body: JSON.stringify({ status: "UNDER_REVIEW" }),
                                    }).then(fetchSecretaryComplaints).catch(() => toast.error("Failed"))}
                                    className="px-3 py-1.5 bg-amber-50 text-amber-700 text-[10px] font-black uppercase rounded-lg hover:bg-amber-100"
                                >
                                    Mark Under Review
                                </button>
                            )}
                            <button
                                onClick={() => apiFetch(`/admin/secretary-complaints/${c.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({ status: "RESOLVED" }),
                                }).then(fetchSecretaryComplaints).catch(() => toast.error("Failed"))}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg hover:bg-emerald-100"
                            >
                                Resolve
                            </button>
                        </div>
                    )}
                </div>
            ))
        )}
    </div>
)}
```

- [ ] **Step 9: Commit**

```bash
git add frontend/app/admin/bookings/page.tsx
git commit -m "feat: admin complaints — cancel bill, override amount, secretary reports tab"
```

---

## Task 13: Frontend — Secretary Dashboard (Report Issue + My Reports)

**Files:**
- Modify: `frontend/app/secretary/dashboard/page.tsx`

- [ ] **Step 1: Add SecretaryComplaint interface and state**

Open `frontend/app/secretary/dashboard/page.tsx`. After the existing `Provider` interface, add:

```tsx
interface SecretaryComplaint {
    id: string;
    subject: string;
    description: string;
    status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
    admin_notes?: string;
    created_at: string;
}
```

Inside `SecretaryDashboard`, add state after existing state declarations:

```tsx
const [complaints, setComplaints] = useState<SecretaryComplaint[]>([]);
const [reportModal, setReportModal] = useState(false);
const [reportSubject, setReportSubject] = useState("");
const [reportDescription, setReportDescription] = useState("");
const [submittingReport, setSubmittingReport] = useState(false);
```

- [ ] **Step 2: Fetch complaints on mount**

In the existing `useEffect` that fetches data, add the complaints fetch. Find the `useEffect` that sets `setLoading(false)` and add:

```tsx
apiFetch("/secretary/complaints").then(d => setComplaints(Array.isArray(d) ? d : [])).catch(() => {});
```

alongside the other fetches.

- [ ] **Step 3: Add `handleSubmitReport` function**

Before the `return` statement, add:

```tsx
const handleSubmitReport = async () => {
    if (!reportSubject.trim() || !reportDescription.trim()) return;
    setSubmittingReport(true);
    try {
        const data = await apiFetch("/secretary/complaints", {
            method: "POST",
            body: JSON.stringify({ subject: reportSubject, description: reportDescription }),
        });
        setComplaints(prev => [data, ...prev]);
        setReportModal(false);
        setReportSubject("");
        setReportDescription("");
        // toast not imported — use alert or add toast context
        alert("Report submitted to admin");
    } catch (err: any) {
        alert(err.message || "Failed to submit report");
    } finally {
        setSubmittingReport(false);
    }
};
```

Note: if `useToast` is already used in the file, replace `alert(...)` with `toast.success(...)` / `toast.error(...)`.

- [ ] **Step 4: Add Report Issue button to the dashboard header**

Find the section that renders the page header/title. Add a "Report Issue" button next to the title:

```tsx
<button
    onClick={() => setReportModal(true)}
    className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase rounded-xl hover:bg-rose-100 transition-colors"
>
    <AlertTriangle className="w-3.5 h-3.5" /> Report Issue
</button>
```

- [ ] **Step 5: Add My Reports section**

At the end of the dashboard content (before the final closing tag), add:

```tsx
{/* My Reports */}
<div className="bg-white border border-slate-200 rounded-2xl p-6">
    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-500" /> My Reports
    </h2>
    {complaints.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No reports filed yet</p>
    ) : (
        <div className="space-y-3">
            {complaints.map(c => (
                <div key={c.id} className={`border rounded-xl p-4 border-l-4 ${
                    c.status === "OPEN" ? "border-l-rose-500 bg-rose-50/30" :
                    c.status === "UNDER_REVIEW" ? "border-l-amber-500 bg-amber-50/30" : "border-l-emerald-500 bg-emerald-50/30"
                }`}>
                    <div className="flex items-start justify-between">
                        <p className="font-black text-slate-900 text-sm">{c.subject}</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            c.status === "OPEN" ? "bg-rose-100 text-rose-700" :
                            c.status === "UNDER_REVIEW" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}>{c.status.replace("_", " ")}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                    {c.admin_notes && (
                        <p className="text-xs text-slate-600 italic border-l-2 border-slate-300 pl-2 mt-2">Admin: {c.admin_notes}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2">{new Date(c.created_at).toLocaleDateString("en-IN")}</p>
                </div>
            ))}
        </div>
    )}
</div>
```

- [ ] **Step 6: Add Report Issue modal**

Before the closing `</div>` of the component, add:

```tsx
{reportModal && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Report an Issue</h2>
                <button onClick={() => setReportModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Subject</label>
                    <input
                        type="text"
                        value={reportSubject}
                        onChange={e => setReportSubject(e.target.value)}
                        placeholder="e.g. Maintenance not responded"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Description</label>
                    <textarea
                        value={reportDescription}
                        onChange={e => setReportDescription(e.target.value)}
                        placeholder="Describe the issue in detail..."
                        rows={4}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button onClick={() => setReportModal(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                    Cancel
                </button>
                <button
                    onClick={handleSubmitReport}
                    disabled={submittingReport || !reportSubject.trim() || !reportDescription.trim()}
                    className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black uppercase hover:bg-rose-700 disabled:opacity-50"
                >
                    {submittingReport ? "Submitting..." : "Submit Report"}
                </button>
            </div>
        </div>
    </div>
)}
```

Add `X` to the lucide-react imports if not already present.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/secretary/dashboard/page.tsx
git commit -m "feat: secretary dashboard — Report Issue button and My Reports section"
```

---

## Self-Review Checklist

After all tasks are complete:

- [ ] Run backend: `cd backend && uvicorn app.main:app --reload --port 8000` — no import errors
- [ ] Run frontend: `cd frontend && npm run build` — no TypeScript errors
- [ ] Test flow manually:
  1. Servicer accepts a booking → clicks "Submit Completion" (Accepted or In Progress) → fills extra hours → submits → booking shows `Pending Confirmation`
  2. User visits `/user/bookings?tab=contracts` → sees amber "Confirm Receipt" button → clicks → receipt modal opens → clicks "Confirm Payment" → booking becomes `Completed` → review modal opens
  3. Alternatively, user clicks "Dispute" → fills reason → submits → admin sees complaint
  4. Admin visits `/admin/bookings?tab=complaints` → sees "Cancel Bill" → clicks → booking reverts to `In Progress` → servicer notified
  5. Admin clicks "Override Amount" → enters amount → booking completes with new amount
  6. Secretary visits dashboard → clicks "Report Issue" → fills form → submits → admin sees it in Secretary Reports tab

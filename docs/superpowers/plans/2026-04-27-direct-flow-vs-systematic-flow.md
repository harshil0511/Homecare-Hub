# Direct Flow vs Systematic Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `flow_type` field (`direct` | `systematic`) to service requests and bookings, splitting the completion path: direct = offline payment + instant complete; systematic = existing hour-entry + confirmation + payment flow (unchanged).

**Architecture:** `flow_type` lives on both `ServiceRequest` (chosen at request time by user) and `ServiceBooking` (propagated from the request on acceptance, or set directly on `BookingCreate`). A new backend endpoint `direct-complete` handles instant completion for direct-flow bookings. Frontend branches badge rendering and the "Mark Done" action based on `flow_type`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, Next.js 16, React 19, Tailwind CSS 4, TypeScript

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `backend/app/booking/domain/model.py` | Modify | Add `flow_type` column to `ServiceBooking` |
| `backend/app/request/domain/model.py` | Modify | Add `flow_type` column to `ServiceRequest` |
| `backend/alembic/versions/27_04_2026_add_flow_type_to_bookings_and_requests.py` | Create | Migration: add columns, backfill existing rows to `systematic` |
| `backend/app/api/booking/schemas.py` | Modify | Add `flow_type` to `BookingCreate` and `BookingRead` |
| `backend/app/api/request/schemas.py` | Modify | Add `flow_type` to `ServiceRequestCreate` and `ServiceRequestRead` |
| `backend/app/api/booking/endpoints.py` | Modify | Pass `flow_type` in `create_booking`; guard `final_complete`; add `direct_complete` endpoint |
| `backend/app/api/request/endpoints.py` | Modify | Pass `flow_type` in `create_service_request`; propagate to booking in both `accept_response` and `accept_counter_offer` |
| `frontend/app/user/providers/page.tsx` | Modify | Add `flow_type` state + radio selector UI in request modal |
| `frontend/app/service/jobs/page.tsx` | Modify | `Booking` interface + flow badge + branch "Mark Done" for direct vs systematic |
| `frontend/app/user/bookings/page.tsx` | Modify | `ActiveBooking` interface + flow badge + hide systematic UI for direct bookings |

---

### Task 1: DB Models — add `flow_type` to `ServiceBooking` and `ServiceRequest`

**Files:**
- Modify: `backend/app/booking/domain/model.py:9-34`
- Modify: `backend/app/request/domain/model.py:9-27`

- [ ] **Step 1: Add `flow_type` to `ServiceBooking` model**

In `backend/app/booking/domain/model.py`, add the `flow_type` column after `is_flagged`:

```python
    is_flagged = Column(Boolean, default=False, nullable=False, server_default="false")
    flow_type = Column(String, default="systematic", nullable=False, server_default="systematic")
```

The full updated class head (lines 9–34) becomes:

```python
class ServiceBooking(Base):
    __tablename__ = "service_bookings"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"))
    service_type = Column(String)
    scheduled_at = Column(DateTime)
    status = Column(String, default="Pending")

    priority = Column(String, default="Normal")
    issue_description = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)
    estimated_cost = Column(Float, default=0.0)
    final_cost = Column(Float, default=0.0)
    actual_hours = Column(Float, nullable=True)
    completion_notes = Column(Text, nullable=True)
    completion_photos = Column(Text, nullable=True)
    property_details = Column(Text, nullable=True)
    source_type = Column(String, nullable=True)
    source_id = Column(PG_UUID(as_uuid=True), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    is_flagged = Column(Boolean, default=False, nullable=False, server_default="false")
    flow_type = Column(String, default="systematic", nullable=False, server_default="systematic")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
```

- [ ] **Step 2: Add `flow_type` to `ServiceRequest` model**

In `backend/app/request/domain/model.py`, add `flow_type` after the `urgency` column:

```python
    urgency = Column(String, default="Normal")
    flow_type = Column(String, default="systematic", nullable=False, server_default="systematic")
    status = Column(String, default="OPEN")
```

- [ ] **Step 3: Commit model changes**

```bash
git add backend/app/booking/domain/model.py backend/app/request/domain/model.py
git commit -m "feat: add flow_type column to ServiceBooking and ServiceRequest models"
```

---

### Task 2: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/27_04_2026_add_flow_type_to_bookings_and_requests.py`

- [ ] **Step 1: Create the migration file**

Run from the `backend/` directory:

```bash
alembic revision -m "add_flow_type_to_bookings_and_requests"
```

This generates a new file in `backend/alembic/versions/`. Rename it to `27_04_2026_add_flow_type_to_bookings_and_requests.py` and replace its content with:

```python
"""add_flow_type_to_bookings_and_requests

Revision ID: <leave generated>
Revises: <leave generated>
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers — leave as generated by alembic revision command above
revision = "<generated>"
down_revision = "<generated>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service_bookings",
        sa.Column("flow_type", sa.String(), nullable=False, server_default="systematic"),
    )
    op.add_column(
        "service_requests",
        sa.Column("flow_type", sa.String(), nullable=False, server_default="systematic"),
    )


def downgrade() -> None:
    op.drop_column("service_bookings", "flow_type")
    op.drop_column("service_requests", "flow_type")
```

**Important:** Keep the `revision` and `down_revision` values exactly as generated by `alembic revision`. Only replace the function bodies.

- [ ] **Step 2: Run the migration and verify**

```bash
cd backend
alembic upgrade head
alembic current
```

Expected output of `alembic current`: shows `27_04_2026_add_flow_type_to_bookings_and_requests (head)`

- [ ] **Step 3: Commit migration**

```bash
git add backend/alembic/versions/27_04_2026_add_flow_type_to_bookings_and_requests.py
git commit -m "feat: migration — add flow_type to service_bookings and service_requests"
```

---

### Task 3: Backend Schemas — add `flow_type`

**Files:**
- Modify: `backend/app/api/booking/schemas.py`
- Modify: `backend/app/api/request/schemas.py`

- [ ] **Step 1: Update `BookingCreate` and `BookingRead` in booking schemas**

In `backend/app/api/booking/schemas.py`:

Add a `flow_type` validator to `BookingBase` (after `estimated_cost`):

```python
class BookingBase(BaseModel):
    provider_id: UUID
    service_type: str
    scheduled_at: datetime
    priority: str = "Normal"
    issue_description: Optional[str] = None
    property_details: Optional[str] = None
    estimated_cost: float = 0.0
    flow_type: str = "systematic"

    @field_validator("estimated_cost")
    @classmethod
    def estimated_cost_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Estimated cost cannot be negative.")
        return v

    @field_validator("flow_type")
    @classmethod
    def validate_flow_type(cls, v: str) -> str:
        if v not in ("direct", "systematic"):
            raise ValueError("flow_type must be 'direct' or 'systematic'")
        return v
```

Add `flow_type` to `BookingRead` (after `is_flagged`):

```python
class BookingRead(BookingBase):
    id: UUID
    user_id: UUID
    status: str
    source_type: Optional[str] = None
    source_id: Optional[UUID] = None
    final_cost: Optional[float] = None
    actual_hours: Optional[float] = None
    completion_notes: Optional[str] = None
    completion_photos: Optional[str] = None
    completed_at: Optional[datetime] = None
    is_flagged: bool = False
    flow_type: str = "systematic"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Update `ServiceRequestCreate` and `ServiceRequestRead` in request schemas**

In `backend/app/api/request/schemas.py`:

Add `flow_type` to `ServiceRequestCreate` (after `urgency`):

```python
class ServiceRequestCreate(BaseModel):
    provider_ids: List[UUID]
    contact_name: str
    contact_mobile: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str = "Normal"
    flow_type: str = "systematic"

    @field_validator("provider_ids")
    @classmethod
    def validate_provider_count(cls, v):
        if not (1 <= len(v) <= 10):
            raise ValueError("Must select between 1 and 10 providers")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate provider IDs are not allowed")
        return v

    @field_validator("urgency")
    @classmethod
    def validate_urgency(cls, v):
        allowed = {"Normal", "High", "Emergency"}
        if v not in allowed:
            raise ValueError(f"urgency must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("flow_type")
    @classmethod
    def validate_flow_type(cls, v: str) -> str:
        if v not in ("direct", "systematic"):
            raise ValueError("flow_type must be 'direct' or 'systematic'")
        return v
```

Add `flow_type` to `ServiceRequestRead` (after `status`):

```python
class ServiceRequestRead(BaseModel):
    id: UUID
    user_id: UUID
    contact_name: str
    contact_mobile: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str
    status: str
    flow_type: str = "systematic"
    expires_at: datetime
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resulting_booking_id: Optional[UUID] = None
    recipients: List[ServiceRequestRecipientRead] = []
    responses: List[ServiceRequestResponseRead] = []

    @field_validator("photos", "preferred_dates", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True
```

Also add `flow_type` to `IncomingServiceRequestRead` (after `status`) so providers can see it:

```python
class IncomingServiceRequestRead(BaseModel):
    id: UUID
    contact_name: str
    location: str
    device_or_issue: str
    description: Optional[str] = None
    photos: Optional[List[str]] = []
    preferred_dates: Optional[List[str]] = []
    urgency: str
    status: str
    flow_type: str = "systematic"
    expires_at: datetime
    created_at: Optional[datetime] = None
    is_read: bool = False
    has_responded: bool = False
    response_id: Optional[UUID] = None
    negotiation_status: Optional[str] = None
    current_round: int = 0
    counter_offer_price: Optional[float] = None
    counter_offer_message: Optional[str] = None

    @field_validator("photos", "preferred_dates", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True
```

- [ ] **Step 3: Commit schema changes**

```bash
git add backend/app/api/booking/schemas.py backend/app/api/request/schemas.py
git commit -m "feat: add flow_type to booking and request schemas"
```

---

### Task 4: Backend Endpoints — booking creation + direct-complete

**Files:**
- Modify: `backend/app/api/booking/endpoints.py`

- [ ] **Step 1: Pass `flow_type` when creating a booking in `create_booking`**

In `backend/app/api/booking/endpoints.py`, the `ServiceBooking(...)` constructor call at line 74 currently reads:

```python
    db_booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=booking_in.provider_id,
        service_type=booking_in.service_type,
        scheduled_at=booking_in.scheduled_at,
        priority=booking_in.priority,
        issue_description=booking_in.issue_description,
        property_details=booking_in.property_details,
        estimated_cost=booking_in.estimated_cost
    )
```

Replace with:

```python
    db_booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=booking_in.provider_id,
        service_type=booking_in.service_type,
        scheduled_at=booking_in.scheduled_at,
        priority=booking_in.priority,
        issue_description=booking_in.issue_description,
        property_details=booking_in.property_details,
        estimated_cost=booking_in.estimated_cost,
        flow_type=booking_in.flow_type,
    )
```

- [ ] **Step 2: Guard `final_complete_booking` against direct-flow bookings**

In `final_complete_booking` (the `POST /{booking_id}/final-complete` handler, line 444), add the guard immediately after the `source_type == "emergency"` check:

```python
    if booking.source_type == "emergency":
        raise HTTPException(status_code=400, detail="Emergency bookings use the emergency billing flow")

    if booking.flow_type == "direct":
        raise HTTPException(
            status_code=400,
            detail="Direct-flow bookings use the /direct-complete endpoint — no hour entry required"
        )
```

- [ ] **Step 3: Add the `direct_complete_booking` endpoint**

Add this new endpoint in `backend/app/api/booking/endpoints.py`, directly after the `cancel_booking` endpoint (after line 399) and before the `create_review` endpoint:

```python
@router.post("/{booking_id}/direct-complete", response_model=BookingRead)
def direct_complete_booking(
    booking_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Provider marks a direct-flow booking as done. Instantly completes — no hour entry, no user confirmation."""
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider or provider.id != booking.provider_id:
        raise HTTPException(status_code=403, detail="Only the assigned servicer can complete this booking")

    if booking.flow_type != "direct":
        raise HTTPException(
            status_code=400,
            detail="This endpoint is only for direct-flow bookings. Use /final-complete for systematic flow."
        )

    if booking.status not in ("Accepted", "In Progress"):
        raise HTTPException(
            status_code=400,
            detail=f"Booking is '{booking.status}' — must be 'Accepted' or 'In Progress' to complete"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    booking.status = "Completed"
    booking.completed_at = now

    db.add(BookingStatusHistory(
        booking_id=booking.id,
        status="Completed",
        notes="Direct-flow job marked done by provider. Payment handled offline.",
        timestamp=now,
    ))

    priority = (booking.priority or "Normal").strip()
    if priority == "Emergency":
        event = "EMERGENCY_COMPLETE"
    elif priority == "High":
        event = "URGENT_COMPLETE"
    else:
        event = "REGULAR_COMPLETE"
    award_points(db, provider.id, event, source_id=booking.id,
                 note=f"{booking.service_type} direct-flow completed")

    provider.availability_status = "AVAILABLE"

    _notify_booking(
        db, user_id=booking.user_id,
        title="Job Completed",
        message=f"Your {booking.service_type} booking has been marked complete by the provider.",
        notification_type="INFO",
        link=f"/user/bookings/{booking.id}",
    )
    if provider.user_id:
        _notify_booking(
            db, user_id=provider.user_id,
            title="Job Complete",
            message=f"You marked '{booking.service_type}' as done. The booking is now in history.",
            notification_type="SUCCESS",
            link="/service/jobs",
        )

    db.commit()
    db.refresh(booking)
    return booking
```

- [ ] **Step 4: Commit booking endpoint changes**

```bash
git add backend/app/api/booking/endpoints.py
git commit -m "feat: pass flow_type in create_booking, guard final_complete, add direct_complete endpoint"
```

---

### Task 5: Backend Endpoints — request creation + propagation to booking

**Files:**
- Modify: `backend/app/api/request/endpoints.py`

- [ ] **Step 1: Pass `flow_type` when creating a service request**

In `create_service_request` (line 168), the `ServiceRequest(...)` constructor currently has:

```python
    db_request = ServiceRequest(
        user_id=current_user.id,
        contact_name=request_in.contact_name,
        contact_mobile=request_in.contact_mobile,
        location=request_in.location,
        device_or_issue=request_in.device_or_issue,
        description=request_in.description,
        photos=json.dumps(request_in.photos) if request_in.photos else None,
        preferred_dates=json.dumps(request_in.preferred_dates) if request_in.preferred_dates else None,
        urgency=request_in.urgency,
        status="OPEN",
        expires_at=now + timedelta(hours=24),
        created_at=now,
    )
```

Replace with:

```python
    db_request = ServiceRequest(
        user_id=current_user.id,
        contact_name=request_in.contact_name,
        contact_mobile=request_in.contact_mobile,
        location=request_in.location,
        device_or_issue=request_in.device_or_issue,
        description=request_in.description,
        photos=json.dumps(request_in.photos) if request_in.photos else None,
        preferred_dates=json.dumps(request_in.preferred_dates) if request_in.preferred_dates else None,
        urgency=request_in.urgency,
        flow_type=request_in.flow_type,
        status="OPEN",
        expires_at=now + timedelta(hours=24),
        created_at=now,
    )
```

- [ ] **Step 2: Propagate `flow_type` to booking in `accept_response`**

In `accept_response` (around line 381), the `ServiceBooking(...)` constructor is:

```python
    booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=chosen.provider_id,
        service_type=req.device_or_issue,
        scheduled_at=chosen.proposed_date,
        priority=req.urgency,
        issue_description=req.description,
        property_details=req.location,
        estimated_cost=chosen.proposed_price,
        photos=req.photos,
        status="Accepted",
    )
```

Replace with:

```python
    booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=chosen.provider_id,
        service_type=req.device_or_issue,
        scheduled_at=chosen.proposed_date,
        priority=req.urgency,
        issue_description=req.description,
        property_details=req.location,
        estimated_cost=chosen.proposed_price,
        photos=req.photos,
        status="Accepted",
        flow_type=req.flow_type,
    )
```

- [ ] **Step 3: Propagate `flow_type` to booking in `accept_counter_offer`**

In the `accept_counter_offer` function (around line 690), the `ServiceBooking(...)` constructor is:

```python
    booking = ServiceBooking(
        user_id=req.user_id,
        provider_id=response.provider_id,
        service_type=req.device_or_issue,
        scheduled_at=latest_offer.proposed_date,
        priority=req.urgency,
        issue_description=req.description,
        property_details=req.location,
        estimated_cost=latest_offer.proposed_price,
        photos=req.photos,
        status="Accepted",
        source_type="negotiated",
    )
```

Replace with:

```python
    booking = ServiceBooking(
        user_id=req.user_id,
        provider_id=response.provider_id,
        service_type=req.device_or_issue,
        scheduled_at=latest_offer.proposed_date,
        priority=req.urgency,
        issue_description=req.description,
        property_details=req.location,
        estimated_cost=latest_offer.proposed_price,
        photos=req.photos,
        status="Accepted",
        source_type="negotiated",
        flow_type=req.flow_type,
    )
```

- [ ] **Step 4: Commit request endpoint changes**

```bash
git add backend/app/api/request/endpoints.py
git commit -m "feat: propagate flow_type from service request to booking on acceptance"
```

---

### Task 6: Frontend — booking creation form (user providers page)

**Files:**
- Modify: `frontend/app/user/providers/page.tsx`

- [ ] **Step 1: Add `flow_type` state in `ProvidersContent`**

In `ProvidersContent` (line 180), add `reqFlowType` state beside the other request state declarations (after `reqUrgency`):

```tsx
const [reqUrgency, setReqUrgency] = useState<"Normal" | "High" | "Emergency">("Normal");
const [reqFlowType, setReqFlowType] = useState<"direct" | "systematic">("systematic");
```

- [ ] **Step 2: Include `flow_type` in the POST body**

In `handleSubmitRequest` (line 340), the `apiFetch` call body currently is:

```tsx
body: JSON.stringify({
    provider_ids: Array.from(selectedIds),
    contact_name: reqName,
    contact_mobile: reqMobile,
    location: reqLocation,
    device_or_issue: reqProblemType,
    description: reqDescription,
    preferred_dates: reqDateStart ? [reqDateStart, reqDateEnd].filter(Boolean) : [],
    urgency: reqUrgency,
}),
```

Replace with:

```tsx
body: JSON.stringify({
    provider_ids: Array.from(selectedIds),
    contact_name: reqName,
    contact_mobile: reqMobile,
    location: reqLocation,
    device_or_issue: reqProblemType,
    description: reqDescription,
    preferred_dates: reqDateStart ? [reqDateStart, reqDateEnd].filter(Boolean) : [],
    urgency: reqUrgency,
    flow_type: reqFlowType,
}),
```

Also reset `reqFlowType` after successful submit (in the same function, after `setReqUrgency("Normal")`):

```tsx
setReqFlowType("systematic");
```

- [ ] **Step 3: Add the flow type selector UI in the request modal**

Find the request modal in `ProvidersContent`. The modal contains fields for `reqName`, `reqMobile`, `reqLocation`, etc. Add the flow type selector **just before the submit button** (inside the modal's form area):

```tsx
{/* Flow Type Selector */}
<div>
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
        Payment Method *
    </label>
    <div className="grid grid-cols-2 gap-2">
        <label className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            reqFlowType === "systematic"
                ? "border-[#064e3b] bg-emerald-50"
                : "border-slate-200 hover:border-slate-300"
        }`}>
            <input
                type="radio"
                name="flow_type"
                value="systematic"
                checked={reqFlowType === "systematic"}
                onChange={() => setReqFlowType("systematic")}
                className="sr-only"
            />
            <span className="text-xs font-black text-slate-900">Systematic</span>
            <span className="text-[10px] text-slate-500 leading-tight">Pay through the app. Hours are tracked and confirmed.</span>
        </label>
        <label className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            reqFlowType === "direct"
                ? "border-[#064e3b] bg-emerald-50"
                : "border-slate-200 hover:border-slate-300"
        }`}>
            <input
                type="radio"
                name="flow_type"
                value="direct"
                checked={reqFlowType === "direct"}
                onChange={() => setReqFlowType("direct")}
                className="sr-only"
            />
            <span className="text-xs font-black text-slate-900">Direct</span>
            <span className="text-[10px] text-slate-500 leading-tight">Pay the provider directly. No hour tracking through the app.</span>
        </label>
    </div>
</div>
```

- [ ] **Step 4: Commit providers page changes**

```bash
git add frontend/app/user/providers/page.tsx
git commit -m "feat: add flow_type radio selector to service request creation modal"
```

---

### Task 7: Frontend — provider jobs page

**Files:**
- Modify: `frontend/app/service/jobs/page.tsx`

- [ ] **Step 1: Add `flow_type` to the `Booking` interface**

The `Booking` interface (line 10) currently ends at `source_type`. Add `flow_type`:

```tsx
interface Booking {
    id: string;
    user_id: string;
    provider_id: string;
    service_type: string;
    scheduled_at: string;
    status: string;
    priority: string;
    issue_description: string | null;
    property_details: string | null;
    estimated_cost: number;
    created_at: string;
    updated_at: string;
    source_type?: string | null;
    flow_type?: string;
}
```

Also add `flow_type` to the `IncomingRequest` interface (line 27) so providers can see it on incoming requests too:

```tsx
interface IncomingRequest {
    id: string;
    contact_name: string;
    location: string;
    device_or_issue: string;
    description?: string;
    urgency: "Normal" | "High" | "Emergency";
    preferred_dates?: string[];
    photos?: string[];
    expires_at: string;
    created_at: string;
    is_read: boolean;
    has_responded: boolean;
    status: string;
    response_id?: string;
    negotiation_status?: string;
    current_round?: number;
    counter_offer_price?: number;
    counter_offer_message?: string;
    flow_type?: string;
}
```

- [ ] **Step 2: Add flow-type badge to each booking card**

Inside the active jobs tab, in the booking card's badge row (around line 577 where status and priority badges are shown), add the flow badge immediately after the priority badge block:

```tsx
{booking.flow_type && (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
        booking.flow_type === "direct"
            ? "bg-slate-700 text-white"
            : "bg-blue-600 text-white"
    }`}>
        {booking.flow_type === "direct" ? "Direct" : "Systematic"}
    </span>
)}
```

- [ ] **Step 3: Branch the "Mark Done" button on `flow_type`**

Currently the `handleFinalComplete` function always calls `/final-complete` or `/emergency-complete`. For direct-flow bookings, we need a different handler that calls `/direct-complete`.

Add a new handler after `handleFinalComplete` (around line 500):

```tsx
const handleDirectComplete = async (booking: Booking) => {
    if (!confirm(`Mark "${booking.service_type}" as done? Payment was handled offline.`)) return;
    try {
        await apiFetch(`/bookings/${booking.id}/direct-complete`, { method: "POST" });
        toast.success("Job marked complete. Moved to history.");
        await fetchJobs();
    } catch (err) {
        toast.error((err as Error)?.message || "Failed to complete booking");
    }
};
```

Now update the button rendering logic in the active jobs tab. Find the block that renders the "Submit Completion" / "Mark Complete & Submit Charge" buttons (around line 639–675). Replace it with:

```tsx
{(booking.status === "Accepted" || (booking.status === "In Progress" && booking.source_type === "emergency")) && (
    booking.flow_type === "direct" ? (
        <button
            onClick={() => handleDirectComplete(booking)}
            className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
            <CheckCircle className="w-4 h-4" />
            Mark as Done
        </button>
    ) : (
        <button
            onClick={async () => {
                setExtraHours("");
                setFinalNotes("");
                setEmergencyRates(null);
                if (booking.source_type === "emergency") {
                    try {
                        const configs: { category: string; callout_fee: number; hourly_rate: number }[] = await apiFetch("/emergency/config");
                        const cfg = configs.find(c => c.category === booking.service_type);
                        setEmergencyRates(cfg ? { callout_fee: cfg.callout_fee, hourly_rate: cfg.hourly_rate } : { callout_fee: 0, hourly_rate: 0 });
                    } catch {
                        setEmergencyRates({ callout_fee: 0, hourly_rate: 0 });
                    }
                }
                setFinalCompleteTarget(booking);
            }}
            className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
            <CheckCircle className="w-4 h-4" />
            {booking.source_type === "emergency" ? "Submit Emergency Charge" : "Submit Completion"}
        </button>
    )
)}
{booking.status === "In Progress" && booking.source_type !== "emergency" && booking.flow_type !== "direct" && (
    <button
        onClick={() => {
            setFinalCompleteTarget(booking);
            setExtraHours("");
            setFinalNotes("");
            setEmergencyRates(null);
        }}
        className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
    >
        <CheckCircle className="w-4 h-4" />
        Mark Complete &amp; Submit Charge
    </button>
)}
{booking.status === "In Progress" && booking.source_type !== "emergency" && booking.flow_type === "direct" && (
    <button
        onClick={() => handleDirectComplete(booking)}
        className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
    >
        <CheckCircle className="w-4 h-4" />
        Mark as Done
    </button>
)}
```

- [ ] **Step 4: Add flow-type badge to incoming requests tab**

In the incoming requests tab rendering (around line 709, inside the `.map(req => ...)` block), add the flow badge alongside the urgency badge:

```tsx
<div className="flex items-center gap-2">
    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${urgencyBadge}`}>
        {req.urgency}
    </span>
    {req.flow_type && (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
            req.flow_type === "direct"
                ? "bg-slate-100 text-slate-700"
                : "bg-blue-50 text-blue-700"
        }`}>
            {req.flow_type === "direct" ? "Direct Pay" : "Systematic"}
        </span>
    )}
    {/* ... existing countdown ... */}
</div>
```

- [ ] **Step 5: Commit provider jobs page changes**

```bash
git add frontend/app/service/jobs/page.tsx
git commit -m "feat: flow_type badge, direct-complete branch on provider jobs page"
```

---

### Task 8: Frontend — user bookings page

**Files:**
- Modify: `frontend/app/user/bookings/page.tsx`

- [ ] **Step 1: Add `flow_type` to the `ActiveBooking` interface**

The `ActiveBooking` interface (line 70) currently ends at `source_type`. Add `flow_type`:

```tsx
interface ActiveBooking {
  id: number;
  service_type: string;
  status: string;
  priority?: string;
  scheduled_at?: string;
  estimated_cost?: number;
  final_cost?: number;
  actual_hours?: number | null;
  completion_notes?: string | null;
  is_flagged?: boolean;
  source_type?: string | null;
  flow_type?: string;
  provider?: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
}
```

Also add `flow_type` to `HistoryBooking` (line 106):

```tsx
interface HistoryBooking {
  id: number;
  service_type: string;
  status: string;
  scheduled_at?: string;
  estimated_cost?: number;
  final_cost?: number;
  flow_type?: string;
  provider?: { first_name?: string; last_name?: string; company_name?: string };
}
```

- [ ] **Step 2: Add flow badge to the Active Contracts tab**

In the contracts tab rendering (around line 591, inside `activeContracts.map(b => ...)`), add the flow badge below the status badge / "Confirm Receipt" button block. Find the `<div className="flex items-center gap-3">` that contains the cost and status, and add the badge:

```tsx
<div className="flex items-center gap-3">
    {/* flow type badge */}
    {b.flow_type && (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
            b.flow_type === "direct"
                ? "bg-slate-100 text-slate-600"
                : "bg-blue-50 text-blue-700"
        }`}>
            {b.flow_type === "direct" ? "Direct" : "Systematic"}
        </span>
    )}
    {(b.final_cost || b.estimated_cost) && (
        <span className="text-sm font-black text-slate-700">
            ₹{(b.final_cost || b.estimated_cost || 0).toLocaleString("en-IN")}
        </span>
    )}
    {b.status === "Pending Confirmation" && b.flow_type !== "direct" ? (
        <button
            onClick={() => handleOpenReceipt(b)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 transition-colors animate-pulse"
        >
            <IndianRupee className="w-3 h-3" /> Confirm Receipt
        </button>
    ) : b.status !== "Pending Confirmation" ? (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
            b.status === "Accepted" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
        }`}>{b.status}</span>
    ) : null}
    <button onClick={() => router.push(`/user/bookings/${b.id}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
        <ChevronRight className="w-4 h-4 text-slate-400" />
    </button>
</div>
```

This change gates the "Confirm Receipt" button: it only shows for `systematic` bookings in `Pending Confirmation` state. Direct bookings in that state (which shouldn't exist due to the backend guard, but belt-and-suspenders) will just show their status badge.

- [ ] **Step 3: Add flow badge to History tab**

In the history tab (around line 638, inside `history.map(b => ...)`), add a flow badge beside the status badge:

```tsx
<div className="flex items-center gap-3">
    {(b.final_cost || b.estimated_cost) && (
        <span className="text-sm font-black text-slate-700">₹{(b.final_cost || b.estimated_cost || 0).toLocaleString("en-IN")}</span>
    )}
    {b.flow_type && (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
            b.flow_type === "direct"
                ? "bg-slate-100 text-slate-500"
                : "bg-blue-50 text-blue-600"
        }`}>
            {b.flow_type === "direct" ? "Direct" : "Systematic"}
        </span>
    )}
    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase">{b.status}</span>
    <button onClick={() => router.push(`/user/bookings/${b.id}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
        <ChevronRight className="w-4 h-4 text-slate-400" />
    </button>
</div>
```

- [ ] **Step 4: Commit user bookings page changes**

```bash
git add frontend/app/user/bookings/page.tsx
git commit -m "feat: flow_type badge and direct-flow UI gates on user bookings page"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Start backend and frontend**

Terminal 1 (backend):
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

- [ ] **Step 2: Test Direct Flow end-to-end**

1. Log in as a USER. Go to `/user/providers`.
2. Select a provider, open the request modal, choose **"Direct"** flow type. Submit.
3. Log in as the SERVICER. Go to `/service/jobs` → **Incoming Requests** tab. Verify the badge shows "Direct Pay".
4. Servicer responds with an offer.
5. Back as USER, go to `/user/bookings` → **Incoming Responses**. Accept the offer.
6. Booking appears in **Active Contracts** with "Direct" badge. No "Confirm Receipt" button.
7. Servicer goes to **Active Jobs**. The job shows "Direct" badge. Button reads "Mark as Done" (not "Submit Completion").
8. Servicer clicks "Mark as Done". Booking moves to completed immediately.
9. No hour-entry modal appeared. No notification asking user to confirm.
10. Booking appears in USER's **History** tab with "Direct" badge and "Completed" status.

- [ ] **Step 3: Verify Systematic Flow is unchanged**

1. Repeat the flow above but choose **"Systematic"** flow type.
2. Servicer's button should read "Submit Completion" and open the hour-entry modal.
3. After submitting hours, user should see "Confirm Receipt" button in Active Contracts.
4. User confirms → booking moves to Completed.
5. Confirm no regression from the existing systematic path.

- [ ] **Step 4: Verify `flow_type` is immutable after creation**

Attempt to PATCH the `flow_type` on a booking via the `/bookings/{id}/status` endpoint (send `flow_type` in the body). It should be silently ignored (the status endpoint does not accept `flow_type`). The DB value must not change.

- [ ] **Step 5: Commit any fixes found during verification**

```bash
git add -p
git commit -m "fix: direct/systematic flow verification fixes"
```

---

## Spec Coverage Check

| Spec requirement | Task that implements it |
|-----------------|------------------------|
| `flow_type` field on booking model | Task 1, Task 2 |
| `flow_type` field on service request model (selected at creation) | Task 1, Task 2 |
| `flow_type` required at creation, validated | Task 3 |
| `flow_type` propagated from request to booking on acceptance | Task 5 |
| Existing bookings default to `systematic` | Task 2 (server_default in migration) |
| Booking creation UI — two-option radio selector | Task 6 |
| Flow badge on provider booking list | Task 7 (Step 2, 4) |
| Flow badge on user booking list | Task 8 (Step 2, 3) |
| Direct → "Mark as Done" = instant complete, no hour entry | Task 4 (Step 3), Task 7 (Step 3) |
| Systematic → "Submit Completion" = existing hour-entry modal | Task 7 (Step 3) |
| No "Confirm Receipt" button for direct bookings | Task 8 (Step 2) |
| No notification asking user to confirm for direct flow | Task 4 (Step 3) — `direct_complete` skips the Pending Confirmation step |
| `flow_type` immutable after creation | Not a dedicated endpoint; the status/update endpoints do not accept `flow_type` |
| Both flows allow ratings after completion | No change needed — review endpoint only checks `status == "Completed"` |
| Cancellation works for both flows | No change needed — cancel endpoint has no flow_type branch |
| History/archive identical once completed | No change needed — history queries filter by `status == "Completed"` regardless |
| Guard `final-complete` endpoint for direct flow | Task 4 (Step 2) |

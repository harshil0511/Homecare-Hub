# Servicer Verification & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a point-based star rating system, servicer analytics page, compact provider cards with detail popup, and admin verification revoke — without touching any existing layout or flow.

**Architecture:** Layered — DB migration first, then backend point engine + hooks into existing booking/review endpoints, then analytics endpoint + admin revoke endpoint, then all frontend changes. Each layer is independently testable before the next begins.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend), Alembic (migrations), Next.js 16 App Router + Tailwind CSS (frontend), lucide-react (icons)

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `backend/alembic/versions/07_04_2026_add_provider_points.py` | Migration: creates `provider_points` table |
| `backend/app/internal/point_engine.py` | `award_points()` helper — inserts point row, recalculates rating |
| `backend/app/api/service/analytics_endpoint.py` | `GET /services/providers/me/analytics` endpoint |
| `frontend/app/service/analytics/page.tsx` | Servicer analytics page |

### Modify
| File | What changes |
|---|---|
| `backend/app/internal/models.py` | Add `ProviderPoints` ORM model |
| `backend/app/internal/schemas.py` | Add `ProviderAnalyticsRead` response schema |
| `backend/app/api/booking/endpoint.py` | Call `award_points` on completion + provider cancel + review |
| `backend/app/api/admin/endpoint.py` | Add `PATCH /admin/providers/{id}/verify` revoke endpoint |
| `backend/app/main.py` | Register analytics router under `/api/v1/services` |
| `frontend/components/layout/Sidebar.tsx` | Add "Analytics" item to `SERVICER_NAV` |
| `frontend/app/user/providers/page.tsx` | Compact cards + detail modal |
| `frontend/app/admin/providers/page.tsx` | Revoke verification button + confirmation popup |

---

## Task 1: Alembic Migration — `provider_points` Table

**Files:**
- Create: `backend/alembic/versions/07_04_2026_add_provider_points.py`

- [ ] **Step 1: Check the latest migration revision ID**

```bash
cd backend && alembic history --verbose | head -5
```

Note the `Rev:` value of the most recent migration — you will use it as `down_revision` in Step 2.

- [ ] **Step 2: Create migration file**

Create `backend/alembic/versions/07_04_2026_add_provider_points.py` with the revision ID from Step 1:

```python
"""add provider_points table

Revision ID: 07042026_provider_points
Revises: <PASTE_LATEST_REV_HERE>
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "07042026_provider_points"
down_revision = "<PASTE_LATEST_REV_HERE>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "provider_points",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("provider_id", PG_UUID(as_uuid=True),
                  sa.ForeignKey("service_providers.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("delta", sa.Float, nullable=False),
        sa.Column("event_type", sa.String, nullable=False),
        sa.Column("source_id", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime,
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_provider_points_provider_id", "provider_points", ["provider_id"])


def downgrade() -> None:
    op.drop_index("ix_provider_points_provider_id", table_name="provider_points")
    op.drop_table("provider_points")
```

- [ ] **Step 3: Run migration**

```bash
cd backend && alembic upgrade head
```

Expected output ends with: `Running upgrade <prev_rev> -> 07042026_provider_points`

- [ ] **Step 4: Verify table exists**

```bash
cd backend && alembic current
```

Expected: `07042026_provider_points (head)`

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/07_04_2026_add_provider_points.py
git commit -m "feat: add provider_points table migration"
```

---

## Task 2: ORM Model + Schema

**Files:**
- Modify: `backend/app/internal/models.py` (after line 384, end of file)
- Modify: `backend/app/internal/schemas.py` (after line 809, end of file)

- [ ] **Step 1: Add `ProviderPoints` model to `models.py`**

Append after the last class (`EmergencyStarAdjustment`) in `backend/app/internal/models.py`:

```python
class ProviderPoints(Base):
    __tablename__ = "provider_points"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    delta = Column(Float, nullable=False)
    event_type = Column(String, nullable=False)
    source_id = Column(PG_UUID(as_uuid=True), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", backref="points_log")
```

- [ ] **Step 2: Add `ProviderAnalyticsRead` schema to `schemas.py`**

Append after the last class in `backend/app/internal/schemas.py`:

```python
# ────────────────────────────────────────────────────────────
# Provider Analytics Schemas
# ────────────────────────────────────────────────────────────

class PointLogEntry(BaseModel):
    created_at: Optional[datetime] = None
    event_type: str
    delta: float
    note: Optional[str] = None

    class Config:
        from_attributes = True


class MonthlyStatEntry(BaseModel):
    month: str          # "2026-03"
    jobs: int
    points_earned: float
    rating_end: float


class PointsBreakdown(BaseModel):
    emergency: float = 0.0
    urgent: float = 0.0
    regular: float = 0.0
    feedback: float = 0.0
    penalties: float = 0.0


class ProviderAnalyticsRead(BaseModel):
    total_jobs: int
    emergency_jobs: int
    urgent_jobs: int
    regular_jobs: int
    cancelled_jobs: int
    total_points: float
    current_rating: float
    completion_rate: float
    points_breakdown: PointsBreakdown
    recent_point_log: List[PointLogEntry] = []
    monthly_stats: List[MonthlyStatEntry] = []
```

- [ ] **Step 3: Verify imports are in place**

`schemas.py` already imports `List`, `Optional`, `datetime` at the top — no new imports needed.

`models.py` already imports `Float`, `Text`, `relationship`, `datetime` at the top — no new imports needed.

- [ ] **Step 4: Commit**

```bash
git add backend/app/internal/models.py backend/app/internal/schemas.py
git commit -m "feat: add ProviderPoints model and analytics schemas"
```

---

## Task 3: Point Engine

**Files:**
- Create: `backend/app/internal/point_engine.py`

- [ ] **Step 1: Create the file**

```python
"""Point engine — awards/deducts points for a provider and recalculates their star rating."""

import uuid
import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.internal.models import ServiceProvider, ProviderPoints


# Points configuration
POINTS = {
    "EMERGENCY_COMPLETE": 35.0,
    "URGENT_COMPLETE": 20.0,
    "REGULAR_COMPLETE": 15.0,
    "EMERGENCY_CANCEL": -20.0,
    "REGULAR_CANCEL": -10.0,
    "FEEDBACK_5_STAR": 10.0,
    "FEEDBACK_4_STAR": 8.0,
    "FEEDBACK_3_STAR": 5.0,
    "FEEDBACK_2_STAR": 2.0,
    "FEEDBACK_1_STAR": 0.0,
    "REVIEW_WRITTEN": 2.0,
}

POINTS_PER_STAR = 100.0


def award_points(
    db: Session,
    provider_id: uuid.UUID,
    event_type: str,
    source_id: Optional[uuid.UUID] = None,
    note: Optional[str] = None,
    custom_delta: Optional[float] = None,
) -> None:
    """
    Insert a provider_points row and recalculate ServiceProvider.rating.
    Uses custom_delta if provided, otherwise looks up the event_type in POINTS.
    Commits all changes.
    """
    delta = custom_delta if custom_delta is not None else POINTS.get(event_type, 0.0)
    if delta == 0.0 and event_type not in ("FEEDBACK_1_STAR", "ADMIN_ADJUSTMENT"):
        # Nothing to record for zero-delta non-feedback events
        if event_type not in POINTS:
            return

    row = ProviderPoints(
        id=uuid.uuid4(),
        provider_id=provider_id,
        delta=delta,
        event_type=event_type,
        source_id=source_id,
        note=note,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(row)

    # Recalculate rating from total points
    total: float = db.query(func.sum(ProviderPoints.delta)).filter(
        ProviderPoints.provider_id == provider_id
    ).scalar() or 0.0
    total += delta  # include the row we just added (not yet flushed)

    new_rating = max(0.0, min(5.0, total / POINTS_PER_STAR))

    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if provider:
        provider.rating = round(new_rating, 2)

    db.commit()
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd backend && python -c "from app.internal.point_engine import award_points, POINTS; print('OK', POINTS)"
```

Expected: `OK {'EMERGENCY_COMPLETE': 35.0, ...}`

- [ ] **Step 3: Commit**

```bash
git add backend/app/internal/point_engine.py
git commit -m "feat: add point engine for provider star rating calculation"
```

---

## Task 4: Hook Points into Booking Endpoint

**Files:**
- Modify: `backend/app/api/booking/endpoint.py`

The two hooks are: (a) completion in `update_booking_status`, (b) provider-cancel in `cancel_booking`.

- [ ] **Step 1: Add import at top of `booking/endpoint.py`**

Find the existing imports block at the top of `backend/app/api/booking/endpoint.py`. Add after the last import line (currently line 13):

```python
from app.internal.point_engine import award_points
```

- [ ] **Step 2: Hook completion points in `update_booking_status`**

In `update_booking_status` (starts at line 138), find this block (around line 162–168):

```python
        # Capture completion data when provider marks job complete
        if new_status == "Completed" and is_provider:
            if booking_update.final_cost is not None:
                booking.final_cost = booking_update.final_cost
            if booking_update.actual_hours is not None:
                booking.actual_hours = booking_update.actual_hours
            if booking_update.completion_notes is not None:
                booking.completion_notes = booking_update.completion_notes
```

Replace with:

```python
        # Capture completion data when provider marks job complete
        if new_status == "Completed" and is_provider:
            if booking_update.final_cost is not None:
                booking.final_cost = booking_update.final_cost
            if booking_update.actual_hours is not None:
                booking.actual_hours = booking_update.actual_hours
            if booking_update.completion_notes is not None:
                booking.completion_notes = booking_update.completion_notes
            # Award points based on job priority
            if provider:
                priority = (booking.priority or "Normal").strip()
                if priority == "Emergency":
                    event = "EMERGENCY_COMPLETE"
                elif priority == "High":
                    event = "URGENT_COMPLETE"
                else:
                    event = "REGULAR_COMPLETE"
                award_points(db, provider.id, event, source_id=booking.id,
                             note=f"{booking.service_type} completed")
```

- [ ] **Step 3: Hook cancellation penalty in `cancel_booking`**

In `cancel_booking` (starts at line 270), find this block (around line 284):

```python
    booking.status = "Cancelled"
    
    history = models.BookingStatusHistory(
```

Replace with:

```python
    booking.status = "Cancelled"

    # Deduct points if the PROVIDER is the one cancelling
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == booking.provider_id
    ).first()
    if provider and provider.user_id == current_user.id:
        priority = (booking.priority or "Normal").strip()
        event = "EMERGENCY_CANCEL" if priority == "Emergency" else "REGULAR_CANCEL"
        award_points(db, provider.id, event, source_id=booking.id,
                     note=f"Cancelled by provider: {cancel_in.reason}")

    history = models.BookingStatusHistory(
```

Note: the existing `cancel_booking` queries the provider again later — that's fine, it will just query again. The `award_points` call commits its own transaction, so remove the duplicate `provider` lookup that already exists further down in the function to avoid confusion. Check lines 296–297 in the original file, which also query `provider`. Leave those in place (they're used for notification), just ensure the new block above uses its own local `provider` variable.

- [ ] **Step 4: Restart backend and manually verify**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Complete a test booking as provider and confirm no 500 errors in the log.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/booking/endpoint.py
git commit -m "feat: award points on booking completion and provider cancellation"
```

---

## Task 5: Hook Feedback Points into Review Endpoint

**Files:**
- Modify: `backend/app/api/booking/endpoint.py` (same file, `create_review` function)

- [ ] **Step 1: Replace the rating update block in `create_review`**

In `create_review` (starts at line 313), find this block (around line 337–344):

```python
    # Update provider rating
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == booking.provider_id).first()
    if provider:
        all_reviews = db.query(models.BookingReview).join(models.ServiceBooking).filter(models.ServiceBooking.provider_id == provider.id).all()
        ratings = [r.rating for r in all_reviews] + [review_in.rating]
        provider.rating = sum(ratings) / len(ratings)
        
    db.commit()
```

Replace with:

```python
    # Award feedback points — point engine recalculates rating and commits
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == booking.provider_id
    ).first()
    if provider:
        star = review_in.rating
        event_map = {5: "FEEDBACK_5_STAR", 4: "FEEDBACK_4_STAR",
                     3: "FEEDBACK_3_STAR", 2: "FEEDBACK_2_STAR", 1: "FEEDBACK_1_STAR"}
        feedback_event = event_map.get(star, "FEEDBACK_1_STAR")
        award_points(db, provider.id, feedback_event, source_id=booking_id,
                     note=f"{star}-star review for {booking.service_type}")
        # Bonus for written review
        if review_in.review_text and review_in.review_text.strip():
            award_points(db, provider.id, "REVIEW_WRITTEN", source_id=booking_id,
                         note="Written review bonus")
    else:
        db.commit()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/booking/endpoint.py
git commit -m "feat: replace average-rating update with point-based feedback awards"
```

---

## Task 6: Analytics Endpoint

**Files:**
- Create: `backend/app/api/service/analytics_endpoint.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create analytics endpoint file**

```python
"""Servicer analytics endpoint — GET /services/providers/me/analytics"""

import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.internal import models, schemas, deps
from app.internal.models import ProviderPoints, ServiceProvider, ServiceBooking

router = APIRouter(tags=["Servicer Analytics"])

servicer_only = deps.RoleChecker(["SERVICER"])


@router.get("/providers/me/analytics", response_model=schemas.ProviderAnalyticsRead)
def get_my_analytics(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(servicer_only),
):
    provider = db.query(ServiceProvider).filter(
        ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    # ── Job counts ────────────────────────────────────────────────────────────
    all_bookings = db.query(ServiceBooking).filter(
        ServiceBooking.provider_id == provider.id
    ).all()

    emergency_jobs = sum(1 for b in all_bookings if (b.priority or "").strip() == "Emergency" and b.status == "Completed")
    urgent_jobs    = sum(1 for b in all_bookings if (b.priority or "").strip() == "High"      and b.status == "Completed")
    regular_jobs   = sum(1 for b in all_bookings if (b.priority or "").strip() not in ("Emergency", "High") and b.status == "Completed")
    cancelled_jobs = sum(1 for b in all_bookings if b.status == "Cancelled")
    total_jobs     = emergency_jobs + urgent_jobs + regular_jobs
    total_attempted = total_jobs + cancelled_jobs
    completion_rate = round((total_jobs / total_attempted * 100), 1) if total_attempted > 0 else 0.0

    # ── Points ───────────────────────────────────────────────────────────────
    all_points = db.query(ProviderPoints).filter(
        ProviderPoints.provider_id == provider.id
    ).order_by(ProviderPoints.created_at.desc()).all()

    total_points = sum(p.delta for p in all_points)

    emergency_pts = sum(p.delta for p in all_points if p.event_type in ("EMERGENCY_COMPLETE",) and p.delta > 0)
    urgent_pts    = sum(p.delta for p in all_points if p.event_type == "URGENT_COMPLETE")
    regular_pts   = sum(p.delta for p in all_points if p.event_type == "REGULAR_COMPLETE")
    feedback_pts  = sum(p.delta for p in all_points if p.event_type.startswith("FEEDBACK") or p.event_type == "REVIEW_WRITTEN")
    penalty_pts   = sum(p.delta for p in all_points if p.delta < 0)

    breakdown = schemas.PointsBreakdown(
        emergency=round(emergency_pts, 1),
        urgent=round(urgent_pts, 1),
        regular=round(regular_pts, 1),
        feedback=round(feedback_pts, 1),
        penalties=round(penalty_pts, 1),
    )

    # ── Recent log (last 10) ──────────────────────────────────────────────────
    recent_log = [
        schemas.PointLogEntry(
            created_at=p.created_at,
            event_type=p.event_type,
            delta=p.delta,
            note=p.note,
        )
        for p in all_points[:10]
    ]

    # ── Monthly stats (last 6 months) ─────────────────────────────────────────
    monthly_stats = []
    now = datetime.datetime.utcnow()
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - datetime.timedelta(days=i * 28)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Normalise to first of month
        month_start = month_start.replace(day=1)
        if i > 0:
            next_month = (month_start + datetime.timedelta(days=32)).replace(day=1)
        else:
            next_month = now

        month_label = month_start.strftime("%Y-%m")

        month_jobs = sum(
            1 for b in all_bookings
            if b.status == "Completed"
            and b.created_at is not None
            and month_start <= b.created_at < next_month
        )
        month_pts = sum(
            p.delta for p in all_points
            if p.created_at is not None and month_start <= p.created_at < next_month
        )

        # Rating at end of month = cumulative points up to next_month / 100, clamped
        cumulative = sum(
            p.delta for p in all_points
            if p.created_at is not None and p.created_at < next_month
        )
        rating_end = round(max(0.0, min(5.0, cumulative / 100.0)), 2)

        monthly_stats.append(schemas.MonthlyStatEntry(
            month=month_label,
            jobs=month_jobs,
            points_earned=round(month_pts, 1),
            rating_end=rating_end,
        ))

    return schemas.ProviderAnalyticsRead(
        total_jobs=total_jobs,
        emergency_jobs=emergency_jobs,
        urgent_jobs=urgent_jobs,
        regular_jobs=regular_jobs,
        cancelled_jobs=cancelled_jobs,
        total_points=round(total_points, 1),
        current_rating=round(provider.rating or 0.0, 2),
        completion_rate=completion_rate,
        points_breakdown=breakdown,
        recent_point_log=recent_log,
        monthly_stats=monthly_stats,
    )
```

- [ ] **Step 2: Register router in `main.py`**

In `backend/app/main.py`, add this import after line 12 (the `service_router` import):

```python
from app.api.service.analytics_endpoint import router as analytics_router
```

Then add this line after the `service_router` registration (line 132):

```python
app.include_router(analytics_router,    prefix="/api/v1/services")
```

- [ ] **Step 3: Verify endpoint is reachable**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Then in another terminal (with a valid SERVICER token):

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/services/providers/me/analytics
```

Expected: JSON with all keys (`total_jobs`, `current_rating`, etc.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/service/analytics_endpoint.py backend/app/main.py
git commit -m "feat: add servicer analytics endpoint GET /services/providers/me/analytics"
```

---

## Task 7: Admin Revoke Endpoint

**Files:**
- Modify: `backend/app/api/admin/endpoint.py`

- [ ] **Step 1: Find where to insert**

Open `backend/app/api/admin/endpoint.py`. Find the existing provider verify endpoint — search for `"/providers/{` to locate provider-related admin routes. Add the new endpoint directly after the existing `PATCH /admin/providers/{id}/verify`.

- [ ] **Step 2: Add revoke schema to `schemas.py`**

In `backend/app/internal/schemas.py`, append after `ProviderAnalyticsRead`:

```python
class AdminVerifyUpdate(BaseModel):
    is_verified: bool
    reason: Optional[str] = None
```

- [ ] **Step 3: Add the revoke endpoint to `admin/endpoint.py`**

First, check if `AdminVerifyUpdate` is already imported in `admin/endpoint.py`. If not, add it to the schemas import line.

Find the existing `PATCH /providers/{provider_id}/verify` route in `admin/endpoint.py`. Add a new endpoint directly after it:

```python
@router.patch("/providers/{provider_id}/revoke-verify")
def revoke_provider_verification(
    provider_id: UUID,
    body: schemas.AdminVerifyUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    _: models.User = Depends(deps.RoleChecker(["ADMIN"])),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider.is_verified = body.is_verified

    # Notify the servicer
    if provider.user_id:
        if not body.is_verified:
            msg = f"Your verified status has been revoked by admin. Reason: {body.reason or 'Not specified'}"
        else:
            msg = "Your profile has been re-verified by admin."
        db.add(models.Notification(
            user_id=provider.user_id,
            title="Verification Status Updated",
            message=msg,
            notification_type="WARNING" if not body.is_verified else "INFO",
        ))

    db.commit()
    db.refresh(provider)
    return {"id": str(provider.id), "is_verified": provider.is_verified, "message": "Verification status updated"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/admin/endpoint.py backend/app/internal/schemas.py
git commit -m "feat: add admin revoke-verify endpoint for service providers"
```

---

## Task 8: Sidebar — Add Analytics Link

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `TrendingUp` to the lucide-react import**

In `Sidebar.tsx` line 6, the import currently reads:

```typescript
import {
  LayoutDashboard, Wrench, Bell, Settings,
  LogOut, Briefcase, Star, Users, ShieldCheck, ShieldAlert,
  BarChart3, ClipboardList, UserCheck, ChevronRight,
  User, Lock, BellRing, Search, Home,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
```

Add `TrendingUp` to this import:

```typescript
import {
  LayoutDashboard, Wrench, Bell, Settings,
  LogOut, Briefcase, Star, Users, ShieldCheck, ShieldAlert,
  BarChart3, ClipboardList, UserCheck, ChevronRight,
  User, Lock, BellRing, Search, Home,
  PanelLeftClose, PanelLeftOpen, TrendingUp,
} from "lucide-react";
```

- [ ] **Step 2: Add Analytics to `SERVICER_NAV`**

Find `SERVICER_NAV` (currently lines 52–57):

```typescript
const SERVICER_NAV = [
  { name: "Overview", icon: LayoutDashboard, path: "/service/dashboard" },
  { name: "My Jobs", icon: Briefcase, path: "/service/jobs" },
  { name: "Ratings", icon: Star, path: "/service/ratings" },
  { name: "Settings", icon: Settings, path: "/service/settings" },
];
```

Replace with:

```typescript
const SERVICER_NAV = [
  { name: "Overview", icon: LayoutDashboard, path: "/service/dashboard" },
  { name: "My Jobs", icon: Briefcase, path: "/service/jobs" },
  { name: "Ratings", icon: Star, path: "/service/ratings" },
  { name: "Analytics", icon: TrendingUp, path: "/service/analytics" },
  { name: "Settings", icon: Settings, path: "/service/settings" },
];
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat: add Analytics link to servicer sidebar"
```

---

## Task 9: Compact Provider Cards + Detail Modal (`/user/providers`)

**Files:**
- Modify: `frontend/app/user/providers/page.tsx`

The existing file is ~550 lines. The card rendering starts around line 270 (after the filter panel). The task is to: (1) add a `selectedProvider` state for the detail modal, (2) make provider cards compact (one row), (3) add the detail modal component.

- [ ] **Step 1: Add `selectedProvider` state and `ProviderModal` component**

In the `ProvidersContent` function, add this state declaration after the existing `showRequestModal` state (around line 89):

```typescript
const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
```

- [ ] **Step 2: Add the `ProviderDetailModal` component**

Add this component definition **above** the `ProvidersContent` function (after the `matchesSearch` function, around line 61):

```typescript
function ProviderDetailModal({ provider, onClose }: { provider: Provider; onClose: () => void }) {
    const getPhotoUrl = (url: string | null) => {
        if (!url) return null;
        return url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${url}` : url;
    };
    const displayName = (p: Provider) =>
        p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.owner_name || p.company_name;

    const photoUrl = getPhotoUrl(provider.profile_photo_url);
    const starFull = Math.floor(provider.rating);
    const hasHalf = provider.rating - starFull >= 0.5;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95 duration-150">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all"
                >
                    <X size={16} />
                </button>

                {/* Photo + name */}
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                        {photoUrl ? (
                            <img src={photoUrl} alt={displayName(provider)} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl font-black text-slate-300">
                                {displayName(provider).charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">
                                {displayName(provider)}
                            </h2>
                            {provider.is_verified && (
                                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <ShieldCheck size={10} /> Verified
                                </span>
                            )}
                        </div>
                        {/* Stars */}
                        <div className="flex items-center gap-1 mt-1">
                            {[1,2,3,4,5].map(s => (
                                <Star
                                    key={s}
                                    size={13}
                                    className={
                                        s <= starFull
                                            ? "text-amber-400 fill-amber-400"
                                            : s === starFull + 1 && hasHalf
                                            ? "text-amber-400 fill-amber-200"
                                            : "text-slate-200"
                                    }
                                />
                            ))}
                            <span className="text-[10px] font-black text-slate-500 ml-1">
                                {provider.rating > 0 ? provider.rating.toFixed(1) : "New"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bio */}
                {provider.bio && (
                    <p className="text-xs font-bold text-slate-600 leading-relaxed mb-5 border-b border-slate-100 pb-5">
                        {provider.bio}
                    </p>
                )}

                {/* Categories */}
                {provider.categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                        {provider.categories.map((cat: string) => (
                            <span key={cat} className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                {cat}
                            </span>
                        ))}
                    </div>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-wide">
                    {provider.experience_years > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-400 mb-0.5">Experience</p>
                            <p className="text-slate-900">{provider.experience_years} yrs</p>
                        </div>
                    )}
                    {provider.hourly_rate > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-400 mb-0.5">Rate</p>
                            <p className="text-slate-900">₹{provider.hourly_rate}/hr</p>
                        </div>
                    )}
                    {provider.location && (
                        <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                            <p className="text-slate-400 mb-0.5">Location</p>
                            <p className="text-slate-900">{provider.location}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Find the provider card rendering section and replace with compact cards**

In `ProvidersContent`, search for the section that renders individual provider cards (look for `filteredProviders.map`). The existing cards are large blocks. Replace the entire `filteredProviders.map(...)` section with this compact row layout:

```typescript
{filteredProviders.map((p, idx) => {
    const name = displayName(p);
    const photoUrl = getPhotoUrl(p.profile_photo_url);
    const isSelected = selectedIds.has(p.id);
    const isFocused = focusedIndex === idx;

    return (
        <div
            key={p.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer group ${
                isSelected
                    ? "border-[#064e3b] bg-emerald-50/50"
                    : isFocused
                    ? "border-slate-300 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
            }`}
        >
            {/* Checkbox */}
            <button
                onClick={() => toggleSelect(p.id)}
                className="flex-shrink-0 text-slate-300 hover:text-[#064e3b] transition-colors"
            >
                {isSelected ? <CheckSquare size={16} className="text-[#064e3b]" /> : <Square size={16} />}
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                {photoUrl ? (
                    <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-sm font-black text-slate-300">{name.charAt(0).toUpperCase()}</span>
                )}
            </div>

            {/* Name + badge + status dot */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-black text-[#000000] uppercase tracking-tight truncate">{name}</span>
                {p.is_verified && <ShieldCheck size={13} className="text-emerald-600 flex-shrink-0" />}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[p.availability_status] || "bg-slate-300"}`} />
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1 flex-shrink-0 hidden sm:flex">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-black text-slate-600">
                    {p.rating > 0 ? p.rating.toFixed(1) : "New"}
                </span>
            </div>

            {/* Category pill */}
            <span className="hidden md:block text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase tracking-wide flex-shrink-0">
                {p.category}
            </span>

            {/* Rate */}
            <span className="hidden lg:block text-[10px] font-black text-slate-500 flex-shrink-0">
                ₹{p.hourly_rate}/hr
            </span>

            {/* View Details button */}
            <button
                onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                className="flex-shrink-0 text-[9px] font-black text-[#064e3b] bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-all uppercase tracking-wide"
            >
                Details
            </button>
        </div>
    );
})}
```

- [ ] **Step 4: Add the modal render at the bottom of `ProvidersContent` return**

At the very end of the `ProvidersContent` JSX (just before the closing `</div>`), add:

```typescript
{/* Provider detail modal */}
{selectedProvider && (
    <ProviderDetailModal
        provider={selectedProvider}
        onClose={() => setSelectedProvider(null)}
    />
)}
```

- [ ] **Step 5: Verify `X` and `ShieldCheck` are in the import at top of the file**

The file already imports `X` and `ShieldCheck` (check the existing `import { ... } from "lucide-react"` at the top). No change needed.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/user/providers/page.tsx
git commit -m "feat: compact provider cards with detail popup modal on user providers page"
```

---

## Task 10: Admin Revoke UI

**Files:**
- Modify: `frontend/app/admin/providers/page.tsx`

- [ ] **Step 1: Add revoke state variables**

In `AdminProvidersPage`, after the existing state declarations (around line 56), add:

```typescript
const [revokeTarget, setRevokeTarget] = useState<{ id: number; name: string } | null>(null);
const [revokeReason, setRevokeReason] = useState("");
const [revoking, setRevoking] = useState(false);
```

- [ ] **Step 2: Add the `handleRevoke` function**

After the existing `rejectProvider` function (around line 100), add:

```typescript
const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
        await apiFetch(`/admin/providers/${revokeTarget.id}/revoke-verify`, {
            method: "PATCH",
            body: JSON.stringify({ is_verified: false, reason: revokeReason }),
        });
        setProviders((prev) =>
            prev.map((p) => p.id === revokeTarget.id ? { ...p, is_verified: false } : p)
        );
        setActionMsg("Verification revoked.");
        setTimeout(() => setActionMsg(""), 2500);
    } catch (err: any) {
        setActionMsg(err.message || "Failed to revoke.");
        setTimeout(() => setActionMsg(""), 3000);
    } finally {
        setRevoking(false);
        setRevokeTarget(null);
        setRevokeReason("");
    }
};
```

- [ ] **Step 3: Add Revoke button to each verified provider row**

Find the table/list where each provider row is rendered (search for `p.is_verified` in the JSX). For each verified provider, add a Revoke button. Find the existing verify/reject buttons in the row and add this alongside them:

```typescript
{p.is_verified && (
    <button
        onClick={() => setRevokeTarget({ id: p.id, name: p.company_name || p.owner_name })}
        className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-all uppercase tracking-wide"
    >
        Revoke
    </button>
)}
```

- [ ] **Step 4: Add the revoke confirmation modal**

At the bottom of the `AdminProvidersPage` JSX return (just before the last closing `</div>`), add:

```typescript
{/* Revoke confirmation modal */}
{revokeTarget && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative">
            <button
                onClick={() => { setRevokeTarget(null); setRevokeReason(""); }}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all"
            >
                <X size={16} />
            </button>
            <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight mb-1">Revoke Verification</h2>
            <p className="text-xs font-bold text-slate-500 mb-6">
                Remove verified badge from <span className="text-slate-900">{revokeTarget.name}</span>. They will be notified.
            </p>
            <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason (optional)..."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-300 outline-none focus:border-[#064e3b] resize-none mb-4"
                rows={3}
            />
            <div className="flex gap-3">
                <button
                    onClick={() => { setRevokeTarget(null); setRevokeReason(""); }}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="flex-1 px-4 py-3 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50"
                >
                    {revoking ? "Revoking..." : "Revoke"}
                </button>
            </div>
        </div>
    </div>
)}
```

- [ ] **Step 5: Check `X` is in the lucide-react import**

The file already imports `X` (line 8). No change needed.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/admin/providers/page.tsx
git commit -m "feat: add revoke verification button and confirmation modal to admin providers page"
```

---

## Task 11: Servicer Analytics Page

**Files:**
- Create: `frontend/app/service/analytics/page.tsx`

- [ ] **Step 1: Create the analytics page**

```typescript
"use client";

import { useEffect, useState } from "react";
import {
    TrendingUp, Star, Zap, Briefcase, AlertTriangle,
    CheckCircle2, XCircle, Loader2, BarChart2
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface PointLogEntry {
    created_at: string | null;
    event_type: string;
    delta: number;
    note: string | null;
}

interface MonthlyStatEntry {
    month: string;
    jobs: number;
    points_earned: number;
    rating_end: number;
}

interface PointsBreakdown {
    emergency: number;
    urgent: number;
    regular: number;
    feedback: number;
    penalties: number;
}

interface Analytics {
    total_jobs: number;
    emergency_jobs: number;
    urgent_jobs: number;
    regular_jobs: number;
    cancelled_jobs: number;
    total_points: number;
    current_rating: number;
    completion_rate: number;
    points_breakdown: PointsBreakdown;
    recent_point_log: PointLogEntry[];
    monthly_stats: MonthlyStatEntry[];
}

const EVENT_LABELS: Record<string, string> = {
    EMERGENCY_COMPLETE: "Emergency Completed",
    URGENT_COMPLETE: "Urgent Job Completed",
    REGULAR_COMPLETE: "Regular Job Completed",
    EMERGENCY_CANCEL: "Emergency Cancelled",
    REGULAR_CANCEL: "Job Cancelled",
    FEEDBACK_5_STAR: "5-Star Feedback",
    FEEDBACK_4_STAR: "4-Star Feedback",
    FEEDBACK_3_STAR: "3-Star Feedback",
    FEEDBACK_2_STAR: "2-Star Feedback",
    FEEDBACK_1_STAR: "1-Star Feedback",
    REVIEW_WRITTEN: "Written Review Bonus",
    ADMIN_ADJUSTMENT: "Admin Adjustment",
};

export default function ServicerAnalyticsPage() {
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch("/services/providers/me/analytics")
            .then(setAnalytics)
            .catch((err: any) => {
                const msg = err?.message || "";
                if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("timed out")) {
                    setFetchError("Could not connect to the server. Please ensure the backend is running.");
                } else {
                    setFetchError(msg || "Failed to load analytics.");
                }
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-[#064e3b] animate-spin" />
            </div>
        );
    }

    if (fetchError || !analytics) {
        return (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-black uppercase tracking-widest">{fetchError || "No data"}</span>
            </div>
        );
    }

    const bd = analytics.points_breakdown;
    const totalPositive = bd.emergency + bd.urgent + bd.regular + bd.feedback;
    const barItems = [
        { label: "Emergency", value: bd.emergency, color: "bg-rose-400" },
        { label: "Urgent", value: bd.urgent, color: "bg-amber-400" },
        { label: "Regular", value: bd.regular, color: "bg-emerald-400" },
        { label: "Feedback", value: bd.feedback, color: "bg-blue-400" },
        { label: "Penalties", value: Math.abs(bd.penalties), color: "bg-slate-300" },
    ];

    const starFull = Math.floor(analytics.current_rating);
    const hasHalf = analytics.current_rating - starFull >= 0.5;

    return (
        <div className="space-y-8 animate-fade-in pb-16">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">My Analytics</h1>
                <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-1">
                    Point-based performance breakdown
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: "Total Jobs",
                        value: analytics.total_jobs,
                        sub: `${analytics.emergency_jobs} emergency · ${analytics.urgent_jobs} urgent · ${analytics.regular_jobs} regular`,
                        icon: Briefcase,
                        color: "text-[#064e3b]",
                        bg: "bg-emerald-50",
                    },
                    {
                        label: "Current Rating",
                        value: analytics.current_rating > 0 ? analytics.current_rating.toFixed(2) : "New",
                        sub: `${analytics.total_points} total points`,
                        icon: Star,
                        color: "text-amber-500",
                        bg: "bg-amber-50",
                    },
                    {
                        label: "Total Points",
                        value: analytics.total_points,
                        sub: `${(analytics.total_points / 100).toFixed(1)} star levels earned`,
                        icon: TrendingUp,
                        color: "text-blue-600",
                        bg: "bg-blue-50",
                    },
                    {
                        label: "Completion Rate",
                        value: `${analytics.completion_rate}%`,
                        sub: `${analytics.cancelled_jobs} cancelled`,
                        icon: CheckCircle2,
                        color: "text-purple-600",
                        bg: "bg-purple-50",
                    },
                ].map((card) => (
                    <div key={card.label} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-10 h-10 ${card.bg} ${card.color} rounded-xl flex items-center justify-center`}>
                                <card.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-[#000000] tracking-tight">{card.value}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{card.label}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Star visual */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-amber-400" /> Star Rating
                </p>
                <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(s => (
                        <Star
                            key={s}
                            size={28}
                            className={
                                s <= starFull
                                    ? "text-amber-400 fill-amber-400"
                                    : s === starFull + 1 && hasHalf
                                    ? "text-amber-400 fill-amber-200"
                                    : "text-slate-200"
                            }
                        />
                    ))}
                    <span className="text-2xl font-black text-[#000000] ml-3">
                        {analytics.current_rating > 0 ? analytics.current_rating.toFixed(2) : "New"}
                    </span>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-2">
                    {analytics.total_points} points ÷ 100 = {(analytics.total_points / 100).toFixed(2)} base stars
                </p>
            </div>

            {/* Points Breakdown Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-[#064e3b]" /> Points Breakdown
                </p>
                <div className="space-y-3">
                    {barItems.map((item) => {
                        const pct = totalPositive > 0 ? Math.round((item.value / (totalPositive + Math.abs(bd.penalties))) * 100) : 0;
                        return (
                            <div key={item.label} className="flex items-center gap-4">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-20 flex-shrink-0">
                                    {item.label}
                                </span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${item.color} transition-all`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-black text-slate-600 w-14 text-right flex-shrink-0">
                                    {item.label === "Penalties" ? `-${item.value}` : `+${item.value}`} pts
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recent Point Activity */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-[#064e3b]" /> Recent Activity (Last 10)
                    </p>
                </div>
                {analytics.recent_point_log.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="text-slate-300 text-xs font-black uppercase tracking-widest">No activity yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {analytics.recent_point_log.map((entry, i) => (
                            <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black text-[#000000] uppercase tracking-tight">
                                        {EVENT_LABELS[entry.event_type] || entry.event_type}
                                    </p>
                                    {entry.note && (
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{entry.note}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ""}
                                    </span>
                                    <span className={`text-sm font-black ${entry.delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                        {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Monthly Stats Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-[#064e3b]" /> Monthly Stats (Last 6 Months)
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                {["Month", "Jobs", "Points Earned", "Rating"].map((h) => (
                                    <th key={h} className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {analytics.monthly_stats.map((row) => (
                                <tr key={row.month} className="hover:bg-slate-50/50 transition-all">
                                    <td className="px-6 py-4 text-xs font-black text-[#000000] uppercase">{row.month}</td>
                                    <td className="px-6 py-4 text-xs font-black text-slate-700">{row.jobs}</td>
                                    <td className="px-6 py-4 text-xs font-black text-emerald-600">+{row.points_earned}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1">
                                            <Star size={11} className="text-amber-400 fill-amber-400" />
                                            <span className="text-xs font-black text-slate-700">
                                                {row.rating_end > 0 ? row.rating_end.toFixed(2) : "New"}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/service/analytics/page.tsx
git commit -m "feat: add servicer analytics page at /service/analytics"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Verify migration is applied**

```bash
cd backend && alembic current
```

Expected: `07042026_provider_points (head)`

- [ ] **Step 3: Test point flow**

1. Log in as a SERVICER — navigate to `/service/analytics`. Should load with zero data.
2. Log in as a USER — navigate to `/user/providers`. Cards should be compact rows with a "Details" button. Click "Details" — popup opens, × closes it.
3. Complete a booking as servicer — check `/service/analytics` — total_jobs should increment, points should appear in recent log.
4. Submit a review as user — check analytics again — feedback points should appear.

- [ ] **Step 4: Test admin revoke**

1. Log in as ADMIN — navigate to `/admin/providers`.
2. Find a verified provider — "Revoke" button should be visible.
3. Click Revoke → confirmation modal opens.
4. Enter reason → click Revoke → badge disappears from row, success message appears.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete servicer verification & analytics system"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] point_engine.py covers all event types from spec
- [x] booking endpoint hooks cover completion (all priorities) and provider-cancel
- [x] review endpoint hook covers feedback-to-points conversion + written review bonus
- [x] analytics endpoint returns all fields from spec schema
- [x] admin revoke endpoint + UI covered (Task 7 + Task 10)
- [x] compact cards + detail modal covered (Task 9)
- [x] analytics page covered (Task 11)
- [x] sidebar link covered (Task 8)
- [x] migration covered (Task 1)

**No placeholders** — all steps contain complete code.

**Type consistency:**
- `award_points()` signature used identically in Tasks 3, 4, 5, 6
- `ProviderAnalyticsRead` field names match between `schemas.py` (Task 2) and `analytics_endpoint.py` (Task 6) and `page.tsx` (Task 11)
- `SERVICER_NAV` array item shape `{ name, icon, path }` matches existing entries (Task 8)

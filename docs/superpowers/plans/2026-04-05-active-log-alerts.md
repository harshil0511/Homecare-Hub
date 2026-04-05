# Active Log Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the existing `MaintenanceTask` model into a full alert system with automatic due-date notifications, alert cards on the dashboard, and servicer-finding integration — without touching the existing booking flow.

**Architecture:** Add 5 fields to `MaintenanceTask` and 2 fields to `ServiceBooking` via migration. An APScheduler job fires notifications on schedule. The dashboard replaces its mixed ledger with focused Alert Cards + a small Active Bookings summary. The `/user/alerts` page gains an Alert History tab.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, APScheduler 3.x, Next.js 14, React, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/alembic/versions/05_04_2026_add_alert_fields.py` | CREATE | DB migration — new columns |
| `backend/app/internal/models.py` | MODIFY | Add 5 cols to MaintenanceTask, 2 cols to ServiceBooking |
| `backend/app/internal/schemas.py` | MODIFY | Add MaintenanceTaskUpdate schema; add new fields to TaskCreate/TaskResponse |
| `backend/app/api/task/endpoint.py` | MODIFY | Add PATCH /maintenance/{id}; loosen task_type filter on providers/assign |
| `backend/app/core/scheduler.py` | CREATE | APScheduler job — check due dates, fire notifications |
| `backend/pyproject.toml` | MODIFY | Add apscheduler dependency |
| `backend/app/main.py` | MODIFY | Start/stop scheduler in lifespan |
| `frontend/app/user/dashboard/page.tsx` | MODIFY | Replace mixed ledger with Alert Cards + Active Bookings summary; add Category to create form |
| `frontend/app/user/alerts/page.tsx` | MODIFY | Add Active/History tab toggle with alert history tab |

---

## Task 1: Database Migration

**Files:**
- Create: `backend/alembic/versions/05_04_2026_add_alert_fields.py`

- [ ] **Step 1: Create the migration file**

```python
# backend/alembic/versions/05_04_2026_add_alert_fields.py
"""add alert fields to maintenance tasks and bookings

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # MaintenanceTask — alert lifecycle tracking fields
    op.add_column('maintenance_tasks', sa.Column('warning_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('maintenance_tasks', sa.Column('final_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('maintenance_tasks', sa.Column('overdue_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('maintenance_tasks', sa.Column('completed_at', sa.DateTime(), nullable=True))
    op.add_column('maintenance_tasks', sa.Column('completion_method', sa.String(), nullable=True))

    # ServiceBooking — track when booking originated from an alert
    op.add_column('service_bookings', sa.Column('source_type', sa.String(), nullable=True))
    op.add_column('service_bookings', sa.Column('source_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('maintenance_tasks', 'warning_sent')
    op.drop_column('maintenance_tasks', 'final_sent')
    op.drop_column('maintenance_tasks', 'overdue_sent')
    op.drop_column('maintenance_tasks', 'completed_at')
    op.drop_column('maintenance_tasks', 'completion_method')
    op.drop_column('service_bookings', 'source_type')
    op.drop_column('service_bookings', 'source_id')
```

- [ ] **Step 2: Run migration**

```bash
cd backend
alembic upgrade head
```

Expected output: `Running upgrade b2c3d4e5f6a7 -> c3d4e5f6a7b8, add alert fields to maintenance tasks and bookings`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/05_04_2026_add_alert_fields.py
git commit -m "db: add alert lifecycle fields to maintenance_tasks and service_bookings"
```

---

## Task 2: Model + Schema + PATCH Endpoint

**Files:**
- Modify: `backend/app/internal/models.py`
- Modify: `backend/app/internal/schemas.py`
- Modify: `backend/app/api/task/endpoint.py`

- [ ] **Step 1: Update MaintenanceTask model** — add the 5 new columns after the existing `created_at` line

In `backend/app/internal/models.py`, find the `MaintenanceTask` class and replace:

```python
    booking_id = Column(Integer, ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
```

with:

```python
    booking_id = Column(Integer, ForeignKey("service_bookings.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Alert lifecycle tracking
    warning_sent = Column(Boolean, default=False)
    final_sent = Column(Boolean, default=False)
    overdue_sent = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    completion_method = Column(String, nullable=True)  # "booked" | "manual" | "cancelled"
```

- [ ] **Step 2: Update ServiceBooking model** — add source fields after the `property_details` line

In `backend/app/internal/models.py`, find the `ServiceBooking` class and find the line:
```python
    property_details = Column(Text, nullable=True) # Quick property info
```

Add immediately after it:
```python
    source_type = Column(String, nullable=True)   # "alert" | "manual" | null
    source_id = Column(Integer, nullable=True)    # maintenance_tasks.id if source_type="alert"
```

- [ ] **Step 3: Add TaskCreate category field + MaintenanceTaskUpdate schema**

In `backend/app/internal/schemas.py`, find `TaskCreate`:

```python
class TaskCreate(BaseModel):
    title: str # Device Name
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "Pending"
    priority: str = "Routine" # Routine, Mandatory, Urgent
    service_provider_id: Optional[int] = None
```

Replace with:

```python
class TaskCreate(BaseModel):
    title: str                            # Device Name
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "Pending"
    priority: str = "Routine"             # Routine, Mandatory, Urgent
    category: Optional[str] = None        # Service category for Find Servicer
    service_provider_id: Optional[int] = None
```

Then find `TaskResponse` and replace with:

```python
class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    priority: str
    category: Optional[str] = None
    location: Optional[str] = None
    task_type: Optional[str] = "standard"
    booking_id: Optional[int] = None
    warning_sent: bool = False
    final_sent: bool = False
    overdue_sent: bool = False
    completed_at: Optional[datetime] = None
    completion_method: Optional[str] = None
    created_at: Optional[datetime] = None
    provider: Optional[ProviderResponse] = None

    class Config:
        from_attributes = True
```

After `TaskResponse`, add a new schema for the PATCH endpoint:

```python
class MaintenanceTaskUpdate(BaseModel):
    status: Optional[str] = None
    completion_method: Optional[str] = None
    task_type: Optional[str] = None
```

- [ ] **Step 4: Add PATCH endpoint + loosen task_type filter on routine providers/assign**

In `backend/app/api/task/endpoint.py`, add this import at the top (after existing imports):

```python
from app.internal.schemas import (
    TaskCreate, TaskResponse,
    RoutineTaskCreate, RoutineTaskResponse, RoutineTaskAssign,
    ProviderResponse, MaintenanceTaskUpdate
)
```

(Replace the existing `from app.internal.schemas import (...)` block with the above.)

Then add the PATCH endpoint after the `create_task` POST endpoint (before the `# ── Routine Task endpoints ──` comment):

```python
@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    update_in: MaintenanceTaskUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if update_in.status is not None:
        task.status = update_in.status
    if update_in.completion_method is not None:
        task.completion_method = update_in.completion_method
        task.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if update_in.task_type is not None:
        task.task_type = update_in.task_type

    db.commit()
    db.refresh(task)
    return task
```

- [ ] **Step 5: Loosen task_type filter on providers endpoint**

In `backend/app/api/task/endpoint.py`, find `get_matching_providers` and change the filter:

```python
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id,
        MaintenanceTask.task_type == "routine"
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Routine task not found")
```

Replace with:

```python
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
```

- [ ] **Step 6: Loosen task_type filter on assign endpoint**

In `backend/app/api/task/endpoint.py`, find `assign_routine_provider` and change:

```python
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id,
        MaintenanceTask.task_type == "routine"
    ).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="Routine task not found")
    if task.booking_id:
        raise HTTPException(status_code=400, detail="Task already has an assigned provider")
```

Replace with:

```python
    task = db.query(MaintenanceTask).filter(
        MaintenanceTask.id == task_id,
        MaintenanceTask.user_id == current_user.id
    ).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.booking_id:
        raise HTTPException(status_code=400, detail="Task already has an assigned provider")
```

Also in that same `assign_routine_provider` function, find where the `booking` object is created and add the source fields:

```python
    booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=provider.id,
        service_type=task.category or "General",
        issue_description=f"{task.title}: {task.description}" if task.description else task.title,
        scheduled_at=scheduled,
        priority=task.priority,
        property_details=task.location,
        estimated_cost=provider.hourly_rate or 0.0
    )
```

Replace with:

```python
    booking = ServiceBooking(
        user_id=current_user.id,
        provider_id=provider.id,
        service_type=task.category or "General",
        issue_description=f"{task.title}: {task.description}" if task.description else task.title,
        scheduled_at=scheduled,
        priority=task.priority,
        property_details=task.location,
        estimated_cost=provider.hourly_rate or 0.0,
        source_type="alert",
        source_id=task.id
    )
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/internal/models.py backend/app/internal/schemas.py backend/app/api/task/endpoint.py
git commit -m "feat: add alert lifecycle model fields, PATCH endpoint, and loosen task_type filter"
```

---

## Task 3: APScheduler Notification Job

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/app/core/scheduler.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add APScheduler dependency**

In `backend/pyproject.toml`, add `"apscheduler>=3.10.0"` to the `dependencies` list:

```toml
dependencies = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.29.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.13.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "pydantic[email]",
    "psycopg[binary]>=3.1.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[pbkdf2]>=1.7.4",
    "python-multipart>=0.0.9",
    "anthropic>=0.25.0",
    "python-dotenv>=1.0.0",
    "email-validator>=2.0.0",
    "apscheduler>=3.10.0",
]
```

- [ ] **Step 2: Install the new dependency**

```bash
cd backend
pip install apscheduler>=3.10.0
```

Expected: `Successfully installed apscheduler-3.x.x`

- [ ] **Step 3: Create the scheduler module**

Create `backend/app/core/scheduler.py`:

```python
import logging
from datetime import datetime, timedelta, date

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.internal.models import MaintenanceTask, Notification

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC")


def _check_alert_notifications() -> None:
    """Run every hour. Fire WARNING / FINAL / OVERDUE notifications for due maintenance tasks."""
    db = SessionLocal()
    try:
        today = date.today()
        two_days_later = today + timedelta(days=2)

        active_tasks = (
            db.query(MaintenanceTask)
            .filter(
                MaintenanceTask.due_date.isnot(None),
                MaintenanceTask.status.notin_(["Completed", "Cancelled", "Expired"])
            )
            .all()
        )

        for task in active_tasks:
            due: date = task.due_date

            # Stage 1 — warning notification (2 days before)
            if due == two_days_later and not task.warning_sent:
                db.add(Notification(
                    user_id=task.user_id,
                    title="Maintenance Reminder — 2 Days Left",
                    message=f"Your '{task.title}' maintenance is due in 2 days on {due.strftime('%d %b %Y')}. Don't forget!",
                    notification_type="WARNING",
                    link=f"/user/routine?taskId={task.id}",
                ))
                task.warning_sent = True

            # Stage 2 — due today notification
            elif due == today and not task.final_sent:
                db.add(Notification(
                    user_id=task.user_id,
                    title="MAINTENANCE DUE TODAY",
                    message=f"Your '{task.title}' maintenance is scheduled for today. Take action now.",
                    notification_type="URGENT",
                    link=f"/user/routine?taskId={task.id}",
                ))
                task.final_sent = True
                task.status = "Triggered"

            # Stage 3 — overdue notification (1+ days past due)
            elif due < today and not task.overdue_sent:
                db.add(Notification(
                    user_id=task.user_id,
                    title="OVERDUE: Maintenance Missed",
                    message=f"Your '{task.title}' maintenance was due on {due.strftime('%d %b %Y')}. Please take action.",
                    notification_type="URGENT",
                    link=f"/user/routine?taskId={task.id}",
                ))
                task.overdue_sent = True
                task.status = "Overdue"

            # Auto-expire after 7 days overdue
            if task.status == "Overdue" and due < today - timedelta(days=7):
                task.status = "Expired"

        db.commit()
        logger.info("Alert notification check complete — processed %d tasks.", len(active_tasks))
    except Exception:
        logger.exception("Alert notification scheduler failed.")
        db.rollback()
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(
        _check_alert_notifications,
        trigger="interval",
        hours=1,
        id="alert_notifications",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Alert notification scheduler started.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Alert notification scheduler stopped.")
```

- [ ] **Step 4: Register scheduler in main.py lifespan**

In `backend/app/main.py`, add the scheduler import after the existing imports:

```python
from app.core.scheduler import start_scheduler, stop_scheduler
```

Then find the `lifespan` function:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB (with auto-retry if not ready). Shutdown: nothing extra needed."""
    logger.info("Starting HomeCare Hub API ...")
    init_db()  # connects immediately or starts background retry thread
    _seed_penalty_configs()
    yield
    logger.info("Shutting down HomeCare Hub API.")
```

Replace with:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, seed configs, start scheduler. Shutdown: stop scheduler."""
    logger.info("Starting HomeCare Hub API ...")
    init_db()
    _seed_penalty_configs()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Shutting down HomeCare Hub API.")
```

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/app/core/scheduler.py backend/app/main.py
git commit -m "feat: add APScheduler hourly job for alert due-date notifications"
```

---

## Task 4: Dashboard — Alert Cards + Active Bookings + Category Field

**Files:**
- Modify: `frontend/app/user/dashboard/page.tsx`

This task replaces the existing mixed task+booking ledger with two focused sections:
1. **Active Alerts** — maintenance tasks only, with alert card design
2. **Active Bookings** — small summary of Accepted/In Progress bookings

- [ ] **Step 1: Replace the full dashboard page**

Replace the entire content of `frontend/app/user/dashboard/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    Activity,
    ShieldCheck,
    Clock,
    LayoutDashboard,
    AlertCircle,
    ChevronRight,
    Zap,
    X,
    CheckCircle2,
    Loader2,
    ArrowRight,
    ClipboardList,
    Bell,
    Search,
    Calendar,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { page, card, stat, btn, form, modal, badge, iconBox } from "@/lib/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface MaintenanceTask {
    id: number;
    title: string;
    description?: string;
    due_date?: string;
    status: string;
    priority: string;
    category?: string;
    warning_sent: boolean;
    final_sent: boolean;
    overdue_sent: boolean;
    booking_id?: number;
    task_type?: string;
}

interface ActiveBooking {
    id: number;
    service_type: string;
    status: string;
    scheduled_at: string;
    provider?: {
        first_name?: string;
        last_name?: string;
        company_name?: string;
        owner_name?: string;
    };
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    iconBg: string;
    onClick?: () => void;
    isActive?: boolean;
}

const CATEGORIES = [
    "Plumber", "Electrician", "HVAC Technician", "Appliance Repair",
    "Pest Control", "Cleaning Service", "General Maintenance", "Bill Payment", "Other"
];

const PRIORITY_BORDER: Record<string, string> = {
    Routine: "border-l-emerald-400",
    Mandatory: "border-l-amber-400",
    Urgent: "border-l-rose-400",
    Emergency: "border-l-rose-600",
};

const STATUS_BADGE: Record<string, string> = {
    Pending:   "bg-slate-100 text-slate-500",
    Active:    "bg-emerald-50 text-emerald-700",
    Triggered: "bg-amber-50 text-amber-700",
    Overdue:   "bg-rose-50 text-rose-600",
    Assigned:  "bg-blue-50 text-blue-600",
};

const StatCard = ({ title, value, icon: Icon, iconColor, iconBg, onClick, isActive }: StatCardProps) => (
    <div onClick={onClick} className={`${stat.tile} ${isActive ? stat.tileActive : ''}`}>
        <div className={`${stat.icon} ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
            <h3 className={stat.value}>{value}</h3>
            <p className={stat.label}>{title}</p>
        </div>
    </div>
);

export default function DashboardPage() {
    const router = useRouter();
    const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
    const [bookings, setBookings] = useState<ActiveBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [newTask, setNewTask] = useState({ title: "", description: "", due_date: "", priority: "Routine", category: "" });
    const [findingServicer, setFindingServicer] = useState<number | null>(null);

    const fetchData = async () => {
        try {
            const [userTasks, userBookings] = await Promise.allSettled([
                apiFetch("/maintenance"),
                apiFetch("/bookings/list"),
            ]);
            if (userTasks.status === "fulfilled") setTasks(userTasks.value ?? []);
            if (userBookings.status === "fulfilled") setBookings(userBookings.value ?? []);
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiFetch("/maintenance", { method: "POST", body: JSON.stringify(newTask) });
            setShowTaskModal(false);
            setNewTask({ title: "", description: "", due_date: "", priority: "Routine", category: "" });
            fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to create alert");
        }
    };

    const markDone = async (id: number) => {
        try {
            await apiFetch(`/maintenance/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "Completed", completion_method: "manual" })
            });
            fetchData();
        } catch (err) {
            console.error("Failed to mark done", err);
        }
    };

    const dismissAlert = async (id: number) => {
        try {
            await apiFetch(`/maintenance/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "Cancelled", completion_method: "cancelled" })
            });
            fetchData();
        } catch (err) {
            console.error("Failed to dismiss", err);
        }
    };

    const handleFindServicer = async (task: MaintenanceTask) => {
        setFindingServicer(task.id);
        try {
            // Convert to routine type so /user/routine can find + match providers
            if (task.task_type !== "routine") {
                await apiFetch(`/maintenance/${task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ task_type: "routine" })
                });
            }
            router.push(`/user/routine?taskId=${task.id}`);
        } catch (err) {
            console.error("Failed to start find servicer flow", err);
            setFindingServicer(null);
        }
    };

    const activeAlerts = tasks.filter(t =>
        ["Pending", "Active", "Triggered", "Overdue", "Assigned"].includes(t.status)
    ).sort((a, b) => {
        const order: Record<string, number> = { Overdue: 0, Triggered: 1, Assigned: 2, Active: 3, Pending: 4 };
        const oa = order[a.status] ?? 5;
        const ob = order[b.status] ?? 5;
        if (oa !== ob) return oa - ob;
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db2 = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db2;
    });

    const activeBookings = bookings.filter(b =>
        b.status === "Accepted" || b.status === "In Progress"
    );

    const overdueCount = activeAlerts.filter(t => t.status === "Overdue").length;
    const triggeredCount = activeAlerts.filter(t => t.status === "Triggered").length;

    return (
        <div className={`${page.wrapper} animate-fade-in`}>
            {/* Header */}
            <div className={page.header}>
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBox.dark}`}>
                            <LayoutDashboard className="w-4 h-4" />
                        </div>
                        <h1 className={page.title}>Operations Control</h1>
                    </div>
                    <p className={page.subtitle}>Unified Infrastructure Monitoring & Resource Management</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/user/bookings/emergency" className={btn.danger}>
                        <Zap className="w-3.5 h-3.5" />
                        Emergency SOS
                    </Link>
                    <button onClick={() => setShowTaskModal(true)} className={btn.primary}>
                        <Zap className="w-3.5 h-3.5" />
                        Create Alert
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Active Alerts" value={activeAlerts.length} icon={Bell} iconBg="bg-emerald-50" iconColor="text-emerald-700" />
                <StatCard title="Overdue" value={overdueCount} icon={AlertCircle} iconBg="bg-rose-50" iconColor="text-rose-600" />
                <StatCard title="Due Soon" value={triggeredCount} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
                <StatCard title="Active Bookings" value={activeBookings.length} icon={ClipboardList} iconBg="bg-slate-100" iconColor="text-slate-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* ── Active Log Alerts ── */}
                <div className={`lg:col-span-3 ${card.base} ${card.pad} space-y-4`}>
                    <div className="flex items-center justify-between">
                        <h2 className={`${card.title} flex items-center gap-2`}>
                            <Bell className="w-4 h-4 text-[#064e3b]" />
                            Active Log Alerts
                        </h2>
                        <Link href="/user/alerts" className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-[#064e3b] transition-colors">
                            History ↗
                        </Link>
                    </div>

                    {loading ? (
                        <div className="py-16 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-[#064e3b] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : activeAlerts.length === 0 ? (
                        <div className="py-16 flex flex-col items-center text-center gap-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <Bell className="w-8 h-8 text-slate-200" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Active Alerts</p>
                            <button onClick={() => setShowTaskModal(true)} className="text-[9px] font-black text-[#064e3b] uppercase tracking-widest">
                                Create First Alert →
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                            {activeAlerts.map(task => {
                                const isOverdue = task.status === "Overdue";
                                const isTriggered = task.status === "Triggered";
                                const borderColor = isOverdue || isTriggered
                                    ? "border-l-rose-500"
                                    : PRIORITY_BORDER[task.priority] ?? "border-l-slate-300";

                                return (
                                    <div
                                        key={task.id}
                                        className={`border border-slate-100 border-l-4 ${borderColor} rounded-xl p-4 bg-white hover:shadow-sm transition-all space-y-3`}
                                    >
                                        {/* Card header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                                                    isOverdue ? badge.danger :
                                                    isTriggered ? "bg-amber-50 text-amber-700" :
                                                    task.priority === "Urgent" ? badge.danger :
                                                    task.priority === "Mandatory" ? badge.warning : badge.neutral
                                                }`}>
                                                    {task.priority}
                                                </span>
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{task.title}</h4>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {task.due_date && (
                                                    <span className="text-[8px] text-slate-400 font-black uppercase">
                                                        {new Date(task.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${STATUS_BADGE[task.status] ?? "bg-slate-100 text-slate-500"}`}>
                                                    {task.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {task.description && (
                                            <p className="text-[10px] text-slate-500 leading-relaxed">{task.description}</p>
                                        )}

                                        {/* Category */}
                                        {task.category && (
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                Category: {task.category}
                                            </p>
                                        )}

                                        {/* Footer actions */}
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                                            {task.booking_id ? (
                                                <Link
                                                    href={`/user/bookings/${task.booking_id}`}
                                                    className="bg-[#064e3b] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#053e2f] transition-all active:scale-95 flex items-center gap-2"
                                                >
                                                    <ArrowRight className="w-3 h-3" />
                                                    View Booking
                                                </Link>
                                            ) : (
                                                <button
                                                    onClick={() => handleFindServicer(task)}
                                                    disabled={findingServicer === task.id}
                                                    className="bg-[#064e3b] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#053e2f] transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60"
                                                >
                                                    {findingServicer === task.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Search className="w-3 h-3" />
                                                    )}
                                                    Find Servicer
                                                </button>
                                            )}
                                            <button
                                                onClick={() => markDone(task.id)}
                                                className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-all active:scale-95 flex items-center gap-1.5"
                                            >
                                                <CheckCircle2 className="w-3 h-3" />
                                                Mark Done
                                            </button>
                                            <button
                                                onClick={() => dismissAlert(task.id)}
                                                className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-all"
                                                title="Dismiss"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Quick Actions */}
                    <div className={`${card.base} ${card.padSm}`}>
                        <h3 className={`${card.title} mb-3 flex items-center gap-1.5`}>
                            <Zap className="w-3 h-3 text-[#064e3b]" /> Quick Actions
                        </h3>
                        <div className="space-y-1.5">
                            <Link href="/user/providers" className="flex items-center justify-between w-full p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all">
                                <span className="flex items-center gap-2"><Calendar className="w-3 h-3" />Book a Service</span>
                                <ChevronRight className="w-3 h-3" />
                            </Link>
                            <Link href="/user/bookings/emergency" className="flex items-center justify-between w-full p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all">
                                <span className="flex items-center gap-2"><AlertCircle className="w-3 h-3" />Emergency SOS</span>
                                <ChevronRight className="w-3 h-3" />
                            </Link>
                            <Link href="/user/providers" className="flex items-center justify-between w-full p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all">
                                <span className="flex items-center gap-2"><Search className="w-3 h-3" />Find Experts</span>
                                <ChevronRight className="w-3 h-3" />
                            </Link>
                            <Link href="/user/bookings" className="flex items-center justify-between w-full p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all">
                                <span className="flex items-center gap-2"><ClipboardList className="w-3 h-3" />My Bookings</span>
                                <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                    {/* Active Bookings Summary */}
                    <div className={`${card.base} ${card.padSm}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`${card.title} flex items-center gap-1.5`}>
                                <ShieldCheck className="w-3 h-3 text-[#064e3b]" /> Active Bookings
                            </h3>
                            {activeBookings.length > 0 && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[8px] font-black uppercase">
                                    {activeBookings.length}
                                </span>
                            )}
                        </div>
                        {activeBookings.length === 0 ? (
                            <div className="py-6 text-center text-slate-300 text-[9px] font-black uppercase tracking-widest">
                                No active bookings
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeBookings.slice(0, 4).map(b => {
                                    const providerName = b.provider
                                        ? (b.provider.company_name || `${b.provider.first_name ?? ''} ${b.provider.last_name ?? ''}`.trim() || b.provider.owner_name || "Provider")
                                        : "Unassigned";
                                    return (
                                        <Link
                                            key={b.id}
                                            href={`/user/bookings/${b.id}`}
                                            className="block p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-tight">{b.service_type}</p>
                                                    <p className="text-[8px] text-slate-400 mt-0.5">{providerName}</p>
                                                </div>
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${b.status === "In Progress" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"}`}>
                                                    {b.status}
                                                </span>
                                            </div>
                                            <p className="text-[8px] text-slate-400 mt-1">
                                                {new Date(b.scheduled_at).toLocaleDateString()}
                                            </p>
                                        </Link>
                                    );
                                })}
                                {activeBookings.length > 4 && (
                                    <Link href="/user/bookings" className="block text-center text-[9px] font-black text-[#064e3b] uppercase tracking-widest hover:underline pt-1">
                                        View all {activeBookings.length} →
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Alert Modal */}
            {showTaskModal && createPortal(
                <div className={modal.overlay}>
                    <div className={modal.backdrop} onClick={() => setShowTaskModal(false)} />
                    <div className={modal.box}>
                        <div className={modal.pad}>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h2 className={modal.title}>New Log Alert</h2>
                                    <p className={modal.subtitle}>Device Maintenance Timer</p>
                                </div>
                                <button onClick={() => setShowTaskModal(false)} className={btn.icon}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateTask} className="space-y-4">
                                <div className={form.group}>
                                    <label className={form.label}>Device Name</label>
                                    <input
                                        placeholder="E.G., WATER PURIFIER, AC UNIT..."
                                        value={newTask.title}
                                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                        className={form.input}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className={form.group}>
                                        <label className={form.label}>End Date (Timer)</label>
                                        <input
                                            type="date"
                                            value={newTask.due_date}
                                            onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                                            className={form.input}
                                            required
                                        />
                                    </div>
                                    <div className={form.group}>
                                        <label className={form.label}>Priority</label>
                                        <select
                                            value={newTask.priority}
                                            onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                                            className={form.select}
                                        >
                                            <option value="Routine">Routine</option>
                                            <option value="Mandatory">Mandatory</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div className={form.group}>
                                    <label className={form.label}>Service Category (Optional)</label>
                                    <select
                                        value={newTask.category}
                                        onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                                        className={form.select}
                                    >
                                        <option value="">Select category...</option>
                                        {CATEGORIES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={form.group}>
                                    <label className={form.label}>Notes & Context</label>
                                    <textarea
                                        placeholder="ADDITIONAL DETAILS OR MODEL NUMBERS..."
                                        rows={3}
                                        value={newTask.description}
                                        onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                                        className={form.textarea}
                                    />
                                </div>
                                <button type="submit" className={`w-full justify-center ${btn.primary}`}>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Initialize Alert
                                </button>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/user/dashboard/page.tsx
git commit -m "feat: replace dashboard mixed ledger with Alert Cards and Active Bookings summary"
```

---

## Task 5: Alerts Page — Add Alert History Tab

**Files:**
- Modify: `frontend/app/user/alerts/page.tsx`

Add a tab toggle at the top of the page. **Active tab** keeps all existing content. **History tab** shows Completed / Expired / Cancelled maintenance tasks fetched from `GET /maintenance`.

- [ ] **Step 1: Add alertHistory state and fetch logic**

In `frontend/app/user/alerts/page.tsx`, find the existing state declarations at the top of `AlertsPage()`:

```tsx
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
    const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [loadingBookings, setLoadingBookings] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);
    const [bookingDetail, setBookingDetail] = useState<BookingDetailData | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
```

Replace with:

```tsx
    const [activeTab, setActiveTab] = useState<"active" | "history">("active");
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
    const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
    const [alertHistory, setAlertHistory] = useState<PendingTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [loadingBookings, setLoadingBookings] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);
    const [bookingDetail, setBookingDetail] = useState<BookingDetailData | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
```

- [ ] **Step 2: Add fetchAlertHistory function**

In `frontend/app/user/alerts/page.tsx`, find the `fetchPendingTasks` function:

```tsx
    const fetchPendingTasks = async () => {
        setLoadingTasks(true);
        try {
            const data: PendingTask[] = await apiFetch("/maintenance/routine");
            setPendingTasks(data.filter(t => t.booking_id === null));
        } catch (err) {
            // User may not be a home user — silently ignore
        } finally {
            setLoadingTasks(false);
        }
    };
```

Add this new function immediately after it:

```tsx
    const fetchAlertHistory = async () => {
        setLoadingHistory(true);
        try {
            const data: PendingTask[] = await apiFetch("/maintenance");
            setAlertHistory(data.filter(t =>
                ["Completed", "Expired", "Cancelled"].includes(t.status)
            ));
        } catch (err) {
            console.warn("Failed to fetch alert history", err);
        } finally {
            setLoadingHistory(false);
        }
    };
```

- [ ] **Step 3: Call fetchAlertHistory in useEffect**

Find:

```tsx
    useEffect(() => {
        fetchNotifications();
        fetchPendingTasks();
        fetchPendingBookings();
    }, []);
```

Replace with:

```tsx
    useEffect(() => {
        fetchNotifications();
        fetchPendingTasks();
        fetchPendingBookings();
        fetchAlertHistory();
    }, []);
```

- [ ] **Step 4: Add tab toggle UI and History tab content**

In `frontend/app/user/alerts/page.tsx`, find the page header section:

```tsx
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Control Alerts</h1>
                    <p className="text-slate-600 text-sm font-black uppercase tracking-widest mt-1">Real-time Infrastructure Monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={clearAll}
                        disabled={notifications.length === 0}
                        className="bg-[#064e3b] hover:bg-emerald-950 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/10"
                    >
                        Clear All Alerts
                    </button>
                </div>
            </div>
```

Replace with:

```tsx
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Control Alerts</h1>
                    <p className="text-slate-600 text-sm font-black uppercase tracking-widest mt-1">Real-time Infrastructure Monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === "active" && (
                        <button
                            onClick={clearAll}
                            disabled={notifications.length === 0}
                            className="bg-[#064e3b] hover:bg-emerald-950 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/10"
                        >
                            Clear All Alerts
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Toggle */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab("active")}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "active" ? "bg-white text-[#064e3b] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                    Active
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${activeTab === "history" ? "bg-white text-[#064e3b] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                    History
                    {alertHistory.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[8px]">{alertHistory.length}</span>
                    )}
                </button>
            </div>
```

- [ ] **Step 5: Wrap existing content in activeTab === "active" and add history tab**

Find the closing `</div>` of the `<div className="space-y-8 animate-fade-in pb-12">` wrapper. Everything between the tab toggle and the end should be wrapped.

Locate the final `</div>` that closes `<div className="space-y-8 animate-fade-in pb-12">` and add the History tab content before it. Add this block right before the closing `</div>` of the page wrapper:

```tsx
            {/* ── Alert History Tab ── */}
            {activeTab === "history" && (
                <div className="space-y-3">
                    {loadingHistory ? (
                        <div className="py-16 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-[#064e3b] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : alertHistory.length === 0 ? (
                        <div className="py-16 flex flex-col items-center text-center gap-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No alert history yet</p>
                        </div>
                    ) : (
                        alertHistory.map(task => {
                            const statusBg: Record<string, string> = {
                                Completed: "bg-emerald-50 border-emerald-100",
                                Expired:   "bg-slate-50 border-slate-200",
                                Cancelled: "bg-rose-50 border-rose-100",
                            };
                            const statusText: Record<string, string> = {
                                Completed: "text-emerald-700",
                                Expired:   "text-slate-400",
                                Cancelled: "text-rose-500",
                            };
                            return (
                                <div
                                    key={task.id}
                                    className={`border rounded-2xl p-4 space-y-1.5 ${statusBg[task.status] ?? "bg-slate-50 border-slate-100"}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${statusBg[task.status] ?? ""} ${statusText[task.status] ?? "text-slate-400"}`}>
                                                {task.status}
                                            </span>
                                            <h4 className="text-xs font-black text-slate-600 uppercase tracking-tight">{task.title}</h4>
                                        </div>
                                        {task.booking_id && (
                                            <Link
                                                href={`/user/bookings/${task.booking_id}`}
                                                className="text-[9px] font-black text-[#064e3b] uppercase tracking-widest hover:underline flex-shrink-0"
                                            >
                                                View Booking ↗
                                            </Link>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {task.priority && (
                                            <p className="text-[8px] text-slate-400 font-black uppercase">Priority: {task.priority}</p>
                                        )}
                                        {task.category && (
                                            <p className="text-[8px] text-slate-400 font-black uppercase">Category: {task.category}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
```

Also wrap all the existing sections (notifications, pending assignments, pending bookings) inside `{activeTab === "active" && (...)}`. Find the first section after the tab toggle (the `{!loadingTasks && pendingTasks.length > 0 && (` block) and wrap everything until just before the History tab content in:

```tsx
            {activeTab === "active" && (
                <div className="space-y-8">
                    {/* ... all existing active content ... */}
                </div>
            )}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/user/alerts/page.tsx
git commit -m "feat: add Active/History tab toggle to alerts page"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Alert creation with category field → Task 4 (dashboard form)
- [x] warning_sent / final_sent / overdue_sent fields → Task 1 + 2
- [x] Scheduler fires notifications 2 days before, on due date, overdue → Task 3
- [x] Auto-expire after 7 days overdue → Task 3 (`scheduler.py`)
- [x] PATCH /maintenance/{id} for Mark Done / Dismiss → Task 2
- [x] Find Servicer → converts task to routine then routes to /user/routine → Task 4
- [x] Active Bookings summary on dashboard → Task 4
- [x] Alert History tab on /user/alerts → Task 5
- [x] source_type / source_id on ServiceBooking → Task 1 + 2
- [x] Existing booking system untouched — booking endpoints, booking page, booking detail all unchanged

**No placeholders:** All code blocks are complete.

**Type consistency:** `MaintenanceTaskUpdate` defined in Task 2 Step 3 and used in Task 2 Step 4. `TaskResponse` fields match model fields added in Task 2 Step 1.

# Servicer Dashboard & Profile System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the servicer dashboard with a clean read-only profile card, move certificate management to Settings > Profile with real file upload, fix fetch error states, and add backend support for titled certificate uploads.

**Architecture:** Backend gains a `title` column on `service_certificates`, a multipart file-upload endpoint, and a delete endpoint. The dashboard profile section becomes read-only (no editing). All editing and certificate management moves to `/service/settings/profile` as two always-visible stacked sections.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Alembic (backend), Next.js 14 App Router + Tailwind CSS + lucide-react (frontend)

---

## File Map

| File | Action |
|------|--------|
| `backend/alembic/versions/04_04_2026_add_title_to_service_certificates.py` | CREATE — migration adding `title` column |
| `backend/app/internal/models.py` | MODIFY — add `title` to `ServiceCertificate` |
| `backend/app/internal/schemas.py` | MODIFY — add `title` to `CertificateBase` |
| `backend/app/api/service/endpoint.py` | MODIFY — add upload + delete cert endpoints |
| `frontend/app/service/dashboard/page.tsx` | MODIFY — replace profile block + certs block with read-only card |
| `frontend/app/service/jobs/page.tsx` | MODIFY — add visible fetch error state |
| `frontend/app/service/ratings/page.tsx` | MODIFY — add visible fetch error state |
| `frontend/app/service/settings/profile/page.tsx` | MODIFY — full edit form + certificate management |

---

## Task 1: Migration — add `title` to `service_certificates`

**Files:**
- Create: `backend/alembic/versions/04_04_2026_add_title_to_service_certificates.py`

- [ ] **Step 1: Create the migration file**

```python
# backend/alembic/versions/04_04_2026_add_title_to_service_certificates.py
"""add_title_to_service_certificates

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('service_certificates', sa.Column('title', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('service_certificates', 'title')
```

- [ ] **Step 2: Run the migration**

```bash
cd backend
alembic upgrade head
```

Expected output: `Running upgrade c3d4e5f6a7b8 -> d4e5f6a7b8c9, add_title_to_service_certificates`

- [ ] **Step 3: Verify column exists**

```bash
alembic current
```

Expected: `d4e5f6a7b8c9 (head)`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/04_04_2026_add_title_to_service_certificates.py
git commit -m "feat: add title column to service_certificates migration"
```

---

## Task 2: Model — add `title` field to `ServiceCertificate`

**Files:**
- Modify: `backend/app/internal/models.py`

- [ ] **Step 1: Open `backend/app/internal/models.py` and locate the `ServiceCertificate` class (around line 117). It currently looks like:**

```python
class ServiceCertificate(Base):
    __tablename__ = "service_certificates"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("service_providers.id"))
    category = Column(String)
    certificate_url = Column(String)
    is_verified = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", back_populates="certificates")
```

- [ ] **Step 2: Add `title` column after `category`**

Replace the class body so it reads:

```python
class ServiceCertificate(Base):
    __tablename__ = "service_certificates"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("service_providers.id"))
    category = Column(String)
    title = Column(String, nullable=True)
    certificate_url = Column(String)
    is_verified = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    provider = relationship("ServiceProvider", back_populates="certificates")
```

- [ ] **Step 3: Verify the backend starts without error**

```bash
cd backend
python -c "from app.internal.models import ServiceCertificate; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/internal/models.py
git commit -m "feat: add title field to ServiceCertificate model"
```

---

## Task 3: Schema — add `title` to certificate schemas

**Files:**
- Modify: `backend/app/internal/schemas.py`

- [ ] **Step 1: Locate `CertificateBase` in `backend/app/internal/schemas.py` (around line 145). It currently reads:**

```python
class CertificateBase(BaseModel):
    category: str
    certificate_url: str
    is_verified: bool = False
```

- [ ] **Step 2: Add `title` field and make `certificate_url` optional (since the upload endpoint generates the URL server-side)**

```python
class CertificateBase(BaseModel):
    category: str
    title: Optional[str] = None
    certificate_url: str
    is_verified: bool = False
```

- [ ] **Step 3: Verify `CertificateCreate` and `CertificateResponse` still work (they inherit from `CertificateBase` and need no changes)**

`CertificateCreate` inherits `title` automatically.  
`CertificateResponse` already has `id` and `uploaded_at`.

- [ ] **Step 4: Check `Optional` is imported at the top of schemas.py**

```bash
grep "from typing import" backend/app/internal/schemas.py | head -3
```

`Optional` should already be imported. If not, add it to the existing import line.

- [ ] **Step 5: Commit**

```bash
git add backend/app/internal/schemas.py
git commit -m "feat: add title field to CertificateBase schema"
```

---

## Task 4: Backend — certificate file-upload endpoint

**Files:**
- Modify: `backend/app/api/service/endpoint.py`

- [ ] **Step 1: Ensure upload directory constant exists at the top of the file. Check lines 21-22, you will see:**

```python
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "profile_photos")
```

Add a new constant immediately after it:

```python
CERT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "certificates")
```

Also add `os.makedirs(CERT_UPLOAD_DIR, exist_ok=True)` right after the constant so the directory is auto-created:

```python
CERT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "certificates")
os.makedirs(CERT_UPLOAD_DIR, exist_ok=True)
```

- [ ] **Step 2: Add the `Form` import to the fastapi import line. Locate:**

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
```

Replace with:

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
```

- [ ] **Step 3: Add the file-upload endpoint after the existing `upload_certificate` function (after line ~361). Insert:**

```python
@router.post("/providers/certificates/upload", response_model=CertificateResponse)
async def upload_certificate_file(
    file: UploadFile = File(...),
    category: str = Form(...),
    title: str = Form(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found. Complete your profile setup first.")

    allowed_types = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, and PNG files are allowed.")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size must not exceed 5MB.")

    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(CERT_UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    cert_url = f"/uploads/certificates/{filename}"
    db_cert = ServiceCertificate(
        provider_id=provider.id,
        category=category,
        title=title,
        certificate_url=cert_url,
        is_verified=False,
    )
    db.add(db_cert)
    db.commit()
    db.refresh(db_cert)
    return db_cert
```

- [ ] **Step 4: Verify the endpoint is importable**

```bash
cd backend
python -c "from app.api.service.endpoint import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/service/endpoint.py
git commit -m "feat: add certificate file-upload endpoint POST /providers/certificates/upload"
```

---

## Task 5: Backend — certificate delete endpoint

**Files:**
- Modify: `backend/app/api/service/endpoint.py`

- [ ] **Step 1: Add the delete endpoint immediately after the file-upload endpoint from Task 4:**

```python
@router.delete("/providers/certificates/{cert_id}")
def delete_certificate(
    cert_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found.")

    cert = db.query(ServiceCertificate).filter(ServiceCertificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    if cert.provider_id != provider.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this certificate.")

    db.delete(cert)
    db.commit()
    return {"message": "Certificate deleted successfully."}
```

- [ ] **Step 2: Verify import again**

```bash
python -c "from app.api.service.endpoint import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Manually test both new endpoints via the FastAPI docs**

Start the backend: `uvicorn app.main:app --reload --port 8000`  
Open `http://localhost:8000/api/v1/docs`  
Verify these routes appear:
- `POST /api/v1/services/providers/certificates/upload`
- `DELETE /api/v1/services/providers/certificates/{cert_id}`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/service/endpoint.py
git commit -m "feat: add DELETE /providers/certificates/{cert_id} endpoint"
```

---

## Task 6: Frontend — fix visible fetch error states (jobs + ratings pages)

**Files:**
- Modify: `frontend/app/service/jobs/page.tsx`
- Modify: `frontend/app/service/ratings/page.tsx`

### jobs/page.tsx

- [ ] **Step 1: Open `frontend/app/service/jobs/page.tsx`. Find the state declarations (around line 43) and add an `error` state:**

```typescript
const [fetchError, setFetchError] = useState<string | null>(null);
```

- [ ] **Step 2: In the `fetchJobs` function (around line 64), replace the catch block:**

Current:
```typescript
    } catch (err: any) {
        // Provider profile not yet created — silently show empty state
        if (err?.message?.toLowerCase().includes("provider profile not found") ||
            err?.message?.toLowerCase().includes("not found")) {
            setBookings([]);
        } else {
            console.error("Failed to fetch jobs", err);
        }
    } finally {
```

Replace with:
```typescript
    } catch (err: any) {
        if (err?.message?.toLowerCase().includes("provider profile not found") ||
            err?.message?.toLowerCase().includes("not found")) {
            setBookings([]);
        } else if (err instanceof TypeError || err?.message?.toLowerCase().includes("failed to fetch") || err?.message?.toLowerCase().includes("timed out")) {
            setFetchError("Could not connect to the server. Please ensure the backend is running.");
        } else {
            console.error("Failed to fetch jobs", err);
        }
    } finally {
```

- [ ] **Step 3: Add the error banner at the top of the return JSX (just inside the outermost `<div>`). Find the first `<div>` in the return statement and add immediately after it:**

```tsx
{fetchError && (
    <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
        <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
    </div>
)}
```

### ratings/page.tsx

- [ ] **Step 4: Open `frontend/app/service/ratings/page.tsx`. Add `fetchError` state near the top of the component:**

```typescript
const [fetchError, setFetchError] = useState<string | null>(null);
```

- [ ] **Step 5: In the `fetchData` function (inside `useEffect`, around line 52), the current catch block is:**

```typescript
            } catch (err) {
                console.error("Failed to fetch ratings data", err);
            } finally {
```

Replace with:
```typescript
            } catch (err: any) {
                if (err instanceof TypeError || err?.message?.toLowerCase().includes("failed to fetch") || err?.message?.toLowerCase().includes("timed out")) {
                    setFetchError("Could not connect to the server. Please ensure the backend is running.");
                } else {
                    console.error("Failed to fetch ratings data", err);
                }
            } finally {
```

- [ ] **Step 6: Add the error banner at the top of the return JSX in ratings page (just inside the outermost `<div>`):**

```tsx
{fetchError && (
    <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
        <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
    </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/service/jobs/page.tsx frontend/app/service/ratings/page.tsx
git commit -m "fix: add visible error state for fetch failures on jobs and ratings pages"
```

---

## Task 7: Frontend — dashboard read-only profile card

**Files:**
- Modify: `frontend/app/service/dashboard/page.tsx`

The goal is to:
1. Remove all edit-profile state variables and the edit modal
2. Remove the "Your Certificates" section (it moves to Settings > Profile)  
3. Replace the "My Profile" block with a clean read-only card
4. Add an "incomplete profile" amber banner when key fields are missing
5. Add fetch error state for the dashboard's own fetch failure

- [ ] **Step 1: Replace the entire file content with the following. Read the current file first to verify the structure matches what is described, then write this replacement:**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Briefcase, Clock, Star, TrendingUp, CheckCircle2,
    ChevronRight, MapPin, DollarSign, Calendar, GraduationCap,
    ShieldCheck, Building2, Phone, AlertTriangle, User
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";

export default function ServicerDashboard() {
    const router = useRouter();
    const [jobs, setJobs] = useState([]);
    const [profile, setProfile] = useState<any>(null);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [filterStatus, setFilterStatus] = useState("ACTIVE");
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            let myProfile = await apiFetch("/services/providers/me").catch(() => null);
            if (myProfile && typeof myProfile.categories === "string") {
                try { myProfile.categories = JSON.parse(myProfile.categories); }
                catch { myProfile.categories = []; }
            }
            const jobsData = await apiFetch("/bookings/list").catch(() => []);
            const invitesData = await apiFetch("/services/societies/requests/me").catch(() => []);
            setProfile(myProfile);
            setJobs(jobsData || []);
            setInvitations(invitesData || []);
        } catch (err: any) {
            if (err instanceof TypeError || err?.message?.toLowerCase().includes("failed to fetch") || err?.message?.toLowerCase().includes("timed out")) {
                setFetchError("Could not connect to the server. Please ensure the backend is running.");
            } else {
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleInviteResponse = async (id: number, status: string) => {
        try {
            await apiFetch(`/services/societies/requests/${id}/action`, {
                method: "POST",
                body: JSON.stringify({ status })
            });
            fetchData();
        } catch {
            alert("Failed to respond to invitation");
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        setUpdatingStatus(true);
        try {
            await apiFetch("/services/providers/availability", {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });
            setProfile({ ...profile, availability_status: newStatus });
        } catch {
            alert("Failed to update status");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const filteredJobs = jobs.filter((j: any) => {
        if (filterStatus === "ALL") return true;
        if (filterStatus === "ACTIVE") return j.status !== "Completed" && j.status !== "Cancelled";
        return j.status === filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase();
    });

    const isProfileIncomplete = !profile || !profile.first_name || !profile.categories?.length || !profile.hourly_rate;

    if (loading) return null;

    return (
        <div className="space-y-8 animate-fade-in pb-12">

            {/* Fetch error */}
            {fetchError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">My Dashboard</h1>
                    <p className="text-slate-600 text-xs font-black uppercase tracking-[0.2em] mt-1">
                        {profile?.first_name ? `Welcome back, ${profile.first_name}` : "Welcome to your dashboard"}
                    </p>
                </div>
                <select
                    value={profile?.availability_status || "AVAILABLE"}
                    disabled={updatingStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase border transition-all outline-none cursor-pointer tracking-[0.15em] ${
                        profile?.availability_status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        profile?.availability_status === "WORKING"   ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                                        "bg-rose-50 text-rose-700 border-rose-100"
                    }`}
                >
                    <option value="AVAILABLE">🟢 Available</option>
                    <option value="WORKING">🟡 On a Job</option>
                    <option value="VACATION">🔴 Vacation</option>
                </select>
            </div>

            {/* Society Invitations */}
            {invitations.length > 0 && (
                <div className="bg-white border-l-4 border-l-[#064e3b] border border-slate-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-right-4">
                    <div className="flex items-center gap-3 mb-6">
                        <Building2 className="w-5 h-5 text-[#064e3b]" />
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Society Invitations</h2>
                        <span className="bg-emerald-50 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full">{invitations.length} New</span>
                    </div>
                    <div className="space-y-4">
                        {invitations.map((invite) => (
                            <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 gap-4">
                                <div>
                                    <h4 className="font-bold text-[#000000] text-sm">Join a Trusted Network</h4>
                                    <p className="text-[11px] text-slate-500 mt-1 italic">&quot;{invite.message}&quot;</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleInviteResponse(invite.id, "REJECTED")} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-[10px] font-black uppercase transition-all">Decline</button>
                                    <button onClick={() => handleInviteResponse(invite.id, "ACCEPTED")} className="px-4 py-2 bg-[#064e3b] text-white hover:bg-emerald-950 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg shadow-[#064e3b]/10">Accept Invite</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-50 text-[#064e3b] rounded-2xl flex items-center justify-center"><Briefcase className="w-6 h-6" /></div>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">{jobs.length}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Active Jobs</p>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><DollarSign className="w-6 h-6" /></div>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Week 12</span>
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">₹{jobs.filter((j: any) => j.status === "Completed").reduce((sum: number, j: any) => sum + (j.estimated_cost || 0), 0).toFixed(2)}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Total Earnings</p>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center"><Star className="w-6 h-6" /></div>
                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Top Rated</p>
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">{profile?.rating?.toFixed(2) || "0.00"}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Your Rating</p>
                </div>
            </div>

            {/* Read-Only Profile Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
                <div className="relative z-10">

                    {/* Incomplete profile banner */}
                    {isProfileIncomplete && (
                        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Your profile is incomplete — fill in your details to start receiving jobs.</p>
                            </div>
                            <Link href="/service/settings/profile" className="flex-shrink-0 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-amber-700 transition-all">
                                Complete Profile →
                            </Link>
                        </div>
                    )}

                    {/* Profile header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-[#000000] uppercase tracking-tight">My Profile</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Your professional information</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {profile?.is_verified ? (
                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-emerald-100 shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" /> Verified
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 bg-slate-50 text-slate-400 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-slate-100 italic">
                                    Not Yet Verified
                                </div>
                            )}
                            <Link href="/service/settings/profile" className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                                Edit Profile <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                    {/* Profile body — two columns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {/* Left: photo + bio */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="flex items-start gap-5">
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100 flex items-center justify-center">
                                    {profile?.profile_photo_url ? (
                                        <Image
                                            src={profile.profile_photo_url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${profile.profile_photo_url}` : profile.profile_photo_url}
                                            alt="Profile"
                                            width={64}
                                            height={64}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-7 h-7 text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-lg font-black text-[#000000] uppercase tracking-tight">
                                        {profile?.first_name && profile?.last_name
                                            ? `${profile.first_name} ${profile.last_name}`
                                            : profile?.owner_name || "No name set"}
                                    </p>
                                    {profile?.location && (
                                        <p className="text-xs font-black text-slate-500 flex items-center gap-1 mt-1">
                                            <MapPin className="w-3 h-3" /> {profile.location}
                                        </p>
                                    )}
                                    {profile?.phone && (
                                        <p className="text-xs font-black text-slate-500 flex items-center gap-1 mt-1">
                                            <Phone className="w-3 h-3" /> {profile.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">About You</p>
                                <p className="text-base font-bold text-slate-800 leading-[1.6]">
                                    {profile?.bio || "No bio added yet. Tell customers about your skills and experience."}
                                </p>
                            </div>

                            {profile?.categories && profile.categories.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Services Offered</p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.categories.map((cat: string) => (
                                            <span key={cat} className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide">{cat}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: credentials */}
                        <div className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                    <GraduationCap className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Education</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{profile?.education || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Experience</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{profile?.experience_years || 0} Years</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Certificates</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{profile?.certificates?.length || 0} Uploaded</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Rate</p>
                                <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter">₹{profile?.hourly_rate || 0}.00 <span className="text-[10px] text-slate-400">/ HR</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Job History */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[40vh] flex flex-col">
                <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#064e3b]" />
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Job History</h2>
                    </div>
                    <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                        {["ACTIVE", "COMPLETED", "CANCELLED", "ALL"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    filterStatus === status
                                        ? "bg-[#064e3b] text-white shadow-lg shadow-emerald-900/10"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredJobs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-[#000000] tracking-tight">No Results</h3>
                        <p className="text-slate-600 text-xs font-bold uppercase tracking-widest mt-2">No jobs match the selected filter.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filteredJobs.map((job: any) => (
                            <div key={job.id} className="px-10 py-8 hover:bg-slate-50/80 transition-all cursor-pointer group flex items-center justify-between">
                                <div className="flex items-center gap-8">
                                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-[#064e3b] transition-colors">
                                        <Briefcase className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <h4 className="text-lg font-black text-[#000000] tracking-tight group-hover:text-[#064e3b] transition-colors uppercase">{job.service_type || job.title} Service</h4>
                                        <div className="flex items-center gap-5 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {job.property_details || "No location"}</span>
                                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : job.due_date || "No date"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden md:block">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1 leading-none">Estimate</p>
                                        <p className="text-sm font-black text-[#000000] uppercase">₹{job.estimated_cost?.toFixed(2) || "0.00"}</p>
                                    </div>
                                    <ChevronRight className="w-6 h-6 text-slate-100 group-hover:text-slate-900 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify the page compiles (run `npm run build` or check dev server)**

Start dev server if not running: `cd frontend && npm run dev`  
Navigate to `http://localhost:3000/service/dashboard` — should render without console errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/service/dashboard/page.tsx
git commit -m "feat: replace dashboard profile editing block with clean read-only profile card"
```

---

## Task 8: Frontend — Settings > Profile page overhaul

**Files:**
- Modify: `frontend/app/service/settings/profile/page.tsx`

This replaces the entire existing page with two sections: full edit form + certificate management.

- [ ] **Step 1: Replace the entire file with the following:**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
    User, Shield, CheckCircle2, AlertCircle, Briefcase,
    Phone, MapPin, GraduationCap, DollarSign, Upload,
    Trash2, FileText, Plus, X, Camera, ChevronDown
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

const ALLOWED_CATEGORIES = [
    "AC Service",
    "Appliance Repair",
    "Home Cleaning",
    "Plumbing",
    "Electrical",
    "Pest Control",
    "Painting",
    "Carpentry",
    "General Maintenance",
];

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5";
const inputCls = "w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-semibold text-sm";
const readonlyCls = "w-full bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-slate-500 cursor-not-allowed font-semibold text-sm";

export default function ServicerProfilePage() {
    // Account state
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [savingAccount, setSavingAccount] = useState(false);
    const [accountSuccess, setAccountSuccess] = useState(false);
    const [accountError, setAccountError] = useState("");

    // Provider profile state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [bio, setBio] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [hourlyRate, setHourlyRate] = useState<number | "">("");
    const [experienceYears, setExperienceYears] = useState<number | "">("");
    const [education, setEducation] = useState("");
    const [location, setLocation] = useState("");
    const [age, setAge] = useState<number | "">("");
    const [gender, setGender] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState("");
    const [photoUrl, setPhotoUrl] = useState("");
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [profileError, setProfileError] = useState("");

    // Certificate state
    const [certificates, setCertificates] = useState<any[]>([]);
    const [showCertForm, setShowCertForm] = useState(false);
    const [certCategory, setCertCategory] = useState("");
    const [certTitle, setCertTitle] = useState("");
    const [certFile, setCertFile] = useState<File | null>(null);
    const [uploadingCert, setUploadingCert] = useState(false);
    const [certError, setCertError] = useState("");
    const certFileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiFetch("/user/me").catch(() => null),
            apiFetch("/services/providers/me").catch(async () => {
                // Profile doesn't exist yet — create a minimal one
                try {
                    return await apiFetch("/services/providers/setup", {
                        method: "POST",
                        body: JSON.stringify({}),
                    });
                } catch {
                    return null;
                }
            }),
        ]).then(([me, prov]) => {
            if (me) {
                setUsername(me.username || "");
                setEmail(me.email || "");
            }
            if (prov) {
                setFirstName(prov.first_name || "");
                setLastName(prov.last_name || "");
                setPhone(prov.phone || "");
                setBio(prov.bio || "");
                const cats = Array.isArray(prov.categories) ? prov.categories :
                    (typeof prov.categories === "string" ? JSON.parse(prov.categories || "[]") : []);
                setSelectedCategories(cats);
                setHourlyRate(prov.hourly_rate || "");
                setExperienceYears(prov.experience_years || "");
                setEducation(prov.education || "");
                setLocation(prov.location || "");
                setAge(prov.age || "");
                setGender(prov.gender || "");
                setPhotoUrl(prov.profile_photo_url || "");
                setCertificates(prov.certificates || []);
            }
        }).finally(() => setLoading(false));
    }, []);

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setProfileError("Only JPEG, PNG, or WebP images are allowed for profile photo.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setProfileError("Profile photo must be under 5MB.");
            return;
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const isProfileValid = firstName.trim() && lastName.trim() && phone.trim() && bio.trim() && selectedCategories.length > 0 && hourlyRate !== "" && Number(hourlyRate) > 0;

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingAccount(true); setAccountError(""); setAccountSuccess(false);
        try {
            await apiFetch("/user/me", { method: "PATCH", body: JSON.stringify({ username }) });
            setAccountSuccess(true);
            setTimeout(() => setAccountSuccess(false), 3000);
        } catch (err: any) {
            setAccountError(err.message || "Failed to update account");
        } finally {
            setSavingAccount(false);
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isProfileValid) return;
        setSavingProfile(true); setProfileError(""); setProfileSuccess(false);
        try {
            let finalPhotoUrl = photoUrl;
            if (photoFile) {
                const fd = new FormData();
                fd.append("file", photoFile);
                const uploadRes = await apiFetch("/services/providers/upload-photo", { method: "POST", body: fd });
                finalPhotoUrl = uploadRes.url;
                setPhotoUrl(finalPhotoUrl);
                setPhotoFile(null);
                setPhotoPreview("");
            }
            await apiFetch("/services/providers/me", {
                method: "PATCH",
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    bio,
                    categories: selectedCategories,
                    hourly_rate: Number(hourlyRate),
                    experience_years: experienceYears !== "" ? Number(experienceYears) : undefined,
                    education: education || undefined,
                    location: location || undefined,
                    age: age !== "" ? Number(age) : undefined,
                    gender: gender || undefined,
                    profile_photo_url: finalPhotoUrl || undefined,
                }),
            });
            setProfileSuccess(true);
            setTimeout(() => setProfileSuccess(false), 3000);
        } catch (err: any) {
            setProfileError(err.message || "Failed to update profile");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCertFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowed = ["application/pdf", "image/jpeg", "image/png"];
        if (!allowed.includes(file.type)) {
            setCertError("Only PDF, JPEG, or PNG files are allowed.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setCertError("Certificate file must be under 5MB.");
            return;
        }
        setCertFile(file);
        setCertError("");
    };

    const handleUploadCert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!certFile || !certCategory || !certTitle.trim()) return;
        setUploadingCert(true); setCertError("");
        try {
            const fd = new FormData();
            fd.append("file", certFile);
            fd.append("category", certCategory);
            fd.append("title", certTitle.trim());
            const newCert = await apiFetch("/services/providers/certificates/upload", { method: "POST", body: fd });
            setCertificates(prev => [...prev, newCert]);
            setShowCertForm(false);
            setCertCategory(""); setCertTitle(""); setCertFile(null);
            if (certFileInputRef.current) certFileInputRef.current.value = "";
        } catch (err: any) {
            setCertError(err.message || "Failed to upload certificate");
        } finally {
            setUploadingCert(false);
        }
    };

    const handleDeleteCert = async (certId: number) => {
        if (!confirm("Delete this certificate?")) return;
        try {
            await apiFetch(`/services/providers/certificates/${certId}`, { method: "DELETE" });
            setCertificates(prev => prev.filter(c => c.id !== certId));
        } catch (err: any) {
            alert(err.message || "Failed to delete certificate");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#064e3b] border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto animate-fade-in py-8 space-y-6">

            {/* ── Account Details ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 rounded-xl"><User className="w-4 h-4 text-emerald-700" /></div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Account Details</h2>
                </div>
                <form onSubmit={handleSaveAccount} className="space-y-4">
                    {accountSuccess && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs font-black uppercase tracking-widest">Saved successfully</span>
                        </div>
                    )}
                    {accountError && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            <span className="text-xs font-semibold">{accountError}</span>
                        </div>
                    )}
                    <div>
                        <label className={labelCls}>Display Name</label>
                        <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} required />
                    </div>
                    <div>
                        <label className={labelCls}>Email Address</label>
                        <input className={readonlyCls} value={email} readOnly />
                    </div>
                    <div>
                        <label className={labelCls}>Role</label>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <Briefcase className="w-3 h-3" /> SERVICER
                        </span>
                    </div>
                    <button type="submit" disabled={savingAccount} className="w-full bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-xs">
                        {savingAccount ? "Saving..." : "Save Account"}
                    </button>
                </form>
            </div>

            {/* ── My Profile ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 rounded-xl"><Shield className="w-4 h-4 text-slate-600" /></div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">My Profile</h2>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-5">
                    {profileSuccess && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs font-black uppercase tracking-widest">Profile updated successfully</span>
                        </div>
                    )}
                    {profileError && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            <span className="text-xs font-semibold">{profileError}</span>
                        </div>
                    )}

                    {/* Photo */}
                    <div>
                        <label className={labelCls}>Profile Photo</label>
                        <div className="flex items-center gap-4">
                            <div
                                onClick={() => photoInputRef.current?.click()}
                                className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:border-[#064e3b] transition-all flex-shrink-0"
                            >
                                {photoPreview ? (
                                    <Image src={photoPreview} alt="Preview" width={64} height={64} className="w-full h-full object-cover" />
                                ) : photoUrl ? (
                                    <Image src={photoUrl.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${photoUrl}` : photoUrl} alt="Current" width={64} height={64} className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-5 h-5 text-slate-300" />
                                )}
                            </div>
                            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} className="hidden" />
                            <button type="button" onClick={() => photoInputRef.current?.click()} className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline">
                                {photoFile ? photoFile.name : "Choose Photo"}
                            </button>
                        </div>
                    </div>

                    {/* Name row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>First Name <span className="text-rose-500">*</span></label>
                            <input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ravi" required />
                        </div>
                        <div>
                            <label className={labelCls}>Last Name <span className="text-rose-500">*</span></label>
                            <input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Kumar" required />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className={labelCls}>Phone <span className="text-rose-500">*</span></label>
                        <input className={inputCls} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className={labelCls}>Bio <span className="text-rose-500">*</span></label>
                        <textarea
                            className={`${inputCls} resize-none`}
                            rows={3}
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="Tell customers about your skills and experience..."
                            required
                        />
                    </div>

                    {/* Categories */}
                    <div>
                        <label className={labelCls}>Service Categories <span className="text-rose-500">*</span></label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {ALLOWED_CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => toggleCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${
                                        selectedCategories.includes(cat)
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {selectedCategories.length === 0 && (
                            <p className="text-[10px] text-rose-500 mt-1 font-semibold">Select at least one category</p>
                        )}
                    </div>

                    {/* Rate */}
                    <div>
                        <label className={labelCls}>Hourly Rate (₹) <span className="text-rose-500">*</span></label>
                        <input className={inputCls} type="number" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value === "" ? "" : Number(e.target.value))} placeholder="500" required />
                    </div>

                    {/* Optional fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Experience (Years)</label>
                            <input className={inputCls} type="number" min="0" value={experienceYears} onChange={e => setExperienceYears(e.target.value === "" ? "" : Number(e.target.value))} placeholder="3" />
                        </div>
                        <div>
                            <label className={labelCls}>Age</label>
                            <input className={inputCls} type="number" min="18" max="80" value={age} onChange={e => setAge(e.target.value === "" ? "" : Number(e.target.value))} placeholder="28" />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Education / Qualification</label>
                        <input className={inputCls} value={education} onChange={e => setEducation(e.target.value)} placeholder="e.g. ITI Electrician, BE Mechatronics" />
                    </div>

                    <div>
                        <label className={labelCls}>Location</label>
                        <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai, Maharashtra" />
                    </div>

                    <div>
                        <label className={labelCls}>Gender</label>
                        <select className={inputCls} value={gender} onChange={e => setGender(e.target.value)}>
                            <option value="">Prefer not to say</option>
                            {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={savingProfile || !isProfileValid}
                        className="w-full bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 uppercase tracking-widest text-xs"
                    >
                        {savingProfile ? "Saving..." : "Save Profile"}
                    </button>
                </form>
            </div>

            {/* ── Your Certificates ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl"><FileText className="w-4 h-4 text-blue-600" /></div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Your Certificates</h2>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Upload qualifications to get verified</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setShowCertForm(v => !v); setCertError(""); }}
                        className="flex items-center gap-1.5 bg-[#064e3b] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-emerald-950 transition-all"
                    >
                        {showCertForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {showCertForm ? "Cancel" : "Upload Certificate"}
                    </button>
                </div>

                {/* Upload form */}
                {showCertForm && (
                    <form onSubmit={handleUploadCert} className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-5 space-y-4">
                        {certError && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                <span className="text-xs font-semibold">{certError}</span>
                            </div>
                        )}
                        <div>
                            <label className={labelCls}>Category <span className="text-rose-500">*</span></label>
                            <select
                                className={inputCls}
                                value={certCategory}
                                onChange={e => setCertCategory(e.target.value)}
                                required
                            >
                                <option value="">Select a category</option>
                                {ALLOWED_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Certificate Title <span className="text-rose-500">*</span></label>
                            <input
                                className={inputCls}
                                value={certTitle}
                                onChange={e => setCertTitle(e.target.value)}
                                placeholder="e.g. Electrician Safety Certificate"
                                required
                            />
                        </div>
                        <div>
                            <label className={labelCls}>File (PDF, JPG, PNG — max 5MB) <span className="text-rose-500">*</span></label>
                            <div
                                onClick={() => certFileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#064e3b] transition-all"
                            >
                                {certFile ? (
                                    <p className="text-sm font-black text-slate-700">{certFile.name}</p>
                                ) : (
                                    <>
                                        <Upload className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Click to select file</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={certFileInputRef}
                                type="file"
                                accept="application/pdf,image/jpeg,image/png"
                                onChange={handleCertFileSelect}
                                className="hidden"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={uploadingCert || !certFile || !certCategory || !certTitle.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 uppercase tracking-widest text-xs"
                        >
                            {uploadingCert ? "Uploading..." : "Upload Certificate"}
                        </button>
                    </form>
                )}

                {/* Certificate list */}
                {certificates.length === 0 ? (
                    <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                            <FileText className="w-5 h-5 text-slate-300" />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No certificates uploaded yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">Upload your qualifications to get verified</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {certificates.map((cert: any) => (
                            <div key={cert.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl group hover:border-blue-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{cert.title || "Certificate"}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase tracking-wide">{cert.category}</span>
                                            {cert.is_verified ? (
                                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Verified</span>
                                            ) : (
                                                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Under Review</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {cert.certificate_url && (
                                        <a
                                            href={cert.certificate_url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${cert.certificate_url}` : cert.certificate_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                        >
                                            View
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleDeleteCert(cert.id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                        title="Delete certificate"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify the page compiles**

Navigate to `http://localhost:3000/service/settings/profile`  
Should render three sections: Account Details, My Profile, Your Certificates.  
Fill in mandatory fields (First Name, Last Name, Phone, Bio, at least one Category, Rate) → Save Profile button should become enabled.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/service/settings/profile/page.tsx
git commit -m "feat: overhaul settings/profile — full edit form with mandatory fields + certificate management"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Register a new servicer account and log in**

- Go to `http://localhost:3000/login`, log in as a SERVICER role user  
- Should land on `/service/dashboard`

- [ ] **Step 3: Verify dashboard shows incomplete profile banner**

- Dashboard should show amber "Your profile is incomplete" banner  
- Profile card should show "No name set", no categories, ₹0.00/HR  
- No edit modal, no certificates section on dashboard  
- Job History section should be present

- [ ] **Step 4: Navigate to Settings > Profile and fill in the form**

- Go to `/service/settings/profile`  
- Fill in: First Name, Last Name, Phone, Bio, select 2 categories, set Rate  
- Save Profile → green "Profile updated successfully" banner appears  
- Refresh page → form re-loads with the saved values

- [ ] **Step 5: Verify dashboard profile card reflects the saved data**

- Go back to `/service/dashboard`  
- Profile card now shows the name, bio, categories, rate  
- Incomplete profile banner is gone

- [ ] **Step 6: Upload a certificate**

- Go to `/service/settings/profile`, scroll to "Your Certificates"  
- Click "Upload Certificate" → inline form opens  
- Select category, enter title, pick a PDF or image file  
- Click "Upload Certificate" → cert appears in list below  
- "View" link opens the file. "Delete" button removes it.

- [ ] **Step 7: Verify error state**

- Stop the backend server  
- Reload `/service/dashboard` — amber "Could not connect to the server" banner should appear  
- Same on `/service/jobs` and `/service/ratings`

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: servicer dashboard profile system — complete implementation"
```

---

## Summary of Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/user/me` | Load account details |
| PATCH | `/api/v1/user/me` | Save username |
| GET | `/api/v1/services/providers/me` | Load provider profile + certs |
| POST | `/api/v1/services/providers/setup` | Create profile if not exists |
| PATCH | `/api/v1/services/providers/me` | Save provider profile |
| POST | `/api/v1/services/providers/upload-photo` | Upload profile photo |
| POST | `/api/v1/services/providers/certificates/upload` | Upload cert file (NEW) |
| DELETE | `/api/v1/services/providers/certificates/{id}` | Delete cert (NEW) |
| GET | `/api/v1/bookings/list` | Dashboard job history |
| GET | `/api/v1/services/societies/requests/me` | Dashboard invitations |
| PATCH | `/api/v1/services/providers/availability` | Availability toggle |

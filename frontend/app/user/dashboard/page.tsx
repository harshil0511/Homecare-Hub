"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    ShieldCheck,
    ShieldAlert,
    Clock,
    LayoutDashboard,
    AlertCircle,
    ChevronRight,
    Zap,
    X,
    ArrowRight,
    ClipboardList,
    Bell,
    Search,
    Calendar,
    AlarmClock,
    Timer,
    CalendarClock,
    Siren,
    CalendarCheck,
    CircleCheck,
    CircleX,
    Pencil,
    Save,
    Loader2,
} from "lucide-react";
import { apiFetch, emergencyApi, EmergencyRequestRead } from "@/lib/api";
import { page, card, stat, btn, form, modal, iconBox } from "@/lib/ui";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserAlert {
    id: string;
    title: string;
    description?: string;
    due_date: string;
    due_time?: string;
    status: string;
    warning_sent: boolean;
    final_sent: boolean;
    created_at: string;
    completed_at?: string;
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
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SERVICE_CATEGORIES = [
    "AC Service", "Appliance Repair", "Home Cleaning", "Plumbing",
    "Electrical", "Pest Control", "Painting", "Carpentry", "General Maintenance",
];

const BLANK = { service_type: "", description: "", due_date: "", due_time: "" };

type DisplayStatus = "Active" | "Upcoming" | "Due Today" | "Overdue" | "Completed" | "Cancelled" | "Expired";

const STATUS_CFG: Record<DisplayStatus, { label: string; badge: string; icon: React.ElementType }> = {
    Active:      { label: "Active",    badge: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: AlarmClock },
    Upcoming:    { label: "Upcoming",  badge: "bg-amber-50 text-amber-700 border-amber-100",       icon: CalendarClock },
    "Due Today": { label: "Due Today", badge: "bg-rose-50 text-rose-700 border-rose-100",           icon: Siren },
    Overdue:     { label: "Overdue",   badge: "bg-red-50 text-red-700 border-red-100",              icon: Siren },
    Completed:   { label: "Completed", badge: "bg-slate-50 text-slate-500 border-slate-100",        icon: CalendarCheck },
    Cancelled:   { label: "Cancelled", badge: "bg-slate-50 text-slate-400 border-slate-100",        icon: CircleX },
    Expired:     { label: "Expired",   badge: "bg-slate-50 text-slate-400 border-slate-100",        icon: CircleX },
};

// ── Utility helpers ───────────────────────────────────────────────────────────

function getDisplayStatus(alert: UserAlert): DisplayStatus {
    if (alert.status === "Completed") return "Completed";
    if (alert.status === "Cancelled") return "Cancelled";
    if (alert.status === "Expired")   return "Expired";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date(alert.due_date); due.setHours(0, 0, 0, 0);
    const diff  = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diff < 0)  return "Overdue";
    if (diff === 0) return "Due Today";
    if (diff <= 2)  return "Upcoming";
    return "Active";
}

function getCountdown(dueDate: string, dueTime: string | null | undefined, now: Date): string {
    const target = new Date(dueDate);
    if (dueTime) {
        const [h, m] = dueTime.split(":");
        target.setHours(parseInt(h), parseInt(m), 0, 0);
    } else {
        target.setHours(23, 59, 59, 999);
    }
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return "Now";
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    if (days > 0)  return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function canMarkDone(dueDate: string): boolean {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
    return due <= today;
}

function formatDueDate(dueDate: string, dueTime?: string): string {
    const d = new Date(dueDate);
    const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    if (!dueTime) return dateStr;
    const [h, m] = dueTime.split(":");
    const hh = parseInt(h), ampm = hh >= 12 ? "PM" : "AM";
    return `${dateStr} · ${hh % 12 || 12}:${m} ${ampm}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, iconColor, iconBg }: StatCardProps) => (
    <div className={stat.tile}>
        <div className={`${stat.icon} ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
            <h3 className={stat.value}>{value}</h3>
            <p className={stat.label}>{title}</p>
        </div>
    </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [userAlerts, setUserAlerts]         = useState<UserAlert[]>([]);
    const [bookings, setBookings]             = useState<ActiveBooking[]>([]);
    const [loading, setLoading]               = useState(true);
    const [activeEmergency, setActiveEmergency] = useState<EmergencyRequestRead | null>(null);

    // Create Reminder modal
    const [showTaskModal, setShowTaskModal]   = useState(false);
    const [newTask, setNewTask]               = useState(BLANK);
    const [taskSaving, setTaskSaving]         = useState(false);

    // Inline edit
    const [editId, setEditId]                 = useState<string | null>(null);
    const [editForm, setEditForm]             = useState(BLANK);
    const [editSaving, setEditSaving]         = useState(false);

    // Action loading (mark done / cancel)
    const [actionLoading, setActionLoading]   = useState<string | null>(null);

    // Live countdown
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(id);
    }, []);

    // ── Fetchers ──────────────────────────────────────────────────────────────

    const fetchAlerts = useCallback(async () => {
        try { setUserAlerts(await apiFetch("/maintenance/alerts/")); }
        catch { /* silent */ }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [alertsRes, bookingsRes] = await Promise.allSettled([
                apiFetch("/maintenance/alerts/"),
                apiFetch("/bookings/list"),
            ]);
            if (alertsRes.status === "fulfilled")  setUserAlerts(alertsRes.value ?? []);
            if (bookingsRes.status === "fulfilled") setBookings(bookingsRes.value ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        emergencyApi.getActive()
            .then(em => setActiveEmergency(em))
            .catch(() => setActiveEmergency(null));
    }, [fetchData]);

    // ── Create Reminder ───────────────────────────────────────────────────────

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setTaskSaving(true);
        try {
            await apiFetch("/maintenance/alerts/", {
                method: "POST",
                body: JSON.stringify({
                    service_type: newTask.service_type,
                    description:  newTask.description || null,
                    due_date:     newTask.due_date,
                    due_time:     newTask.due_time || null,
                }),
            });
            setShowTaskModal(false);
            setNewTask(BLANK);
            fetchAlerts();
        } catch (err) {
            alert((err as Error).message || "Failed to create reminder");
        } finally {
            setTaskSaving(false);
        }
    };

    // ── Inline edit ───────────────────────────────────────────────────────────

    const openEdit = (alert: UserAlert) => {
        setEditId(alert.id);
        setEditForm({
            service_type: alert.title,
            description:  alert.description || "",
            due_date:     alert.due_date,
            due_time:     alert.due_time ? alert.due_time.slice(0, 5) : "",
        });
    };

    const cancelEdit = () => { setEditId(null); setEditForm(BLANK); };

    const handleEditSave = async () => {
        if (!editId || !editForm.service_type || !editForm.due_date) return;
        setEditSaving(true);
        try {
            await apiFetch(`/maintenance/alerts/${editId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    service_type: editForm.service_type,
                    description:  editForm.description || null,
                    due_date:     editForm.due_date,
                    due_time:     editForm.due_time || null,
                }),
            });
            cancelEdit();
            fetchAlerts();
        } catch { /* silent */ }
        finally { setEditSaving(false); }
    };

    // ── Mark Done / Cancel ────────────────────────────────────────────────────

    const handleMarkDone = async (alert: UserAlert) => {
        setActionLoading(alert.id + "_done");
        try {
            await apiFetch(`/maintenance/alerts/${alert.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "Completed" }),
            });
            fetchAlerts();
        } catch { /* silent */ }
        finally { setActionLoading(null); }
    };

    const handleCancel = async (alert: UserAlert) => {
        if (!confirm(`Cancel the "${alert.title}" reminder?`)) return;
        setActionLoading(alert.id + "_cancel");
        try {
            await apiFetch(`/maintenance/alerts/${alert.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "Cancelled" }),
            });
            fetchAlerts();
        } catch { /* silent */ }
        finally { setActionLoading(null); }
    };

    // ── Derived state ─────────────────────────────────────────────────────────

    const activeBookings = bookings.filter(b =>
        b.status === "Accepted" || b.status === "In Progress"
    );

    const activeCount  = userAlerts.filter(a => !["Completed","Cancelled","Expired"].includes(getDisplayStatus(a))).length;
    const overdueCount = userAlerts.filter(a => getDisplayStatus(a) === "Overdue").length;
    const dueSoonCount = userAlerts.filter(a => { const s = getDisplayStatus(a); return s === "Due Today" || s === "Upcoming"; }).length;

    // Sort: Overdue → Due Today → Upcoming → Active, then by due_date asc
    const sortedAlerts = [...userAlerts].sort((a, b) => {
        const order: Record<string, number> = { Overdue: 0, "Due Today": 1, Upcoming: 2, Active: 3, Completed: 4, Cancelled: 5, Expired: 6 };
        const oa = order[getDisplayStatus(a)] ?? 7;
        const ob = order[getDisplayStatus(b)] ?? 7;
        if (oa !== ob) return oa - ob;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    // ── JSX ───────────────────────────────────────────────────────────────────

    return (
        <div className={page.wrapper}>
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
                        <AlarmClock className="w-3.5 h-3.5" />
                        Create Reminder
                    </button>
                </div>
            </div>

            {/* Active Emergency Banner */}
            {activeEmergency && (
                <Link
                    href="/user/bookings/emergency"
                    className="flex items-center justify-between bg-rose-600 text-white rounded-2xl px-5 py-4 shadow-lg shadow-rose-600/25 hover:bg-rose-700 transition-all animate-in fade-in duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">SOS Active — {activeEmergency.category}</p>
                            <p className="text-[10px] text-rose-200 mt-0.5">Waiting for expert response · Tap to view</p>
                        </div>
                    </div>
                    <ShieldAlert size={20} className="shrink-0" />
                </Link>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Active Reminders" value={activeCount}       icon={Bell}        iconBg="bg-emerald-50" iconColor="text-emerald-700" />
                <StatCard title="Overdue"           value={overdueCount}     icon={AlertCircle} iconBg="bg-rose-50"    iconColor="text-rose-600"   />
                <StatCard title="Due Soon"          value={dueSoonCount}     icon={Clock}       iconBg="bg-amber-50"   iconColor="text-amber-600"  />
                <StatCard title="Active Bookings"   value={activeBookings.length} icon={ClipboardList} iconBg="bg-slate-100" iconColor="text-slate-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* ── My Reminders ── */}
                <div className="lg:col-span-3">
                    <div className={`${card.base} overflow-hidden`}>
                        {/* Panel header */}
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">
                                <AlarmClock className="w-3.5 h-3.5 text-[#064e3b]" />
                                My Reminders
                                {activeCount > 0 && (
                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[8px] font-black">
                                        {activeCount} active
                                    </span>
                                )}
                                {overdueCount > 0 && (
                                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[8px] font-black">
                                        {overdueCount} overdue
                                    </span>
                                )}
                            </h2>
                            <Link href="/user/alerts" className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-[#064e3b] transition-colors">
                                All Reminders ↗
                            </Link>
                        </div>

                        {/* List */}
                        {loading ? (
                            <Spinner />
                        ) : sortedAlerts.length === 0 ? (
                            <div className="p-8">
                                <EmptyState
                                    icon={AlarmClock}
                                    title="No Reminders Yet"
                                    action={{ label: "Create First Reminder", onClick: () => setShowTaskModal(true) }}
                                />
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                                {sortedAlerts.map(alert => {
                                    const ds        = getDisplayStatus(alert);
                                    const cfg       = STATUS_CFG[ds];
                                    const StatusIcon = cfg.icon;
                                    const isActive  = !["Completed", "Cancelled", "Expired"].includes(ds);
                                    const isDone    = actionLoading === alert.id + "_done";
                                    const isCxl     = actionLoading === alert.id + "_cancel";
                                    const doneOk    = canMarkDone(alert.due_date);
                                    const isEditing = editId === alert.id;

                                    return (
                                        <div key={alert.id}>
                                            {/* Normal row */}
                                            {!isEditing && (
                                                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-all">
                                                    {/* Status icon */}
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                                                        ds === "Due Today" || ds === "Overdue" ? "bg-rose-50 border-rose-100" :
                                                        ds === "Upcoming"                      ? "bg-amber-50 border-amber-100" :
                                                        ds === "Active"                        ? "bg-emerald-50 border-emerald-100" :
                                                        "bg-slate-50 border-slate-100"
                                                    }`}>
                                                        <StatusIcon className={`w-3.5 h-3.5 ${
                                                            ds === "Due Today" || ds === "Overdue" ? "text-rose-500" :
                                                            ds === "Upcoming"                      ? "text-amber-500" :
                                                            ds === "Active"                        ? "text-emerald-600" :
                                                            "text-slate-400"
                                                        }`} />
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                            <p className="text-xs font-black text-slate-800 tracking-tight">{alert.title}</p>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${cfg.badge}`}>
                                                                {cfg.label}
                                                            </span>
                                                        </div>
                                                        {alert.description && (
                                                            <p className="text-[10px] text-slate-400 font-medium truncate">{alert.description}</p>
                                                        )}
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                                                            <CalendarClock className="w-3 h-3" />
                                                            {formatDueDate(alert.due_date, alert.due_time)}
                                                        </p>
                                                    </div>

                                                    {/* Live countdown pill */}
                                                    {isActive && (
                                                        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border flex-shrink-0 ${
                                                            ds === "Due Today" || ds === "Overdue" ? "bg-rose-50 border-rose-100" :
                                                            ds === "Upcoming"                      ? "bg-amber-50 border-amber-100" :
                                                            "bg-emerald-50 border-emerald-100"
                                                        }`}>
                                                            <Timer className={`w-3 h-3 ${
                                                                ds === "Due Today" || ds === "Overdue" ? "text-rose-500" :
                                                                ds === "Upcoming"                      ? "text-amber-500" :
                                                                "text-emerald-600"
                                                            }`} />
                                                            <span className={`text-[9px] font-black uppercase tracking-widest tabular-nums ${
                                                                ds === "Due Today" || ds === "Overdue" ? "text-rose-700" :
                                                                ds === "Upcoming"                      ? "text-amber-700" :
                                                                "text-emerald-700"
                                                            }`}>
                                                                {ds === "Overdue"   ? "Overdue" :
                                                                 ds === "Due Today" ? getCountdown(alert.due_date, alert.due_time, now) :
                                                                 getCountdown(alert.due_date, alert.due_time, now)}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        {isActive && (
                                                            <>
                                                                <button
                                                                    onClick={() => openEdit(alert)}
                                                                    title="Edit"
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => doneOk && handleMarkDone(alert)}
                                                                    disabled={!doneOk || isDone}
                                                                    title={doneOk ? "Mark done" : "Available on or after target date"}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                                                                        doneOk
                                                                            ? "text-emerald-600 hover:bg-emerald-50"
                                                                            : "text-slate-200 cursor-not-allowed"
                                                                    }`}
                                                                >
                                                                    {isDone
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <CircleCheck className="w-3 h-3" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCancel(alert)}
                                                                    disabled={isCxl}
                                                                    title="Cancel reminder"
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                                                >
                                                                    {isCxl
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <CircleX className="w-3 h-3" />}
                                                                </button>
                                                            </>
                                                        )}
                                                        {ds === "Completed" && (
                                                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 uppercase tracking-widest">Done</span>
                                                        )}
                                                        {(ds === "Cancelled" || ds === "Expired") && (
                                                            <span className="text-[8px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 uppercase tracking-widest">{cfg.label}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Inline edit row */}
                                            {isEditing && (
                                                <div className="px-5 py-4 bg-amber-50/40 border-l-4 border-amber-400">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                                                        <div>
                                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Service Type</label>
                                                            <select
                                                                value={editForm.service_type}
                                                                onChange={e => setEditForm(f => ({ ...f, service_type: e.target.value }))}
                                                                className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                                                            >
                                                                {SERVICE_CATEGORIES.map(cat => (
                                                                    <option key={cat} value={cat}>{cat}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                                                            <input
                                                                type="text"
                                                                value={editForm.description}
                                                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                                className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Target Date</label>
                                                            <input
                                                                type="date"
                                                                value={editForm.due_date}
                                                                onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                                                                className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                                                            />
                                                        </div>
                                                        <div className="flex gap-2 items-end">
                                                            <div className="flex-1">
                                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Time</label>
                                                                <input
                                                                    type="time"
                                                                    value={editForm.due_time}
                                                                    onChange={e => setEditForm(f => ({ ...f, due_time: e.target.value }))}
                                                                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={handleEditSave}
                                                                disabled={editSaving}
                                                                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                                                            >
                                                                {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-all flex-shrink-0"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Footer link */}
                        {sortedAlerts.length > 0 && (
                            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                                <Link href="/user/alerts" className="text-[9px] font-black text-[#064e3b] uppercase tracking-widest hover:underline flex items-center gap-1">
                                    Manage all reminders <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        )}
                    </div>
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
                                        ? (b.provider.company_name || `${b.provider.first_name ?? ""} ${b.provider.last_name ?? ""}`.trim() || b.provider.owner_name || "Provider")
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

            {/* Create Reminder Modal */}
            {showTaskModal && createPortal(
                <div className={modal.overlay}>
                    <div className={modal.backdrop} onClick={() => setShowTaskModal(false)} />
                    <div className={modal.box}>
                        <div className={modal.pad}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-[#064e3b] rounded-xl flex items-center justify-center flex-shrink-0">
                                        <AlarmClock className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h2 className={modal.title}>Create Reminder</h2>
                                        <p className={modal.subtitle}>Set a service alert</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowTaskModal(false)} className={btn.icon}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateTask} className="space-y-4">
                                <div className={form.group}>
                                    <label className={form.label}>Service Type *</label>
                                    <select
                                        value={newTask.service_type}
                                        onChange={e => setNewTask({ ...newTask, service_type: e.target.value })}
                                        className={form.select}
                                        required
                                    >
                                        <option value="">Select a service...</option>
                                        {SERVICE_CATEGORIES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={form.group}>
                                    <label className={form.label}>Description (Optional)</label>
                                    <input
                                        placeholder="e.g. Annual AC filter cleaning..."
                                        value={newTask.description}
                                        onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                                        className={form.input}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className={form.group}>
                                        <label className={form.label}>Target Date *</label>
                                        <input
                                            type="date"
                                            min={new Date().toISOString().split("T")[0]}
                                            value={newTask.due_date}
                                            onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                                            className={form.input}
                                            required
                                        />
                                    </div>
                                    <div className={form.group}>
                                        <label className={form.label}>Time (Optional)</label>
                                        <input
                                            type="time"
                                            value={newTask.due_time}
                                            onChange={e => setNewTask({ ...newTask, due_time: e.target.value })}
                                            className={form.input}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={taskSaving}
                                    className={`w-full justify-center ${btn.primary}`}
                                >
                                    {taskSaving
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <AlarmClock className="w-4 h-4" />
                                    }
                                    {taskSaving ? "Saving..." : "Set Reminder"}
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

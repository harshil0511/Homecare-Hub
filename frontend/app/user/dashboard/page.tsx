"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
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
            if (task.task_type !== "routine") {
                await apiFetch(`/maintenance/${task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ task_type: "routine" })
                });
            }
            setFindingServicer(null);
            router.push(`/user/routine?taskId=${task.id}`);
        } catch (err) {
            console.error("Failed to start find servicer flow", err);
            setFindingServicer(null);
        }
    };

    const activeAlerts = tasks.filter(t =>
        ["Pending", "Active", "Triggered", "Overdue", "Assigned"].includes(t.status)
    ).sort((taskA, taskB) => {
        const order: Record<string, number> = { Overdue: 0, Triggered: 1, Assigned: 2, Active: 3, Pending: 4 };
        const oa = order[taskA.status] ?? 5;
        const ob = order[taskB.status] ?? 5;
        if (oa !== ob) return oa - ob;
        const da = taskA.due_date ? new Date(taskA.due_date).getTime() : Infinity;
        const db2 = taskB.due_date ? new Date(taskB.due_date).getTime() : Infinity;
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

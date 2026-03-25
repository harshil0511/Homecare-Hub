"use client";

import { useEffect, useState } from "react";
import { Bell, AlertCircle, ShieldAlert, CheckCircle2, Clock, MoreHorizontal, Search, Loader2, Wrench, ArrowRight, CalendarClock, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Notification {
    id: number;
    title: string;
    message: string;
    notification_type: string;
    is_read: boolean;
    created_at: string;
    link?: string;
}

interface PendingTask {
    id: number;
    title: string;
    category: string | null;
    location: string | null;
    priority: string;
    status: string;
    booking_id: number | null;
    created_at: string | null;
}

const PRIORITY_BADGE: Record<string, string> = {
    Routine: "bg-slate-100 text-slate-500",
    Mandatory: "bg-amber-50 text-amber-700",
    Urgent: "bg-red-50 text-red-700",
};

export default function AlertsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const toggleExpand = (id: number) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const fetchNotifications = async () => {
        try {
            const data = await apiFetch("/notifications/");
            setNotifications(data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        } finally {
            setLoading(false);
        }
    };

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

    useEffect(() => {
        fetchNotifications();
        fetchPendingTasks();
    }, []);

    const clearAll = async () => {
        if (!confirm("Are you sure you want to clear all notifications?")) return;
        try {
            await Promise.all(notifications.map(n =>
                apiFetch(`/notifications/${n.id}`, { method: "DELETE" })
            ));
            setNotifications([]);
        } catch (err) {
            console.error("Failed to clear notifications", err);
            fetchNotifications();
        }
    };

    const deleteOne = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await apiFetch(`/notifications/${id}`, { method: "DELETE" });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error("Failed to delete notification", err);
        }
    };

    const timeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInMins = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diffInMins < 1) return "Just now";
        if (diffInMins < 60) return `${diffInMins}m ago`;
        const diffInHours = Math.floor(diffInMins / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return date.toLocaleDateString();
    };

    const filteredNotifications = notifications.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-fade-in pb-12">
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

            {/* ── Pending Assignments Section ── */}
            {!loadingTasks && pendingTasks.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <CalendarClock className="w-4 h-4 text-amber-500" />
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em]">
                            Pending Assignments — Awaiting Expert
                        </h2>
                        <span className="ml-auto text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            {pendingTasks.length} open
                        </span>
                    </div>

                    <div className="bg-white border border-amber-100 rounded-[1.75rem] overflow-hidden shadow-sm">
                        <div className="divide-y divide-amber-50">
                            {pendingTasks.map((task) => (
                                <Link
                                    key={task.id}
                                    href={`/dashboard/routine?taskId=${task.id}`}
                                    className="flex items-center gap-5 px-7 py-5 hover:bg-amber-50/60 transition-all group"
                                >
                                    {/* Icon */}
                                    <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                                        <Wrench className="w-5 h-5 text-amber-600" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-sm font-black text-[#000000] truncate tracking-tight group-hover:text-[#064e3b] transition-colors">
                                                {task.title}
                                            </p>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest flex-shrink-0 ${PRIORITY_BADGE[task.priority] || "bg-slate-100 text-slate-500"}`}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {task.category || "General"}
                                            {task.location && <> &bull; {task.location}</>}
                                            {task.created_at && <> &bull; {timeAgo(task.created_at)}</>}
                                        </p>
                                    </div>

                                    {/* CTA */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg uppercase tracking-widest group-hover:bg-[#064e3b] group-hover:text-white group-hover:border-[#064e3b] transition-all">
                                            Assign Expert
                                        </span>
                                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#064e3b] group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Active Incident Log ── */}
            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden min-h-[40vh] flex flex-col">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        Active Incident Log
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            className="bg-white border border-slate-200 rounded-lg py-1.5 pl-9 pr-3 text-[10px] font-black uppercase w-48 outline-none focus:ring-1 focus:ring-emerald-500 text-[#000000]"
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Secure Records...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="p-20 text-center">
                            <Bell className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active alerts detected</p>
                        </div>
                    ) : (
                        filteredNotifications.map((alert) => {
                            const isOpen = expandedId === alert.id;
                            return (
                                <div key={alert.id} className={`transition-all ${alert.is_read ? "opacity-60" : ""}`}>
                                    {/* ── Accordion Header (always visible) ── */}
                                    <button
                                        onClick={() => toggleExpand(alert.id)}
                                        className="w-full flex items-center gap-4 px-7 py-5 hover:bg-slate-50/80 transition-all group text-left"
                                    >
                                        {/* Type indicator dot */}
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                            alert.notification_type === "URGENT" ? "bg-rose-500" :
                                            alert.notification_type === "WARNING" ? "bg-amber-500" :
                                            "bg-emerald-500"
                                        }`} />

                                        {/* Type badge */}
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex-shrink-0 ${
                                            alert.notification_type === "URGENT" ? "bg-rose-100 text-rose-700" :
                                            alert.notification_type === "WARNING" ? "bg-amber-100 text-amber-700" :
                                            "bg-emerald-100 text-emerald-700"
                                        }`}>
                                            {alert.notification_type}
                                        </span>

                                        {/* Title */}
                                        <h3 className="flex-1 text-sm font-black text-[#000000] tracking-tight uppercase truncate group-hover:text-[#064e3b] transition-colors text-left">
                                            {alert.title}
                                        </h3>

                                        {/* Time */}
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 flex-shrink-0">
                                            <Clock className="w-3 h-3" />
                                            {timeAgo(alert.created_at)}
                                        </span>

                                        {/* Chevron */}
                                        <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180 text-[#064e3b]" : ""}`} />
                                    </button>

                                    {/* ── Accordion Body (expanded content) ── */}
                                    {isOpen && (
                                        <div className="px-7 pb-5 pt-1 bg-slate-50/60 border-t border-slate-100 animate-fade-in">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                    alert.notification_type === "URGENT" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                                                    alert.notification_type === "WARNING" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                                    "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                }`}>
                                                    <AlertCircle className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 space-y-3">
                                                    <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                                        {alert.message}
                                                    </p>
                                                    <div className="flex items-center gap-3">
                                                        {alert.link && (
                                                            <Link
                                                                href={alert.link}
                                                                className="text-[10px] font-black text-emerald-700 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                                                            >
                                                                View Trace →
                                                            </Link>
                                                        )}
                                                        <button
                                                            onClick={(e) => deleteOne(alert.id, e)}
                                                            className="text-[10px] font-black text-slate-400 px-4 py-2 bg-white border border-slate-200 rounded-lg uppercase tracking-widest hover:text-rose-600 hover:border-rose-200 transition-colors"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="mt-auto p-12 text-center border-t border-slate-50 bg-slate-50/30">
                    <CheckCircle2 className="w-10 h-10 text-emerald-100 mx-auto mb-4" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Equilibrium Reached</p>
                </div>
            </div>
        </div>
    );
}

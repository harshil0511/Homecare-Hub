"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    Users,
    ArrowRight,
    Building2,
    Activity,
    ShieldCheck,
    Search,
    Calendar,
    TrendingUp,
    Clock,
    UserPlus,
    LayoutDashboard,
    AlertCircle,
    BadgeCheck,
    ChevronRight,
    Zap,
    Cpu,
    X,
    CheckCircle2,
    ChevronDown,
    Loader2,
    MapPin,
    DollarSign
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface LedgerEntry {
    id: number;
    type: "BOOKING" | "TASK";
    title: string;
    status: string;
    priority?: string;
    date?: string;
    description?: string;
    issue_description?: string;
    category?: string;
    location?: string;
    provider?: { company_name?: string; first_name?: string; last_name?: string; owner_name?: string };
}

interface BookingDetailData {
    id: number;
    service_type: string;
    scheduled_at: string;
    status: string;
    priority: string;
    estimated_cost?: number;
    issue_description?: string;
    property_details?: string;
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
    trend?: string;
    color: string;
    onClick?: () => void;
    isActive?: boolean;
}

const StatCard = ({ title, value, icon: Icon, trend, color, onClick, isActive }: StatCardProps) => (
    <div 
        onClick={onClick}
        className={`bg-white p-8 rounded-[2rem] border transition-all cursor-pointer group flex flex-col justify-between h-48 ${isActive ? 'border-[#064e3b] shadow-lg ring-2 ring-[#064e3b]/5 shadow-emerald-900/10' : 'border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-100 hover:-translate-y-1'}`}
    >
        <div className="flex items-center justify-between">
            <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                <Icon className="w-7 h-7 text-white" />
            </div>
            {trend && (
                <div className="flex items-center space-x-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                    <TrendingUp className="w-3 h-3" />
                    <span>{trend}</span>
                </div>
            )}
        </div>

        <div className="space-y-1 mt-auto">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{value}</h3>
        </div>
    </div>
);

export default function DashboardPage() {
    const [stats, setStats] = useState({
        activeOperations: 0,
        serviceNetwork: 0,
        verifiedExperts: 0,
        priorityTickets: 0
    });
    const [userSociety, setUserSociety] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [trustedProviders, setTrustedProviders] = useState<any[]>([]);
    const [incomingInvites, setIncomingInvites] = useState<any[]>([]);

    // Dynamic Data States
    const [tasks, setTasks] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);

    // UI States
    const [loading, setLoading] = useState(true);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSocietyModal, setShowSocietyModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Form States
    const [newTask, setNewTask] = useState({ title: "", description: "", due_date: "", priority: "Routine" });
    const [newSociety, setNewSociety] = useState({ name: "", address: "", registration_number: "" });
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [creatorRole, setCreatorRole] = useState("OWNER");

    // Inline expandable records in Active Log Alerts
    const [expandedEntryKey, setExpandedEntryKey] = useState<string | null>(null);
    const [expandedDetail, setExpandedDetail] = useState<BookingDetailData | LedgerEntry | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const toggleEntry = async (entry: LedgerEntry) => {
        const key = `${entry.type}-${entry.id}`;
        if (expandedEntryKey === key) {
            setExpandedEntryKey(null);
            setExpandedDetail(null);
            return;
        }
        setExpandedEntryKey(key);
        setExpandedDetail(null);
        if (entry.type === 'BOOKING') {
            setLoadingDetail(true);
            try {
                const detail = await apiFetch(`/bookings/${entry.id}`);
                setExpandedDetail(detail);
            } catch (err) {
                console.error("Failed to fetch booking detail", err);
            } finally {
                setLoadingDetail(false);
            }
        } else {
            setExpandedDetail(entry);
        }
    };

    const fetchData = async () => {
        try {
            const me = await apiFetch("/user/me");
            setUserRole(me.role);

            let userBookings: any[] = [];
            try {
                userBookings = await apiFetch("/bookings/list");
                setBookings(userBookings);
            } catch (e) {
                console.warn("Could not fetch bookings", e);
            }

            let userTasks: any[] = [];
            try {
                // Adjust if a different maintenance endpoint is required
                userTasks = await apiFetch("/maintenance").catch(() => []);
                setTasks(userTasks);
            } catch (e) {
                console.warn("Could not fetch maintenance tasks", e);
            }

            let userNotifs: any[] = [];
            try {
                userNotifs = await apiFetch("/user/notifications").catch(() => apiFetch("/notifications"));
                setNotifications(userNotifs);
            } catch (e) {
                console.warn("Could not fetch notifications", e);
            }

            if (me.society_id) {
                try {
                    const societies = await apiFetch("/services/societies");
                    const mySoc = societies.find((s: any) => s.id === me.society_id);
                    setUserSociety(mySoc);

                    const trusted = await apiFetch(`/services/societies/${me.society_id}/trusted`);
                    setTrustedProviders(trusted);
                } catch (e) {
                    console.warn("Could not fetch society info", e);
                }
            }

            if (me.role === "SERVICER") {
                try {
                    const invites = await apiFetch("/societies/requests/me");
                    setIncomingInvites(invites);
                } catch (e) {
                    console.warn("Could not fetch incoming invites", e);
                }
            }

            setStats({
                activeOperations: userBookings.filter((b: any) => b.status === "In Progress" || b.status === "Accepted").length,
                serviceNetwork: trustedProviders.length, // Re-evaluated below safely
                verifiedExperts: 0,
                priorityTickets: userBookings.filter((b: any) => b.priority === "Emergency").length
            });
        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trustedProviders.length]);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiFetch("/maintenance", {
                method: "POST",
                body: JSON.stringify(newTask)
            });
            setShowTaskModal(false);
            setNewTask({ title: "", description: "", due_date: "", priority: "Routine" });
            fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to create log alert");
        }
    };

    const handleCreateSociety = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiFetch("/services/societies", {
                method: "POST",
                body: JSON.stringify({
                    ...newSociety,
                    creator_role: creatorRole
                })
            });
            setShowSocietyModal(false);
            fetchData();
        } catch (err: any) {
            alert(err.message || "Initialization failed");
        }
    };

    const markNotificationRead = async (id: number) => {
        try {
            await apiFetch(`/notifications/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_read: true })
            });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleInviteAction = async (requestId: number, status: string) => {
        try {
            await apiFetch(`/societies/requests/${requestId}/action`, {
                method: "POST",
                body: JSON.stringify({ status })
            });
            fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to respond to invite");
        }
    };

    const unreadNotifications = notifications.filter(n => !n.is_read).length;

    const ledgerEntries = [
        ...tasks.map(t => ({ ...t, type: 'TASK', date: t.due_date })),
        ...bookings.map(b => ({ ...b, type: 'BOOKING', title: `${b.service_type} Service`, date: b.scheduled_at }))
    ].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
    });

    // Filtered Entries based on activeFilter
    const filteredEntries = ledgerEntries.filter(entry => {
        if (activeFilter === "ALL") return true;
        if (activeFilter === "OPERATIONS") return entry.type === 'BOOKING' && (entry.status === 'Accepted' || entry.status === 'In Progress' || entry.status === 'Completed');
        if (activeFilter === "ALERTS") return entry.type === 'TASK' || (entry.type === 'BOOKING' && entry.status === 'Pending');
        if (activeFilter === "PRIORITY") return entry.priority === 'Emergency' || entry.priority === 'Urgent';
        if (activeFilter === "NETWORK") return !!entry.provider;
        return true;
    });

    const displayEntries = filteredEntries;

    return (
        <div className="space-y-12 animate-fade-in max-w-7xl mx-auto pb-24 relative">
            {/* Header Architecture */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                            <LayoutDashboard className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-[0.8]">Operations Control</h1>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] ml-1">Unified Infrastructure Monitoring & Resource Management</p>
                </div>

                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/bookings/emergency"
                        className="bg-rose-600 text-white px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-rose-900/20 hover:bg-rose-700 transition-all active:scale-95 flex items-center gap-3 border border-rose-500/50"
                    >
                        <Zap className="w-5 h-5 animate-pulse" />
                        Emergency SOS
                    </Link>
                    <button
                        onClick={() => setShowTaskModal(true)}
                        className="bg-[#064e3b] text-white px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-emerald-900/20 hover:bg-emerald-800 transition-all active:scale-95 flex items-center gap-3"
                    >
                        <Zap className="w-5 h-5" />
                        Create Alert
                    </button>
                    
                    <div className="relative ml-2">
                        

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <div className="absolute top-full right-0 mt-4 w-80 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4">
                                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">System Messages</h3>
                                    {unreadNotifications > 0 && (
                                        <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-[8px] font-black uppercase">{unreadNotifications} New</span>
                                    )}
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">No Active Logs</div>
                                    ) : (
                                        notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={() => !notif.is_read && markNotificationRead(notif.id)}
                                                className={`p-6 border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${notif.is_read ? 'opacity-50 hover:bg-slate-50' : 'bg-emerald-50/50 hover:bg-emerald-50'}`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <h4 className={`text-xs font-black uppercase tracking-tight ${notif.is_read ? 'text-slate-600' : 'text-[#064e3b]'}`}>{notif.title}</h4>
                                                    {!notif.is_read && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed mb-3">{notif.message}</p>
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{new Date(notif.created_at).toLocaleDateString()}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Exact Match Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Active Operations"
                    value={bookings.filter((b: any) => b.status === "In Progress" || b.status === "Accepted").length}
                    icon={Activity}
                    trend="+14%"
                    color="bg-emerald-600"
                    onClick={() => setActiveFilter(activeFilter === "OPERATIONS" ? "ALL" : "OPERATIONS")}
                    isActive={activeFilter === "OPERATIONS"}
                />
                <StatCard
                    title="Available Network"
                    value={userSociety ? trustedProviders.length : "0"}
                    icon={Building2}
                    color="bg-slate-900"
                    onClick={() => setActiveFilter(activeFilter === "NETWORK" ? "ALL" : "NETWORK")}
                    isActive={activeFilter === "NETWORK"}
                />
                <StatCard
                    title="Active Alerts"
                    value={tasks.filter(t => t.status !== "Completed").length}
                    icon={ShieldCheck}
                    color="bg-amber-600"
                    onClick={() => setActiveFilter(activeFilter === "ALERTS" ? "ALL" : "ALERTS")}
                    isActive={activeFilter === "ALERTS"}
                />
                <StatCard
                    title="Priority Tickets"
                    value={ledgerEntries.filter(e => e.priority === "Emergency" || e.priority === "Urgent").length}
                    icon={Clock}
                    trend="Stable"
                    color="bg-rose-600"
                    onClick={() => setActiveFilter(activeFilter === "PRIORITY" ? "ALL" : "PRIORITY")}
                    isActive={activeFilter === "PRIORITY"}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Ledger Component */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[2.5rem] p-10 space-y-10 shadow-sm">
                        <div className="flex items-center gap-6">
                            <h2 className="text-sm font-black text-black uppercase tracking-[0.4em] flex items-center gap-3">
                                <Activity className="w-5 h-5 text-[#064e3b]" />
                                Active Log Alerts
                            </h2>
                            <button 
                                onClick={() => setShowFilterModal(true)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${activeFilter !== "ALL" ? 'bg-[#064e3b] text-white border-[#064e3b] shadow-lg shadow-emerald-900/20' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-white hover:text-[#064e3b] hover:border-emerald-100'}`}
                            >
                                <Search className="w-3.5 h-3.5" />
                                {activeFilter === "ALL" ? "Filter Logs" : `Viewing: ${activeFilter}`}
                            </button>
                            <Link href="/dashboard/logs" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#064e3b] transition-colors ml-auto">History ↗</Link>
                        </div>

                    {displayEntries.length === 0 ? (
                        <div className="py-32 flex flex-col items-center text-center gap-4 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                            <p className="text-[10px] font-black text-slate-300 uppercase underline decoration-2 underline-offset-8">
                                {activeFilter === "ALL" ? "No Active Alerts" : `No items matching ${activeFilter}`}
                            </p>
                            {activeFilter !== "ALL" ? (
                                <button onClick={() => setActiveFilter("ALL")} className="text-[9px] font-black text-[#064e3b] uppercase tracking-widest">Clear Filter ←</button>
                            ) : (
                                <button onClick={() => setShowTaskModal(true)} className="text-[9px] font-black text-[#064e3b] uppercase tracking-widest">Initialize First Alert →</button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                            {displayEntries.map((entry, idx) => {
                                const isExpired = entry.type === 'TASK' && entry.date && new Date(entry.date) < new Date();
                                const isUrgent = entry.priority === 'Urgent' || entry.priority === 'Emergency';
                                const statusText = isExpired ? 'MAINTENANCE REQUIRED' : entry.status || 'PENDING';
                                
                                // Color mapping for status
                                const statusColors: { [key: string]: string } = {
                                    'ACCEPTED': 'text-emerald-500',
                                    'PENDING': 'text-amber-500',
                                    'REJECTED': 'text-rose-500',
                                    'MAINTENANCE REQUIRED': 'text-rose-600',
                                    'COMPLETED': 'text-emerald-600'
                                };
                                const statusColor = statusColors[statusText.toUpperCase()] || 'text-slate-400';

                                const entryKey = `${entry.type}-${entry.id}`;
                                const isEntryExpanded = expandedEntryKey === entryKey;

                                return (
                                    <div key={idx} className="rounded-[1.5rem] border overflow-hidden transition-all">
                                        {/* Clickable Row Header */}
                                        <button
                                            onClick={() => toggleEntry(entry)}
                                            className={`w-full flex items-center justify-between p-6 transition-all group cursor-pointer text-left ${isExpired ? 'bg-rose-50/50 border-rose-100 hover:shadow-md' : 'bg-slate-50 hover:bg-white hover:shadow-lg'} ${isEntryExpanded ? 'border-b border-slate-100' : ''}`}
                                        >
                                            <div className="flex items-center gap-8">
                                                <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center shadow-inner relative flex-shrink-0 ${isExpired ? 'bg-rose-500 text-white' : entry.type === 'TASK' ? 'bg-emerald-100 text-emerald-600' : 'bg-[#064e3b] text-white'}`}>
                                                    {isExpired && <div className="absolute inset-0 bg-rose-500 rounded-[1.25rem] animate-ping opacity-20" />}
                                                    {entry.type === 'TASK' ? <Activity className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-4">
                                                        <span className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] ${isExpired ? 'bg-rose-600 text-white' : isUrgent ? 'bg-rose-100 text-rose-600 border border-rose-200' : entry.priority === 'Mandatory' ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                                                            {isExpired ? 'EXPIRED' : entry.priority || 'ROUTINE'}
                                                        </span>
                                                        <h4 className="text-xl font-black text-black uppercase tracking-tighter leading-none">{entry.title}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            {entry.provider ? `Provider: ${entry.provider.company_name}` : 'Self-Managed'}
                                                        </p>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                        <p className="text-[10px] font-bold text-slate-400 max-w-xs truncate">
                                                            {entry.description || entry.issue_description || 'No additional logs provided.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right space-y-2">
                                                    <p className={`text-[11px] font-black uppercase tracking-[0.3em] ${isExpired ? 'text-rose-600' : 'text-slate-400'}`}>
                                                        {entry.date ? new Date(entry.date).toLocaleDateString() : 'No deadline'}
                                                    </p>
                                                    <p className={`text-lg font-black uppercase tracking-tighter ${statusColor}`}>
                                                        {statusText}
                                                    </p>
                                                </div>
                                                <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform duration-200 flex-shrink-0 ${isEntryExpanded ? 'rotate-180 text-[#064e3b]' : ''}`} />
                                            </div>
                                        </button>

                                        {/* Expanded Inline Detail */}
                                        {isEntryExpanded && (
                                            <div className="bg-white px-8 py-6 border-t border-slate-100 animate-fade-in">
                                                {loadingDetail ? (
                                                    <div className="py-6 text-center">
                                                        <Loader2 className="w-5 h-5 text-[#064e3b] animate-spin mx-auto" />
                                                    </div>
                                                ) : expandedDetail ? (
                                                    <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2">
                                                        {entry.type === 'BOOKING' ? (() => {
                                                            const detail = expandedDetail as BookingDetailData;
                                                            return (
                                                            <>
                                                                {/* Booking Detail */}
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded uppercase tracking-widest">{detail.status}</span>
                                                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded uppercase tracking-widest">ID: #{detail.id?.toString().padStart(5, '0')}</span>
                                                                    {detail.priority !== 'Normal' && (
                                                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded uppercase tracking-widest ${detail.priority === 'Emergency' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{detail.priority}</span>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Service</p>
                                                                        <p className="text-sm font-black text-[#000000]">{detail.service_type}</p>
                                                                    </div>
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Schedule</p>
                                                                        <p className="text-sm font-black text-[#000000]">{new Date(detail.scheduled_at).toLocaleDateString()} @ {new Date(detail.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                                    </div>
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost</p>
                                                                        <p className="text-sm font-black text-[#000000]">${detail.estimated_cost?.toFixed(2) || '0.00'}</p>
                                                                    </div>
                                                                    {detail.property_details && (
                                                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                                                                            <p className="text-sm font-black text-[#000000]">{detail.property_details}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {detail.issue_description && (
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</p>
                                                                        <p className="text-xs font-medium text-slate-600 leading-relaxed">{detail.issue_description}</p>
                                                                    </div>
                                                                )}
                                                                {detail.provider && (
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                                                                        <div className="w-8 h-8 bg-[#064e3b] rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                                                                            {(detail.provider.first_name || detail.provider.company_name || '?')[0].toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expert</p>
                                                                            <p className="text-sm font-black text-[#000000]">
                                                                                {detail.provider.first_name && detail.provider.last_name
                                                                                    ? `${detail.provider.first_name} ${detail.provider.last_name}`
                                                                                    : detail.provider.company_name || detail.provider.owner_name}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <Link href={`/dashboard/bookings/${detail.id}`} className="inline-flex items-center gap-2 text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline">
                                                                    Open Full Detail <ArrowRight className="w-3 h-3" />
                                                                </Link>
                                                            </>
                                                            );
                                                        })() : (() => {
                                                            const detail = expandedDetail as LedgerEntry;
                                                            return (
                                                            <>
                                                                {/* Task Detail */}
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {detail.category && (
                                                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                                                                            <p className="text-sm font-black text-[#000000]">{detail.category}</p>
                                                                        </div>
                                                                    )}
                                                                    {detail.location && (
                                                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                                                                            <p className="text-sm font-black text-[#000000]">{detail.location}</p>
                                                                        </div>
                                                                    )}
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority</p>
                                                                        <p className="text-sm font-black text-[#000000]">{detail.priority || 'Routine'}</p>
                                                                    </div>
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                                                        <p className="text-sm font-black text-[#000000]">{detail.status || 'Pending'}</p>
                                                                    </div>
                                                                </div>
                                                                {detail.description && (
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</p>
                                                                        <p className="text-xs font-medium text-slate-600 leading-relaxed">{detail.description}</p>
                                                                    </div>
                                                                )}
                                                                {detail.date && (
                                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
                                                                        <p className="text-sm font-black text-[#000000]">{new Date(detail.date).toLocaleDateString()}</p>
                                                                    </div>
                                                                )}
                                                                <Link href={`/dashboard/routine?taskId=${detail.id}`} className="inline-flex items-center gap-2 text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline">
                                                                    Go to Home Service <ArrowRight className="w-3 h-3" />
                                                                </Link>
                                                            </>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400 py-4">No details available.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Infrastructure Column */}
                <div className="space-y-12">
                    {userRole === 'SERVICER' ? (
                        <div className="bg-white border text-center border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden p-12">
                            <div className="mb-8 flex items-center justify-center gap-3">
                                <Users className="w-6 h-6 text-[#064e3b]" />
                                <h2 className="text-xl font-black text-black uppercase tracking-tighter">Incoming Hub Invitations</h2>
                            </div>
                            <div className="space-y-4">
                                {incomingInvites.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center text-center gap-4 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                        <p className="text-[10px] font-black text-slate-300 uppercase underline decoration-2 underline-offset-8">No Pending Invites</p>
                                    </div>
                                ) : (
                                    incomingInvites.map(invite => (
                                        <div key={invite.id} className="bg-slate-50 border border-slate-200 p-6 rounded-3xl text-left space-y-4 shadow-sm relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#064e3b]" />
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                                    <span>Society Request</span>
                                                    <span>{new Date(invite.created_at).toLocaleDateString()}</span>
                                                </p>
                                                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{invite.message || "Join our Network"}</h4>
                                            </div>
                                            <div className="flex items-center gap-3 pt-2">
                                                <button
                                                    onClick={() => handleInviteAction(invite.id, 'ACCEPTED')}
                                                    className="flex-1 py-3 bg-[#064e3b] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#053e2f] transition-all shadow-md shadow-[#064e3b]/10"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleInviteAction(invite.id, 'REJECTED')}
                                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all hover:text-rose-600 hover:border-rose-200"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden p-10 space-y-8">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                    <BadgeCheck className="w-4 h-4 text-[#064e3b]" />
                                    Your Infrastructure
                                </h2>
                            </div>

                            <div className="space-y-6">
                                {userSociety ? (
                                    <>
                                        {/* Premium Dark Infrastructure Hub (SS3 Style) */}
                                        <div className="bg-[#0B1320] p-8 rounded-[2rem] text-left shadow-2xl relative overflow-hidden group">
                                            {/* Subtle Green Blur Glow */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#064e3b]/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                                            <div className="flex items-start justify-between mb-8 relative z-10">
                                                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                                                    <Building2 className="w-7 h-7 text-emerald-400" />
                                                </div>
                                                <span className="px-4 py-2 bg-[#064e3b] text-white text-[9px] font-black uppercase tracking-[0.4em] rounded-lg border border-emerald-900 shadow-lg shadow-emerald-900/40">
                                                    USER
                                                </span>
                                            </div>

                                            <div className="space-y-1 relative z-10">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3">Active Hub Node</p>
                                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-tight">{userSociety.name}</h3>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4">
                                            <div className="flex items-center justify-between px-2">
                                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Trusted Providers</h4>
                                            </div>

                                            <div className="space-y-3">
                                                {trustedProviders.slice(0, 3).map((p) => (
                                                    <div key={p.id} className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-left hover:bg-white hover:shadow-md transition-all group">
                                                        <div className="w-10 h-10 bg-white shadow-sm rounded-lg flex items-center justify-center border border-slate-50">
                                                            <Users className="w-5 h-5 text-slate-300 group-hover:text-[#064e3b] transition-colors" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-xs font-black text-black uppercase truncate">{p.company_name}</h4>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.category}</p>
                                                        </div>
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                                                    </div>
                                                ))}
                                                {trustedProviders.length === 0 && (
                                                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center py-4">No providers linked</p>
                                                )}
                                            </div>

                                            <Link href="/dashboard/societies" className="block text-center mt-6 text-[9px] font-black text-[#064e3b] uppercase tracking-[0.3em] hover:tracking-[0.4em] transition-all py-2 border-t border-slate-50">
                                                Manage Society Infrastructure →
                                            </Link>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6 py-10 text-center">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Building2 className="w-10 h-10 text-slate-200" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-[200px] mx-auto">Join an organization to build your service network.</p>
                                        <Link
                                            href="/dashboard/societies"
                                            className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] text-center block font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                                        >
                                            Create Society
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {/* Create Task Modal */}
            {showTaskModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setShowTaskModal(false)} />
                    <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
                        <div className="p-12 space-y-10">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">New Log Alert</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Device Maintenance Timer</p>
                                </div>
                                <button onClick={() => setShowTaskModal(false)} className="p-4 bg-slate-50 text-slate-300 rounded-xl hover:text-black transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateTask} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Device Name</label>
                                    <input
                                        placeholder="E.G., WATER PURIFIER, AC UNIT..."
                                        value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:bg-white focus:border-emerald-600 outline-none transition-all shadow-sm"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">End Date (Timer)</label>
                                        <input
                                            type="date"
                                            value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:bg-white focus:border-emerald-600 outline-none transition-all shadow-sm"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Priority</label>
                                        <select
                                            value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-[10px] font-black uppercase tracking-widest focus:bg-white focus:border-emerald-600 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                                        >
                                            <option value="Routine">Routine</option>
                                            <option value="Mandatory">Mandatory</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Notes & Context</label>
                                    <textarea
                                        placeholder="ADDITIONAL DETAILS OR MODEL NUMBERS..."
                                        rows={3}
                                        value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-black uppercase tracking-widest focus:bg-white focus:border-emerald-600 outline-none transition-all shadow-sm resize-none"
                                    />
                                </div>

                                <button type="submit" className="w-full bg-[#064e3b] text-white py-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.5em] shadow-xl shadow-emerald-900/10 hover:bg-[#053e2f] transition-all active:scale-95 flex justify-center items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Initialize Alert
                                </button>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Society Modal (Dashboard Registration) */}
            {showSocietyModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowSocietyModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 sm:p-14 space-y-12">
                            <div className="flex items-start justify-between">
                                <div className="space-y-3">
                                    <h2 className="text-5xl sm:text-6xl font-black text-black tracking-tighter uppercase leading-none">Register society</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Initialize Society Infrastructure</p>
                                </div>
                                <button onClick={() => setShowSocietyModal(false)} className="p-5 bg-slate-50 text-slate-300 rounded-[1.5rem] hover:text-black hover:bg-slate-100 transition-colors">
                                    <X className="w-7 h-7" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSociety} className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-[#8aa0be] uppercase tracking-[0.3em] ml-2">Name</label>
                                        <input
                                            placeholder="HUB_IDENTIFIER..."
                                            value={newSociety.name} onChange={e => setNewSociety({ ...newSociety, name: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] p-6 text-sm font-black uppercase tracking-widest text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition-all"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-[#8aa0be] uppercase tracking-[0.3em] ml-2">Reg ID</label>
                                        <input
                                            placeholder="OPTIONAL_ID..."
                                            value={newSociety.registration_number} onChange={e => setNewSociety({ ...newSociety, registration_number: e.target.value })}
                                            className="w-full bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] p-6 text-sm font-black uppercase tracking-widest text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-[#8aa0be] uppercase tracking-[0.3em] ml-2">Location</label>
                                    <input
                                        placeholder="PHYSICAL_ADDRESS..."
                                        value={newSociety.address} onChange={e => setNewSociety({ ...newSociety, address: e.target.value })}
                                        className="w-full bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] p-6 text-sm font-black uppercase tracking-widest text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition-all"
                                        required
                                    />
                                </div>

                                <div className="bg-white border border-slate-200 p-8 sm:p-10 rounded-[2.5rem] space-y-8">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-2">Authority Assignment</p>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {["OWNER", "SECRETARY"].map(role => (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setCreatorRole(role)}
                                                className={`flex-1 py-6 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.4em] transition-all duration-300 ${creatorRole === role ? 'bg-[#064e3b] text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-black text-white py-8 rounded-[2rem] text-xs font-black uppercase tracking-[0.5em] shadow-xl hover:bg-slate-900 transition-all active:scale-95 duration-300">
                                    Initialize Infrastructure
                                </button>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* Compact Horizontal Filter Pop-up */}
            {showFilterModal && createPortal(
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowFilterModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 border border-slate-200">
                        <div className="p-10 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-black tracking-tight uppercase leading-none">Filter Logs</h2>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Select Category</p>
                                </div>
                                <button onClick={() => setShowFilterModal(false)} className="p-3 bg-slate-50 text-slate-300 rounded-xl hover:text-black transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'ALL', label: 'All Logs', icon: LayoutDashboard, color: 'text-slate-600', bg: 'bg-slate-100' },
                                    { id: 'ALERTS', label: 'House Alerts', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                    { id: 'OPERATIONS', label: 'Bookings', icon: ShieldCheck, color: 'text-[#064e3b]', bg: 'bg-emerald-100' },
                                    { id: 'PRIORITY', label: 'Emergency', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' }
                                ].map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setActiveFilter(cat.id);
                                            setShowFilterModal(false);
                                        }}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group ${activeFilter === cat.id ? 'border-[#064e3b] bg-emerald-50/20' : 'border-slate-50 bg-white hover:border-[#064e3b]/20'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl ${cat.bg} ${cat.color} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                                            <cat.icon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <h4 className={`text-xs font-black uppercase tracking-tight ${activeFilter === cat.id ? 'text-[#064e3b]' : 'text-slate-900 group-hover:text-[#064e3b]'}`}>{cat.label}</h4>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{cat.id === 'ALL' ? 'Unified' : 'Filter view'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

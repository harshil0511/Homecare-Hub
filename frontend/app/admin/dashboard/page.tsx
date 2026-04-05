"use client";

import { useEffect, useState } from "react";
import {
    Users, ShieldCheck, Activity, Search,
    BadgeCheck, Mail,
    Shield, ClipboardList, Wrench,
    BarChart3, Trash2, X, Calendar, User
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUsername } from "@/lib/auth";

interface Stats {
    total_users: number;
    total_servicers: number;
    total_bookings: number;
    total_tasks: number;
    pending_verifications: number;
}

interface User {
    id: number;
    user_uuid: string;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
}

interface AdminContract {
    id: number;
    user_name: string;
    servicer_name: string;
    service_type: string;
    scheduled_at?: string;
    estimated_cost?: number;
    status: string;
    created_at?: string;
}

interface BookingDetail {
    id: number;
    status: string;
    priority: string;
    service_type: string;
    scheduled_at: string | null;
    estimated_cost: number | null;
    issue_description: string | null;
    property_details: string | null;
    user: { username: string; email: string } | null;
    provider: { name: string; category: string; is_verified: boolean } | null;
}

type AdminTab = "overview" | "users" | "contracts";

const ROLE_STYLE: Record<string, string> = {
    ADMIN: "bg-purple-50 text-purple-700 border-purple-100",
    SECRETARY: "bg-amber-50 text-amber-700 border-amber-100",
    SERVICER: "bg-emerald-50 text-emerald-700 border-emerald-100",
    USER: "bg-blue-50 text-blue-700 border-blue-100",
};

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [adminTab, setAdminTab] = useState<AdminTab>("overview");
    const [contracts, setContracts] = useState<AdminContract[]>([]);
    const [contractsLoading, setContractsLoading] = useState(false);
    const [contractStatusFilter, setContractStatusFilter] = useState("ALL");
    const [contractDateFilter, setContractDateFilter] = useState("");
    const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(null);
    const [bookingDetailLoading, setBookingDetailLoading] = useState(false);
    const adminName = getUsername();

    interface HealthStatus { database: boolean; api: boolean; jwt: boolean; checked_at: string | null; }
    const [health, setHealth] = useState<HealthStatus | null>(null);

    useEffect(() => {
        Promise.all([
            apiFetch("/admin/stats"),
            apiFetch("/admin/users"),
        ]).then(([s, u]) => {
            setStats(s);
            setUsers(u || []);
        }).catch(() => {}).finally(() => setLoading(false));

        apiFetch("/admin/health")
            .then((d: HealthStatus) => setHealth(d))
            .catch(() => setHealth({ database: false, api: true, jwt: true, checked_at: null }));

    }, []);

    useEffect(() => {
        if (adminTab === "contracts") {
            setContractsLoading(true);
            apiFetch(`/admin/contracts${contractStatusFilter !== "ALL" ? `?status=${contractStatusFilter}` : ""}`)
                .then((d: AdminContract[]) => setContracts(Array.isArray(d) ? d : []))
                .catch(() => setContracts([]))
                .finally(() => setContractsLoading(false));
        }
    }, [adminTab, contractStatusFilter]);

    const openBookingDetail = async (id: number) => {
        setBookingDetailLoading(true);
        setSelectedBooking(null);
        try {
            const detail = await apiFetch(`/admin/bookings/${id}`);
            setSelectedBooking(detail);
        } catch {
            // silently fail
        } finally {
            setBookingDetailLoading(false);
        }
    };

    const deleteUser = async (uuid: string, username: string) => {
        if (!confirm(`Permanently delete account "${username}"? This cannot be undone.`)) return;
        try {
            await apiFetch(`/admin/users/${uuid}`, { method: "DELETE" });
            setUsers((prev: User[]) => prev.filter((u: User) => u.user_uuid !== uuid));
        } catch (err) {
            console.error("Failed to delete user:", err);
        }
    };

    const statCards = stats ? [
        { label: "Total Users", value: stats.total_users, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Service Providers", value: stats.total_servicers, icon: Wrench, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Total Bookings", value: stats.total_bookings, icon: ClipboardList, color: "text-[#000000]", bg: "bg-slate-50" },
        { label: "Pending Verifications", value: stats.pending_verifications, icon: BadgeCheck, color: "text-amber-600", bg: "bg-amber-50" },
    ] : [];

    const filtered = users.filter((u) =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-10 animate-fade-in pb-16">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-[#000000] rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-black/20">
                        <Shield className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Command Center</h1>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] opacity-60 mt-1">
                            Welcome, {adminName} — System Administration
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-5 py-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-[#000000] uppercase tracking-widest">Backend: Online</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex gap-1 mb-8">
                {([
                    { key: "overview" as AdminTab, label: "Overview", icon: BarChart3 },
                    { key: "users" as AdminTab, label: "Users", icon: Users },
                    { key: "contracts" as AdminTab, label: "Contracts", icon: ClipboardList },
                ]).map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setAdminTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                adminTab === tab.key
                                    ? "bg-[#064e3b] text-white shadow-lg"
                                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Overview Tab */}
            {adminTab === "overview" && (
                <>
                    {/* Stats Grid */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="bg-white border border-slate-200 p-8 rounded-[2rem] animate-pulse h-28" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {statCards.map((stat) => (
                                <div key={stat.label} className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 flex items-center gap-6 group">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${stat.bg}`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-[#000000] tracking-tighter leading-none">{stat.value}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-80">{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}


                    {/* Users + System Health */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">

                        {/* Real User Directory */}
                        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
                            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white">
                                <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                                    <Users className="w-4 h-4 text-[#064e3b]" />
                                    User Registry ({users.length})
                                </h2>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        className="bg-slate-50 border border-slate-100 rounded-xl py-2 pl-12 pr-4 text-xs font-black uppercase tracking-tight focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none w-56 transition-all"
                                        placeholder="Search users..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                {loading ? (
                                    <div className="flex justify-center py-16">
                                        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400">
                                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-semibold text-sm">No users found</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">User</th>
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Role</th>
                                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filtered.slice(0, 8).map((user) => (
                                                <tr key={user.id} className="group hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-10 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-[#064e3b] rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                                                                {user.username?.charAt(0).toUpperCase() || "?"}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-[#000000] uppercase tracking-tight">{user.username}</p>
                                                                <p className="text-[10px] font-black text-slate-400 flex items-center gap-1 mt-0.5">
                                                                    <Mail className="w-3 h-3" /> {user.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-5">
                                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border ${ROLE_STYLE[user.role] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-10 py-5">
                                                        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${user.is_active ? "text-emerald-600" : "text-rose-500"}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                                                            {user.is_active ? "Active" : "Inactive"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* System Health */}
                        <div className="space-y-10">
                            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
                                <h3 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                    <ShieldCheck className="w-4 h-4 text-[#064e3b]" /> System Status
                                </h3>
                                {health === null ? (
                                    <p className="text-xs text-slate-400">Checking...</p>
                                ) : (
                                    <div className="space-y-6">
                                        {[
                                            { label: "Database", ok: health.database },
                                            { label: "API Server", ok: health.api },
                                            { label: "JWT Auth", ok: health.jwt },
                                        ].map(item => (
                                            <div key={item.label} className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                                    <p className="text-sm font-black text-[#000000]">{item.ok ? "Online" : "Offline"}</p>
                                                </div>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase flex items-center gap-1.5 ${item.ok ? "text-emerald-600 bg-emerald-50" : "text-rose-500 bg-rose-50"}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
                                                    {item.ok ? "UP" : "DOWN"}
                                                </span>
                                            </div>
                                        ))}
                                        {health.checked_at && (
                                            <p className="text-[10px] text-slate-300 pt-1">
                                                Checked {new Date(health.checked_at).toLocaleTimeString()}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {stats && (
                                <div className="bg-[#064e3b] rounded-[2.5rem] p-10 text-white shadow-2xl">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-emerald-300">Task Overview</h3>
                                    <p className="text-2xl font-black tracking-tighter">{stats.total_tasks}</p>
                                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-1">Maintenance Tasks</p>
                                    <div className="mt-6 pt-6 border-t border-white/10">
                                        <p className="text-2xl font-black tracking-tighter">{stats.total_bookings}</p>
                                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-1">Total Bookings</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Users Tab */}
            {adminTab === "users" && (
                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white">
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                            <Users className="w-4 h-4 text-[#064e3b]" />
                            User Registry ({users.length})
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <input
                                className="bg-slate-50 border border-slate-100 rounded-xl py-2 pl-12 pr-4 text-xs font-black uppercase tracking-tight focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none w-56 transition-all"
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex justify-center py-16">
                                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="font-semibold text-sm">No users found</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">User</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Role</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((user) => (
                                        <tr key={user.id} className="group hover:bg-slate-50/60 transition-colors">
                                            <td className="px-10 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-[#064e3b] rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                                                        {user.username?.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-[#000000] uppercase tracking-tight">{user.username}</p>
                                                        <p className="text-[10px] font-black text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3 h-3" /> {user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-5">
                                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border ${ROLE_STYLE[user.role] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-10 py-5">
                                                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${user.is_active ? "text-emerald-600" : "text-rose-500"}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                                                    {user.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-10 py-5">
                                                <button
                                                    onClick={() => deleteUser(user.user_uuid, user.username)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Delete user"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Contracts Tab */}
            {adminTab === "contracts" && (
                <div>
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 mb-6 bg-white border border-slate-200 rounded-2xl p-4">
                        <div className="flex gap-2">
                            {["ALL", "Accepted", "In Progress", "Completed", "Cancelled"].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setContractStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                        contractStatusFilter === s
                                            ? "bg-[#064e3b] text-white"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {contractsLoading ? (
                        <div className="text-center py-12 text-slate-400 text-sm">Loading contracts...</div>
                    ) : contracts.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                            <p className="text-slate-400 text-sm">No contracts found</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicer</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contracts.map(c => (
                                        <tr
                                            key={c.id}
                                            onClick={() => openBookingDetail(c.id)}
                                            className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 py-4 text-xs text-slate-400 font-mono">#{c.id}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-700">{c.user_name}</td>
                                            <td className="px-6 py-4 text-xs text-slate-600">{c.servicer_name}</td>
                                            <td className="px-6 py-4 text-xs text-slate-600 max-w-[150px] truncate">{c.service_type}</td>
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-700">
                                                {c.estimated_cost ? `₹${c.estimated_cost.toLocaleString("en-IN")}` : "—"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                                    c.status === "Completed" ? "bg-emerald-50 text-emerald-700"
                                                        : c.status === "Accepted" || c.status === "In Progress" ? "bg-blue-50 text-blue-700"
                                                        : "bg-slate-100 text-slate-500"
                                                }`}>{c.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Booking Detail Modal */}
            {(selectedBooking || bookingDetailLoading) && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedBooking(null)} />
                    <div className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Booking Detail</h2>
                                {selectedBooking && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">#{selectedBooking.id}</p>}
                            </div>
                            <button onClick={() => setSelectedBooking(null)} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {bookingDetailLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : selectedBooking && (
                            <div className="overflow-y-auto flex-1 p-8 space-y-6">
                                {/* Status & Priority */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                                        selectedBooking.status === "Completed" ? "bg-emerald-50 text-emerald-700"
                                        : selectedBooking.status === "Accepted" || selectedBooking.status === "In Progress" ? "bg-blue-50 text-blue-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}>{selectedBooking.status}</span>
                                    {selectedBooking.priority && selectedBooking.priority !== "Normal" && (
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${selectedBooking.priority === "Emergency" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                                            {selectedBooking.priority}
                                        </span>
                                    )}
                                </div>

                                {/* Core Fields */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Service</p>
                                        <p className="text-sm font-black text-[#000000]">{selectedBooking.service_type}</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost</p>
                                        <p className="text-sm font-black text-[#000000]">
                                            {selectedBooking.estimated_cost ? `₹${selectedBooking.estimated_cost.toLocaleString("en-IN")}` : "—"}
                                        </p>
                                    </div>
                                    {selectedBooking.scheduled_at && (
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 col-span-2 flex items-center gap-3">
                                            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Scheduled</p>
                                                <p className="text-sm font-black text-[#000000]">
                                                    {new Date(selectedBooking.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                                                    {" @ "}
                                                    {new Date(selectedBooking.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* User */}
                                {selectedBooking.user && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                                        <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Customer</p>
                                            <p className="text-sm font-black text-[#000000]">{selectedBooking.user.username}</p>
                                            <p className="text-[10px] text-slate-500">{selectedBooking.user.email}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Provider */}
                                {selectedBooking.provider && (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                                        <Wrench className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Provider</p>
                                            <p className="text-sm font-black text-[#000000]">{selectedBooking.provider.name}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">{selectedBooking.provider.category}</p>
                                        </div>
                                        {selectedBooking.provider.is_verified && (
                                            <BadgeCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        )}
                                    </div>
                                )}

                                {/* Description */}
                                {selectedBooking.issue_description && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Issue Description</p>
                                        <p className="text-sm text-slate-600 leading-relaxed">{selectedBooking.issue_description}</p>
                                    </div>
                                )}

                                {/* Property */}
                                {selectedBooking.property_details && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Property / Location</p>
                                        <p className="text-sm text-slate-600">{selectedBooking.property_details}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import {
    Users, ShieldCheck, Activity, Search, MoreVertical,
    BadgeCheck, AlertTriangle, Mail, ArrowUpRight,
    TrendingUp, Shield, ClipboardList, Wrench
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
    const adminName = getUsername();

    useEffect(() => {
        Promise.all([
            apiFetch("/admin/stats"),
            apiFetch("/admin/users"),
        ]).then(([s, u]) => {
            setStats(s);
            setUsers(u || []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

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
                        <div className="space-y-6">
                            {[
                                { label: "Database", value: "Connected", status: "UP" },
                                { label: "JWT Auth", value: "Active", status: "SECURE" },
                                { label: "API Server", value: "Running", status: "ONLINE" },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                        <p className="text-sm font-black text-[#000000]">{item.value}</p>
                                    </div>
                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">{item.status}</span>
                                </div>
                            ))}
                        </div>
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
        </div>
    );
}

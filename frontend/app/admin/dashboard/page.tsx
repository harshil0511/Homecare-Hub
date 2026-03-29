"use client";

import { useEffect, useState } from "react";
import {
    Users,
    ShieldCheck,
    Activity,
    Search,
    MoreVertical,
    BadgeCheck,
    AlertTriangle,
    Mail,
    Calendar,
    ArrowUpRight,
    TrendingUp,
    Shield
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const SYSTEM_STATS = [
    { label: "Active Nodes", value: 48, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Identity Registry", value: 1240, icon: Users, color: "text-[#000000]", bg: "bg-slate-50" },
    { label: "Verify Requests", value: 7, icon: BadgeCheck, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "System Alerts", value: 3, icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50" },
];

export default function AdminPage() {
    const [stats, setStats] = useState(SYSTEM_STATS);

    return (
        <div className="space-y-10 animate-fade-in pb-16">
            {/* Admin Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-[#000000] rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-black/20">
                        <Shield className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Command Center</h1>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] opacity-60 mt-1">System Administration & RBAC Management</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-5 py-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-[#000000] uppercase tracking-widest">Core Status: Stable</span>
                    </div>
                    <button className="bg-[#064e3b] hover:bg-emerald-950 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-900/10 transition-all active:scale-95">
                        Global Broadcast
                    </button>
                </div>
            </div>

            {/* Admin Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
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

            {/* Admin Table Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">

                {/* User Directory - Main Ledger */}
                <div className="xl:col-span-2 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white">
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                            <Users className="w-4 h-4 text-[#064e3b]" />
                            Identity Registry
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <input className="bg-slate-50 border border-slate-100 rounded-xl py-2 pl-12 pr-4 text-xs font-black uppercase tracking-tight focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none w-64 transition-all" placeholder="Search by UID, email..." />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Primary Identity</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Access Role</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Registration</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Access</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <tr key={i} className="group hover:bg-slate-50/60 transition-colors cursor-pointer">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center font-black text-[#000000] text-xs group-hover:bg-[#064e3b] group-hover:text-white transition-colors">
                                                    ID
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-[#000000] uppercase">User_Core_{i}00</span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1.5 mt-0.5">
                                                        <Mail className="w-3 h-3" /> user{i}@homecare.hub
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border ${i === 1 ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                    i % 2 === 0 ? "bg-emerald-50 text-emerald-800 border-emerald-100" :
                                                        "bg-blue-50 text-blue-700 border-blue-100"
                                                }`}>
                                                {i === 1 ? "SUPER ADMIN" : i % 2 === 0 ? "SERVICER" : "CLIENT"}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                <Calendar className="w-3.5 h-3.5 opacity-40" />
                                                Jan 1{i}, 2024
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <button className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Side - System Health & Logs */}
                <div className="space-y-10">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#064e3b]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <h3 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                            <ShieldCheck className="w-4 h-4 text-[#064e3b]" /> System Integrity
                        </h3>
                        <div className="space-y-8 relative z-10">
                            {[
                                { label: "Database Tunnel", value: "99.98%", status: "UP" },
                                { label: "JWT Auth Cluster", value: "Stable", status: "SECURE" },
                                { label: "Load Balancer", value: "0.2ms", status: "FAST" }
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

                    <div className="bg-[#000000] rounded-[2.5rem] p-10 text-white shadow-2xl shadow-black/30 relative overflow-hidden group">
                        <div className="absolute bottom-0 right-0 w-full h-1 bg-[#064e3b]" />
                        <TrendingUp className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 group-hover:rotate-12 transition-transform duration-700" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-emerald-400">Yield Analytics</h3>
                        <p className="text-2xl font-black tracking-tighter">$142,400.0</p>
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-2">Aggregate Ecosystem Revenue</p>
                        <button className="mt-8 w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                            Deep Data Audit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { Users, Mail, Shield, ShieldCheck, ShieldAlert, Search, MoreVertical, Filter } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function AdminUsersPage() {
    const [users, setUsers] = useState([
        { id: 1, name: "Admin Core", email: "admin@homecare.hub", role: "ADMIN", status: "Verified" },
        { id: 2, name: "Expert Technician", email: "pro@tech.com", role: "SERVICER", status: "Verified" },
        { id: 3, name: "Home Owner A", email: "user@home.com", role: "USER", status: "Active" },
    ]);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Identity Registry</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">Master list of all ecosystem participants</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-[#000000] px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        <Filter className="w-3.5 h-3.5" />
                        Filter
                    </button>
                    <button className="bg-[#000000] hover:bg-slate-900 text-white px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-black/10">
                        Export DB
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col min-h-[60vh]">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                        <Users className="w-4 h-4 text-blue-600" />
                        User Directory
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input className="bg-white border border-slate-200 rounded-xl py-2 pl-12 pr-4 text-[10px] font-black uppercase w-64 outline-none focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Search identities..." />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/20">
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Primary Identity</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Access Level</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Verification Status</th>
                                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((user) => (
                                <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-black text-[#000000] text-xs">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-[#000000] uppercase tracking-tight">{user.name}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1.5 mt-0.5">
                                                    <Mail className="w-3 h-3" /> {user.email}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-2">
                                            {user.role === "ADMIN" ? <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> : 
                                             user.role === "SERVICER" ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : 
                                             <Shield className="w-3.5 h-3.5 text-blue-600" />}
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                                user.role === "ADMIN" ? "bg-rose-50 text-rose-700" :
                                                user.role === "SERVICER" ? "bg-emerald-50 text-emerald-700" :
                                                "bg-blue-50 text-blue-700"
                                            }`}>
                                                {user.role}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <span className="text-[10px] font-black text-[#000000] flex items-center gap-2 uppercase tracking-widest">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <button className="p-2 text-slate-300 hover:text-slate-900 bg-slate-50 rounded-lg transition-all">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
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

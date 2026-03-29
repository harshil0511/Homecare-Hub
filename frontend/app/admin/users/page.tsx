"use client";

import { useEffect, useState } from "react";
import { Users, Mail, Shield, ShieldCheck, ShieldAlert, Search, CheckCircle, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface User {
    id: number;
    user_uuid: string;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
    society_id: number | null;
}

const ROLE_STYLE: Record<string, { bg: string; icon: typeof Shield }> = {
    ADMIN:     { bg: "bg-purple-50 text-purple-700 border-purple-100", icon: ShieldAlert },
    SECRETARY: { bg: "bg-amber-50 text-amber-700 border-amber-100",   icon: ShieldCheck },
    SERVICER:  { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: ShieldCheck },
    USER:      { bg: "bg-blue-50 text-blue-700 border-blue-100",       icon: Shield },
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [actionMsg, setActionMsg] = useState("");

    const load = () => {
        setLoading(true);
        apiFetch("/admin/users")
            .then((d) => setUsers(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const toggleActive = async (uuid: string, current: boolean) => {
        try {
            await apiFetch(`/admin/users/${uuid}/activate`, { method: "PATCH" });
            setUsers((prev) => prev.map((u) => u.user_uuid === uuid ? { ...u, is_active: !current } : u));
            setActionMsg("Status updated.");
            setTimeout(() => setActionMsg(""), 2000);
        } catch (err: any) {
            setActionMsg(err.message || "Failed to update.");
            setTimeout(() => setActionMsg(""), 3000);
        }
    };

    const changeRole = async (uuid: string, newRole: string) => {
        try {
            await apiFetch(`/admin/users/${uuid}/role`, {
                method: "PATCH",
                body: JSON.stringify({ role: newRole }),
            });
            setUsers((prev) => prev.map((u) => u.user_uuid === uuid ? { ...u, role: newRole } : u));
            setActionMsg("Role updated.");
            setTimeout(() => setActionMsg(""), 2000);
        } catch (err: any) {
            setActionMsg(err.message || "Failed to update role.");
            setTimeout(() => setActionMsg(""), 3000);
        }
    };

    const filtered = users.filter((u) => {
        const matchSearch =
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === "ALL" || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Identity Registry</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">
                        {users.length} registered accounts
                    </p>
                </div>
                {actionMsg && (
                    <div className="px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest">
                        {actionMsg}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                        className="bg-white border border-slate-200 rounded-xl py-2.5 pl-12 pr-4 text-xs font-black uppercase tracking-tight outline-none focus:ring-1 focus:ring-emerald-500 w-64 transition-all"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {["ALL", "ADMIN", "SECRETARY", "USER", "SERVICER"].map((r) => (
                    <button key={r} onClick={() => setRoleFilter(r)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            roleFilter === r
                                ? "bg-[#064e3b] text-white border-[#064e3b]"
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}>
                        {r}
                    </button>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                    <Users className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">
                        User Directory — {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    </h2>
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
                                <tr className="bg-slate-50/20">
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">User</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Role</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((user) => {
                                    const roleInfo = ROLE_STYLE[user.role] ?? ROLE_STYLE.USER;
                                    const RoleIcon = roleInfo.icon;
                                    return (
                                        <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-10 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-11 h-11 bg-[#064e3b] rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0">
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
                                                <div className="flex items-center gap-2">
                                                    <RoleIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => changeRole(user.user_uuid, e.target.value)}
                                                        className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border cursor-pointer outline-none ${roleInfo.bg}`}
                                                    >
                                                        {["USER", "SERVICER", "SECRETARY", "ADMIN"].map((r) => (
                                                            <option key={r} value={r}>{r}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="px-10 py-5">
                                                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${user.is_active ? "text-emerald-600" : "text-rose-500"}`}>
                                                    {user.is_active
                                                        ? <CheckCircle className="w-3.5 h-3.5" />
                                                        : <XCircle className="w-3.5 h-3.5" />}
                                                    {user.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-10 py-5">
                                                <button
                                                    onClick={() => toggleActive(user.user_uuid, user.is_active)}
                                                    className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border transition-all ${
                                                        user.is_active
                                                            ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                                                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                    }`}
                                                >
                                                    {user.is_active ? "Deactivate" : "Activate"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

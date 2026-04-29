"use client";

import { useEffect, useState } from "react";
import { Users, Mail, Shield, ShieldCheck, ShieldAlert, Search, CheckCircle, XCircle, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
    society_id: string | null;
}

const ROLE_STYLE: Record<string, { bg: string; icon: typeof Shield }> = {
    ADMIN:     { bg: "bg-purple-50 text-purple-700 border-purple-100", icon: ShieldAlert },
    SECRETARY: { bg: "bg-amber-50 text-amber-700 border-amber-100",   icon: ShieldCheck },
    SERVICER:  { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: ShieldCheck },
    USER:      { bg: "bg-blue-50 text-blue-700 border-blue-100",       icon: Shield },
};

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <span className={`text-xs font-bold ${accent ?? "text-slate-700"}`}>{value}</span>
        </div>
    );
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [actionMsg, setActionMsg] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ uuid: string; username: string } | null>(null);

    useEffect(() => {
        apiFetch("/admin/users")
            .then((d) => setUsers(d || []))
            .catch(() => setLoadError(true))
            .finally(() => setLoading(false));
    }, []);

    const toggleActive = async (uuid: string, current: boolean) => {
        try {
            await apiFetch(`/admin/users/${uuid}/activate`, { method: "PATCH" });
            setUsers((prev) => prev.map((u) => u.id === uuid ? { ...u, is_active: !current } : u));
            if (selectedUser?.id === uuid) setSelectedUser((p) => p ? { ...p, is_active: !current } : null);
            setActionMsg("Status updated.");
            setTimeout(() => setActionMsg(""), 2000);
        } catch (err) {
            setActionMsg((err as Error).message || "Failed to update.");
            setTimeout(() => setActionMsg(""), 3000);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await apiFetch(`/admin/users/${deleteConfirm.uuid}`, { method: "DELETE" });
            setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.uuid));
            setSelectedUser(null);
            setActionMsg(`Account "${deleteConfirm.username}" permanently deleted.`);
            setTimeout(() => setActionMsg(""), 3000);
        } catch (err) {
            setActionMsg((err as Error).message || "Failed to delete.");
            setTimeout(() => setActionMsg(""), 3000);
        } finally {
            setDeleteConfirm(null);
        }
    };

    const changeRole = async (uuid: string, newRole: string) => {
        try {
            await apiFetch(`/admin/users/${uuid}/role`, {
                method: "PATCH",
                body: JSON.stringify({ role: newRole }),
            });
            setUsers((prev) => prev.map((u) => u.id === uuid ? { ...u, role: newRole } : u));
            if (selectedUser?.id === uuid) setSelectedUser((p) => p ? { ...p, role: newRole } : null);
            setActionMsg("Role updated.");
            setTimeout(() => setActionMsg(""), 2000);
        } catch (err) {
            setActionMsg((err as Error).message || "Failed to update role.");
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
        <div className="space-y-8 pb-12">
            {loadError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">Failed to load data. Please refresh.</div>
            )}
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
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                        className="bg-white border border-slate-200 rounded-xl py-2.5 pl-12 pr-4 text-xs font-black uppercase tracking-tight outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-64 transition-all"
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
                        <Spinner size="lg" />
                    ) : filtered.length === 0 ? (
                        <div className="px-4">
                            <EmptyState icon={Users} title="No users found" />
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
                                        <tr key={user.id} onClick={() => setSelectedUser(user)} className="group hover:bg-slate-50/50 transition-colors cursor-pointer">
                                            <td className="px-10 py-5">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-11 h-11 bg-[#064e3b] rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                                                        {user.username?.charAt(0).toUpperCase() || "?"}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-[#000000] uppercase tracking-tight truncate">{user.username}</p>
                                                        <p className="text-[10px] font-black text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{user.email}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-5" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <RoleIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    {user.role === "ADMIN" ? (
                                                        <span className="text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest border bg-purple-50 text-purple-700 border-purple-100">
                                                            Super Admin
                                                        </span>
                                                    ) : (
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => changeRole(user.id, e.target.value)}
                                                            title="Change user role"
                                                            className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest border cursor-pointer outline-none ${roleInfo.bg}`}
                                                        >
                                                            {["USER", "SERVICER", "SECRETARY"].map((r) => (
                                                                <option key={r} value={r}>{r}</option>
                                                            ))}
                                                        </select>
                                                    )}
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
                                            <td className="px-10 py-5" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        onClick={() => toggleActive(user.id, user.is_active)}
                                                        className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border transition-all ${
                                                            user.is_active
                                                                ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                                                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                        }`}
                                                    >
                                                        {user.is_active ? "Deactivate" : "Activate"}
                                                    </button>
                                                    {user.role !== "ADMIN" && (
                                                        <button
                                                            onClick={() => setDeleteConfirm({ uuid: user.id, username: user.username })}
                                                            className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all"
                                                            title="Delete account"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* User detail modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 sm:p-8">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-base font-black text-slate-900 uppercase tracking-widest">User Info</h2>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Avatar + name */}
                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                                <div className="w-14 h-14 bg-[#064e3b] rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                                    {selectedUser.username?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div>
                                    <p className="text-base font-black text-slate-900 uppercase tracking-tight">{selectedUser.username}</p>
                                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{selectedUser.email}</p>
                                </div>
                            </div>

                            {/* Info rows */}
                            <div className="space-y-0">
                                <Row label="Role" value={selectedUser.role} />
                                <Row
                                    label="Status"
                                    value={selectedUser.is_active ? "Active" : "Inactive"}
                                    accent={selectedUser.is_active ? "text-emerald-600" : "text-rose-500"}
                                />
                                <Row
                                    label="Society"
                                    value={selectedUser.society_id ? "Assigned" : "No society"}
                                    accent={selectedUser.society_id ? "text-slate-700" : "text-slate-400"}
                                />
                                <div className="flex items-start gap-2 py-2.5 border-b border-slate-50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Account ID</span>
                                    <span className="text-[10px] font-mono text-slate-400 break-all text-right ml-auto">{selectedUser.id}</span>
                                </div>
                            </div>

                            {/* Quick actions */}
                            {selectedUser.role !== "ADMIN" && (
                                <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                                    <button
                                        onClick={() => toggleActive(selectedUser.id, selectedUser.is_active)}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                            selectedUser.is_active
                                                ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                        }`}
                                    >
                                        {selectedUser.is_active ? "Deactivate" : "Activate"}
                                    </button>
                                    <button
                                        onClick={() => { setSelectedUser(null); setDeleteConfirm({ uuid: selectedUser.id, username: selectedUser.username }); }}
                                        title="Delete account"
                                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 max-w-md w-full space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                                <Trash2 className="w-6 h-6 text-rose-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Permanent Deletion</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed">
                            You are about to permanently delete the account for{" "}
                            <span className="font-black text-slate-900">&ldquo;{deleteConfirm.username}&rdquo;</span>.
                            All their data, bookings, and history will be lost forever.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-sm font-black text-white hover:bg-rose-700 transition-all uppercase tracking-widest"
                            >
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

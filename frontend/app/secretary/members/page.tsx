"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Users, CheckCircle, XCircle, Search, AlertTriangle, Clock, Circle } from "lucide-react";

interface Member { id: number; username: string; email: string; is_active: boolean; }
interface Alert { id: number; title: string; status: string; priority: string; created_at: string; user_id: number; }

export default function SecretaryMembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

    useEffect(() => {
        Promise.all([
            apiFetch("/secretary/members").catch(() => []),
            apiFetch("/secretary/alerts").catch(() => []),
        ]).then(([m, a]) => {
            setMembers(m || []);
            setAlerts(a || []);
        }).finally(() => setLoading(false));
    }, []);

    const filtered = members.filter(m => {
        const matchSearch = !search ||
            m.username.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase());
        const matchFilter =
            filter === "all" ||
            (filter === "active" && m.is_active) ||
            (filter === "inactive" && !m.is_active);
        return matchSearch && matchFilter;
    });

    const getAlertCounts = (memberId: number) => {
        const memberAlerts = alerts.filter(a => a.user_id === memberId);
        return {
            total: memberAlerts.length,
            open: memberAlerts.filter(a => a.status === "PENDING" || a.status === "IN_PROGRESS").length,
            recent: memberAlerts
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null,
        };
    };

    const activeCount = members.filter(m => m.is_active).length;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Members</h1>
                <p className="text-slate-500 text-sm mt-1">Home users registered in your society.</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                    <p className="text-2xl font-black text-slate-900">{members.length}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                    <p className="text-2xl font-black text-emerald-700">{activeCount}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Active</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                    <p className="text-2xl font-black text-rose-600">{members.length - activeCount}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Inactive</p>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                    />
                </div>
                <div className="flex gap-2">
                    {(["all", "active", "inactive"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                filter === f
                                    ? "bg-[#064e3b] text-white"
                                    : "bg-white border border-slate-200 text-slate-500 hover:border-[#064e3b] hover:text-[#064e3b]"
                            }`}>
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Member cards */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-bold text-sm">No members found</p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl">
                    <div className="divide-y divide-slate-50 h-[520px] overflow-y-auto">
                        {filtered.map(m => {
                            const counts = getAlertCounts(m.id);
                            return (
                                <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                                            <span className="text-sm font-black text-blue-700">{m.username.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-slate-900 text-sm">{m.username}</p>
                                                {m.is_active
                                                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                    : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                                            </div>
                                            <p className="text-xs text-slate-400 font-medium mt-0.5">{m.email}</p>
                                            {counts.recent && (
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Last: {counts.recent.title} · {new Date(counts.recent.created_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        {counts.total > 0 && (
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-700">{counts.total} task{counts.total !== 1 ? "s" : ""}</p>
                                                {counts.open > 0 && (
                                                    <p className="text-[10px] font-black text-amber-600 flex items-center gap-1 justify-end">
                                                        <AlertTriangle className="w-3 h-3" /> {counts.open} open
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${
                                            m.is_active
                                                ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
                                                : "text-slate-500 bg-slate-50 border border-slate-200"
                                        }`}>
                                            {m.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

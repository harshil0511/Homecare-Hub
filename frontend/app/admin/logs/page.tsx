"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Wrench, Search, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface LogEntry {
    type: "BOOKING" | "TASK";
    id: number;
    description: string;
    status: string;
    user_id: number;
    created_at: string | null;
}

const TYPE_STYLE: Record<string, { style: string; icon: typeof ClipboardList }> = {
    BOOKING: { style: "bg-blue-50 text-blue-700 border-blue-100", icon: ClipboardList },
    TASK:    { style: "bg-purple-50 text-purple-700 border-purple-100", icon: Wrench },
};

const STATUS_DOT: Record<string, string> = {
    PENDING:     "bg-amber-400",
    ACCEPTED:    "bg-blue-400",
    IN_PROGRESS: "bg-purple-400",
    COMPLETED:   "bg-emerald-500",
    CANCELLED:   "bg-slate-300",
    SCHEDULED:   "bg-blue-400",
    DONE:        "bg-emerald-500",
};

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");

    useEffect(() => {
        apiFetch("/admin/logs")
            .then((d) => setLogs(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = logs.filter((l) => {
        const matchSearch = l.description.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === "ALL" || l.type === typeFilter;
        return matchSearch && matchType;
    });

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Activity Logs</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">
                        Recent bookings and maintenance tasks across the system
                    </p>
                </div>
                <div className="px-5 py-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-[#000000] uppercase tracking-widest">Live System Data</span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap items-center">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input className="bg-white border border-slate-200 rounded-xl py-2.5 pl-12 pr-4 text-xs font-black outline-none focus:ring-1 focus:ring-emerald-500 w-60 transition-all"
                        placeholder="Search activity..."
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {["ALL","BOOKING","TASK"].map((f) => (
                    <button key={f} onClick={() => setTypeFilter(f)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            typeFilter === f ? "bg-[#064e3b] text-white border-[#064e3b]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}>{f === "ALL" ? "All Activity" : f === "BOOKING" ? "Bookings" : "Tasks"}</button>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30 rounded-t-[2.5rem]">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">
                        System Activity — {filtered.length} event{filtered.length !== 1 ? "s" : ""}
                    </h2>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold text-sm">No activity found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 h-[520px] overflow-y-auto">
                        {filtered.map((log, idx) => {
                            const typeInfo = TYPE_STYLE[log.type] ?? TYPE_STYLE.TASK;
                            const TypeIcon = typeInfo.icon;
                            const dotColor = STATUS_DOT[log.status] ?? "bg-slate-300";
                            return (
                                <div key={`${log.type}-${log.id}-${idx}`} className="px-10 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${typeInfo.style}`}>
                                            <TypeIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-[#000000]">{log.description}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User #{log.user_id}</span>
                                                <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex-shrink-0 ml-4">
                                        {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

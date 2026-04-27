"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { Bell, Clock, Circle, CheckCircle2, X, AlertTriangle, Search, Megaphone, Send } from "lucide-react";

interface Alert { id: number; title: string; status: string; priority: string; created_at: string; user_id: number; }
interface Member { id: number; username: string; email: string; is_active: boolean; }

const STATUS_ICON: Record<string, React.ReactNode> = {
    PENDING: <Clock className="w-4 h-4 text-amber-500" />,
    IN_PROGRESS: <Circle className="w-4 h-4 text-blue-500" />,
    COMPLETED: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    CANCELLED: <X className="w-4 h-4 text-slate-400" />,
};

const STATUS_COLOR: Record<string, string> = {
    PENDING: "text-amber-700 bg-amber-50 border-amber-100",
    IN_PROGRESS: "text-blue-700 bg-blue-50 border-blue-100",
    COMPLETED: "text-emerald-700 bg-emerald-50 border-emerald-100",
    CANCELLED: "text-slate-500 bg-slate-50 border-slate-100",
};

const PRIORITY_COLOR: Record<string, string> = {
    HIGH: "text-rose-700 bg-rose-50 border-rose-100",
    MEDIUM: "text-amber-700 bg-amber-50 border-amber-100",
    LOW: "text-slate-500 bg-slate-50 border-slate-100",
};

const STATUSES = ["All", "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const PRIORITIES = ["All", "HIGH", "MEDIUM", "LOW"];

export default function SecretaryAlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");

    const [broadcastOpen, setBroadcastOpen] = useState(false);
    const [broadcastTitle, setBroadcastTitle] = useState("");
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
    const [broadcastError, setBroadcastError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            apiFetch("/secretary/alerts").catch(() => []),
            apiFetch("/secretary/members").catch(() => []),
        ]).then(([a, m]) => {
            setAlerts(a || []);
            setMembers(m || []);
        }).finally(() => setLoading(false));
    }, []);

    const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

    const filtered = alerts.filter(a => {
        const member = memberMap[a.user_id];
        const matchSearch = !search ||
            a.title.toLowerCase().includes(search.toLowerCase()) ||
            member?.username.toLowerCase().includes(search.toLowerCase()) ||
            member?.email.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "All" || a.status === statusFilter;
        const matchPriority = priorityFilter === "All" || a.priority === priorityFilter;
        return matchSearch && matchStatus && matchPriority;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const openCount = alerts.filter(a => a.status === "PENDING" || a.status === "IN_PROGRESS").length;
    const highCount = alerts.filter(a => a.priority === "HIGH").length;

    async function handleBroadcast(e: React.FormEvent) {
        e.preventDefault();
        setBroadcastSending(true);
        setBroadcastSuccess(null);
        setBroadcastError(null);
        try {
            const res = await apiFetch("/secretary/broadcast", {
                method: "POST",
                body: JSON.stringify({ title: broadcastTitle, message: broadcastMessage }),
            });
            setBroadcastSuccess(res.message ?? `Notice sent to ${res.sent} members`);
            setBroadcastTitle("");
            setBroadcastMessage("");
            setBroadcastOpen(false);
        } catch (err: unknown) {
            setBroadcastError(err instanceof Error ? err.message : "Failed to send broadcast.");
        } finally {
            setBroadcastSending(false);
        }
    }

    return (
        <div className="space-y-8">
            {/* Broadcast Notice */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-black text-slate-900">Broadcast Notice</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">— send a message to all society members</span>
                    </div>
                    <button
                        onClick={() => { setBroadcastOpen(o => !o); setBroadcastSuccess(null); setBroadcastError(null); }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                            broadcastOpen
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                : "bg-[#064e3b] text-white hover:bg-emerald-800"
                        }`}
                    >
                        <Megaphone className="w-3.5 h-3.5" />
                        {broadcastOpen ? "Cancel" : "Broadcast Notice"}
                    </button>
                </div>

                {broadcastSuccess && !broadcastOpen && (
                    <div className="px-6 pb-4">
                        <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">{broadcastSuccess}</p>
                    </div>
                )}

                {broadcastOpen && (
                    <form onSubmit={handleBroadcast} className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Title</label>
                            <input
                                required
                                value={broadcastTitle}
                                onChange={e => setBroadcastTitle(e.target.value)}
                                placeholder="e.g. Water Supply Interruption"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 transition-all placeholder:text-slate-400"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Message</label>
                            <textarea
                                required
                                rows={3}
                                value={broadcastMessage}
                                onChange={e => setBroadcastMessage(e.target.value)}
                                placeholder="Write your notice here..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 transition-all placeholder:text-slate-400 resize-none"
                            />
                        </div>
                        {broadcastError && (
                            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2">{broadcastError}</p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={broadcastSending}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-60"
                            >
                                <Send className="w-3.5 h-3.5" />
                                {broadcastSending ? "Sending..." : "Send to All Members"}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Alerts</h1>
                    <p className="text-slate-500 text-sm mt-1">Maintenance tasks raised by society members.</p>
                </div>
                <div className="flex gap-3">
                    {openCount > 0 && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5" /> {openCount} open
                        </span>
                    )}
                    {highCount > 0 && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl uppercase tracking-widest">
                            <AlertTriangle className="w-3.5 h-3.5" /> {highCount} high priority
                        </span>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search alerts or member name..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 transition-all placeholder:text-slate-400"
                />
            </div>

            {/* Status filter pills */}
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    {STATUSES.map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                statusFilter === s
                                    ? "bg-[#064e3b] text-white"
                                    : "bg-white border border-slate-200 text-slate-500 hover:border-[#064e3b] hover:text-[#064e3b]"
                            }`}>
                            {s === "IN_PROGRESS" ? "In Progress" : s === "All" ? "All Status" : s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    {PRIORITIES.map(p => (
                        <button key={p} onClick={() => setPriorityFilter(p)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                priorityFilter === p
                                    ? "bg-slate-800 text-white"
                                    : "bg-white border border-slate-200 text-slate-500 hover:border-slate-800 hover:text-slate-800"
                            }`}>
                            {p === "All" ? "All Priority" : p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Alerts list */}
            {loading ? (
                <Spinner size="lg" />
            ) : filtered.length === 0 ? (
                <EmptyState icon={Bell} title="No alerts" description="Member maintenance alerts appear here" />
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl">
                    <div className="divide-y divide-slate-50 h-[520px] overflow-y-auto">
                        {filtered.map(a => {
                            const member = memberMap[a.user_id];
                            return (
                                <div key={a.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <span className="mt-0.5 shrink-0">
                                                {STATUS_ICON[a.status] ?? <Circle className="w-4 h-4 text-slate-400" />}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-900 text-sm">{a.title}</p>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-5 h-5 bg-blue-50 rounded-lg flex items-center justify-center">
                                                            <span className="text-[9px] font-black text-blue-700">{member?.username?.charAt(0)?.toUpperCase() ?? "?"}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                            {member?.username ?? `Member #${a.user_id}`}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-300">·</span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {a.priority && (
                                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl border uppercase tracking-widest ${PRIORITY_COLOR[a.priority] ?? "text-slate-500 bg-slate-50 border-slate-100"}`}>
                                                    {a.priority}
                                                </span>
                                            )}
                                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl border uppercase tracking-widest ${STATUS_COLOR[a.status] ?? "text-slate-500 bg-slate-50 border-slate-100"}`}>
                                                {a.status.replace("_", " ")}
                                            </span>
                                        </div>
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

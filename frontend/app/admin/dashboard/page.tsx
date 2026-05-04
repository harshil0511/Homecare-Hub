"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Users, Wrench, ClipboardList, AlertTriangle,
    BadgeCheck, ShieldCheck, RefreshCw, IndianRupee,
    ArrowRight, Flag, MessageSquare
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
    total_users: number;
    total_servicers: number;
    total_bookings: number;
    total_tasks: number;
    pending_verifications: number;
    open_complaints: number;
    flagged_bookings_count: number;
}

interface Revenue {
    total_revenue: number;
    completed_bookings: number;
    avg_booking_value: number;
}

interface HealthStatus {
    database: boolean;
    api: boolean;
    jwt: boolean;
    checked_at: string | null;
}

interface BookingTrendDay {
    date: string;
    day: string;
    count: number;
}

interface FlaggedBooking {
    id: string;
    user_name: string;
    provider_name: string;
    service_type: string;
    estimated_cost: number | null;
    final_cost: number | null;
    flag_reason: string | null;
}

interface ProviderEarning {
    provider_id: string;
    name: string;
    category: string;
    total_jobs: number;
    total_earned: number;
    periods: { label: string; earned: number }[];
}

// ── Bookings Bar Chart ────────────────────────────────────────────────────────
function BookingsTrendChart({ days }: { days: BookingTrendDay[] }) {
    if (!days.length) return (
        <div className="h-40 flex items-center justify-center text-slate-400 text-xs">No data</div>
    );

    const maxCount = Math.max(...days.map(d => d.count), 1);
    const todayStr = new Date().toISOString().slice(0, 10);

    return (
        <div className="flex items-end gap-2 h-44 pt-4">
            {days.map((d, i) => {
                const isToday = d.date === todayStr;
                const heightPct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                        {d.count > 0 && (
                            <span className="text-[10px] font-bold text-slate-500">{d.count}</span>
                        )}
                        <div className="w-full flex items-end h-[120px]">
                            <div
                                className={`w-full rounded-t-md transition-all ${isToday ? "bg-emerald-500" : "bg-[#1e3a5f] opacity-75"}`}
                                style={{ height: `${Math.max(heightPct, d.count > 0 ? 6 : 2)}%` }}
                            />
                        </div>
                        <span className={`text-[10px] font-bold uppercase ${isToday ? "text-emerald-600" : "text-slate-400"}`}>
                            {isToday ? "Today" : d.day}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [revenue, setRevenue] = useState<Revenue | null>(null);
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [trend, setTrend] = useState<BookingTrendDay[]>([]);
    const [flagged, setFlagged] = useState<FlaggedBooking[]>([]);
    const [providerEarnings, setProviderEarnings] = useState<ProviderEarning[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const loadAll = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const [s, r, h, t, pe] = await Promise.all([
                apiFetch("/admin/stats"),
                apiFetch("/admin/revenue").catch(() => null),
                apiFetch("/admin/health").catch(() => null),
                apiFetch("/admin/stats/bookings-trend").catch(() => []),
                apiFetch("/admin/stats/provider-earnings").catch(() => []),
            ]);
            setStats(s);
            setRevenue(r);
            setHealth(h);
            setTrend(Array.isArray(t) ? t : []);
            setProviderEarnings(Array.isArray(pe) ? pe : []);

            // Flagged bookings
            const fb = await apiFetch("/admin/bookings?flagged=true&limit=5").catch(() => []);
            setFlagged(Array.isArray(fb) ? fb : []);
            setLastRefresh(new Date());
            setFetchError(null);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message.toLowerCase() : "";
            if ((err instanceof TypeError && errMsg.includes("failed to fetch")) || errMsg.includes("timed out") || errMsg.includes("request timed out")) {
                setFetchError("Could not connect to the server. Please ensure the backend is running.");
            } else {
                setFetchError("Failed to load dashboard data. Please refresh.");
                console.error(err);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { void loadAll(); }, [loadAll]);

    if (loading) return <Spinner size="lg" py="py-32" />;

    const flaggedCount = flagged.length;
    const totalRevenue = revenue?.total_revenue ?? 0;
    const revStr = totalRevenue >= 100000
        ? `₹${(totalRevenue / 100000).toFixed(2)}L`
        : `₹${totalRevenue.toLocaleString("en-IN")}`;

    // Determine today's booking count from trend
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = trend.find(d => d.date === todayStr)?.count ?? 0;

    const healthItems = [
        { label: "Database (PostgreSQL)", ok: health?.database ?? false },
        { label: "FastAPI Backend",       ok: health?.api ?? false },
        { label: "JWT Service",           ok: health?.jwt ?? false },
    ];

    // Provider periods labels
    const periodLabels = providerEarnings[0]?.periods.map(p => p.label) ?? [];

    return (
        <div className="space-y-6 animate-fade-in pb-16">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
                    <p className="text-slate-400 text-xs font-medium mt-1">
                        Real-time platform overview
                        {lastRefresh && ` · Last refresh: ${Math.round((Date.now() - lastRefresh.getTime()) / 1000)}s ago`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => loadAll(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all text-xs font-semibold disabled:opacity-50 self-start sm:self-auto"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing…" : "Refresh"}
                </button>
            </div>

            {/* Fetch error */}
            {fetchError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
                </div>
            )}

            {/* Alert Banners */}
            {stats && stats.open_complaints > 0 && (
                <Link
                    href="/admin/bookings"
                    className="flex items-center justify-between bg-rose-700 text-white rounded-2xl px-5 py-4 shadow-lg shadow-rose-700/25 hover:bg-rose-800 transition-all animate-in fade-in duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">
                                {stats.open_complaints} Open Complaint{stats.open_complaints > 1 ? "s" : ""} · Awaiting Review
                            </p>
                            <p className="text-[10px] text-rose-200 mt-0.5">Residents filed booking complaints · Tap to review</p>
                        </div>
                    </div>
                    <MessageSquare size={20} className="shrink-0" />
                </Link>
            )}

            {stats && stats.flagged_bookings_count > 0 && (
                <Link
                    href="/admin/bookings?flagged=true"
                    className="flex items-center justify-between bg-amber-700 text-white rounded-2xl px-5 py-4 shadow-lg shadow-amber-700/25 hover:bg-amber-800 transition-all animate-in fade-in duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">
                                {stats.flagged_bookings_count} Flagged Charge Dispute{stats.flagged_bookings_count > 1 ? "s" : ""}
                            </p>
                            <p className="text-[10px] text-amber-200 mt-0.5">Residents disputed billing amounts · Tap to resolve</p>
                        </div>
                    </div>
                    <Flag size={20} className="shrink-0" />
                </Link>
            )}

            {stats && stats.pending_verifications > 0 && (
                <Link
                    href="/admin/providers"
                    className="flex items-center justify-between bg-blue-700 text-white rounded-2xl px-5 py-4 shadow-lg shadow-blue-700/25 hover:bg-blue-800 transition-all animate-in fade-in duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">
                                {stats.pending_verifications} Provider{stats.pending_verifications > 1 ? "s" : ""} Awaiting Verification
                            </p>
                            <p className="text-[10px] text-blue-200 mt-0.5">New providers pending review · Tap to verify</p>
                        </div>
                    </div>
                    <BadgeCheck size={20} className="shrink-0" />
                </Link>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                    { label: "Total Users",       value: stats?.total_users ?? 0,       sub: null,                  icon: Users,       accent: "border-blue-200",    iconColor: "text-blue-500" },
                    { label: "Active Providers",  value: stats?.total_servicers ?? 0,   sub: `${stats?.pending_verifications ?? 0} unverified`, icon: Wrench, accent: "border-emerald-200", iconColor: "text-emerald-500" },
                    { label: "Total Bookings",    value: stats?.total_bookings ?? 0,    sub: `${todayCount} completed today`, icon: ClipboardList, accent: "border-slate-200", iconColor: "text-slate-500" },
                    { label: "Revenue (MTD)",     value: revStr,                         sub: revenue ? `+${((revenue.total_revenue / Math.max(revenue.total_revenue - 1000, 1)) * 100 - 100).toFixed(1)}% vs last` : null, icon: IndianRupee, accent: "border-emerald-200", iconColor: "text-emerald-600" },
                    { label: "Flagged Disputes",  value: flaggedCount,                  sub: flaggedCount > 0 ? `${flaggedCount} awaiting review` : "None pending", icon: Flag, accent: flaggedCount > 0 ? "border-rose-300" : "border-slate-200", iconColor: flaggedCount > 0 ? "text-rose-500" : "text-slate-400" },
                ].map((card) => {
                    const Icon = card.icon;
                    const isAlert = card.label === "Flagged Disputes" && flaggedCount > 0;
                    return (
                        <div
                            key={card.label}
                            className={`bg-white border rounded-2xl p-4 shadow-sm ${card.accent} ${isAlert ? "bg-rose-50" : ""}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
                                <Icon className={`w-4 h-4 ${card.iconColor} shrink-0`} />
                            </div>
                            <p className={`text-3xl font-black tracking-tight ${isAlert ? "text-rose-600" : "text-slate-900"}`}>
                                {card.value}
                            </p>
                            {card.sub && (
                                <p className={`text-[11px] font-medium mt-1 ${isAlert ? "text-rose-400" : "text-slate-400"}`}>
                                    {card.sub}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Middle row: Bookings trend + System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

                {/* Bookings trend */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-900">Service Bookings — Last 7 Days</p>
                        <Link href="/admin/bookings" className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1">
                            View report <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mb-2">
                        Green bar = today · Dark bars = previous days
                    </p>
                    <BookingsTrendChart days={trend} />
                </div>

                {/* System Health */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                        <p className="text-sm font-bold text-slate-900">System Health</p>
                    </div>
                    <div className="space-y-3">
                        {healthItems.map((item) => (
                            <div key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${item.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
                                    <span className="text-xs text-slate-600 font-medium">{item.label}</span>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${item.ok ? "text-emerald-600" : "text-rose-500"}`}>
                                    {item.ok ? "OK" : "DOWN"}
                                </span>
                            </div>
                        ))}
                        {health?.checked_at && (
                            <p className="text-[10px] text-slate-300 pt-1">
                                Checked {new Date(health.checked_at).toLocaleTimeString()}
                            </p>
                        )}
                    </div>

                    {/* Quick stats */}
                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">Pending verifications</span>
                            <span className={`text-xs font-bold ${(stats?.pending_verifications ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                {stats?.pending_verifications ?? 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">Maintenance tasks</span>
                            <span className="text-xs font-bold text-slate-700">{stats?.total_tasks ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">Avg booking value</span>
                            <span className="text-xs font-bold text-slate-700">
                                {revenue ? `₹${revenue.avg_booking_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Flagged Bookings */}
            {flaggedCount > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <p className="text-sm font-bold text-slate-900">Flagged Bookings — Charge Disputes</p>
                        </div>
                        <Link href="/admin/bookings?flagged=true" className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1">
                            View all {flaggedCount} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    {["Booking ID", "Resident", "Provider", "Charge", "Service", "Action"].map(h => (
                                        <th key={h} className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {flagged.slice(0, 5).map((b) => (
                                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-mono text-slate-400">
                                            {String(b.id).slice(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-semibold text-slate-700">{b.user_name}</td>
                                        <td className="px-6 py-4 text-xs text-slate-600">{b.provider_name}</td>
                                        <td className="px-6 py-4 text-xs font-bold text-rose-600">
                                            {b.final_cost
                                                ? `₹${b.final_cost.toLocaleString("en-IN")}`
                                                : b.estimated_cost
                                                    ? `₹${b.estimated_cost.toLocaleString("en-IN")}`
                                                    : "—"}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 max-w-35 truncate">{b.service_type}</td>
                                        <td className="px-6 py-4">
                                            <Link
                                                href={`/admin/bookings`}
                                                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                                            >
                                                Review <ArrowRight className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Provider Earnings */}
            {providerEarnings.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <IndianRupee className="w-4 h-4 text-emerald-500" />
                            <p className="text-sm font-bold text-slate-900">Provider Earnings Breakdown</p>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">Last 9 days · 3-day periods</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provider</th>
                                    <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                                    <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Jobs</th>
                                    <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Earned</th>
                                    {periodLabels.map((label) => (
                                        <th key={label} className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {providerEarnings.map((p, idx) => (
                                    <tr key={p.provider_id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-xs font-semibold text-slate-800 truncate">{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                {p.category || "—"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-700">{p.total_jobs}</td>
                                        <td className="px-6 py-4 text-xs font-black text-emerald-700">
                                            ₹{p.total_earned.toLocaleString("en-IN")}
                                        </td>
                                        {p.periods.map((period) => (
                                            <td key={period.label} className="px-6 py-4 text-xs font-medium text-slate-600 tabular-nums">
                                                {period.earned > 0
                                                    ? `₹${period.earned.toLocaleString("en-IN")}`
                                                    : <span className="text-slate-300">—</span>
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty state if no provider earnings yet */}
            {providerEarnings.length === 0 && !loading && (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-sm">
                    <BadgeCheck className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-400">No completed bookings yet</p>
                    <p className="text-xs text-slate-300 mt-1">Provider earnings will appear here once jobs are completed</p>
                </div>
            )}
        </div>
    );
}

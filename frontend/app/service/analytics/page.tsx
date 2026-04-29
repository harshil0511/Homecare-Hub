"use client";

import { useEffect, useState, useCallback } from "react";
import {
    RefreshCw, AlertTriangle, BarChart2
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";

// ── Data types ────────────────────────────────────────────────────────────────
interface PointsBreakdown {
    emergency: number;
    urgent: number;
    regular: number;
    feedback: number;
    penalties: number;
}

interface PointLogEntry {
    created_at: string;
    event_type: string;
    delta: number;
    note: string;
}

interface MonthlyStatEntry {
    month: string;
    jobs: number;
    points_earned: number;
    rating_end: number;
    earnings: number;
}

interface AnalyticsData {
    total_jobs: number;
    emergency_jobs: number;
    urgent_jobs: number;
    regular_jobs: number;
    cancelled_jobs: number;
    total_points: number;
    current_rating: number;
    completion_rate: number;
    total_earnings: number;
    points_breakdown: PointsBreakdown;
    recent_point_log: PointLogEntry[];
    monthly_stats: MonthlyStatEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function formatEventDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatEventLabel(eventType: string): string {
    return eventType
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Combo Chart: bars (jobs) + line (rating) ──────────────────────────────────
function ComboChart({ stats }: { stats: MonthlyStatEntry[] }) {
    if (stats.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-semibold">
                No data for the last 6 months
            </div>
        );
    }

    const W = 680;
    const H = 180;
    const PL = 40; // left padding (jobs Y axis)
    const PR = 40; // right padding (rating Y axis)
    const PT = 20; // top padding
    const PB = 32; // bottom padding (x labels)
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;

    const n = stats.length;
    const slotW = chartW / n;
    const barW = Math.min(slotW * 0.42, 28);

    // Jobs Y scale (left axis)
    const maxJobs = Math.max(...stats.map((s) => s.jobs), 1);
    const jobsYScale = (v: number) => PT + chartH - (v / maxJobs) * chartH;
    const jobsTicks = [0, Math.ceil(maxJobs / 2), maxJobs];

    // Rating Y scale (right axis, 0–max rating or min 5)
    const maxRating = Math.max(...stats.map((s) => s.rating_end), 5);
    const ratingYScale = (v: number) => PT + chartH - (v / maxRating) * chartH;

    // Line points
    const linePts = stats
        .map((s, i) => {
            const cx = PL + i * slotW + slotW / 2;
            const cy = ratingYScale(s.rating_end);
            return `${cx},${cy}`;
        })
        .join(" L ");

    const firstX = PL + 0 * slotW + slotW / 2;
    const lastX = PL + (n - 1) * slotW + slotW / 2;
    const firstY = ratingYScale(stats[0].rating_end);
    const lastY = ratingYScale(stats[n - 1].rating_end);

    const areaPath = `M ${firstX},${PT + chartH} L ${linePts.replace(" L ", ",")} L ${lastX},${PT + chartH} Z`;

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="100%"
            style={{ overflow: "visible" }}
        >
            <defs>
                <linearGradient id="ratingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.01" />
                </linearGradient>
            </defs>

            {/* Grid lines (jobs) */}
            {jobsTicks.map((t, i) => (
                <line
                    key={i}
                    x1={PL} y1={jobsYScale(t)}
                    x2={W - PR} y2={jobsYScale(t)}
                    stroke="#f1f5f9" strokeWidth={1}
                />
            ))}

            {/* Jobs Y axis labels */}
            {jobsTicks.map((t, i) => (
                <text
                    key={i}
                    x={PL - 6} y={jobsYScale(t)}
                    textAnchor="end" dominantBaseline="middle"
                    style={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }}
                >
                    {t}
                </text>
            ))}

            {/* Rating Y axis labels (right) */}
            {[0, Math.round(maxRating / 2), maxRating].map((t, i) => (
                <text
                    key={i}
                    x={W - PR + 6} y={ratingYScale(t)}
                    textAnchor="start" dominantBaseline="middle"
                    style={{ fontSize: 9, fill: "#f97316", fontWeight: 700 }}
                >
                    {t.toFixed(1)}
                </text>
            ))}

            {/* Bars */}
            {stats.map((s, i) => {
                const cx = PL + i * slotW + slotW / 2;
                const bx = cx - barW / 2;
                const bTop = jobsYScale(s.jobs);
                const bH = Math.max(jobsYScale(0) - bTop, 2);
                return (
                    <g key={i}>
                        <rect x={bx} y={bTop} width={barW} height={bH} rx={4}
                            fill="#1e3a5f" opacity={0.85} />
                        {s.jobs > 0 && (
                            <text
                                x={cx} y={bTop - 5}
                                textAnchor="middle"
                                style={{ fontSize: 9, fill: "#475569", fontWeight: 800 }}
                            >
                                {s.jobs}
                            </text>
                        )}
                        {/* X label */}
                        <text
                            x={cx} y={H - 6}
                            textAnchor="middle"
                            style={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }}
                        >
                            {formatMonth(s.month).toUpperCase()}
                        </text>
                    </g>
                );
            })}

            {/* Rating area fill */}
            <path d={areaPath} fill="url(#ratingAreaGrad)" />

            {/* Rating line */}
            <polyline
                points={stats.map((s, i) => {
                    const cx = PL + i * slotW + slotW / 2;
                    return `${cx},${ratingYScale(s.rating_end)}`;
                }).join(" ")}
                fill="none"
                stroke="#f97316"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Dots + value labels on line */}
            {stats.map((s, i) => {
                const cx = PL + i * slotW + slotW / 2;
                const cy = ratingYScale(s.rating_end);
                const isLast = i === n - 1;
                return (
                    <g key={i}>
                        {isLast && (
                            <circle cx={cx} cy={cy} r={6} fill="#f97316" opacity={0.2} />
                        )}
                        <circle cx={cx} cy={cy} r={isLast ? 5 : 3.5}
                            fill="white" stroke="#f97316" strokeWidth={2} />
                        {isLast && (
                            <text
                                x={cx} y={cy - 12}
                                textAnchor="middle"
                                style={{ fontSize: 10, fill: "#f97316", fontWeight: 900 }}
                            >
                                {s.rating_end.toFixed(1)}
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Axes */}
            <line x1={PL} y1={PT} x2={PL} y2={PT + chartH} stroke="#e2e8f0" strokeWidth={1.5} />
            <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="#e2e8f0" strokeWidth={1.5} />
            <line x1={W - PR} y1={PT} x2={W - PR} y2={PT + chartH} stroke="#fed7aa" strokeWidth={1} strokeDasharray="3 2" />
        </svg>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const AUTO_REFRESH_MS = 30_000;

export default function ServicerAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchAnalytics = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const result = await apiFetch("/services/providers/me/analytics");
            setData(result);
            setLastUpdated(new Date());
            setFetchError(null);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message.toLowerCase() : "";
            if (
                (err instanceof TypeError && errMsg.includes("failed to fetch")) ||
                errMsg.includes("timed out") ||
                errMsg.includes("request timed out")
            ) {
                setFetchError("Could not connect to the server. Please ensure the backend is running.");
            } else {
                setFetchError("Failed to load analytics data. Please try again.");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void fetchAnalytics();
        const interval = setInterval(() => { void fetchAnalytics(); }, AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchAnalytics]);

    if (loading) return <Spinner size="lg" py="py-32" />;

    if (fetchError) {
        return (
            <div className="space-y-6 animate-fade-in pb-16">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Performance Analytics</h1>
                    <p className="text-slate-400 text-xs font-semibold mt-1">
                        Last 6 months · auto-updated · ★ rating live
                    </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-semibold">{fetchError}</span>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const monthlyStats = (data.monthly_stats || []).slice(-6);
    const recentLog = (data.recent_point_log || []).slice(0, 8);
    const bd = data.points_breakdown;

    const ptsToAutoVerify = Math.max(0, 1000 - data.total_points);
    const starsToAutoVerify = (ptsToAutoVerify / 100).toFixed(1);
    const progressPct = Math.min((data.total_points / 1000) * 100, 100);

    const breakdownItems = [
        { label: "5-star reviews",    pts: bd.feedback,  color: "#10b981" },
        { label: "Regular completed", pts: bd.regular,   color: "#1e3a5f" },
        { label: "Emergency completed", pts: bd.emergency, color: "#f97316" },
        { label: "Urgent completed",  pts: bd.urgent,    color: "#f59e0b" },
        { label: "Cancellations",     pts: bd.penalties, color: "#f43f5e" },
    ];
    const netTotal = bd.emergency + bd.urgent + bd.regular + bd.feedback + bd.penalties;

    return (
        <div className="space-y-6 animate-fade-in pb-16">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Performance Analytics</h1>
                    <p className="text-slate-400 text-xs font-semibold mt-1">
                        Last 6 months · auto-updated · ★ rating live
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-[11px] font-semibold text-slate-400">
                            Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                    )}
                    <button
                        onClick={() => fetchAnalytics(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-50 text-xs font-semibold"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-xl text-xs font-semibold">
                        <BarChart2 className="w-3.5 h-3.5" />
                        Live
                    </div>
                </div>
            </div>

            {/* Top row: Star rating card + stat cards */}
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

                {/* Star Rating Card */}
                <div className="bg-[#1e3a5f] text-white rounded-2xl p-6 flex flex-col justify-between min-h-[180px]">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Your Star Rating</p>
                    <div className="flex items-baseline gap-3 my-3">
                        <span className="text-5xl font-black text-amber-400">★</span>
                        <span className="text-5xl font-black tracking-tight">
                            {data.current_rating > 0 ? data.current_rating.toFixed(1) : "New"}
                        </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mb-3">
                        {data.total_points.toLocaleString()} points ·{" "}
                        {ptsToAutoVerify > 0
                            ? `${starsToAutoVerify} stars away from auto-verify`
                            : "Auto-verified ✓"}
                    </p>
                    {/* Progress bar */}
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div
                            className="bg-amber-400 h-1.5 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                        {data.total_points} / 1000 pts to ★ 10.0
                    </p>
                </div>

                {/* 6 Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                        { label: "Total Jobs",    value: data.total_jobs,                  sub: null,              accent: "text-slate-900" },
                        { label: "Emergency Jobs", value: data.emergency_jobs,             sub: `${data.emergency_jobs > 0 ? Math.round((data.emergency_jobs / data.total_jobs) * 100) : 0}% of total`, accent: "text-rose-600" },
                        { label: "Completion %",  value: `${data.completion_rate.toFixed(1)}%`, sub: `${Math.round(data.completion_rate * data.total_jobs / 100)} / ${data.total_jobs}`, accent: "text-emerald-600" },
                        { label: "Urgent Jobs",   value: data.urgent_jobs,                sub: `${data.total_jobs > 0 ? Math.round((data.urgent_jobs / data.total_jobs) * 100) : 0}% of total`, accent: "text-amber-600" },
                        { label: "Regular Jobs",  value: data.regular_jobs,               sub: `${data.total_jobs > 0 ? Math.round((data.regular_jobs / data.total_jobs) * 100) : 0}% of total`, accent: "text-blue-600" },
                        { label: "Cancellations", value: data.cancelled_jobs,             sub: data.total_jobs > 0 ? `${((data.cancelled_jobs / (data.total_jobs + data.cancelled_jobs)) * 100).toFixed(1)}%` : "0%", accent: "text-rose-500" },
                    ].map((card) => (
                        <div key={card.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{card.label}</p>
                            <p className={`text-3xl font-black tracking-tight ${card.accent}`}>{card.value}</p>
                            {card.sub && <p className="text-[11px] text-slate-400 font-medium mt-1">{card.sub}</p>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom row: Trend chart + Points Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

                {/* 6-Month Performance Trend */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-900">6-Month Performance Trend</p>
                        <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm inline-block bg-[#1e3a5f]" />
                                jobs
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-0.5 inline-block bg-orange-400 rounded" />
                                rating
                            </span>
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mb-4">
                        Bars = jobs completed · Line = star rating (right axis)
                    </p>
                    <div style={{ height: 200 }}>
                        <ComboChart stats={monthlyStats} />
                    </div>
                </div>

                {/* Points Breakdown */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <p className="text-sm font-bold text-slate-900 mb-4">Points Breakdown</p>
                    <div className="space-y-3">
                        {breakdownItems.map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ background: item.color }}
                                    />
                                    <span className="text-xs text-slate-600 font-medium truncate">{item.label}</span>
                                </div>
                                <span
                                    className="text-xs font-bold tabular-nums"
                                    style={{ color: item.pts < 0 ? "#f43f5e" : "#374151" }}
                                >
                                    {item.pts > 0 ? `+${item.pts}` : item.pts}
                                </span>
                            </div>
                        ))}
                        <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">Net total</span>
                            <span className="text-sm font-black text-slate-900">{netTotal > 0 ? `+${netTotal}` : netTotal} pts</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                            ≈ {(netTotal / 100).toFixed(1)} stars (uncapped scale)
                        </p>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            {recentLog.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <p className="text-sm font-bold text-slate-900 mb-4">Recent Activity</p>
                    <div className="space-y-2.5">
                        {recentLog.map((entry, idx) => {
                            const isPositive = entry.delta > 0;
                            return (
                                <div key={idx} className="flex items-center gap-4">
                                    <span
                                        className="text-xs font-black min-w-[36px] tabular-nums flex-shrink-0"
                                        style={{ color: isPositive ? "#10b981" : "#f43f5e" }}
                                    >
                                        {isPositive ? "+" : ""}{entry.delta} pts
                                    </span>
                                    <span className="text-xs text-slate-600 font-medium flex-1 min-w-0 truncate">
                                        {formatEventLabel(entry.event_type)}
                                        {entry.note ? ` · ${entry.note}` : ""}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0">
                                        {formatEventDate(entry.created_at)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

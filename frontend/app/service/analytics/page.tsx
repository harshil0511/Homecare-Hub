"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Briefcase, Star, TrendingUp,
    AlertTriangle, Award, BarChart2,
    Calendar, Activity, RefreshCw, IndianRupee
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

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

function formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function formatEventDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => {
                const filled = rating >= s;
                const partial = !filled && rating > s - 1;
                return (
                    <span key={s} className="relative inline-block">
                        <Star className="w-5 h-5 text-slate-200 fill-slate-200" />
                        {(filled || partial) && (
                            <span
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: filled ? "100%" : `${(rating - (s - 1)) * 100}%` }}
                            >
                                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                            </span>
                        )}
                    </span>
                );
            })}
        </div>
    );
}

// ── Chart layout constants ────────────────────────────────────────────────────
const AXIS_W  = 60;   // fixed Y-axis SVG width
const MT      = 28;   // top margin inside chart SVGs
const MB      = 48;   // bottom margin (space for X labels)
const MR      = 20;   // right padding inside scrollable SVG
const SVG_H   = 300;  // total SVG height
const CH      = SVG_H - MT - MB; // = 224  chart area height

const BAR_SLOT = 52;  // px allocated per bar on the X axis
const BAR_W    = 10;  // thin bar width (trading-chart style)
const LINE_SLOT = 88; // px allocated per point on line charts

// ── Y-axis tick helper ────────────────────────────────────────────────────────
function getNiceTicks(min: number, max: number, count = 5): number[] {
    if (min === max) return [min - 1, min, min + 1];
    const range = max - min;
    const rawStep = range / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep) || 1)));
    const candidates = [1, 2, 2.5, 5, 10];
    const norm = rawStep / magnitude;
    const niceStep = (candidates.find((s) => s >= norm) || 10) * magnitude;
    const start = Math.floor(min / niceStep) * niceStep;
    const ticks: number[] = [];
    for (let v = start; ticks.length <= count + 2; v += niceStep) {
        ticks.push(Math.round(v * 1000) / 1000);
        if (v > max + niceStep) break;
    }
    return ticks;
}

// ── Shared: Y-axis panel (fixed, non-scrolling) ───────────────────────────────
function YAxisPanel({
    ticks,
    yScale,
    formatTick,
}: {
    ticks: number[];
    yScale: (v: number) => number;
    formatTick: (v: number) => string;
}) {
    return (
        <svg width={AXIS_W} height={SVG_H} className="flex-shrink-0 select-none">
            <g transform={`translate(0,${MT})`}>
                {ticks.map((tick, i) => {
                    const y = yScale(tick);
                    if (y < -2 || y > CH + 2) return null;
                    return (
                        <g key={i}>
                            {/* small tick mark */}
                            <line x1={AXIS_W - 5} y1={y} x2={AXIS_W} y2={y} stroke="#cbd5e1" strokeWidth={1} />
                            <text
                                x={AXIS_W - 8}
                                y={y}
                                textAnchor="end"
                                dominantBaseline="middle"
                                style={{ fontSize: 9, fontWeight: 900, fill: "#94a3b8" }}
                            >
                                {formatTick(tick)}
                            </text>
                        </g>
                    );
                })}
                {/* Y axis line */}
                <line x1={AXIS_W} y1={0} x2={AXIS_W} y2={CH} stroke="#e2e8f0" strokeWidth={1.5} />
                {/* bottom corner */}
                <line x1={AXIS_W} y1={CH} x2={AXIS_W} y2={CH} stroke="#e2e8f0" strokeWidth={1.5} />
            </g>
        </svg>
    );
}

// ── Vertical bar chart (thin bars, scrollable) ────────────────────────────────
interface BarDatum { label: string; value: number; color?: string }

function BarChart({
    bars,
    multiColor = false,
    defaultColor = "#10b981",
    formatTick = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1)),
    formatBarLabel = (v: number) => (v > 0 ? `+${v}` : `${v}`),
}: {
    bars: BarDatum[];
    multiColor?: boolean;
    defaultColor?: string;
    formatTick?: (v: number) => string;
    formatBarLabel?: (v: number) => string;
}) {
    if (!bars.length) {
        return (
            <div className="h-40 flex items-center justify-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
                No data
            </div>
        );
    }

    const values = bars.map((b) => b.value);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values, 1);
    const ticks = getNiceTicks(rawMin, rawMax, 5);
    const minY = ticks[0];
    const maxY = ticks[ticks.length - 1];
    const yRange = maxY - minY || 1;
    const yScale = (v: number) => CH - ((v - minY) / yRange) * CH;
    const zeroY = yScale(0);

    const chartAreaW = bars.length * BAR_SLOT + MR;

    return (
        <div className="flex" style={{ height: SVG_H }}>
            {/* Fixed Y axis */}
            <YAxisPanel ticks={ticks} yScale={yScale} formatTick={formatTick} />

            {/* Scrollable chart area */}
            <div className="overflow-x-auto flex-1" style={{ height: SVG_H }}>
                <svg width={chartAreaW} height={SVG_H} style={{ display: "block" }}>
                    <g transform={`translate(0,${MT})`}>
                        {/* Horizontal grid lines */}
                        {ticks.map((tick, i) => {
                            const y = yScale(tick);
                            if (y < -2 || y > CH + 2) return null;
                            return (
                                <line key={i} x1={0} y1={y} x2={chartAreaW} y2={y}
                                    stroke="#f1f5f9" strokeWidth={1} />
                            );
                        })}

                        {/* Zero line */}
                        <line x1={0} y1={zeroY} x2={chartAreaW} y2={zeroY}
                            stroke="#cbd5e1" strokeWidth={1.5} />

                        {/* Bars */}
                        {bars.map((b, i) => {
                            const cx = i * BAR_SLOT + BAR_SLOT / 2;
                            const bx = cx - BAR_W / 2;
                            const bTop = Math.min(yScale(b.value), zeroY);
                            const bH = Math.max(Math.abs(yScale(b.value) - zeroY), 2);
                            const fill = multiColor
                                ? (b.color || defaultColor)
                                : (b.value < 0 ? "#f43f5e" : defaultColor);
                            const labelY = b.value >= 0 ? bTop - 5 : bTop + bH + 11;

                            return (
                                <g key={i}>
                                    <rect x={bx} y={bTop} width={BAR_W} height={bH} rx={2} fill={fill} opacity={0.9} />
                                    {b.value !== 0 && (
                                        <text x={cx} y={labelY} textAnchor="middle"
                                            style={{ fontSize: 8, fontWeight: 900, fill: b.value < 0 ? "#f43f5e" : "#475569" }}>
                                            {formatBarLabel(b.value)}
                                        </text>
                                    )}
                                    {/* X label */}
                                    <text x={cx} y={CH + 18} textAnchor="middle"
                                        style={{ fontSize: 9, fontWeight: 900, fill: "#94a3b8" }}>
                                        {b.label.length > 7 ? b.label.slice(0, 6) + "…" : b.label.toUpperCase()}
                                    </text>
                                </g>
                            );
                        })}

                        {/* X axis line */}
                        <line x1={0} y1={CH} x2={chartAreaW} y2={CH} stroke="#e2e8f0" strokeWidth={1.5} />
                    </g>
                </svg>
            </div>
        </div>
    );
}

// ── Line chart (trading style — scrollable, values on dots) ───────────────────
function LineChart({
    points,
    color = "#10b981",
    gradId,
    formatTick = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1)),
}: {
    points: { label: string; value: number }[];
    color?: string;
    gradId: string;
    formatTick?: (v: number) => string;
}) {
    if (points.length < 2) {
        return (
            <div className="h-40 flex items-center justify-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
                Not enough data
            </div>
        );
    }

    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const ticks = getNiceTicks(rawMin, rawMax, 5);
    const minY = ticks[0];
    const maxY = ticks[ticks.length - 1];
    const yRange = maxY - minY || 1;
    const yScale = (v: number) => CH - ((v - minY) / yRange) * CH;

    // Each point gets LINE_SLOT px; total from first to last
    const chartAreaW = (points.length - 1) * LINE_SLOT + MR * 2 + 24;
    const xScale = (i: number) => i * LINE_SLOT + 12;

    const pts = points.map((p, i) => ({ x: xScale(i), y: yScale(p.value) }));
    const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
    const areaPts = [
        `${pts[0].x},${CH}`,
        ...pts.map((p) => `${p.x},${p.y}`),
        `${pts[pts.length - 1].x},${CH}`,
    ].join(" ");

    return (
        <div className="flex" style={{ height: SVG_H }}>
            {/* Fixed Y axis */}
            <YAxisPanel ticks={ticks} yScale={yScale} formatTick={formatTick} />

            {/* Scrollable chart area */}
            <div className="overflow-x-auto flex-1" style={{ height: SVG_H }}>
                <svg width={chartAreaW} height={SVG_H} style={{ display: "block" }}>
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                        </linearGradient>
                    </defs>
                    <g transform={`translate(0,${MT})`}>
                        {/* Horizontal grid lines */}
                        {ticks.map((tick, i) => {
                            const y = yScale(tick);
                            if (y < -2 || y > CH + 2) return null;
                            return (
                                <line key={i} x1={0} y1={y} x2={chartAreaW} y2={y}
                                    stroke="#f1f5f9" strokeWidth={1} />
                            );
                        })}

                        {/* Area fill */}
                        <polygon points={areaPts} fill={`url(#${gradId})`} />

                        {/* Line */}
                        <polyline points={linePts} fill="none" stroke={color}
                            strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

                        {/* Dots + value labels + X labels */}
                        {pts.map((p, i) => (
                            <g key={i}>
                                {/* Value above dot */}
                                <text x={p.x} y={p.y - 11} textAnchor="middle"
                                    style={{ fontSize: 9, fontWeight: 900, fill: color }}>
                                    {formatTick(points[i].value)}
                                </text>
                                <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={color} strokeWidth={2} />
                                {/* X label */}
                                <text x={p.x} y={CH + 18} textAnchor="middle"
                                    style={{ fontSize: 9, fontWeight: 900, fill: "#94a3b8" }}>
                                    {points[i].label.toUpperCase()}
                                </text>
                            </g>
                        ))}

                        {/* X axis line */}
                        <line x1={0} y1={CH} x2={chartAreaW} y2={CH} stroke="#e2e8f0" strokeWidth={1.5} />
                    </g>
                </svg>
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────
const AUTO_REFRESH_MS = 30_000; // 30 seconds

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
                console.error("Analytics fetch error:", err);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchAnalytics();
        const interval = setInterval(() => { void fetchAnalytics(); }, AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [fetchAnalytics]);

    if (loading) return <Spinner size="lg" py="py-32" />;

    if (fetchError) {
        return (
            <div className="space-y-10 animate-fade-in pb-16">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Analytics</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">
                        Performance overview and point history
                    </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const breakdown = data.points_breakdown;
    const breakdownBars: BarDatum[] = [
        { label: "Emergency", value: breakdown.emergency, color: "#10b981" },
        { label: "Urgent",    value: breakdown.urgent,    color: "#3b82f6" },
        { label: "Regular",   value: breakdown.regular,   color: "#64748b" },
        { label: "Feedback",  value: breakdown.feedback,  color: "#f59e0b" },
        { label: "Penalties", value: breakdown.penalties, color: "#f43f5e" },
    ];

    const recentLog = (data.recent_point_log || []).slice(0, 10);
    const activityBars: BarDatum[] = recentLog.map((e) => ({
        label: formatEventDate(e.created_at),
        value: e.delta,
    }));

    const monthlyStats = (data.monthly_stats || []).slice(-6);
    const monthlyJobsBars: BarDatum[]   = monthlyStats.map((s) => ({ label: formatMonth(s.month), value: s.jobs }));
    const monthlyPointsBars: BarDatum[] = monthlyStats.map((s) => ({ label: formatMonth(s.month), value: s.points_earned }));
    const ratingLine = monthlyStats.map((s) => ({ label: formatMonth(s.month), value: s.rating_end }));

    return (
        <div className="space-y-10 animate-fade-in pb-16">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Analytics</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">
                        Performance overview · auto-refreshes every 30s
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                    )}
                    <button
                        onClick={() => fetchAnalytics(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-2xl hover:bg-emerald-100 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {refreshing ? "Refreshing…" : "Refresh"}
                        </span>
                    </button>
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-2xl">
                        <BarChart2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
                    </div>
                </div>
            </div>

            {/* Section 1: Summary stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:-translate-y-1 transition-all">
                    <div className="w-14 h-14 bg-emerald-50 text-[#064e3b] rounded-2xl flex items-center justify-center mb-6">
                        <Briefcase className="w-7 h-7" />
                    </div>
                    <p className="text-4xl font-black text-[#000000] tracking-tighter">{data.total_jobs}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Jobs</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg">
                            {data.emergency_jobs} Emergency
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg">
                            {data.urgent_jobs} Urgent
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg">
                            {data.regular_jobs} Regular
                        </span>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:-translate-y-1 transition-all">
                    <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6">
                        <Star className="w-7 h-7" />
                    </div>
                    <p className="text-4xl font-black text-[#000000] tracking-tighter">
                        {data.current_rating > 0 ? data.current_rating.toFixed(1) : "N/A"}
                    </p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Current Rating</p>
                    <div className="mt-4">
                        <StarRating rating={data.current_rating} />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:-translate-y-1 transition-all">
                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                        <Award className="w-7 h-7" />
                    </div>
                    <p className="text-4xl font-black text-[#000000] tracking-tighter">{data.total_points.toLocaleString()}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Points</p>
                </div>

                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:-translate-y-1 transition-all">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                        <TrendingUp className="w-7 h-7" />
                    </div>
                    <p className="text-4xl font-black text-[#000000] tracking-tighter">{data.completion_rate.toFixed(1)}%</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Completion Rate</p>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(data.completion_rate, 100)}%` }}
                        />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:-translate-y-1 transition-all">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                        <IndianRupee className="w-7 h-7" />
                    </div>
                    <p className="text-4xl font-black text-[#000000] tracking-tighter">
                        {data.total_earnings > 0
                            ? `₹${data.total_earnings.toLocaleString("en-IN")}`
                            : "₹0"}
                    </p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Earned</p>
                </div>
            </div>

            {/* Section 2: Points Breakdown */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3 mb-2">
                    <BarChart2 className="w-4 h-4 text-[#064e3b]" />
                    Points Breakdown
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">
                    X: category · Y: points · scroll →
                </p>
                <div className="flex flex-wrap gap-3 mb-5">
                    {breakdownBars.map((b) => (
                        <div key={b.label} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: b.color }} />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{b.label}</span>
                        </div>
                    ))}
                </div>
                <BarChart
                    bars={breakdownBars}
                    multiColor
                    formatTick={(v) => (v > 0 ? `+${v}` : `${v}`)}
                    formatBarLabel={(v) => (v > 0 ? `+${v}` : `${v}`)}
                />
            </div>

            {/* Section 3: Monthly Performance */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-8">
                <div>
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-[#064e3b]" />
                        Monthly Performance
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        Last 6 months · X: month · Y: value · scroll →
                    </p>
                </div>

                {monthlyStats.length === 0 ? (
                    <EmptyState icon={Calendar} title="No monthly data yet" description="Stats will appear after your first completed month" />
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                                    Jobs per Month
                                </p>
                                <BarChart
                                    bars={monthlyJobsBars}
                                    defaultColor="#10b981"
                                    formatTick={(v) => `${Math.round(v)}`}
                                    formatBarLabel={(v) => `${v}`}
                                />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                    <Award className="w-3.5 h-3.5 text-purple-600" />
                                    Points Earned
                                </p>
                                <BarChart
                                    bars={monthlyPointsBars}
                                    defaultColor="#a855f7"
                                    formatTick={(v) => `${Math.round(v)}`}
                                    formatBarLabel={(v) => `+${v}`}
                                />
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                <Star className="w-3.5 h-3.5 text-amber-500" />
                                Rating Trend
                            </p>
                            <LineChart
                                points={ratingLine}
                                color="#f59e0b"
                                gradId="rating-grad"
                                formatTick={(v) => v.toFixed(1)}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Section 4: Recent Point Activity */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <Activity className="w-4 h-4 text-[#064e3b]" />
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Recent Point Activity</h2>
                    <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Last {recentLog.length} Events
                    </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                    X: event date · Y: points delta · scroll →
                </p>

                {recentLog.length === 0 ? (
                    <EmptyState icon={Activity} title="No activity yet" description="Complete jobs to earn points" />
                ) : (
                    <>
                        <BarChart
                            bars={activityBars}
                            defaultColor="#10b981"
                            formatTick={(v) => (v > 0 ? `+${v}` : `${v}`)}
                            formatBarLabel={(v) => (v > 0 ? `+${v}` : `${v}`)}
                        />
                        <div className="mt-5 space-y-1.5">
                            {recentLog.map((entry, idx) => {
                                const isPositive = entry.delta > 0;
                                const label = entry.event_type
                                    .toLowerCase()
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (c) => c.toUpperCase());
                                return (
                                    <div key={idx} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-slate-400 w-10 shrink-0">{formatEventDate(entry.created_at)}</span>
                                        <span className="text-slate-600 flex-1">{label}</span>
                                        <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                                            {isPositive ? "+" : ""}{entry.delta}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

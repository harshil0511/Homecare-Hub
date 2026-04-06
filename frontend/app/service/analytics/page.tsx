"use client";

import { useEffect, useState } from "react";
import {
    Briefcase, Star, TrendingUp, CheckCircle2,
    Zap, AlertTriangle, Award, BarChart2, Loader2,
    Calendar, Activity
} from "lucide-react";
import { apiFetch } from "@/lib/api";

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
    points_breakdown: PointsBreakdown;
    recent_point_log: PointLogEntry[];
    monthly_stats: MonthlyStatEntry[];
}

function formatEventType(eventType: string): string {
    return eventType
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
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

export default function ServicerAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [data, setData] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const result = await apiFetch("/services/providers/me/analytics");
                setData(result);
            } catch (err: any) {
                if (
                    (err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) ||
                    err?.message?.toLowerCase().includes("timed out") ||
                    err?.message?.toLowerCase().includes("request timed out")
                ) {
                    setFetchError("Could not connect to the server. Please ensure the backend is running.");
                } else {
                    setFetchError("Failed to load analytics data. Please try again.");
                    console.error("Analytics fetch error:", err);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-[#064e3b] animate-spin" />
            </div>
        );
    }

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

    // Compute bar chart normalization
    const breakdown = data.points_breakdown;
    const breakdownEntries: { label: string; value: number; color: string; icon: React.ElementType }[] = [
        { label: "Emergency", value: breakdown.emergency, color: "bg-emerald-500", icon: Zap },
        { label: "Urgent", value: breakdown.urgent, color: "bg-blue-500", icon: AlertTriangle },
        { label: "Regular", value: breakdown.regular, color: "bg-slate-500", icon: Briefcase },
        { label: "Feedback", value: breakdown.feedback, color: "bg-amber-500", icon: Star },
        { label: "Penalties", value: breakdown.penalties, color: "bg-rose-500", icon: Activity },
    ];
    const maxAbsValue = Math.max(...breakdownEntries.map((e) => Math.abs(e.value)), 1);

    // Last 10 point log entries
    const recentLog = (data.recent_point_log || []).slice(0, 10);

    // Last 6 monthly stats
    const monthlyStats = (data.monthly_stats || []).slice(-6);

    return (
        <div className="space-y-10 animate-fade-in pb-16">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Analytics</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">
                        Performance overview and point history
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-2xl">
                    <BarChart2 className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Live Stats</span>
                </div>
            </div>

            {/* Section 1: Summary stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Total Jobs */}
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

                {/* Current Rating */}
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

                {/* Total Points */}
                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:-translate-y-1 transition-all">
                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                        <Award className="w-7 h-7" />
                    </div>
                    <p className="text-4xl font-black text-[#000000] tracking-tighter">{data.total_points.toLocaleString()}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Points</p>
                </div>

                {/* Completion Rate */}
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
            </div>

            {/* Section 2: Points Breakdown Bar Chart */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3 mb-8">
                    <BarChart2 className="w-4 h-4 text-[#064e3b]" />
                    Points Breakdown
                </h2>
                <div className="space-y-5">
                    {breakdownEntries.map((entry) => {
                        const barWidth = maxAbsValue > 0 ? (Math.abs(entry.value) / maxAbsValue) * 100 : 0;
                        const isNegative = entry.value < 0;
                        return (
                            <div key={entry.label} className="flex items-center gap-4">
                                <div className="w-24 flex-shrink-0">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        {entry.label}
                                    </span>
                                </div>
                                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className={`${entry.color} h-3 rounded-full transition-all duration-500`}
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                                <div className="w-20 flex-shrink-0 text-right">
                                    <span className={`text-sm font-black tracking-tight ${isNegative ? "text-rose-600" : "text-slate-800"}`}>
                                        {isNegative ? "" : "+"}{entry.value.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Section 3: Recent Point Activity Log */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <Activity className="w-4 h-4 text-[#064e3b]" />
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Recent Point Activity</h2>
                    <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Last {recentLog.length} Events
                    </span>
                </div>

                {recentLog.length === 0 ? (
                    <div className="text-center py-16">
                        <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No activity yet</p>
                        <p className="text-slate-300 text-xs font-bold mt-2">Complete jobs to earn points</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Event Type</th>
                                    <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Points</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {recentLog.map((entry, idx) => {
                                    const isPositive = entry.delta > 0;
                                    const date = new Date(entry.created_at);
                                    const formattedDate = date.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    });
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-all">
                                            <td className="px-8 py-5">
                                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                                    {formattedDate}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-xs font-black text-[#000000] uppercase tracking-wide">
                                                    {formatEventType(entry.event_type)}
                                                </span>
                                                {entry.note && (
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{entry.note}</p>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className={`text-sm font-black tracking-tight ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {isPositive ? "+" : ""}{entry.delta.toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Section 4: Monthly Stats Table */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[#064e3b]" />
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Monthly Performance</h2>
                    <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Last 6 Months
                    </span>
                </div>

                {monthlyStats.length === 0 ? (
                    <div className="text-center py-16">
                        <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No monthly data yet</p>
                        <p className="text-slate-300 text-xs font-bold mt-2">Stats will appear after your first completed month</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                                    <th className="px-8 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Jobs</th>
                                    <th className="px-8 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Points Earned</th>
                                    <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Rating</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {monthlyStats.map((stat, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-all">
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-black text-[#000000] uppercase tracking-widest">
                                                {formatMonth(stat.month)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                {stat.jobs}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">
                                                +{stat.points_earned.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                    {stat.rating_end > 0 ? stat.rating_end.toFixed(1) : "N/A"}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
    Calendar, Clock, Filter, Search,
    Download, RefreshCw, ChevronRight,
    CheckCircle2, AlertCircle, MessageSquare
} from "lucide-react";

export default function BookingHistoryPage() {
    const router = useRouter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [bookings, setBookings] = useState<Record<string, any>[]>([]);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState("All");

    useEffect(() => {
        apiFetch("/bookings/list")
            .then(setBookings)
            .finally(() => setLoading(false));
    }, []);

    const filtered = bookings.filter(b => categoryFilter === "All" || b.service_type === categoryFilter);

    if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase tracking-widest text-slate-400">Loading History...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-20">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase mb-4">Operations Ledger</h1>
                    <div className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Complete history of site operations & service logs
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-white border border-slate-200 p-2 rounded-2xl flex items-center gap-1 shadow-sm overflow-x-auto">
                        {["All", "AC Service", "Appliance Repair", "Home Cleaning", "Plumbing", "Electrical", "Pest Control", "Painting", "Carpentry", "General Maintenance"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setCategoryFilter(f)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                    categoryFilter === f ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900"
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bookings List */}
            <div className="space-y-6">
                {filtered.length === 0 ? (
                    <div className="p-20 bg-white border border-dashed border-slate-200 rounded-[3rem] text-center space-y-4">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No entries found for this category</p>
                        <button onClick={() => router.push("/user/providers")} className="text-xs font-black text-emerald-600 uppercase underline">Find an Expert</button>
                    </div>
                ) : (
                    filtered.map((booking) => (
                        <div
                            key={booking.id}
                            onClick={() => router.push(`/user/bookings/${booking.id}`)}
                            className="bg-white border border-slate-200 rounded-[2.5rem] p-4 pr-10 hover:shadow-2xl hover:shadow-slate-200/50 transition-all cursor-pointer group"
                        >
                            <div className="flex flex-col md:flex-row md:items-center gap-8">
                                {/* Date Column */}
                                <div className="flex flex-col items-center justify-center w-24 h-24 bg-slate-50 border border-slate-100 rounded-3xl group-hover:bg-slate-900 group-hover:text-white transition-all">
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                        {new Date(booking.scheduled_at).toLocaleString('default', { month: 'short' })}
                                    </span>
                                    <span className="text-2xl font-black tracking-tighter">
                                        {new Date(booking.scheduled_at).getDate()}
                                    </span>
                                </div>

                                {/* Main Details */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{booking.service_type}</h3>
                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                            booking.status === "Completed" ? "bg-emerald-50 text-emerald-600" :
                                            booking.status === "Cancelled" ? "bg-rose-50 text-rose-600" :
                                            booking.status === "Pending" ? "bg-amber-50 text-amber-600" :
                                            "bg-blue-50 text-blue-600"
                                        }`}>
                                            {booking.status}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 flex items-center gap-4">
                                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="flex items-center gap-1.5 font-black uppercase text-emerald-600 tracking-widest">{booking.property_details || booking.priority}</span>
                                    </p>
                                </div>

                                {/* Stats & Action */}
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden lg:block">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operation Cost</p>
                                        <p className="text-xl font-black text-slate-900 tracking-tighter">
                                            {(booking.final_cost || booking.estimated_cost)
                                                ? `₹${Number(booking.final_cost || booking.estimated_cost).toLocaleString("en-IN")}`
                                                : "—"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {(booking.status === "Completed" || booking.status === "Cancelled") && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); router.push("/user/providers"); }}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all"
                                            >
                                                <RefreshCw size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Book Again</span>
                                            </button>
                                        )}
                                        <button className="p-4 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                                            <Download size={20} />
                                        </button>
                                        <div className="p-4 rounded-2xl bg-slate-900 text-white group-hover:bg-emerald-500 transition-all">
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { 
    Calendar, 
    Clock, 
    MessageSquare, 
    CheckCircle2, 
    XCircle, 
    Clock4, 
    ShieldCheck, 
    Building2,
    ArrowLeft,
    Inbox
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Booking {
    id: number;
    service_type: string;
    scheduled_at: string;
    status: string;
    notes: string;
    provider: {
        company_name: string;
        category: string;
        is_verified: boolean;
    };
}

export default function BookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBookings = async () => {
        try {
            const data = await apiFetch("/bookings/list");
            setBookings(data);
        } catch (err) {
            console.error("Failed to fetch bookings", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, []);

    const handleCancel = async (id: number) => {
        if (!confirm("Are you sure you want to cancel this booking?")) return;
        try {
            await apiFetch(`/bookings/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "Cancelled" })
            });
            fetchBookings();
        } catch (err) {
            alert("Failed to cancel booking");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <Link href="/dashboard" className="inline-flex items-center text-xs font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors mb-4 group">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-black text-[#000000] tracking-tight flex items-center gap-4">
                        Service Ledger
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase tracking-widest">Active Requests</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-2">Track and manage your professional service appointments</p>
                </div>
            </div>

            {/* Bookings List */}
            {bookings.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] py-32 text-center">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Inbox className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No Active Appointments</h3>
                    <p className="text-slate-500 text-sm mt-2 font-medium max-w-xs mx-auto">You haven't requested any services yet. Visit the network to find experts.</p>
                    <Link 
                        href="/dashboard"
                        className="inline-flex items-center mt-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        Browse Network
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">
                    {bookings.map((booking) => (
                        <div key={booking.id} className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group border border-white/5 transition-all hover:border-blue-500/30">
                            {/* Status Glow */}
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 -mr-16 -mt-16 transition-colors ${
                                booking.status === "Pending" ? "bg-amber-400" : 
                                booking.status === "Accepted" ? "bg-emerald-400" :
                                booking.status === "Completed" ? "bg-blue-400" : "bg-slate-400"
                            }`} />

                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
                                <div className="space-y-6 flex-1">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                            <Building2 className="w-7 h-7 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black tracking-tight">{booking.provider.company_name}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{booking.service_type}</p>
                                        </div>
                                        {booking.provider.is_verified && (
                                            <div className="w-6 h-6 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center border border-blue-500/20 tooltip" title="Verified Expert">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <Calendar className="w-3 h-3 text-blue-500" />
                                                Scheduled Date
                                            </p>
                                            <p className="text-sm font-bold text-slate-100">{new Date(booking.scheduled_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <Clock className="w-3 h-3 text-blue-500" />
                                                Arrival Window
                                            </p>
                                            <p className="text-sm font-bold text-slate-100">{new Date(booking.scheduled_at).toLocaleTimeString(undefined, { timeStyle: 'short' })}</p>
                                        </div>
                                    </div>

                                    {booking.notes && (
                                        <div className="bg-white/5 rounded-2xl p-4 flex gap-4">
                                            <MessageSquare className="w-5 h-5 text-slate-500 shrink-0 mt-1" />
                                            <p className="text-xs text-slate-400 font-medium leading-relaxed italic">"{booking.notes}"</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-end gap-6 w-full md:w-auto">
                                    <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 whitespace-nowrap ${
                                        booking.status === "Pending" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                        booking.status === "Accepted" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                        "bg-white/10 border-white/10 text-slate-300"
                                    }`}>
                                        {booking.status === "Pending" && <Clock4 className="w-3 h-3" />}
                                        {booking.status === "Accepted" && <CheckCircle2 className="w-3 h-3" />}
                                        {booking.status === "Cancelled" && <XCircle className="w-3 h-3" />}
                                        {booking.status}
                                    </div>

                                    {booking.status === "Pending" && (
                                        <button 
                                            onClick={() => handleCancel(booking.id)}
                                            className="w-full md:w-auto mt-auto px-6 py-2.5 rounded-xl border border-rose-500/30 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                                        >
                                            Cancel Request
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

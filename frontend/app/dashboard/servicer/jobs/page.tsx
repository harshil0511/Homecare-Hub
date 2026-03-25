"use client";

import { useEffect, useState } from "react";
import { Briefcase, Clock, MapPin, CheckCircle, XCircle, ChevronRight, User } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Booking {
    id: number;
    status: string;
    booking_date: string;
    booking_time: string;
    notes: string;
    society_name: string;
    user_name: string;
}

export default function ServicerJobsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = async () => {
        try {
            const data = await apiFetch("/bookings/incoming");
            setBookings(data);
        } catch (err) {
            console.error("Failed to fetch jobs", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const updateStatus = async (id: number, status: string) => {
        try {
            await apiFetch(`/bookings/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            });
            fetchJobs(); // Refresh list
        } catch (err) {
            alert("Failed to update status");
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">My Service Jobs</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">Manage your active and incoming requests</p>
                </div>
                <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-[#000000] uppercase tracking-widest">Provider Online</span>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
                    ))}
                </div>
            ) : bookings.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-[3rem] border border-slate-200 border-dashed">
                    <Briefcase className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-black uppercase tracking-widest text-sm">No active jobs found in your queue</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {bookings.map((booking) => (
                        <div key={booking.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700 opacity-50" />
                            
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                                <div className="flex items-start gap-6">
                                    <div className="w-16 h-16 bg-[#064e3b] rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-emerald-900/10">
                                        <User className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                                booking.status === "Accepted" ? "bg-blue-600 text-white" :
                                                booking.status === "Pending" ? "bg-amber-500 text-white" :
                                                booking.status === "Completed" ? "bg-emerald-600 text-white" :
                                                "bg-slate-500 text-white"
                                            }`}>
                                                {booking.status}
                                            </span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                ID: BK-{booking.id}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-black text-[#000000] tracking-tight">{booking.user_name}</h3>
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {booking.society_name}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#064e3b] uppercase tracking-widest">
                                                <Clock className="w-3.5 h-3.5" />
                                                {booking.booking_date} at {booking.booking_time}
                                            </div>
                                        </div>
                                        {booking.notes && (
                                            <p className="text-sm text-slate-500 font-medium italic mt-2 border-l-2 border-slate-100 pl-4">
                                                "{booking.notes}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    {booking.status === "Pending" && (
                                        <>
                                            <button 
                                                onClick={() => updateStatus(booking.id, "Accepted")}
                                                className="w-full sm:w-auto px-8 py-3.5 bg-[#064e3b] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Accept Job
                                            </button>
                                            <button 
                                                onClick={() => updateStatus(booking.id, "Cancelled")}
                                                className="w-full sm:w-auto px-8 py-3.5 bg-white border border-slate-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:border-rose-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    {booking.status === "Accepted" && (
                                        <button 
                                            onClick={() => updateStatus(booking.id, "Completed")}
                                            className="w-full sm:w-auto px-10 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Mark Completed
                                        </button>
                                    )}
                                    <button className="p-3.5 text-slate-300 hover:text-slate-900 bg-slate-50 rounded-xl transition-all">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

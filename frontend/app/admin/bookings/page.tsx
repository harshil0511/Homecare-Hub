"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Calendar, DollarSign, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Booking {
    id: number;
    user_id: number;
    provider_id: number | null;
    service_type: string | null;
    status: string;
    priority: string | null;
    scheduled_at: string | null;
    estimated_cost: number | null;
    created_at: string | null;
}

const STATUS_STYLE: Record<string, string> = {
    PENDING:     "bg-amber-50 text-amber-700 border-amber-100",
    ACCEPTED:    "bg-blue-50 text-blue-700 border-blue-100",
    IN_PROGRESS: "bg-purple-50 text-purple-700 border-purple-100",
    COMPLETED:   "bg-emerald-50 text-emerald-700 border-emerald-100",
    CANCELLED:   "bg-slate-100 text-slate-500 border-slate-200",
};

const PRIORITY_STYLE: Record<string, string> = {
    EMERGENCY: "text-rose-600 bg-rose-50",
    HIGH:      "text-orange-600 bg-orange-50",
    NORMAL:    "text-slate-500 bg-slate-50",
    LOW:       "text-slate-400 bg-slate-50",
};

interface BookingDetail {
    id: number;
    status: string;
    priority: string;
    service_type: string;
    scheduled_at: string | null;
    estimated_cost: number | null;
    issue_description: string | null;
    property_details: string | null;
    user: { username: string; email: string } | null;
    provider: { name: string; category: string; is_verified: boolean } | null;
}

function BRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <span className="text-xs font-bold text-slate-700 text-right max-w-[60%]">{value}</span>
        </div>
    );
}

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedBooking, setSelectedBooking] = useState<number | null>(null);
    const [bookingDetail, setBookingDetail] = useState<BookingDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const openBookingDetail = async (id: number) => {
        setSelectedBooking(id);
        setBookingDetail(null);
        setDetailLoading(true);
        try {
            const d: BookingDetail = await apiFetch(`/admin/bookings/${id}`);
            setBookingDetail(d);
        } catch {
            setBookingDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        apiFetch("/admin/bookings")
            .then((d) => setBookings(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = bookings.filter((b) => {
        const matchSearch =
            String(b.id).includes(search) ||
            (b.service_type || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.status || "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const statusCounts = bookings.reduce((acc, b) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">All Bookings</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">
                        {bookings.length} total bookings in the system
                    </p>
                </div>
            </div>

            {/* Status summary cards */}
            {!loading && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {["PENDING","ACCEPTED","IN_PROGRESS","COMPLETED","CANCELLED"].map((s) => (
                        <button key={s} onClick={() => setStatusFilter(s === statusFilter ? "ALL" : s)}
                            className={`p-4 rounded-2xl border text-center transition-all ${statusFilter === s ? "ring-2 ring-[#064e3b]" : ""} ${STATUS_STYLE[s] ?? "bg-slate-50 text-slate-500 border-slate-100"}`}>
                            <p className="text-lg font-black">{statusCounts[s] || 0}</p>
                            <p className="text-[9px] font-black uppercase tracking-wider mt-0.5">{s.replace("_"," ")}</p>
                        </button>
                    ))}
                </div>
            )}

            {/* Search + filter */}
            <div className="flex gap-3 items-center">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input className="bg-white border border-slate-200 rounded-xl py-2.5 pl-12 pr-4 text-xs font-black outline-none focus:ring-1 focus:ring-emerald-500 w-64 transition-all"
                        placeholder="Search by ID or service type..."
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {statusFilter !== "ALL" && (
                    <button onClick={() => setStatusFilter("ALL")}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        Clear Filter
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">
                        Booking Ledger — {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-semibold text-sm">No bookings found</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/20">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Booking</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Service</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Priority</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Scheduled</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((b) => (
                                    <tr key={b.id} onClick={() => openBookingDetail(b.id)} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-xs font-black text-slate-600">
                                                    #{b.id}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-500 uppercase">User #{b.user_id}</p>
                                                    {b.provider_id && <p className="text-[10px] text-slate-400">Provider #{b.provider_id}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-black text-[#000000] uppercase tracking-tight">{b.service_type || "—"}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border ${STATUS_STYLE[b.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                                {b.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${PRIORITY_STYLE[b.priority ?? "NORMAL"] ?? "text-slate-400 bg-slate-50"}`}>
                                                {b.priority || "NORMAL"}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                <Calendar className="w-3.5 h-3.5 opacity-40" />
                                                {b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString() : "—"}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-1 text-sm font-black text-[#000000]">
                                                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                                {b.estimated_cost != null ? b.estimated_cost.toFixed(0) : "—"}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {selectedBooking !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-base font-black text-slate-900 uppercase tracking-widest">
                                    Booking #{selectedBooking}
                                </h2>
                                <button
                                    onClick={() => { setSelectedBooking(null); setBookingDetail(null); }}
                                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                            {detailLoading ? (
                                <p className="text-sm text-slate-400 text-center py-6">Loading...</p>
                            ) : bookingDetail ? (
                                <div className="space-y-0">
                                    <BRow label="Service" value={bookingDetail.service_type || "—"} />
                                    <BRow label="Status" value={bookingDetail.status} />
                                    <BRow label="Priority" value={bookingDetail.priority || "Normal"} />
                                    <BRow label="Scheduled" value={bookingDetail.scheduled_at
                                        ? new Date(bookingDetail.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                        : "—"} />
                                    <BRow label="Est. Cost" value={bookingDetail.estimated_cost ? `₹${bookingDetail.estimated_cost.toLocaleString("en-IN")}` : "—"} />
                                    {bookingDetail.user && <>
                                        <BRow label="User" value={bookingDetail.user.username} />
                                        <BRow label="User Email" value={bookingDetail.user.email} />
                                    </>}
                                    {bookingDetail.provider && <>
                                        <BRow label="Provider" value={bookingDetail.provider.name} />
                                        <BRow label="Category" value={bookingDetail.provider.category || "—"} />
                                        <BRow label="Verified" value={bookingDetail.provider.is_verified ? "Yes" : "No"} />
                                    </>}
                                    {bookingDetail.issue_description && (
                                        <div className="pt-3 border-t border-slate-100 mt-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Issue</p>
                                            <p className="text-xs text-slate-600">{bookingDetail.issue_description}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 text-center py-6">Could not load details.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

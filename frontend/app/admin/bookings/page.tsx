"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Calendar, DollarSign, Search, X, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

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
    is_flagged?: boolean;
}

interface Complaint {
    id: string;
    booking_id: string;
    filed_by: string;
    reason: string;
    status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
    admin_notes?: string;
    created_at: string;
    resolved_at?: string;
}

interface SecretaryComplaint {
    id: string;
    society_id: string;
    filed_by: string;
    subject: string;
    description: string;
    status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
    admin_notes?: string;
    created_at: string;
    resolved_at?: string;
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
    actual_hours?: number | null;
    final_cost?: number | null;
    completion_notes?: string | null;
    is_flagged?: boolean;
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
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<"bookings" | "complaints" | "secretary-reports">("bookings");

    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedBooking, setSelectedBooking] = useState<number | null>(null);
    const [bookingDetail, setBookingDetail] = useState<BookingDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [secretaryComplaints, setSecretaryComplaints] = useState<SecretaryComplaint[]>([]);
    const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
    const [overrideAmount, setOverrideAmount] = useState<number | "">("");
    const [applyingAction, setApplyingAction] = useState<string | null>(null);

    const fetchComplaints = async () => {
        const data = await apiFetch("/admin/complaints").catch(() => []);
        setComplaints(Array.isArray(data) ? data : []);
    };

    const handleResolveComplaint = async (id: string, notes: string) => {
        try {
            await apiFetch(`/admin/complaints/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "RESOLVED", admin_notes: notes }),
            });
            toast.success("Complaint resolved");
            fetchComplaints();
        } catch (err) {
            toast.error((err as Error).message || "Failed to resolve complaint");
        }
    };

    const fetchSecretaryComplaints = async () => {
        const data = await apiFetch("/admin/secretary-complaints").catch(() => []);
        setSecretaryComplaints(Array.isArray(data) ? data : []);
    };

    const handleComplaintAction = async (
        complaintId: string,
        action: "cancel_bill" | "override_amount",
        amount?: number
    ) => {
        setApplyingAction(complaintId + action);
        try {
            await apiFetch(`/admin/complaints/${complaintId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    action,
                    ...(action === "override_amount" && amount !== undefined ? { override_amount: amount } : {}),
                }),
            });
            toast.success(action === "cancel_bill" ? "Bill cancelled — servicer notified" : "Amount overridden — booking completed");
            fetchComplaints();
        } catch (err) {
            toast.error((err as Error).message || "Action failed");
        } finally {
            setApplyingAction(null);
            setOverrideTarget(null);
            setOverrideAmount("");
        }
    };

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

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (activeTab === "complaints") void fetchComplaints();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (activeTab === "secretary-reports") void fetchSecretaryComplaints();
    }, [activeTab]);

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

    const openComplaintCount = complaints.filter(c => c.status === "OPEN").length;
    const openSecretaryCount = secretaryComplaints.filter(c => c.status === "OPEN").length;

    const tabs: { key: "bookings" | "complaints" | "secretary-reports"; label: string; count?: number }[] = [
        { key: "bookings", label: "Bookings" },
        { key: "complaints", label: "Complaints", count: openComplaintCount },
        { key: "secretary-reports", label: "Secretary Reports", count: openSecretaryCount || undefined },
    ];

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

            {/* Tab bar */}
            <div className="flex gap-2 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                            activeTab === tab.key
                                ? "border-[#064e3b] text-[#064e3b]"
                                : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                    >
                        {tab.label}
                        {tab.count != null && tab.count > 0 && (
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {activeTab === "bookings" && (
                <>
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
                                <Spinner size="lg" />
                            ) : filtered.length === 0 ? (
                                <EmptyState icon={ClipboardList} title="No bookings found" />
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
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border ${STATUS_STYLE[b.status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                                                            {b.status}
                                                        </span>
                                                        {b.is_flagged && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-widest">
                                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                                Flagged
                                                            </span>
                                                        )}
                                                    </div>
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
                </>
            )}

            {activeTab === "complaints" && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">
                            Customer Complaints
                        </h2>
                    </div>
                    {complaints.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">No complaints filed</div>
                    ) : (
                        complaints.map(c => (
                            <div key={c.id} className={`bg-white border rounded-2xl p-5 border-l-4 ${
                                c.status === "OPEN" ? "border-l-rose-500" :
                                c.status === "UNDER_REVIEW" ? "border-l-amber-500" : "border-l-emerald-500"
                            }`}>
                                <div className="flex justify-between items-start mb-2">
                                    <p className="font-black text-slate-900 text-sm">
                                        Booking #{c.booking_id.slice(0, 8)}
                                    </p>
                                    <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-lg ${
                                        c.status === "OPEN" ? "bg-rose-100 text-rose-700" :
                                        c.status === "UNDER_REVIEW" ? "bg-amber-100 text-amber-700" :
                                        "bg-emerald-100 text-emerald-700"
                                    }`}>
                                        {c.status.replace("_", " ")}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 mb-3 leading-relaxed">{c.reason}</p>
                                {c.admin_notes && (
                                    <p className="text-xs text-slate-500 italic mb-2">Note: {c.admin_notes}</p>
                                )}
                                <p className="text-[10px] text-slate-400 mb-3">
                                    Filed: {new Date(c.created_at).toLocaleString()}
                                </p>
                                {c.status !== "RESOLVED" && (
                                    <div className="flex gap-2 flex-wrap">
                                        {c.status === "OPEN" && (
                                            <button
                                                onClick={() => apiFetch(`/admin/complaints/${c.id}`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({ status: "UNDER_REVIEW" }),
                                                }).then(fetchComplaints).catch(() => toast.error("Failed"))}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg hover:bg-blue-100"
                                            >
                                                Mark Under Review
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleComplaintAction(c.id, "cancel_bill")}
                                            disabled={applyingAction === c.id + "cancel_bill"}
                                            className="px-3 py-1.5 bg-rose-50 text-rose-700 text-[10px] font-black uppercase rounded-lg hover:bg-rose-100 disabled:opacity-50"
                                        >
                                            {applyingAction === c.id + "cancel_bill" ? "Cancelling..." : "Cancel Bill"}
                                        </button>
                                        {overrideTarget === c.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={overrideAmount}
                                                    onChange={e => setOverrideAmount(e.target.value ? Number(e.target.value) : "")}
                                                    placeholder="New amount ₹"
                                                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                <button
                                                    onClick={() => overrideAmount !== "" && handleComplaintAction(c.id, "override_amount", Number(overrideAmount))}
                                                    disabled={overrideAmount === "" || applyingAction === c.id + "override_amount"}
                                                    className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg disabled:opacity-50"
                                                >
                                                    {applyingAction === c.id + "override_amount" ? "Applying..." : "Apply"}
                                                </button>
                                                <button onClick={() => setOverrideTarget(null)} className="text-slate-400 hover:text-slate-700">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setOverrideTarget(c.id); setOverrideAmount(""); }}
                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg hover:bg-emerald-100"
                                            >
                                                Override Amount
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                const notes = window.prompt("Add admin notes (optional):") ?? "";
                                                handleResolveComplaint(c.id, notes);
                                            }}
                                            className="px-3 py-1.5 bg-[#064e3b] text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-800"
                                        >
                                            Resolve
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === "secretary-reports" && (
                <div className="space-y-4">
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">Secretary Reports</h2>
                    {secretaryComplaints.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">No secretary reports filed</div>
                    ) : (
                        secretaryComplaints.map(c => (
                            <div key={c.id} className={`bg-white border rounded-2xl p-5 border-l-4 ${
                                c.status === "OPEN" ? "border-l-rose-500" :
                                c.status === "UNDER_REVIEW" ? "border-l-amber-500" : "border-l-emerald-500"
                            }`}>
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-black text-slate-900 text-sm">{c.subject}</p>
                                        <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                                        c.status === "OPEN" ? "bg-rose-50 text-rose-700" :
                                        c.status === "UNDER_REVIEW" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                                    }`}>{c.status.replace("_", " ")}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mb-3">{new Date(c.created_at).toLocaleDateString("en-IN")}</p>
                                {c.admin_notes && (
                                    <p className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-3 mb-3">{c.admin_notes}</p>
                                )}
                                {c.status !== "RESOLVED" && (
                                    <div className="flex gap-2">
                                        {c.status === "OPEN" && (
                                            <button
                                                onClick={() => apiFetch(`/admin/secretary-complaints/${c.id}`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({ status: "UNDER_REVIEW" }),
                                                }).then(fetchSecretaryComplaints).catch(() => toast.error("Failed"))}
                                                className="px-3 py-1.5 bg-amber-50 text-amber-700 text-[10px] font-black uppercase rounded-lg hover:bg-amber-100"
                                            >
                                                Mark Under Review
                                            </button>
                                        )}
                                        <button
                                            onClick={() => apiFetch(`/admin/secretary-complaints/${c.id}`, {
                                                method: "PATCH",
                                                body: JSON.stringify({ status: "RESOLVED" }),
                                            }).then(fetchSecretaryComplaints).catch(() => toast.error("Failed"))}
                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg hover:bg-emerald-100"
                                        >
                                            Resolve
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

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
                                    {bookingDetail.is_flagged && (
                                        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                            <p className="text-xs text-red-700 font-bold">This booking has been flagged</p>
                                        </div>
                                    )}
                                    {(bookingDetail.actual_hours != null || bookingDetail.final_cost != null) && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Charge Details</p>
                                            {bookingDetail.actual_hours != null && (
                                                <BRow label="Hours Worked" value={`${bookingDetail.actual_hours?.toFixed(1) ?? "—"}h`} />
                                            )}
                                            {bookingDetail.final_cost != null && (
                                                <BRow label="Final Charge" value={`₹${bookingDetail.final_cost.toLocaleString("en-IN")}`} />
                                            )}
                                            {bookingDetail.completion_notes && (
                                                <div className="py-2 border-b border-slate-50">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                                                    <p className="text-xs text-slate-600 italic">&ldquo;{bookingDetail.completion_notes}&rdquo;</p>
                                                </div>
                                            )}
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

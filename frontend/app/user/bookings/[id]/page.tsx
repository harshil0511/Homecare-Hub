"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import {
    Clock as ClockIcon, Calendar,
    ChevronRight, Settings, AlertTriangle,
    ShieldCheck, Send, Phone,
    X, FileText, Star, IndianRupee, CreditCard, Camera,
    CheckCircle2
} from "lucide-react";
import BookingStatusTimeline from "@/components/bookings/BookingStatusTimeline";
import QRScanner from "@/components/ui/QRScanner";

interface BookingProvider {
    company_name?: string;
    first_name?: string;
    last_name?: string;
}

interface BookingData {
    id: string | number;
    status: string;
    service_type: string;
    estimated_cost?: number;
    final_cost?: number;
    property_details?: string;
    scheduled_at: string;
    issue_description?: string;
    actual_hours?: number | string;
    completion_notes?: string;
    review?: unknown;
    status_history?: { status: string; notes: string; timestamp: string }[];
    chats?: ChatMessage[];
    user_id?: string;
    provider?: BookingProvider;
    flow_type?: string;
    provider_id?: string;
}

interface ChatMessage {
    sender_id?: string;
    message?: string;
    timestamp?: string;
}

interface ReceiptData {
    booking_id: string | number;
    service_type: string;
    servicer_name: string;
    completed_at: string | null;
    is_emergency?: boolean;
    callout_fee?: number;
    extra_hours?: number;
    hourly_rate?: number;
    extra_charge?: number;
    base_price?: number;
    final_amount: number;
}

type PayStep = "select" | "detail" | "confirm";
type PayMethod = "qr" | "bank" | "upi";

function statusColor(status: string) {
    if (status === "Pending") return "bg-amber-100 text-amber-600";
    if (status === "Completed") return "bg-emerald-100 text-emerald-700";
    if (status === "Cancelled") return "bg-rose-100 text-rose-600";
    if (status === "Pending Confirmation") return "bg-violet-100 text-violet-600";
    return "bg-blue-100 text-blue-600";
}

export default function BookingDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const toast = useToast();
    const [booking, setBooking] = useState<BookingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState("");

    const chatEndRef = useRef<HTMLDivElement>(null);
    const [showReschedule, setShowReschedule] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState("");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [showReview, setShowReview] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewHover, setReviewHover] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [qualityRating, setQualityRating] = useState(0);
    const [punctualityRating, setPunctualityRating] = useState(0);
    const [professionalismRating, setProfessionalismRating] = useState(0);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [receipt, setReceipt] = useState<ReceiptData | null>(null);
    const [showDispute, setShowDispute] = useState(false);
    const [disputeReason, setDisputeReason] = useState("");
    const [filingDispute, setFilingDispute] = useState(false);
    const [payDetails, setPayDetails] = useState<{
        account_holder_name: string;
        account_number_masked: string;
        account_number_last4: string;
        ifsc_code: string;
        upi_id: string | null;
        upi_qr_image_url: string | null;
        has_upi: boolean;
        has_qr: boolean;
    } | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [paying, setPaying] = useState(false);
    const [showQrScanner, setShowQrScanner] = useState(false);
    const [scannedQrData, setScannedQrData] = useState<string>("");

    const [showPayModal, setShowPayModal] = useState(false);
    const [payStep, setPayStep] = useState<PayStep>("select");
    const [selectedMethod, setSelectedMethod] = useState<PayMethod>("bank");

    const fetchData = async () => {
        try {
            const [data, me] = await Promise.all([
                apiFetch(`/bookings/${id}`),
                apiFetch("/user/me")
            ]);
            setBooking(data);
            setMessages(data.chats || []);
            setUserRole(me.role);
            if (data.status === "Completed" || data.status === "Pending Confirmation") {
                apiFetch(`/bookings/${id}/receipt`).then(setReceipt).catch((e) => console.error("Receipt fetch failed:", e));
            }
            if (data.flow_type === "systematic" && data.status === "Pending Confirmation" && data.provider_id) {
                apiFetch(`/payment/provider/${data.provider_id}/pay-details`)
                    .then(setPayDetails)
                    .catch(() => {});
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchData();
    }, [id]);

    useEffect(() => {
        if (!loading && booking && booking.status === "Completed" && userRole === "USER" && !booking.review) {
            const dismissed = localStorage.getItem(`review_dismissed_${id}`);
            if (!dismissed) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setShowReview(true);
            }
        }
    }, [loading, booking, userRole, id]);

    const handlePayNow = async () => {
        setPaying(true);
        try {
            await apiFetch(`/bookings/${id}/confirm`, { method: "POST" });
            setShowPayModal(false);
            router.push(`/user/bookings/${id}/receipt`);
        } catch (err) {
            toast.error((err as Error).message || "Failed to confirm payment");
        } finally {
            setPaying(false);
        }
    };

    const openPayModal = () => {
        setPayStep("select");
        setSelectedMethod("bank");
        setScannedQrData("");
        setRevealed(false);
        setShowPayModal(true);
    };

    const handleQrScan = useCallback((data: string) => {
        setShowQrScanner(false);
        setScannedQrData(data);
        toast.success("QR code scanned successfully");
    }, [toast]);

    const handleQrTimeout = useCallback(() => {
        setShowQrScanner(false);
        toast.error("Scanner timed out — please try again");
    }, [toast]);

    const handleDispute = async () => {
        if (!disputeReason.trim()) return;
        setFilingDispute(true);
        try {
            await apiFetch(`/bookings/${id}/complaint`, {
                method: "POST",
                body: JSON.stringify({ reason: disputeReason }),
            });
            setShowDispute(false);
            toast.success("Dispute filed — admin will review");
            await fetchData();
        } catch (err) {
            toast.error((err as Error).message || "Failed to file dispute");
        } finally {
            setFilingDispute(false);
        }
    };

    const handleSubmitReview = async () => {
        if (reviewRating === 0) {
            toast.error("Please select a star rating");
            return;
        }
        setSubmittingReview(true);
        try {
            await apiFetch(`/bookings/${id}/review`, {
                method: "POST",
                body: JSON.stringify({
                    rating: reviewRating,
                    review_text: reviewText || null,
                    quality_rating: qualityRating || reviewRating,
                    punctuality_rating: punctualityRating || reviewRating,
                    professionalism_rating: professionalismRating || reviewRating
                })
            });
            setShowReview(false);
            toast.success("Review submitted — thank you!");
            await fetchData();
        } catch (err) {
            toast.error((err as Error).message || "Failed to submit review");
        } finally {
            setSubmittingReview(false);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        try {
            const res = await apiFetch(`/bookings/${id}/chat/message`, {
                method: "POST",
                body: JSON.stringify({ message: newMessage })
            });
            setMessages([...messages, res]);
            setNewMessage("");
        } catch (err) {
            console.error(err);
        }
    };

    const handleCancel = async () => {
        try {
            await apiFetch(`/bookings/${id}/cancel`, {
                method: "PATCH",
                body: JSON.stringify({ reason: cancelReason })
            });
            setShowCancel(false);
            toast.success("Booking cancelled");
            setLoading(true);
            await fetchData();
        } catch (err) {
            toast.error((err as Error).message || "Failed to cancel booking");
        }
    };

    const [rescheduling, setRescheduling] = useState(false);

    const handleReschedule = async () => {
        if (!rescheduleDate) {
            alert("Please select a new date and time first.");
            return;
        }
        setRescheduling(true);
        try {
            let formattedDate = rescheduleDate;
            if (!formattedDate.includes("T")) {
                formattedDate = formattedDate.replace(" ", "T");
            }
            if (formattedDate.split(":").length === 2) {
                formattedDate += ":00";
            }
            await apiFetch(`/bookings/${id}/reschedule`, {
                method: "PATCH",
                body: JSON.stringify({ new_date: formattedDate })
            });
            setShowReschedule(false);
            toast.success("Schedule updated");
            setLoading(true);
            await fetchData();
        } catch (err) {
            toast.error((err as Error).message || "Failed to reschedule. Please try again.");
        } finally {
            setRescheduling(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase tracking-widest text-slate-400">Synchronizing Details...</div>;
    if (!booking) return <div className="p-20 text-center text-rose-500 font-black uppercase">Booking Not Found</div>;

    const providerName = booking.provider?.company_name
        || `${booking.provider?.first_name || ""} ${booking.provider?.last_name || ""}`.trim()
        || "Provider";

    const providerInitial = providerName.charAt(0).toUpperCase();

    const scheduledDate = new Date(booking.scheduled_at);

    // Service details rows for the table
    const serviceRows: { label: string; value: string; highlight?: boolean }[] = [
        { label: "Service Type", value: booking.service_type },
        {
            label: "Scheduled For",
            value: `${scheduledDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · ${scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        },
        { label: "Location", value: booking.property_details || "—" },
    ];
    if (booking.actual_hours) {
        serviceRows.push({ label: "Actual Hours", value: `${booking.actual_hours} hours` });
    }
    if (booking.final_cost) {
        serviceRows.push({ label: "Final Cost", value: `₹${Number(booking.final_cost).toLocaleString("en-IN")}`, highlight: true });
    } else if (booking.estimated_cost) {
        serviceRows.push({ label: "Estimated Cost", value: `₹${Number(booking.estimated_cost).toLocaleString("en-IN")}` });
    }

    const isPendingConfirm = booking.status === "Pending Confirmation" && userRole === "USER";
    const isCompleted = booking.status === "Completed";
    const canRescheduleOrCancel = !["Completed", "Cancelled", "Pending Confirmation"].includes(booking.status);

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-5">

            {/* ── Page Header ── */}
            <div className="space-y-2">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button
                        onClick={() => router.push("/user/bookings")}
                        className="hover:text-slate-700 transition-colors"
                    >
                        Bookings
                    </button>
                    <ChevronRight size={10} />
                    <span className="text-slate-600">Booking #{booking.id.toString().slice(0, 8).toUpperCase()}</span>
                </div>

                {/* Title row */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            {booking.service_type}
                        </h1>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">
                            Booked on {scheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, {scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {providerName !== "Provider" && <> · with {providerName}</>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${statusColor(booking.status)}`}>
                            {booking.status}
                        </span>
                        {canRescheduleOrCancel && (
                            <>
                                <button
                                    onClick={() => setShowReschedule(true)}
                                    className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all text-slate-600 shadow-sm"
                                >
                                    <Calendar size={11} /> Reschedule
                                </button>
                                <button
                                    onClick={() => setShowCancel(true)}
                                    className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl hover:bg-rose-100 transition-all text-rose-600"
                                >
                                    <AlertTriangle size={11} /> Cancel
                                </button>
                            </>
                        )}
                        {isCompleted && userRole === "USER" && !booking.review && (
                            <button
                                onClick={() => setShowReview(true)}
                                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl hover:bg-amber-100 transition-all text-amber-700"
                            >
                                <Star size={11} /> Rate Service
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 2-Column Body ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">

                {/* LEFT COLUMN */}
                <div className="space-y-4">

                    {/* Status Timeline */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-5">Status Timeline</h4>
                        <BookingStatusTimeline currentStatus={booking.status} history={booking.status_history} />
                    </div>

                    {/* Service Details Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Service Details</h4>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {serviceRows.map(({ label, value, highlight }) => (
                                <div key={label} className="flex items-center justify-between px-6 py-3.5">
                                    <span className="text-xs font-semibold text-slate-500">{label}</span>
                                    <span className={`text-sm font-black text-right ${highlight ? "text-emerald-700" : "text-slate-900"}`}>
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Issue Description */}
                    {booking.issue_description && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Issue Description</h4>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">{booking.issue_description}</p>
                        </div>
                    )}

                    {/* Technician Notes (completed) */}
                    {isCompleted && booking.completion_notes && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Technician Notes</h4>
                            <p className="text-sm text-slate-600 italic leading-relaxed">{booking.completion_notes}</p>
                        </div>
                    )}

                    {/* ── Charge Action Card (Pending Confirmation) ── */}
                    {isPendingConfirm && receipt && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Charge Submitted</p>
                                    <p className="text-xl font-black text-slate-900 tracking-tight">
                                        ₹{Number(booking.final_cost ?? booking.estimated_cost ?? 0).toLocaleString("en-IN")}
                                    </p>
                                </div>
                                <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-lg">
                                    Awaiting your action
                                </span>
                            </div>

                            {/* Breakdown */}
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 space-y-2 text-sm">
                                {receipt.is_emergency ? (
                                    <>
                                        <div className="flex justify-between text-slate-600">
                                            <span>Callout fee (1st hour)</span>
                                            <span className="font-bold">₹{Number(receipt.callout_fee).toLocaleString("en-IN")}</span>
                                        </div>
                                        {Number(receipt.extra_hours) > 0 && (
                                            <div className="flex justify-between text-slate-600">
                                                <span>Extra ({Number(receipt.extra_hours).toFixed(1)}h × ₹{Number(receipt.hourly_rate).toFixed(0)}/h)</span>
                                                <span className="font-bold">₹{Number(receipt.extra_charge).toLocaleString("en-IN")}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    Number(receipt.extra_hours) > 0 && (
                                        <div className="flex justify-between text-slate-600">
                                            <span>{Number(receipt.extra_hours)}h × ₹{Number(receipt.hourly_rate).toFixed(0)}/h</span>
                                            <span className="font-bold">₹{Number(receipt.extra_charge).toLocaleString("en-IN")}</span>
                                        </div>
                                    )
                                )}
                                <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-2">
                                    <span>Total</span>
                                    <span className="text-emerald-700">₹{Number(receipt.final_amount).toLocaleString("en-IN")}</span>
                                </div>
                            </div>

                            {/* Dispute inline form or action buttons */}
                            <div className="px-6 py-4">
                                {!showDispute ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={openPayModal}
                                            className="py-3.5 bg-[#064e3b] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle2 size={14} /> Confirm Charge
                                        </button>
                                        <button
                                            onClick={() => setShowDispute(true)}
                                            className="py-3.5 border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase hover:bg-rose-50 transition-colors"
                                        >
                                            Reject &amp; Flag to Admin
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <textarea
                                            value={disputeReason}
                                            onChange={e => setDisputeReason(e.target.value)}
                                            placeholder="Describe the issue with this charge..."
                                            rows={3}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowDispute(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-500">
                                                Back
                                            </button>
                                            <button
                                                onClick={handleDispute}
                                                disabled={filingDispute || !disputeReason.trim()}
                                                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase disabled:opacity-50"
                                            >
                                                {filingDispute ? "Submitting..." : "File Dispute"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Receipt card (Completed) */}
                    {isCompleted && receipt && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-[9px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                        <FileText size={10} /> Payment Receipt
                                    </h4>
                                    <p className="text-2xl font-black text-emerald-700 tracking-tight">
                                        ₹{Number(receipt.final_amount).toLocaleString("en-IN")}
                                    </p>
                                </div>
                                <div className="text-right text-xs text-slate-500 font-medium space-y-0.5">
                                    <p className="font-black text-slate-700">{receipt.servicer_name}</p>
                                    <p>{receipt.completed_at ? new Date(receipt.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push(`/user/bookings/${id}/receipt`)}
                                className="w-full py-3 border border-emerald-300 text-emerald-700 rounded-xl text-xs font-black uppercase hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <FileText size={12} /> View Full Receipt
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="flex flex-col gap-4 lg:sticky lg:top-6">

                    {/* Provider Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl shadow-slate-900/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg text-emerald-400 flex-shrink-0">
                                {providerInitial}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="text-sm font-black tracking-tight truncate">{providerName}</h3>
                                    <ShieldCheck size={13} className="text-emerald-500 flex-shrink-0" />
                                </div>
                                <p className="text-[9px] font-bold text-emerald-400/60 uppercase tracking-widest mt-0.5">Assigned Expert</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button className="bg-white/5 border border-white/10 py-2.5 rounded-xl flex flex-col items-center gap-1 hover:bg-white/10 transition-all">
                                <Phone size={14} className="text-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Call</span>
                            </button>
                            <button className="bg-white/5 border border-white/10 py-2.5 rounded-xl flex flex-col items-center gap-1 hover:bg-white/10 transition-all">
                                <FileText size={14} className="text-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
                            </button>
                        </div>
                    </div>

                    {/* Chat */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-[520px]">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Service Chat</h3>
                            </div>
                            <Settings size={13} className="text-slate-300" />
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {messages.length === 0 && (
                                <p className="text-center text-[10px] text-slate-300 font-medium uppercase tracking-widest mt-10">No messages yet</p>
                            )}
                            {messages.map((m, i) => {
                                const isUser = m.sender_id === booking.user_id;
                                const isSystem = !m.sender_id || m.sender_id === "system";
                                if (isSystem) {
                                    return (
                                        <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
                                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">⚠ System</p>
                                            <p className="text-xs font-medium text-amber-800 mt-0.5">{m.message}</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${
                                            isUser
                                                ? "bg-slate-900 text-white rounded-br-none"
                                                : "bg-slate-50 border border-slate-100 text-slate-800 rounded-bl-none"
                                        }`}>
                                            <p>{m.message}</p>
                                            <p className={`text-[9px] mt-1 font-black uppercase opacity-40 ${isUser ? "text-right" : "text-left"}`}>
                                                {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                                {!isUser && <> · {providerName.split(" ")[0]}</>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex-shrink-0">
                            <div className="relative">
                                <input
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyPress={e => e.key === "Enter" && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="absolute right-2 top-1.5 w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-all"
                                >
                                    <Send size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Cancel Modal ── */}
            {showCancel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Cancel Booking</h3>
                            <button onClick={() => setShowCancel(false)} className="text-slate-400"><X /></button>
                        </div>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed">Please provide a reason for cancellation. This helps us improve our service network.</p>
                        <textarea
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 font-bold text-sm outline-none"
                            placeholder="Reason for cancellation..."
                            rows={4}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setShowCancel(false)} className="py-4 rounded-xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50">Back</button>
                            <button onClick={handleCancel} className="py-4 rounded-xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20">Confirm Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reschedule Modal ── */}
            {showReschedule && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Reschedule Service</h3>
                            <button onClick={() => setShowReschedule(false)} className="text-slate-400"><X /></button>
                        </div>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed">Choose a new date and time for this request. If the job was cancelled, it will be automatically re-opened for the provider.</p>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Date &amp; Time</label>
                            <input
                                type="datetime-local"
                                value={rescheduleDate}
                                onChange={e => setRescheduleDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setShowReschedule(false)} className="py-4 rounded-xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50">Cancel</button>
                            <button
                                onClick={handleReschedule}
                                disabled={rescheduling}
                                className={`py-4 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg transition-all ${rescheduling ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 shadow-slate-900/20 active:scale-95"}`}
                            >
                                {rescheduling ? "Updating..." : "Update Schedule"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Review Modal ── */}
            {showReview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Rate Service</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                    {providerName} · {booking.service_type}
                                </p>
                            </div>
                            <button onClick={() => { setShowReview(false); localStorage.setItem(`review_dismissed_${id}`, "1"); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-black transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="text-center space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Rating</p>
                            <div className="flex items-center justify-center gap-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onMouseEnter={() => setReviewHover(star)}
                                        onMouseLeave={() => setReviewHover(0)}
                                        onClick={() => setReviewRating(star)}
                                        className="transition-transform hover:scale-125 active:scale-95"
                                    >
                                        <Star size={36} className={`transition-colors ${(reviewHover || reviewRating) >= star ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                                    </button>
                                ))}
                            </div>
                            {reviewRating > 0 && (
                                <p className="text-xs font-black text-amber-600 uppercase tracking-widest">
                                    {["", "Poor", "Fair", "Good", "Great", "Excellent"][reviewRating]}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: "Quality", value: qualityRating, set: setQualityRating },
                                { label: "Punctuality", value: punctualityRating, set: setPunctualityRating },
                                { label: "Professional", value: professionalismRating, set: setProfessionalismRating }
                            ].map(cat => (
                                <div key={cat.label} className="text-center space-y-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cat.label}</p>
                                    <div className="flex items-center justify-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <button key={s} onClick={() => cat.set(s)}>
                                                <Star size={14} className={`transition-colors ${cat.value >= s ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feedback (Optional)</label>
                            <textarea
                                value={reviewText}
                                onChange={e => setReviewText(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                                placeholder="Share your experience..."
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => { setShowReview(false); localStorage.setItem(`review_dismissed_${id}`, "1"); }} className="py-4 rounded-xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50">Skip</button>
                            <button
                                onClick={handleSubmitReview}
                                disabled={submittingReview || reviewRating === 0}
                                className={`py-4 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg transition-all ${submittingReview || reviewRating === 0 ? "bg-slate-300 cursor-not-allowed" : "bg-[#064e3b] shadow-emerald-900/20 active:scale-95"}`}
                            >
                                {submittingReview ? "Submitting..." : "Submit Rating"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Payment Method Modal ── */}
            {showPayModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 space-y-6 animate-in fade-in zoom-in duration-200">

                        {payStep === "select" && (
                            <>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Pay Your Provider</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Choose payment method</p>
                                    </div>
                                    <button onClick={() => setShowPayModal(false)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-black transition-colors">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex justify-between items-center">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Amount Due</p>
                                    <p className="text-2xl font-black text-slate-900">
                                        ₹{Number(booking?.final_cost ?? booking?.estimated_cost ?? 0).toLocaleString("en-IN")}
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {(["qr", "bank", "upi"] as PayMethod[]).map((method) => {
                                        const labels: Record<PayMethod, { title: string; sub: string; icon: React.ReactNode }> = {
                                            qr:   { title: "QR Scanner",    sub: "Scan provider's UPI QR code",  icon: <Camera size={20} className="text-emerald-600" /> },
                                            bank: { title: "Bank Transfer", sub: "NEFT / IMPS to bank account",  icon: <CreditCard size={20} className="text-emerald-600" /> },
                                            upi:  { title: "UPI Transfer",  sub: "PhonePe, GPay, Paytm & more", icon: <IndianRupee size={20} className="text-emerald-600" /> },
                                        };
                                        const { title, sub, icon } = labels[method];
                                        const isSelected = selectedMethod === method;
                                        return (
                                            <button
                                                key={method}
                                                onClick={() => setSelectedMethod(method)}
                                                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${isSelected ? "border-[#064e3b] bg-emerald-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? "bg-emerald-100" : "bg-slate-100"}`}>{icon}</div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-black text-slate-900">{title}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-slate-200"}`}>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <button onClick={() => setPayStep("detail")} className="w-full py-4 bg-[#064e3b] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-800 transition-colors">
                                    Continue →
                                </button>
                            </>
                        )}

                        {payStep === "detail" && (
                            <>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => { setPayStep("select"); setScannedQrData(""); setShowQrScanner(false); setRevealed(false); }} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-black transition-colors">
                                        <ClockIcon size={18} />
                                    </button>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                            {selectedMethod === "qr" ? "QR Scanner" : selectedMethod === "bank" ? "Bank Transfer" : "UPI Transfer"}
                                        </h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Complete your payment</p>
                                    </div>
                                    <button onClick={() => { setShowPayModal(false); setShowQrScanner(false); }} className="ml-auto p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-black transition-colors">
                                        <X size={18} />
                                    </button>
                                </div>

                                {selectedMethod === "qr" && (
                                    <div className="space-y-4">
                                        {!scannedQrData ? (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-4">
                                                <p className="text-sm font-black text-slate-700">Open camera to scan the provider&apos;s QR code</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Camera stays open for 2 minutes</p>
                                                <button onClick={() => setShowQrScanner(true)} className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#064e3b] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-800 transition-colors">
                                                    <Camera size={14} /> Open QR Scanner
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">QR Scanned Successfully</p>
                                                <p className="text-sm font-mono font-black text-emerald-800 break-all">{scannedQrData}</p>
                                                <button onClick={() => { setScannedQrData(""); setShowQrScanner(true); }} className="text-[10px] text-slate-400 underline font-medium">Scan again</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedMethod === "bank" && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                                        {payDetails ? (
                                            <>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Account Holder</span>
                                                    <span className="text-sm font-black text-slate-900">{payDetails.account_holder_name}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Account Number</span>
                                                    <button onClick={() => setRevealed(!revealed)} className="text-sm font-mono font-black text-slate-900 hover:text-[#064e3b] transition-colors">
                                                        {revealed ? payDetails.account_number_masked : "XXXXXX••••"}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">IFSC Code</span>
                                                    <span className="text-sm font-mono font-black text-slate-900">{payDetails.ifsc_code}</span>
                                                </div>
                                                {!revealed && <p className="text-[10px] text-slate-400 font-medium text-center pt-1">Tap account number to reveal</p>}
                                            </>
                                        ) : (
                                            <p className="text-sm font-medium text-slate-500 text-center">Contact your provider directly for bank account details, then confirm payment below.</p>
                                        )}
                                    </div>
                                )}

                                {selectedMethod === "upi" && (
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                                        {payDetails?.has_upi && payDetails.upi_id ? (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">UPI ID</span>
                                                <span className="text-sm font-mono font-black text-slate-900">{payDetails.upi_id}</span>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium text-slate-500 text-center">Contact your provider for their UPI ID, then confirm payment below.</p>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={() => setPayStep("confirm")}
                                    disabled={selectedMethod === "qr" && !scannedQrData}
                                    className="w-full py-4 bg-[#064e3b] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {selectedMethod === "qr" && !scannedQrData ? "Scan QR first" : "I've Completed the Transfer →"}
                                </button>
                            </>
                        )}

                        {payStep === "confirm" && (
                            <>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setPayStep("detail")} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-black transition-colors">
                                        <ClockIcon size={18} />
                                    </button>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Confirm Payment</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Final step</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Method</span>
                                        <span className="text-sm font-black text-slate-900">
                                            {selectedMethod === "qr" ? "QR Scanner" : selectedMethod === "bank" ? "Bank Transfer" : "UPI Transfer"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Amount</span>
                                        <span className="text-xl font-black text-emerald-700">
                                            ₹{Number(booking?.final_cost ?? booking?.estimated_cost ?? 0).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Service</span>
                                        <span className="text-sm font-black text-slate-900">{booking?.service_type}</span>
                                    </div>
                                </div>

                                <p className="text-[10px] text-slate-400 font-medium text-center">
                                    Tapping below records your payment and marks this booking as settled. No money is transferred through the app.
                                </p>

                                <button
                                    onClick={handlePayNow}
                                    disabled={paying}
                                    className="w-full py-4 bg-[#064e3b] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                                >
                                    {paying ? "Processing..." : "✓ Confirm & View Receipt"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showQrScanner && (
                <QRScanner
                    onScan={handleQrScan}
                    onClose={() => setShowQrScanner(false)}
                    onTimeout={handleQrTimeout}
                />
            )}
        </div>
    );
}

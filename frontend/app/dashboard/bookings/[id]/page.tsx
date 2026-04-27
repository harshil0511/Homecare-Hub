"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
    Clock as ClockIcon, Calendar,
    ChevronLeft, Settings, AlertTriangle,
    ShieldCheck, Send, Phone, MapPin,
    X, FileText, Star, CheckCircle2
} from "lucide-react";
import BookingStatusTimeline from "@/components/bookings/BookingStatusTimeline";

interface BookingProvider {
    company_name: string;
}

interface BookingData {
    id: number;
    status: string;
    service_type: string;
    estimated_cost: number;
    property_details: string;
    scheduled_at: string;
    issue_description: string;
    review?: unknown;
    status_history?: { status: string; notes: string; timestamp: string }[];
    chats?: ChatMessage[];
    user_id?: string;
    provider: BookingProvider;
}

interface ChatMessage {
    sender_id?: string;
    message?: string;
    timestamp?: string;
}

export default function BookingDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
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
    const [completing, setCompleting] = useState(false);

    const fetchData = async () => {
        try {
            const [data, me] = await Promise.all([
                apiFetch(`/bookings/${id}`),
                apiFetch("/user/me")
            ]);
            setBooking(data);
            setMessages(data.chats || []);
            setUserRole(me.role);
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

    // Auto-prompt review modal when USER visits a completed booking with no review
    useEffect(() => {
        if (!loading && booking && booking.status === "Completed" && userRole === "USER" && !booking.review) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowReview(true);
        }
    }, [loading, booking, userRole]);

    const handleMarkComplete = async () => {
        setCompleting(true);
        try {
            await apiFetch(`/bookings/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "Completed" })
            });
            await fetchData();
        } catch (err) {
            alert((err as Error).message || "Failed to mark as completed");
        } finally {
            setCompleting(false);
        }
    };

    const handleSubmitReview = async () => {
        if (reviewRating === 0) {
            alert("Please select a star rating");
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
            await fetchData();
        } catch (err) {
            alert((err as Error).message || "Failed to submit review");
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
            setLoading(true);
            await fetchData();
        } catch (err) {
            console.error(err);
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
            // datetime-local gives YYYY-MM-DDTHH:MM. We ensure it's ISO by adding :00 if needed.
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
            setLoading(true);
            await fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to reschedule. Please check the network and try again.");
        } finally {
            setRescheduling(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase tracking-widest text-slate-400">Synchronizing Details...</div>;
    if (!booking) return <div className="p-20 text-center text-rose-500 font-black uppercase">Booking Not Found</div>;

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                    <ChevronLeft size={16} /> Back to dashboard
                </button>
                <div className="flex items-center gap-4">
                    {booking.status === "Completed" && userRole === "USER" && !booking.review && (
                        <button
                            onClick={() => setShowReview(true)}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-6 py-3 rounded-xl hover:bg-amber-100 transition-all text-amber-700"
                        >
                            <Star size={14} /> Give Feedback
                        </button>
                    )}
                    {(booking.status === "Accepted" || booking.status === "In Progress") && userRole === "SERVICER" && (
                        <button
                            onClick={handleMarkComplete}
                            disabled={completing}
                            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-sm ${completing ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-[#064e3b] text-white hover:bg-emerald-800 active:scale-95 shadow-emerald-900/20"}`}
                        >
                            <CheckCircle2 size={14} /> {completing ? "Completing..." : "Mark Complete"}
                        </button>
                    )}
                    <button
                        onClick={() => setShowReschedule(true)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 px-6 py-3 rounded-xl hover:bg-slate-50 transition-all text-slate-600 shadow-sm"
                    >
                        <Calendar size={14} /> Reschedule
                    </button>
                    <button
                        onClick={() => setShowCancel(true)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-rose-50 border border-rose-100 px-6 py-3 rounded-xl hover:bg-rose-100 transition-all text-rose-600"
                    >
                        <AlertTriangle size={14} /> Cancel Request
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Column: Details */}
                <div className="lg:col-span-2 space-y-10">
                    {/* Main Info Card */}
                    <div className="bg-white border border-slate-200 rounded-[3rem] p-10 md:p-14 shadow-xl shadow-slate-200/50">
                        <div className="flex items-start justify-between mb-12">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-4">{booking.service_type} Service</h1>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg uppercase tracking-widest">ID: #{booking.id.toString().padStart(5, '0')}</span>
                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${
                                        booking.status === "Pending" ? "bg-amber-100 text-amber-600" :
                                        booking.status === "Completed" ? "bg-emerald-100 text-emerald-600" :
                                        "bg-blue-100 text-blue-600"
                                    }`}>
                                        {booking.status}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Estimate</p>
                                <p className="text-4xl font-black text-slate-900 tracking-tighter">${booking.estimated_cost.toFixed(2)}</p>
                            </div>
                        </div>

                        <BookingStatusTimeline currentStatus={booking.status} history={booking.status_history} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16 pb-12 border-b border-slate-100">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <MapPin size={12} className="text-emerald-500" /> Service Location
                                </h4>
                                <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                                    <p className="text-sm font-black text-slate-900">{booking.property_details}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <ClockIcon size={12} className="text-emerald-500" /> Scheduled Time
                                </h4>
                                <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                                    <p className="text-sm font-black text-slate-900">{new Date(booking.scheduled_at).toLocaleDateString()} @ {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Description</h4>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                {booking.issue_description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Provider & Chat */}
                <div className="space-y-10">
                    {/* Provider Profile Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/40">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl text-emerald-400">
                                {booking.provider.company_name.charAt(0)}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black tracking-tight">{booking.provider.company_name}</h3>
                                    <ShieldCheck size={18} className="text-emerald-500" />
                                </div>
                                <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest mt-1">Assigned Expert</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-1 hover:bg-white/10 transition-all">
                                <Phone size={18} className="text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest mt-1">Call</span>
                            </button>
                            <button className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-1 hover:bg-white/10 transition-all">
                                <FileText size={18} className="text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest mt-1">Profile</span>
                            </button>
                        </div>
                    </div>

                    {/* Chat Interface */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50 flex flex-col h-[600px] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Service Chat</h3>
                            </div>
                            <Settings size={16} className="text-slate-300" />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.sender_id === booking.user_id ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm font-medium ${
                                        m.sender_id === booking.user_id 
                                            ? "bg-slate-900 text-white rounded-br-none" 
                                            : "bg-slate-50 border border-slate-100 text-slate-800 rounded-bl-none"
                                    }`}>
                                        {m.message}
                                        <p className={`text-[8px] mt-2 font-black uppercase opacity-40 ${m.sender_id === booking.user_id ? "text-right" : "text-left"}`}>
                                            {new Date(m.timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                            <div className="relative">
                                <input 
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-14 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                />
                                <button 
                                    onClick={handleSendMessage}
                                    className="absolute right-2 top-2 w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-all"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cancel Modal */}
            {showCancel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Cancel Booking</h3>
                            <button onClick={() => setShowCancel(false)} className="text-slate-400"><X /></button>
                        </div>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed">Please provide a reason for cancellation. This help us improve our service network.</p>
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
            {/* Reschedule Modal */}
            {showReschedule && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black text-slate-900 uppercase">Reschedule Service</h3>
                            <button onClick={() => setShowReschedule(false)} className="text-slate-400"><X /></button>
                        </div>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed">Choose a new date and time for this request. If the job was cancelled, it will be automatically re-opened for the provider.</p>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Date & Time</label>
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
                                className={`py-4 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg transition-all ${
                                    rescheduling ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 shadow-slate-900/20 active:scale-95"
                                }`}
                            >
                                {rescheduling ? "Updating..." : "Update Schedule"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review / Feedback Modal */}
            {showReview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Rate Service</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                    {booking.provider?.company_name} · {booking.service_type}
                                </p>
                            </div>
                            <button onClick={() => setShowReview(false)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-black transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Overall Star Rating */}
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
                                        <Star
                                            size={36}
                                            className={`transition-colors ${(reviewHover || reviewRating) >= star ? "text-amber-400 fill-amber-400" : "text-slate-200"}`}
                                        />
                                    </button>
                                ))}
                            </div>
                            {reviewRating > 0 && (
                                <p className="text-xs font-black text-amber-600 uppercase tracking-widest">
                                    {reviewRating === 1 ? "Poor" : reviewRating === 2 ? "Fair" : reviewRating === 3 ? "Good" : reviewRating === 4 ? "Great" : "Excellent"}
                                </p>
                            )}
                        </div>

                        {/* Category Ratings */}
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

                        {/* Review Text */}
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
                            <button
                                onClick={() => setShowReview(false)}
                                className="py-4 rounded-xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50"
                            >
                                Skip
                            </button>
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
        </div>
    );
}

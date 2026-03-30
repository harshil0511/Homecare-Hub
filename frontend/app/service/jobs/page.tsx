"use client";

import { useEffect, useState } from "react";
import { Briefcase, Clock, MapPin, CheckCircle, XCircle, ChevronRight, User, DollarSign, Calendar, Send, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Booking {
    id: number;
    user_id: number;
    provider_id: number;
    service_type: string;
    scheduled_at: string;
    status: string;
    priority: string;
    issue_description: string | null;
    property_details: string | null;
    estimated_cost: number;
    created_at: string;
    updated_at: string;
}

interface IncomingRequest {
    id: number;
    contact_name: string;
    location: string;
    device_or_issue: string;
    description?: string;
    urgency: "Normal" | "High" | "Emergency";
    preferred_dates?: string[];
    photos?: string[];
    expires_at: string;
    created_at: string;
    is_read: boolean;
    has_responded: boolean;
    status: string;
}

type JobTab = "jobs" | "requests";

export default function ServicerJobsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<JobTab>("jobs");
    const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [respondingTo, setRespondingTo] = useState<IncomingRequest | null>(null);
    const [resDate, setResDate] = useState("");
    const [resTime, setResTime] = useState("09:00");
    const [resPrice, setResPrice] = useState<number | "">("");
    const [resDuration, setResDuration] = useState(2);
    const [resMessage, setResMessage] = useState("");
    const [submittingResponse, setSubmittingResponse] = useState(false);
    const [countdown, setCountdown] = useState<Record<number, string>>({});

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

    useEffect(() => {
        if (activeTab === "requests") {
            setRequestsLoading(true);
            apiFetch("/requests/incoming")
                .then((d: IncomingRequest[]) => setIncomingRequests(d || []))
                .catch(() => setIncomingRequests([]))
                .finally(() => setRequestsLoading(false));
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== "requests" || incomingRequests.length === 0) return;
        const tick = () => {
            const now = Date.now();
            const map: Record<number, string> = {};
            incomingRequests.forEach(req => {
                const diff = new Date(req.expires_at).getTime() - now;
                if (diff <= 0) { map[req.id] = "Expired"; return; }
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                map[req.id] = `${h}h ${m}m`;
            });
            setCountdown(map);
        };
        tick();
        const t = setInterval(tick, 60000);
        return () => clearInterval(t);
    }, [activeTab, incomingRequests]);

    const updateStatus = async (id: number, status: string) => {
        try {
            await apiFetch(`/bookings/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            });
            fetchJobs();
        } catch (err) {
            alert("Failed to update status");
        }
    };

    const handleSubmitResponse = async () => {
        if (!respondingTo || !resDate || !resPrice) return;
        setSubmittingResponse(true);
        try {
            const proposedDateTime = `${resDate}T${resTime}:00`;
            await apiFetch(`/requests/${respondingTo.id}/respond`, {
                method: "POST",
                body: JSON.stringify({
                    proposed_date: proposedDateTime,
                    proposed_price: Number(resPrice),
                    estimated_hours: resDuration,
                    message: resMessage || null,
                }),
            });
            setIncomingRequests(prev => prev.filter(r => r.id !== respondingTo.id));
            setRespondingTo(null);
            setResDate(""); setResTime("09:00"); setResPrice(""); setResDuration(2); setResMessage("");
        } catch (err) {
            console.error("Failed to submit response:", err);
        } finally {
            setSubmittingResponse(false);
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

            {/* Tab strip */}
            <div className="flex border-b border-slate-200 mb-8">
                {([
                    { key: "jobs", label: "Active Jobs" },
                    { key: "requests", label: "Incoming Requests" },
                ] as { key: JobTab; label: string }[]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`relative px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
                            activeTab === tab.key
                                ? "border-[#064e3b] text-[#064e3b]"
                                : "border-transparent text-slate-400 hover:text-slate-700"
                        }`}
                    >
                        {tab.label}
                        {tab.key === "requests" && incomingRequests.length > 0 && (
                            <span className="ml-2 inline-block w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                        )}
                    </button>
                ))}
            </div>

            {/* Active Jobs tab */}
            {activeTab === "jobs" && (
                <>
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
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                                        booking.status === "Accepted" ? "bg-blue-600 text-white" :
                                                        booking.status === "Pending" ? "bg-amber-500 text-white" :
                                                        booking.status === "Completed" ? "bg-emerald-600 text-white" :
                                                        "bg-slate-500 text-white"
                                                    }`}>
                                                        {booking.status}
                                                    </span>
                                                    {booking.priority !== "Normal" && (
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                                            booking.priority === "Emergency" ? "bg-rose-600 text-white" : "bg-orange-500 text-white"
                                                        }`}>
                                                            {booking.priority}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        ID: BK-{booking.id}
                                                    </span>
                                                </div>
                                                <h3 className="text-xl font-black text-[#000000] tracking-tight">{booking.service_type} Service</h3>
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                        <MapPin className="w-3.5 h-3.5" />
                                                        {booking.property_details || "No location specified"}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#064e3b] uppercase tracking-widest">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(booking.scheduled_at).toLocaleDateString()} at {new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                        <DollarSign className="w-3.5 h-3.5" />
                                                        ${booking.estimated_cost.toFixed(2)}
                                                    </div>
                                                </div>
                                                {booking.issue_description && (
                                                    <p className="text-sm text-slate-500 font-medium italic mt-2 border-l-2 border-slate-100 pl-4">
                                                        &ldquo;{booking.issue_description}&rdquo;
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
                                            <Link href={`/dashboard/bookings/${booking.id}`} className="p-3.5 text-slate-300 hover:text-slate-900 bg-slate-50 rounded-xl transition-all">
                                                <ChevronRight className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Incoming Requests tab */}
            {activeTab === "requests" && (
                <div>
                    {requestsLoading ? (
                        <div className="text-center py-16 text-slate-400 text-sm">Loading requests...</div>
                    ) : incomingRequests.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-slate-400 text-sm">No incoming requests at the moment.</p>
                            <p className="text-slate-300 text-xs mt-1">New requests from home users will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {incomingRequests.map(req => {
                                const urgencyColor = req.urgency === "Emergency" ? "border-l-rose-500 bg-rose-50/30"
                                    : req.urgency === "High" ? "border-l-amber-500 bg-amber-50/30"
                                    : "border-l-emerald-500 bg-emerald-50/30";
                                const urgencyBadge = req.urgency === "Emergency" ? "bg-rose-100 text-rose-700"
                                    : req.urgency === "High" ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700";

                                return (
                                    <div key={req.id} className={`bg-white border border-slate-200 border-l-4 ${urgencyColor} rounded-2xl p-6`}>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm font-black text-slate-600">
                                                    {req.contact_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm">{req.contact_name}</p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />{req.location}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${urgencyBadge}`}>
                                                    {req.urgency}
                                                </span>
                                                {countdown[req.id] && countdown[req.id] !== "Expired" && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                                        <Clock className="w-3 h-3" />
                                                        {countdown[req.id]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <p className="font-bold text-slate-800 text-sm mb-1">{req.device_or_issue}</p>
                                            {req.description && (
                                                <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3">{req.description}</p>
                                            )}
                                        </div>

                                        {req.preferred_dates && req.preferred_dates.length > 0 && (
                                            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Preferred: {req.preferred_dates.slice(0, 2).join(" — ")}
                                            </p>
                                        )}

                                        {!req.has_responded && req.status === "OPEN" && countdown[req.id] !== "Expired" && (
                                            <button
                                                onClick={() => {
                                                    setRespondingTo(req);
                                                    setResDate(""); setResTime("09:00"); setResPrice(""); setResDuration(2); setResMessage("");
                                                }}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 transition-colors"
                                            >
                                                <Send className="w-4 h-4" />
                                                Respond with Offer
                                            </button>
                                        )}
                                        {req.has_responded && (
                                            <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                                <CheckCircle className="w-4 h-4" /> Response submitted
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Response modal */}
            {respondingTo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Your Offer</h2>
                                    <p className="text-xs text-slate-500 mt-1">For: {respondingTo.device_or_issue}</p>
                                </div>
                                <button onClick={() => setRespondingTo(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Proposed Date *</label>
                                        <input type="date" value={resDate} onChange={e => setResDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Arrival Time</label>
                                        <select value={resTime} onChange={e => setResTime(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#064e3b] bg-white">
                                            {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"].map(t => (
                                                <option key={t} value={t}>{t.replace(":", ":") + (parseInt(t) < 12 ? " AM" : " PM").replace("12 PM", "12 PM")}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Your Price (₹) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                                        <input type="number" min="1" value={resPrice} onChange={e => setResPrice(e.target.value ? Number(e.target.value) : "")} placeholder="0" className="w-full border border-slate-200 rounded-xl pl-7 pr-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Estimated Duration: {resDuration}h</label>
                                    <input type="range" min={1} max={12} step={0.5} value={resDuration} onChange={e => setResDuration(Number(e.target.value))} className="w-full accent-[#064e3b]" />
                                    <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1h</span><span>12h</span></div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Message (optional)</label>
                                    <textarea value={resMessage} onChange={e => setResMessage(e.target.value)} placeholder="Describe your approach, materials needed, experience with this type of work..." rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setRespondingTo(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitResponse}
                                    disabled={submittingResponse || !resDate || !resPrice}
                                    className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submittingResponse ? "Submitting..." : <><Send className="w-4 h-4" /> Submit Offer</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

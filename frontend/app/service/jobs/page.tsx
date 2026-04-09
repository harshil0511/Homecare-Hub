"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, Clock, MapPin, CheckCircle, XCircle, ChevronRight, User, IndianRupee, Calendar, Send, X, FileText, ShieldAlert } from "lucide-react";
import { apiFetch, emergencyApi, createServicerAlertSocket, IncomingEmergencyRead } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

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
    response_id?: string;
    negotiation_status?: string;
    current_round?: number;
}

interface ServicerResponse {
    id: string;
    request_id: string;
    proposed_date: string;
    proposed_price: number;
    estimated_hours?: number;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    negotiation_status: "NONE" | "NEGOTIATING" | "AGREED" | "CLOSED";
    current_round: number;
}

interface NegotiationOffer {
    id: string;
    offered_by: "USER" | "SERVICER";
    round_number: number;
    proposed_date: string;
    proposed_time: string;
    proposed_price: number;
    message?: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
}

type JobTab = "jobs" | "requests" | "emergency";

export default function ServicerJobsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

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
    const [emergencies, setEmergencies] = useState<IncomingEmergencyRead[]>([]);
    const [emergencyLoading, setEmergencyLoading] = useState(false);
    const [emergencyCountdown, setEmergencyCountdown] = useState<Record<number, string>>({});
    const [respondingToEmergency, setRespondingToEmergency] = useState<IncomingEmergencyRead | null>(null);
    const [emergencyArrivalTime, setEmergencyArrivalTime] = useState("");
    const [submittingEmergencyResponse, setSubmittingEmergencyResponse] = useState(false);
    const [providerId, setProviderId] = useState<number | null>(null);
    const emergencyWsRef = useRef<WebSocket | null>(null);

    const [countdown, setCountdown] = useState<Record<number, string>>({});
    const [completionTarget, setCompletionTarget] = useState<Booking | null>(null);
    const [compHours, setCompHours] = useState<number | "">("");
    const [compFinalCost, setCompFinalCost] = useState<number | "">("");
    const [compNotes, setCompNotes] = useState("");
    const [submittingCompletion, setSubmittingCompletion] = useState(false);

    const [counterModal, setCounterModal] = useState<{
        requestId: string;
        responseId: string;
        userName: string;
        currentOffer: { price: number; date: string };
        currentRound: number;
    } | null>(null);
    const [servicerCounterPrice, setServicerCounterPrice] = useState<number | "">("");
    const [servicerCounterDate, setServicerCounterDate] = useState("");
    const [servicerCounterTime, setServicerCounterTime] = useState("morning");
    const [servicerCounterMessage, setServicerCounterMessage] = useState("");
    const [sendingServicerCounter, setSendingServicerCounter] = useState(false);
    const [finalCompleteTarget, setFinalCompleteTarget] = useState<Booking | null>(null);
    const [extraHours, setExtraHours] = useState<number | "">(0);
    const [finalNotes, setFinalNotes] = useState("");
    const [submittingFinal, setSubmittingFinal] = useState(false);

    const toast = useToast();

    const fetchJobs = async () => {
        setFetchError(null);
        try {
            const data = await apiFetch("/bookings/incoming");
            setBookings(data || []);
        } catch (err: any) {
            // Provider profile not yet created — silently show empty state
            if (err?.message?.toLowerCase().includes("provider profile not found") ||
                err?.message?.toLowerCase().includes("not found")) {
                setBookings([]);
            } else if ((err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) || err?.message?.toLowerCase().includes("timed out") || err?.message?.toLowerCase().includes("request timed out")) {
                setFetchError("Could not connect to the server. Please ensure the backend is running.");
            } else {
                console.error("Failed to fetch jobs", err);
            }
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

    // Fetch provider id once (needed for WebSocket)
    useEffect(() => {
        apiFetch("/services/providers/me")
            .then((p: any) => setProviderId(p?.id ?? null))
            .catch(() => {});
    }, []);

    // Load + WebSocket for emergency tab
    useEffect(() => {
        if (activeTab !== "emergency") return;
        setEmergencyLoading(true);
        emergencyApi.getIncoming()
            .then(d => setEmergencies(d || []))
            .catch(() => setEmergencies([]))
            .finally(() => setEmergencyLoading(false));

        if (providerId) {
            const ws = createServicerAlertSocket(providerId);
            emergencyWsRef.current = ws;
            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    if (msg.event === "emergency_alert") {
                        emergencyApi.getIncoming().then(d => setEmergencies(d || [])).catch(() => {});
                    } else if (msg.event === "request_cancelled") {
                        setEmergencies(prev => prev.filter(e => e.id !== msg.request_id));
                    }
                } catch { /* ignore malformed frames */ }
            };
            return () => {
                ws.close();
                emergencyWsRef.current = null;
            };
        }
    }, [activeTab, providerId]);

    useEffect(() => {
        if (emergencies.length === 0) return;
        const tick = () => {
            const now = Date.now();
            const map: Record<number, string> = {};
            emergencies.forEach(em => {
                const diff = new Date(em.expires_at).getTime() - now;
                if (diff <= 0) { map[em.id] = "Expired"; return; }
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                map[em.id] = `${m}:${String(s).padStart(2, "0")}`;
            });
            setEmergencyCountdown(map);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [emergencies]);

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
        } catch (err: any) {
            console.error("Failed to submit response:", err);
            toast.error(err?.message || "Failed to submit response — please try again");
        } finally {
            setSubmittingResponse(false);
        }
    };

    const handleSubmitCompletion = async () => {
        if (!completionTarget || compHours === "" || compFinalCost === "") return;
        setSubmittingCompletion(true);
        try {
            await apiFetch(`/bookings/${completionTarget.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: "Completed",
                    final_cost: Number(compFinalCost),
                    actual_hours: Number(compHours),
                    completion_notes: compNotes || undefined,
                }),
            });
            setCompletionTarget(null);
            setCompHours(""); setCompFinalCost(""); setCompNotes("");
            toast.success("Job marked as completed — client notified");
            fetchJobs();
        } catch (err: any) {
            toast.error(err.message || "Failed to submit completion");
        } finally {
            setSubmittingCompletion(false);
        }
    };

    const handleEmergencyRespond = async () => {
        if (!respondingToEmergency || !emergencyArrivalTime) return;
        setSubmittingEmergencyResponse(true);
        try {
            await emergencyApi.respond(respondingToEmergency.id, emergencyArrivalTime);
            setEmergencies(prev => prev.map(e =>
                e.id === respondingToEmergency.id ? { ...e, has_responded: true } : e
            ));
            setRespondingToEmergency(null);
            setEmergencyArrivalTime("");
            toast.success("Response submitted — waiting for user to accept.");
        } catch (err: any) {
            toast.error(err.message || "Failed to respond.");
        } finally {
            setSubmittingEmergencyResponse(false);
        }
    };

    const handleEmergencyIgnore = async (id: number) => {
        try {
            await emergencyApi.ignore(id);
            setEmergencies(prev => prev.filter(e => e.id !== id));
        } catch (err: any) {
            toast.error(err.message || "Failed to ignore.");
        }
    };

    const handleAcceptCounter = async (requestId: string, responseId: string) => {
        try {
            await apiFetch(`/requests/${requestId}/responses/${responseId}/accept-counter`, { method: "POST" });
            toast.success("Counter offer accepted! Contract created.");
            await fetchJobs();
        } catch (err: any) {
            toast.error(err.message || "Failed to accept counter offer");
        }
    };

    const handleRejectCounter = async (requestId: string, responseId: string) => {
        try {
            await apiFetch(`/requests/${requestId}/responses/${responseId}/reject-counter`, { method: "POST" });
            toast.success("Counter offer rejected");
            if (counterModal) setCounterModal(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to reject counter offer");
        }
    };

    const handleServicerSendCounter = async () => {
        if (!counterModal || servicerCounterPrice === "" || !servicerCounterDate) return;
        setSendingServicerCounter(true);
        try {
            await apiFetch(
                `/requests/${counterModal.requestId}/responses/${counterModal.responseId}/counter`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        proposed_date: new Date(servicerCounterDate).toISOString(),
                        proposed_time: servicerCounterTime,
                        proposed_price: Number(servicerCounterPrice),
                        message: servicerCounterMessage || undefined,
                    }),
                }
            );
            setCounterModal(null);
            setServicerCounterPrice("");
            setServicerCounterDate("");
            setServicerCounterMessage("");
            toast.success("New offer sent to user");
        } catch (err: any) {
            toast.error(err.message || "Failed to send offer");
        } finally {
            setSendingServicerCounter(false);
        }
    };

    const handleFinalComplete = async () => {
        if (!finalCompleteTarget) return;
        setSubmittingFinal(true);
        try {
            await apiFetch(`/bookings/${finalCompleteTarget.id}/final-complete`, {
                method: "POST",
                body: JSON.stringify({
                    extra_hours: Number(extraHours) || 0,
                    notes: finalNotes || undefined,
                }),
            });
            setFinalCompleteTarget(null);
            setExtraHours(0);
            setFinalNotes("");
            toast.success("Job marked as complete. Receipt ready.");
            await fetchJobs();
        } catch (err: any) {
            toast.error(err.message || "Failed to mark complete");
        } finally {
            setSubmittingFinal(false);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {fetchError && (
                <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
                </div>
            )}
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
            <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
                {([
                    { key: "jobs", label: "Active Jobs" },
                    { key: "requests", label: "Incoming Requests" },
                    { key: "emergency", label: "Emergency SOS" },
                ] as { key: JobTab; label: string }[]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`relative flex-shrink-0 px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
                            activeTab === tab.key
                                ? "border-[#064e3b] text-[#064e3b]"
                                : "border-transparent text-slate-400 hover:text-slate-700"
                        }`}
                    >
                        {tab.label}
                        {tab.key === "requests" && incomingRequests.length > 0 && (
                            <span className="ml-2 inline-block w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                        )}
                        {tab.key === "emergency" && emergencies.filter(e => !e.has_responded).length > 0 && (
                            <span className="ml-2 inline-block w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                        )}
                    </button>
                ))}
            </div>

            {/* Active Jobs tab */}
            {activeTab === "jobs" && (
                <>
                    {loading ? (
                        <Spinner size="lg" />
                    ) : bookings.length === 0 ? (
                        <EmptyState icon={Briefcase} title="No active jobs found" description="New bookings will appear here" py="py-24" />
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
                                                        <IndianRupee className="w-3.5 h-3.5" />
                                                        ₹{booking.estimated_cost.toLocaleString("en-IN")}
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
                                                    onClick={() => {
                                                        setCompletionTarget(booking);
                                                        setCompFinalCost(booking.estimated_cost);
                                                        setCompHours("");
                                                        setCompNotes("");
                                                    }}
                                                    className="w-full sm:w-auto px-10 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Mark Completed
                                                </button>
                                            )}
                                            {booking.status === "In Progress" && (
                                                <button
                                                    onClick={() => {
                                                        setFinalCompleteTarget(booking);
                                                        setExtraHours(0);
                                                        setFinalNotes("");
                                                    }}
                                                    className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Final Complete
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
                        <Spinner />
                    ) : incomingRequests.length === 0 ? (
                        <EmptyState icon={FileText} title="No incoming requests" description="New requests from home users will appear here" />
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
                                        {req.has_responded && req.response_id && req.negotiation_status === "NEGOTIATING" && (req.current_round ?? 0) > 0 && (
                                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-700 mb-2">
                                                    Counter Offer from User
                                                </p>
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => handleAcceptCounter(String(req.id), req.response_id!)}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-700 transition-colors"
                                                    >
                                                        Accept Counter
                                                    </button>
                                                    <button
                                                        onClick={() => setCounterModal({
                                                            requestId: String(req.id),
                                                            responseId: req.response_id!,
                                                            userName: req.contact_name,
                                                            currentOffer: { price: 0, date: new Date().toISOString() },
                                                            currentRound: req.current_round ?? 0,
                                                        })}
                                                        className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Send New Offer
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectCounter(String(req.id), req.response_id!)}
                                                        className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-rose-700 transition-colors"
                                                    >
                                                        Reject Counter
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Emergency SOS tab */}
            {activeTab === "emergency" && (
                <div className="space-y-4">
                    {emergencyLoading ? (
                        <Spinner />
                    ) : emergencies.length === 0 ? (
                        <EmptyState icon={ShieldAlert} title="No emergency requests" description="Active emergency SOS requests will appear here" />
                    ) : (
                        emergencies.map(em => {
                            const timeLeft = emergencyCountdown[em.id];
                            const expired = timeLeft === "Expired";
                            return (
                                <div key={em.id} className={`bg-white border-2 rounded-2xl p-6 space-y-4 ${expired ? "border-slate-200 opacity-60" : em.has_responded ? "border-emerald-200" : "border-rose-300"}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${expired ? "bg-slate-100 text-slate-400" : "bg-rose-100 text-rose-600"}`}>
                                                <ShieldAlert size={20} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">{em.category}</p>
                                                <p className="text-xs text-slate-500">{em.building_name}, {em.flat_no}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {timeLeft && (
                                                <span className={`text-xs font-black px-3 py-1 rounded-full ${expired ? "bg-slate-100 text-slate-400" : "bg-rose-100 text-rose-600"}`}>
                                                    {expired ? "Expired" : timeLeft}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                                        <div><span className="font-black text-slate-400 uppercase text-[10px] block">Society</span>{em.society_name}</div>
                                        <div><span className="font-black text-slate-400 uppercase text-[10px] block">Contact</span>{em.contact_name} · {em.contact_phone}</div>
                                        <div className="col-span-2"><span className="font-black text-slate-400 uppercase text-[10px] block">Issue</span>{em.description}</div>
                                        {em.device_name && <div className="col-span-2"><span className="font-black text-slate-400 uppercase text-[10px] block">Device</span>{em.device_name}</div>}
                                    </div>

                                    {(em.callout_fee != null || em.hourly_rate != null) && (
                                        <div className="flex items-center gap-4 bg-slate-50 rounded-xl px-4 py-3 text-xs font-bold text-slate-600">
                                            <IndianRupee size={14} className="text-slate-400" />
                                            {em.callout_fee != null && <span>Callout ₹{em.callout_fee}</span>}
                                            {em.hourly_rate != null && <span>+ ₹{em.hourly_rate}/hr after 1st hr</span>}
                                        </div>
                                    )}

                                    {!expired && !em.has_responded && (
                                        <div className="flex gap-3 pt-1">
                                            <button
                                                onClick={() => { setRespondingToEmergency(em); setEmergencyArrivalTime(""); }}
                                                className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Send size={14} /> Respond
                                            </button>
                                            <button
                                                onClick={() => handleEmergencyIgnore(em.id)}
                                                className="px-5 py-3 border border-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase hover:bg-slate-50 transition-all"
                                            >
                                                Ignore
                                            </button>
                                        </div>
                                    )}

                                    {em.has_responded && (
                                        <p className="text-xs text-emerald-600 font-black flex items-center gap-1">
                                            <CheckCircle size={14} /> Response submitted — awaiting user selection
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Emergency Respond Modal */}
            {respondingToEmergency && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl">
                        <div className="p-8 space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 uppercase">Respond to SOS</h2>
                                    <p className="text-xs text-slate-500 mt-1">{respondingToEmergency.category} — {respondingToEmergency.building_name}</p>
                                </div>
                                <button onClick={() => setRespondingToEmergency(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-700 font-semibold space-y-1">
                                <p>{respondingToEmergency.society_name}, {respondingToEmergency.flat_no}</p>
                                <p>{respondingToEmergency.contact_name} · {respondingToEmergency.contact_phone}</p>
                                {respondingToEmergency.callout_fee != null && (
                                    <p className="font-black">Callout ₹{respondingToEmergency.callout_fee} + ₹{respondingToEmergency.hourly_rate}/hr</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                                    Committed Arrival Time *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={emergencyArrivalTime}
                                    onChange={e => setEmergencyArrivalTime(e.target.value)}
                                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-400"
                                />
                                <p className="text-[10px] text-slate-400">Must be in the future. User will see this when deciding.</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setRespondingToEmergency(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEmergencyRespond}
                                    disabled={submittingEmergencyResponse || !emergencyArrivalTime}
                                    className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submittingEmergencyResponse ? "Submitting..." : <><Send size={16} /> Submit</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Completion Form Modal */}
            {completionTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Complete Job</h2>
                                    <p className="text-xs text-slate-500 mt-1">{completionTarget.service_type} — BK-{completionTarget.id}</p>
                                </div>
                                <button onClick={() => setCompletionTarget(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Hours Worked *</label>
                                        <input
                                            type="number" min="0.5" max="24" step="0.5"
                                            value={compHours}
                                            onChange={e => setCompHours(e.target.value ? Number(e.target.value) : "")}
                                            placeholder="e.g. 2.5"
                                            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#064e3b]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Final Bill (₹) *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                                            <input
                                                type="number" min="0"
                                                value={compFinalCost}
                                                onChange={e => setCompFinalCost(e.target.value ? Number(e.target.value) : "")}
                                                placeholder="0"
                                                className="w-full border border-slate-200 rounded-xl pl-7 pr-4 py-3 text-sm outline-none focus:border-[#064e3b]"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">Estimated: ₹{completionTarget.estimated_cost.toLocaleString("en-IN")}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Completion Notes (optional)</label>
                                    <textarea
                                        value={compNotes}
                                        onChange={e => setCompNotes(e.target.value)}
                                        placeholder="Describe the work done, parts replaced, any follow-up needed..."
                                        rows={3}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setCompletionTarget(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitCompletion}
                                    disabled={submittingCompletion || compHours === "" || compFinalCost === ""}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submittingCompletion ? "Submitting..." : <><FileText className="w-4 h-4" /> Submit Completion</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Servicer Counter Offer Modal */}
            {counterModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-black text-slate-900 uppercase tracking-widest">Send New Offer</h2>
                            <button onClick={() => setCounterModal(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            To: <span className="font-bold text-slate-700">{counterModal.userName}</span>
                            <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-widest">Round {counterModal.currentRound + 1} of 3</span>
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Proposed Date</label>
                                <input type="date" value={servicerCounterDate} onChange={e => setServicerCounterDate(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Preferred Time</label>
                                <select value={servicerCounterTime} onChange={e => setServicerCounterTime(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="morning">Morning (8am–12pm)</option>
                                    <option value="afternoon">Afternoon (12pm–5pm)</option>
                                    <option value="evening">Evening (5pm–8pm)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Your Price (₹)</label>
                                <input type="number" min={1} value={servicerCounterPrice}
                                    onChange={e => setServicerCounterPrice(e.target.value === "" ? "" : Number(e.target.value))}
                                    placeholder="e.g. 1000"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Message (optional)</label>
                                <textarea value={servicerCounterMessage} onChange={e => setServicerCounterMessage(e.target.value)}
                                    rows={2} placeholder="Add a note..."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setCounterModal(null)}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-50">
                                Cancel
                            </button>
                            <button onClick={handleServicerSendCounter} disabled={sendingServicerCounter || servicerCounterPrice === "" || !servicerCounterDate}
                                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-xl disabled:opacity-50">
                                {sendingServicerCounter ? "Sending..." : "Send Offer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Final Complete Modal */}
            {finalCompleteTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-black text-slate-900 uppercase tracking-widest">Mark Job Complete</h2>
                            <button onClick={() => setFinalCompleteTarget(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">{finalCompleteTarget.service_type}</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Extra Hours (beyond estimate)</label>
                                <input type="number" min={0} step={0.5} value={extraHours}
                                    onChange={e => setExtraHours(e.target.value === "" ? "" : Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Notes (optional)</label>
                                <textarea value={finalNotes} onChange={e => setFinalNotes(e.target.value)} rows={2}
                                    placeholder="Any notes about the completed job..."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800">
                                Base: ₹{finalCompleteTarget.estimated_cost.toLocaleString()}
                                {Number(extraHours) > 0 && <span> + extra hours charge</span>}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setFinalCompleteTarget(null)}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-50">
                                Cancel
                            </button>
                            <button onClick={handleFinalComplete} disabled={submittingFinal}
                                className="flex-1 px-4 py-2.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-xs font-black uppercase rounded-xl disabled:opacity-50">
                                {submittingFinal ? "Completing..." : "Mark Complete"}
                            </button>
                        </div>
                    </div>
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

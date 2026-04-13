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
    source_type?: string | null;
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


type JobTab = "jobs" | "requests" | "emergency" | "completed" | "society";

interface CompletedJob {
    id: string;
    service_type: string;
    scheduled_at: string;
    final_cost: number;
    actual_hours?: number;
    completion_notes?: string;
    property_details?: string;
    priority: string;
    created_at: string;
    user?: {
        id: string;
        username: string;
        email: string;
        home_number?: string;
    } | null;
    review?: {
        id: string;
        rating: number;
        review_text?: string | null;
        quality_rating: number;
        punctuality_rating: number;
        professionalism_rating: number;
        created_at: string;
    } | null;
}

interface SocietyDispatchItem {
    id: string;
    service_type: string;
    scheduled_at: string;
    job_price: number;
    notes?: string;
    status: string;
    member_home_number?: string;
    member_name?: string;
}

interface SocietyContractItem {
    id: string;
    society_id: string;
    duration_months: number;
    counter_duration_months?: number;
    monthly_rate: number;
    start_date?: string;
    end_date?: string;
    status: string;
    secretary_notes?: string;
    servicer_notes?: string;
    created_at: string;
    society?: { id: string; name: string; address: string };
    dispatches: SocietyDispatchItem[];
}

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
    const [emergencyCountdown, setEmergencyCountdown] = useState<Record<string, string>>({});
    const [respondingToEmergency, setRespondingToEmergency] = useState<IncomingEmergencyRead | null>(null);
    const [emergencyArrivalTime, setEmergencyArrivalTime] = useState("");
    const [submittingEmergencyResponse, setSubmittingEmergencyResponse] = useState(false);
    const [providerId, setProviderId] = useState<string | null>(null);
    const emergencyWsRef = useRef<WebSocket | null>(null);

    const [countdown, setCountdown] = useState<Record<number, string>>({});

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
    const [servicerCounterIsFinal, setServicerCounterIsFinal] = useState(false);
    const [sendingServicerCounter, setSendingServicerCounter] = useState(false);
    const [resFinalOffer, setResFinalOffer] = useState(false);
    const [finalCompleteTarget, setFinalCompleteTarget] = useState<Booking | null>(null);
    const [extraHours, setExtraHours] = useState<number | "">(0);
    const [finalNotes, setFinalNotes] = useState("");
    const [submittingFinal, setSubmittingFinal] = useState(false);
    const [chargeAmount, setChargeAmount] = useState<number | "">("");

    const [reportIssueTarget, setReportIssueTarget] = useState<Booking | null>(null);
    const [issueReason, setIssueReason] = useState("");
    const [submittingIssue, setSubmittingIssue] = useState(false);

    const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
    const [completedLoading, setCompletedLoading] = useState(false);

    const [societyContracts, setSocietyContracts] = useState<SocietyContractItem[]>([]);
    const [societyLoading, setSocietyLoading] = useState(false);
    const [counterContractId, setCounterContractId] = useState<string | null>(null);
    const [counterDuration, setCounterDuration] = useState<2 | 6 | 10 | 12>(6);
    const [counterNote, setCounterNote] = useState("");
    const [societyActionId, setSocietyActionId] = useState<string | null>(null);

    const toast = useToast();

    const fetchJobs = async () => {
        setFetchError(null);
        try {
            const data = await apiFetch("/bookings/incoming");
            setBookings(data || []);
        } catch (err) {
            // Provider profile not yet created — silently show empty state
            const errMsg = err instanceof Error ? err.message.toLowerCase() : "";
            if (errMsg.includes("provider profile not found") || errMsg.includes("not found")) {
                setBookings([]);
            } else if (errMsg.includes("failed to fetch") || errMsg.includes("timed out") || errMsg.includes("request timed out")) {
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
        if (activeTab === "completed") {
            setCompletedLoading(true);
            apiFetch("/bookings/completed-provider")
                .then((d: CompletedJob[]) => setCompletedJobs(d || []))
                .catch(() => setCompletedJobs([]))
                .finally(() => setCompletedLoading(false));
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== "society") return;
        setSocietyLoading(true);
        apiFetch("/service/contracts")
            .then(d => setSocietyContracts(d || []))
            .catch(() => {})
            .finally(() => setSocietyLoading(false));
    }, [activeTab]);

    // Fetch provider id once (needed for WebSocket)
    useEffect(() => {
        apiFetch("/services/providers/me")
            .then((p: { id?: string }) => setProviderId(p?.id ?? null))
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
                    } else if (msg.event === "response_accepted") {
                        // User accepted our response — refresh active jobs and switch to Jobs tab
                        fetchJobs();
                        setActiveTab("jobs");
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
            const map: Record<string, string> = {};
            emergencies.forEach(em => {
                // expires_at is a naive UTC datetime from the server (no Z).
                // Without Z, JS treats it as local time — for IST users that makes it
                // appear expired immediately (offset by +5:30). Append "Z" to force UTC.
                const utcExpiry = em.expires_at.endsWith("Z") || em.expires_at.includes("+")
                    ? em.expires_at
                    : em.expires_at + "Z";
                const diff = new Date(utcExpiry).getTime() - now;
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
        } catch {
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
                    is_final_offer: resFinalOffer,
                }),
            });
            setIncomingRequests(prev => prev.filter(r => r.id !== respondingTo.id));
            setRespondingTo(null);
            setResDate(""); setResTime("09:00"); setResPrice(""); setResDuration(2); setResMessage(""); setResFinalOffer(false);
        } catch (err) {
            console.error("Failed to submit response:", err);
            toast.error((err as Error).message ||"Failed to submit response — please try again");
        } finally {
            setSubmittingResponse(false);
        }
    };

    const handleReportIssue = async () => {
        if (!reportIssueTarget || !issueReason.trim()) return;
        setSubmittingIssue(true);
        try {
            await apiFetch(`/bookings/${reportIssueTarget.id}/complaint`, {
                method: "POST",
                body: JSON.stringify({ reason: issueReason }),
            });
            setReportIssueTarget(null);
            setIssueReason("");
            toast.success("Issue reported to admin");
        } catch (err) {
            toast.error((err as Error).message || "Failed to report issue");
        } finally {
            setSubmittingIssue(false);
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
        } catch (err) {
            toast.error((err as Error).message ||"Failed to respond.");
        } finally {
            setSubmittingEmergencyResponse(false);
        }
    };

    const handleEmergencyIgnore = async (id: string) => {
        try {
            await emergencyApi.ignore(id);
            setEmergencies(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            toast.error((err as Error).message ||"Failed to ignore.");
        }
    };

    const handleAcceptCounter = async (requestId: string, responseId: string) => {
        try {
            await apiFetch(`/requests/${requestId}/responses/${responseId}/accept-counter`, { method: "POST" });
            toast.success("Counter offer accepted! Contract created.");
            await fetchJobs();
        } catch (err) {
            toast.error((err as Error).message ||"Failed to accept counter offer");
        }
    };

    const handleRejectCounter = async (requestId: string, responseId: string) => {
        try {
            await apiFetch(`/requests/${requestId}/responses/${responseId}/reject-counter`, { method: "POST" });
            toast.success("Counter offer rejected");
            if (counterModal) setCounterModal(null);
        } catch (err) {
            toast.error((err as Error).message ||"Failed to reject counter offer");
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
                        is_final_offer: servicerCounterIsFinal,
                    }),
                }
            );
            setCounterModal(null);
            setServicerCounterPrice("");
            setServicerCounterDate("");
            setServicerCounterMessage("");
            setServicerCounterIsFinal(false);
            toast.success(servicerCounterIsFinal ? "Final offer sent to user" : "New offer sent to user");
        } catch (err) {
            toast.error((err as Error).message ||"Failed to send offer");
        } finally {
            setSendingServicerCounter(false);
        }
    };

    const handleFinalComplete = async () => {
        if (!finalCompleteTarget) return;
        if (!extraHours || !chargeAmount) {
            toast.error("Actual hours and charge amount are required");
            return;
        }
        setSubmittingFinal(true);
        try {
            await apiFetch(`/bookings/${finalCompleteTarget.id}/final-complete`, {
                method: "POST",
                body: JSON.stringify({
                    actual_hours: Number(extraHours),
                    charge_amount: Number(chargeAmount),
                    charge_description: finalNotes.trim() || null,
                }),
            });
            toast.success("Charge submitted. Waiting for user confirmation.");
            setFinalCompleteTarget(null);
            setExtraHours(0);
            setChargeAmount("");
            setFinalNotes("");
            fetchJobs();
        } catch (err: any) {
            toast.error(err?.message || "Failed to submit charge");
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
                    { key: "completed", label: "Completed Jobs" },
                    { key: "society", label: "Society Jobs" },
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
                                                        setFinalCompleteTarget(booking);
                                                        setExtraHours(0);
                                                        setFinalNotes("");
                                                    }}
                                                    className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Submit Completion
                                                </button>
                                            )}
                                            {booking.status === "In Progress" && booking.source_type !== "emergency" && (
                                                <button
                                                    onClick={() => {
                                                        setFinalCompleteTarget(booking);
                                                        setExtraHours(0);
                                                        setChargeAmount("");
                                                        setFinalNotes("");
                                                    }}
                                                    className="w-full sm:w-auto px-10 py-3.5 bg-[#064e3b] hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/10 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Mark Complete &amp; Submit Charge
                                                </button>
                                            )}
                                            {booking.status === "Pending Confirmation" && (
                                                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                                                    <Clock className="w-4 h-4 shrink-0" />
                                                    Awaiting user payment confirmation
                                                </div>
                                            )}
                                            {(booking.status === "In Progress" || booking.status === "Pending Confirmation" || booking.status === "Accepted") && (
                                                <button
                                                    onClick={() => { setReportIssueTarget(booking); setIssueReason(""); }}
                                                    className="w-full sm:w-auto px-6 py-3.5 border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <ShieldAlert className="w-4 h-4" />
                                                    Report Issue
                                                </button>
                                            )}
                                            <Link href={`/user/bookings/${booking.id}`} className="p-3.5 text-slate-300 hover:text-slate-900 bg-slate-50 rounded-xl transition-all">
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
                                    min={(() => {
                                        // datetime-local min must use LOCAL time, not UTC.
                                        // .toISOString() returns UTC — for IST users that's 5:30h
                                        // behind local, making the constraint appear in the past.
                                        const d = new Date(Date.now() + 60000);
                                        const p = (n: number) => String(n).padStart(2, "0");
                                        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
                                    })()}
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

            {/* ── Completed Jobs tab ──────────────────────────────────── */}
            {activeTab === "completed" && (
                <div className="space-y-4">
                    {completedLoading ? (
                        <Spinner size="lg" />
                    ) : completedJobs.length === 0 ? (
                        <EmptyState icon={CheckCircle} title="No completed jobs yet" description="Finished jobs will appear here with user details and reviews" py="py-24" />
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {completedJobs.map(job => (
                                <div key={job.id} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-4">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0">
                                                <CheckCircle className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest bg-emerald-600 text-white">Completed</span>
                                                    {job.priority !== "Normal" && (
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${job.priority === "Emergency" ? "bg-rose-600 text-white" : "bg-orange-500 text-white"}`}>
                                                            {job.priority}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-lg font-black text-slate-900 mt-1">{job.service_type} Service</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(job.scheduled_at).toLocaleDateString()} at {new Date(job.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xl font-black text-emerald-700">₹{(job.final_cost || 0).toLocaleString("en-IN")}</p>
                                            <p className="text-[10px] text-slate-400 font-semibold">{job.actual_hours ? `${job.actual_hours}h worked` : "Final amount"}</p>
                                        </div>
                                    </div>

                                    {/* User details */}
                                    {job.user && (
                                        <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{job.user.username}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold">{job.user.email}</p>
                                                </div>
                                            </div>
                                            {job.user.home_number && (
                                                <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                                    Home {job.user.home_number}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Property */}
                                    {job.property_details && (
                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                                            {job.property_details}
                                        </div>
                                    )}

                                    {/* Completion notes */}
                                    {job.completion_notes && (
                                        <p className="text-sm text-slate-500 italic border-l-2 border-slate-100 pl-3">&ldquo;{job.completion_notes}&rdquo;</p>
                                    )}

                                    {/* Review */}
                                    {job.review ? (
                                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Customer Review</p>
                                                <div className="flex items-center gap-0.5">
                                                    {[1,2,3,4,5].map(s => (
                                                        <span key={s} className={`text-sm ${s <= job.review!.rating ? "text-amber-500" : "text-slate-200"}`}>★</span>
                                                    ))}
                                                    <span className="text-xs font-black text-amber-700 ml-1">{job.review.rating}/5</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
                                                <span>Quality {job.review.quality_rating}/5</span>
                                                <span>Punctuality {job.review.punctuality_rating}/5</span>
                                                <span>Professionalism {job.review.professionalism_rating}/5</span>
                                            </div>
                                            {job.review.review_text && (
                                                <p className="text-sm text-slate-600 italic">&ldquo;{job.review.review_text}&rdquo;</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-widest">No review yet</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Report Issue Modal */}
            {reportIssueTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Report Issue</h2>
                                <p className="text-xs text-slate-500 mt-1">{reportIssueTarget.service_type} — BK-{reportIssueTarget.id}</p>
                            </div>
                            <button onClick={() => setReportIssueTarget(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Your complaint will be reviewed by admin.</p>
                        <textarea
                            value={issueReason}
                            onChange={e => setIssueReason(e.target.value)}
                            placeholder="Describe the issue (e.g. user is disputing unfairly, access denied to property)..."
                            rows={4}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setReportIssueTarget(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleReportIssue}
                                disabled={submittingIssue || !issueReason.trim()}
                                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black uppercase hover:bg-rose-700 disabled:opacity-50"
                            >
                                {submittingIssue ? "Reporting..." : "Submit Report"}
                            </button>
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
                            <button onClick={() => { setCounterModal(null); setServicerCounterIsFinal(false); }} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            To: <span className="font-bold text-slate-700">{counterModal.userName}</span>
                            <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-widest">Round {counterModal.currentRound + 1}</span>
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
                            {/* Final Offer checkbox */}
                            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                servicerCounterIsFinal ? "border-rose-300 bg-rose-50" : "border-slate-200 hover:border-rose-200 hover:bg-rose-50/40"
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={servicerCounterIsFinal}
                                    onChange={e => setServicerCounterIsFinal(e.target.checked)}
                                    className="mt-0.5 accent-rose-600"
                                />
                                <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${servicerCounterIsFinal ? "text-rose-700" : "text-slate-500"}`}>
                                        This is my Final Best Offer
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">User will only be able to accept or reject — no further counter offers</p>
                                </div>
                            </label>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => { setCounterModal(null); setServicerCounterIsFinal(false); }}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-50">
                                Cancel
                            </button>
                            <button onClick={handleServicerSendCounter} disabled={sendingServicerCounter || servicerCounterPrice === "" || !servicerCounterDate}
                                className={`flex-1 px-4 py-2.5 text-white text-xs font-black uppercase rounded-xl disabled:opacity-50 ${
                                    servicerCounterIsFinal ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
                                }`}>
                                {sendingServicerCounter ? "Sending..." : servicerCounterIsFinal ? "Send Final Offer" : "Send Offer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Society Jobs tab */}
            {activeTab === "society" && (
                <div className="space-y-6">
                    {societyLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-4 border-emerald-200 border-t-[#064e3b] rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Pending Invites */}
                            {societyContracts.filter(c => ["PENDING", "COUNTER_PROPOSED"].includes(c.status)).length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contract Invites</p>
                                    <div className="space-y-3">
                                        {societyContracts.filter(c => ["PENDING", "COUNTER_PROPOSED"].includes(c.status)).map(c => (
                                            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <p className="font-black text-slate-900">{c.society?.name || "Society"}</p>
                                                        <p className="text-xs text-slate-500">{c.duration_months}mo contract · ₹{c.monthly_rate?.toLocaleString()}/month</p>
                                                        {c.secretary_notes && <p className="text-xs text-slate-400 mt-1 italic">&ldquo;{c.secretary_notes}&rdquo;</p>}
                                                    </div>
                                                    <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${c.status === "COUNTER_PROPOSED" ? "text-blue-700 bg-blue-50" : "text-amber-700 bg-amber-50"}`}>
                                                        {c.status === "COUNTER_PROPOSED" ? "Awaiting Confirmation" : "Pending"}
                                                    </span>
                                                </div>
                                                {c.status === "PENDING" && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                setSocietyActionId(c.id + "_accept");
                                                                try {
                                                                    await apiFetch(`/service/contracts/${c.id}/accept`, { method: "POST" });
                                                                    const d = await apiFetch("/service/contracts");
                                                                    setSocietyContracts(d || []);
                                                                } catch {} finally { setSocietyActionId(null); }
                                                            }}
                                                            disabled={societyActionId === c.id + "_accept"}
                                                            className="px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 disabled:opacity-50"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                setSocietyActionId(c.id + "_reject");
                                                                try {
                                                                    await apiFetch(`/service/contracts/${c.id}/reject`, { method: "POST" });
                                                                    const d = await apiFetch("/service/contracts");
                                                                    setSocietyContracts(d || []);
                                                                } catch {} finally { setSocietyActionId(null); }
                                                            }}
                                                            disabled={societyActionId === c.id + "_reject"}
                                                            className="px-4 py-2 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={() => { setCounterContractId(c.id); setCounterDuration(6); setCounterNote(""); }}
                                                            className="px-4 py-2 border border-blue-200 text-blue-700 text-xs font-black uppercase rounded-xl hover:bg-blue-50"
                                                        >
                                                            Counter
                                                        </button>
                                                    </div>
                                                )}
                                                {counterContractId === c.id && (
                                                    <div className="mt-4 p-4 bg-blue-50 rounded-xl space-y-3">
                                                        <p className="text-xs font-black text-blue-700 uppercase tracking-widest">Propose Different Duration</p>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {([2, 6, 10, 12] as const).map(d => (
                                                                <button key={d} onClick={() => setCounterDuration(d)}
                                                                    className={`py-2 rounded-xl text-sm font-black transition-colors ${counterDuration === d ? "bg-[#064e3b] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
                                                                    {d}mo
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <input value={counterNote} onChange={e => setCounterNote(e.target.value)}
                                                            placeholder="Note (optional)"
                                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#064e3b]" />
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setCounterContractId(null)}
                                                                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:bg-white">
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    setSocietyActionId(c.id + "_counter");
                                                                    try {
                                                                        await apiFetch(`/service/contracts/${c.id}/counter`, {
                                                                            method: "POST",
                                                                            body: JSON.stringify({ counter_duration_months: counterDuration, servicer_notes: counterNote || null }),
                                                                        });
                                                                        setCounterContractId(null);
                                                                        const d = await apiFetch("/service/contracts");
                                                                        setSocietyContracts(d || []);
                                                                    } catch {} finally { setSocietyActionId(null); }
                                                                }}
                                                                disabled={societyActionId === c.id + "_counter"}
                                                                className="flex-1 py-2 bg-[#064e3b] text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-800 disabled:opacity-50"
                                                            >
                                                                Send Counter
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Active Contracts */}
                            {societyContracts.filter(c => c.status === "ACTIVE").length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Active Contracts</p>
                                    <div className="space-y-4">
                                        {societyContracts.filter(c => c.status === "ACTIVE").map(c => (
                                            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div>
                                                        <p className="font-black text-slate-900">{c.society?.name}</p>
                                                        <p className="text-xs text-slate-500">{c.duration_months}mo · ₹{c.monthly_rate?.toLocaleString()}/mo</p>
                                                    </div>
                                                    <span className="text-xs font-black px-2 py-0.5 rounded-full uppercase text-emerald-700 bg-emerald-50">Active</span>
                                                </div>
                                                {c.dispatches.length === 0
                                                    ? <p className="text-xs text-slate-400 italic">No jobs dispatched yet.</p>
                                                    : (
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jobs</p>
                                                            {c.dispatches.map(d => (
                                                                <div key={d.id} className="p-3 bg-slate-50 rounded-xl">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div>
                                                                            <p className="text-sm font-black text-slate-900">{d.service_type}</p>
                                                                            <p className="text-xs text-slate-500">
                                                                                {new Date(d.scheduled_at).toLocaleDateString()} · ₹{d.job_price}
                                                                                {d.member_home_number ? ` · Unit ${d.member_home_number}` : ""}
                                                                            </p>
                                                                        </div>
                                                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${d.status === "COMPLETED" ? "text-emerald-700 bg-emerald-50" : d.status === "IN_PROGRESS" ? "text-blue-700 bg-blue-50" : "text-amber-700 bg-amber-50"}`}>
                                                                            {d.status}
                                                                        </span>
                                                                    </div>
                                                                    {d.status === "ASSIGNED" && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await apiFetch(`/service/contracts/${c.id}/jobs/${d.id}`, {
                                                                                        method: "PATCH",
                                                                                        body: JSON.stringify({ status: "IN_PROGRESS" }),
                                                                                    });
                                                                                    const updated = await apiFetch("/service/contracts");
                                                                                    setSocietyContracts(updated || []);
                                                                                } catch {}
                                                                            }}
                                                                            className="text-xs font-black text-blue-700 hover:underline"
                                                                        >
                                                                            Mark In Progress →
                                                                        </button>
                                                                    )}
                                                                    {d.status === "IN_PROGRESS" && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await apiFetch(`/service/contracts/${c.id}/jobs/${d.id}`, {
                                                                                        method: "PATCH",
                                                                                        body: JSON.stringify({ status: "COMPLETED" }),
                                                                                    });
                                                                                    const updated = await apiFetch("/service/contracts");
                                                                                    setSocietyContracts(updated || []);
                                                                                } catch {}
                                                                            }}
                                                                            className="text-xs font-black text-emerald-700 hover:underline"
                                                                        >
                                                                            Mark Completed ✓
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {societyContracts.filter(c => ["PENDING", "COUNTER_PROPOSED", "ACTIVE"].includes(c.status)).length === 0 && (
                                <div className="flex flex-col items-center py-16 text-slate-400">
                                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    <p className="font-black text-sm uppercase tracking-widest">No society contracts</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Charge Submission Modal */}
            {finalCompleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Submit Charge</h2>
                            <button
                                onClick={() => setFinalCompleteTarget(null)}
                                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-5">
                            {finalCompleteTarget.service_type} — fill in actual work details
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Actual hours worked <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.5"
                                    value={extraHours}
                                    onChange={e => setExtraHours(e.target.value === "" ? "" : Number(e.target.value))}
                                    placeholder="e.g. 2.5"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Charge amount ₹ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={chargeAmount}
                                    onChange={e => setChargeAmount(e.target.value === "" ? "" : Number(e.target.value))}
                                    placeholder="e.g. 400"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    rows={3}
                                    value={finalNotes}
                                    onChange={e => setFinalNotes(e.target.value)}
                                    placeholder="What work was done?"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setFinalCompleteTarget(null)}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFinalComplete}
                                disabled={!extraHours || !chargeAmount || submittingFinal}
                                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                            >
                                {submittingFinal ? "Submitting…" : "Submit Charge"}
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

                                {/* Final Offer checkbox */}
                                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                    resFinalOffer ? "border-rose-300 bg-rose-50" : "border-slate-200 hover:border-rose-200 hover:bg-rose-50/40"
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={resFinalOffer}
                                        onChange={e => setResFinalOffer(e.target.checked)}
                                        className="mt-0.5 accent-rose-600"
                                    />
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${resFinalOffer ? "text-rose-700" : "text-slate-500"}`}>
                                            This is my Final Best Offer
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">User will only be able to accept or reject — no counter offers allowed</p>
                                    </div>
                                </label>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => { setRespondingTo(null); setResFinalOffer(false); }} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitResponse}
                                    disabled={submittingResponse || !resDate || !resPrice}
                                    className={`flex-1 py-3 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                        resFinalOffer ? "bg-rose-600 hover:bg-rose-700" : "bg-[#064e3b] hover:bg-emerald-800"
                                    }`}
                                >
                                    {submittingResponse ? "Submitting..." : <><Send className="w-4 h-4" /> {resFinalOffer ? "Submit Final Offer" : "Submit Offer"}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

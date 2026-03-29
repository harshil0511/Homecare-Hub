"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Home,
    MapPin,
    Star,
    ShieldCheck,
    DollarSign,
    Clock,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    Search as SearchIcon,
    Loader2,
    Bell,
    ArrowRight,
    CalendarClock,
    FileText,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Provider {
    id: number;
    company_name: string;
    owner_name: string;
    first_name: string | null;
    last_name: string | null;
    category: string;
    categories: string[];
    phone: string;
    email: string;
    hourly_rate: number;
    bio: string | null;
    location: string | null;
    profile_photo_url: string | null;
    availability_status: string;
    is_verified: boolean;
    rating: number;
    experience_years: number;
}

interface RoutineTask {
    id: number;
    title: string;
    description: string | null;
    category: string | null;
    location: string | null;
    priority: string;
    status: string;
    task_type: string;
    booking_id: number | null;
    created_at: string | null;
}

const ROUTINE_CATEGORIES = [
    "Appliance Repair",
    "AC Service",
    "Home Cleaning",
    "Plumbing",
    "Electrical",
    "Pest Control",
    "Painting",
    "Carpentry",
    "General Maintenance",
];

const PRIORITIES = [
    { value: "Routine", label: "Routine", color: "bg-slate-100 text-slate-600 border-slate-200" },
    { value: "Mandatory", label: "Mandatory", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "Urgent", label: "Urgent", color: "bg-red-50 text-red-700 border-red-200" },
];

const STATUS_COLORS: Record<string, string> = {
    AVAILABLE: "bg-emerald-500",
    WORKING: "bg-amber-500",
    VACATION: "bg-slate-400",
};

const PRIORITY_BADGE: Record<string, string> = {
    Routine: "bg-slate-100 text-slate-600",
    Mandatory: "bg-amber-50 text-amber-700",
    Urgent: "bg-red-50 text-red-700",
};

function RoutineServiceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Phase state: form → providers → schedule → success
    const [phase, setPhase] = useState<"form" | "providers" | "schedule">("form");
    const [createdTask, setCreatedTask] = useState<RoutineTask | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
    const [scheduledDate, setScheduledDate] = useState("");
    const [scheduledTime, setScheduledTime] = useState("");

    // Pending (unassigned) tasks
    const [pendingTasks, setPendingTasks] = useState<RoutineTask[]>([]);
    const [loadingPending, setLoadingPending] = useState(true);
    const [pendingExpanded, setPendingExpanded] = useState(true);
    const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

    // Form state
    const [deviceName, setDeviceName] = useState("");
    const [location, setLocation] = useState("");
    const [category, setCategory] = useState("");
    const [priority, setPriority] = useState("Routine");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Provider state
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(false);
    const [assigning, setAssigning] = useState<number | null>(null);
    const [assignSuccess, setAssignSuccess] = useState(false);

    // Fetch all pending unassigned routine tasks
    const fetchPendingTasks = async () => {
        setLoadingPending(true);
        try {
            const data: RoutineTask[] = await apiFetch("/maintenance/routine");
            const unassigned = data.filter(t => t.booking_id === null);
            setPendingTasks(unassigned);

            // Auto-resume if ?taskId= param is present (coming from Alerts page)
            const taskIdParam = searchParams.get("taskId");
            if (taskIdParam) {
                const taskId = parseInt(taskIdParam);
                const match = unassigned.find(t => t.id === taskId);
                if (match) {
                    setCreatedTask(match);
                    setPhase("providers");
                    fetchProviders(match.id);
                }
            }
        } catch (err) {
            console.error("Failed to fetch pending tasks", err);
        } finally {
            setLoadingPending(false);
        }
    };

    useEffect(() => {
        fetchPendingTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmitTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!deviceName.trim() || !category) {
            setError("Device name and category are required.");
            return;
        }

        setSubmitting(true);
        try {
            const task = await apiFetch("/maintenance/routine", {
                method: "POST",
                body: JSON.stringify({
                    title: deviceName.trim(),
                    description: notes.trim() || null,
                    category,
                    location: location.trim() || null,
                    priority,
                }),
            });
            setCreatedTask(task);
            setPhase("providers");
            fetchProviders(task.id);
        } catch (err: any) {
            setError(err.message || "Failed to create routine task");
        } finally {
            setSubmitting(false);
        }
    };

    const fetchProviders = async (taskId: number) => {
        setLoadingProviders(true);
        try {
            const data = await apiFetch(`/maintenance/routine/${taskId}/providers`);
            setProviders(data);
        } catch (err) {
            console.error("Failed to fetch providers", err);
        } finally {
            setLoadingProviders(false);
        }
    };

    // Resume a previously saved pending task → go straight to provider selection
    const handleResumeTask = (task: RoutineTask) => {
        setCreatedTask(task);
        setProviders([]);
        setPhase("providers");
        fetchProviders(task.id);
    };

    // Step 1: User selects a provider → go to schedule phase
    const handleSelectProvider = (provider: Provider) => {
        setSelectedProvider(provider);
        setScheduledDate("");
        setScheduledTime("");
        setPhase("schedule");
    };

    // Step 2: User picks date+time → sends request (Pending booking)
    const handleSendRequest = async () => {
        if (!createdTask || !selectedProvider || !scheduledDate || !scheduledTime) return;
        setAssigning(selectedProvider.id);
        setError("");
        try {
            const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            await apiFetch(`/maintenance/routine/${createdTask.id}/assign`, {
                method: "POST",
                body: JSON.stringify({
                    provider_id: selectedProvider.id,
                    scheduled_at: scheduledAt,
                }),
            });
            setAssignSuccess(true);
            await fetchPendingTasks();
            setTimeout(() => {
                router.push("/dashboard/bookings/history");
            }, 1500);
        } catch (err: any) {
            setError(err.message || "Failed to send request");
            setAssigning(null);
        }
    };

    const displayName = (p: Provider) => {
        if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
        return p.owner_name || p.company_name;
    };

    const getPhotoUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith("/")) return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
        return url;
    };

    // ── Success Overlay ──
    if (assignSuccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-[#064e3b]" />
                </div>
                <h2 className="text-2xl font-black text-[#000000] tracking-tight uppercase">Request Sent</h2>
                <p className="text-sm text-slate-500 mt-2 font-bold">Awaiting expert response. Redirecting...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-12 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                            <Home className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl font-black text-[#000000] tracking-tighter uppercase leading-[0.9]">
                            Home Service Request
                        </h1>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">
                        {phase === "form"
                            ? "Describe your routine maintenance need"
                            : phase === "providers"
                            ? "Select an available expert for your request"
                            : "Set schedule and send request"}
                    </p>
                </div>
                {phase === "providers" && (
                    <button
                        onClick={() => { setPhase("form"); setProviders([]); setCreatedTask(null); setSelectedProvider(null); }}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#064e3b] transition-colors"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        New Request
                    </button>
                )}
                {phase === "schedule" && (
                    <button
                        onClick={() => { setPhase("providers"); setSelectedProvider(null); }}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#064e3b] transition-colors"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Back to Experts
                    </button>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs font-bold">{error}</p>
                    <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600 text-xs font-black">
                        Dismiss
                    </button>
                </div>
            )}

            {/* ── PHASE 1: Form ── */}
            {phase === "form" && (
                <>
                    {/* ── My Service Requests — Accordion Box ── */}
                    {!loadingPending && (
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {/* Accordion Header */}
                            <button
                                onClick={() => setPendingExpanded(p => !p)}
                                className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                            >
                                <div className="w-8 h-8 bg-[#064e3b] rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-[#000000] tracking-tight">My Service Requests</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                        {pendingTasks.length === 0
                                            ? "No pending requests"
                                            : `${pendingTasks.length} awaiting expert assignment`}
                                    </p>
                                </div>
                                {pendingTasks.length > 0 && (
                                    <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest flex-shrink-0">
                                        {pendingTasks.length} open
                                    </span>
                                )}
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${pendingExpanded ? "rotate-180" : ""}`} />
                            </button>

                            {/* Accordion Body */}
                            {pendingExpanded && (
                                <div className="border-t border-slate-100">
                                    {pendingTasks.length === 0 ? (
                                        <div className="px-6 py-8 text-center">
                                            <p className="text-xs font-bold text-slate-400">No pending requests. Create one below.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                                            {pendingTasks.map(task => {
                                                const isRowOpen = expandedTaskId === task.id;
                                                return (
                                                    <div key={task.id}>
                                                        {/* Row header */}
                                                        <button
                                                            onClick={() => setExpandedTaskId(isRowOpen ? null : task.id)}
                                                            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors text-left group"
                                                        >
                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                                task.priority === "Urgent" ? "bg-red-500" :
                                                                task.priority === "Mandatory" ? "bg-amber-500" :
                                                                "bg-slate-300"
                                                            }`} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-black text-[#000000] truncate tracking-tight group-hover:text-[#064e3b] transition-colors">
                                                                    {task.title}
                                                                </p>
                                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                                                                    {task.category || "General"}
                                                                    {task.location && <> · {task.location}</>}
                                                                </p>
                                                            </div>
                                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex-shrink-0 ${PRIORITY_BADGE[task.priority] || "bg-slate-100 text-slate-500"}`}>
                                                                {task.priority}
                                                            </span>
                                                            <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-150 flex-shrink-0 ${isRowOpen ? "rotate-180 text-[#064e3b]" : ""}`} />
                                                        </button>

                                                        {/* Row expanded detail */}
                                                        {isRowOpen && (
                                                            <div className="px-6 pb-4 pt-1 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-4 animate-fade-in">
                                                                <p className="text-xs text-slate-500 font-medium flex-1">
                                                                    {task.description || "No additional notes."}
                                                                </p>
                                                                <button
                                                                    onClick={() => handleResumeTask(task)}
                                                                    className="flex items-center gap-1.5 px-5 py-2.5 bg-[#064e3b] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-950 transition-all active:scale-95 flex-shrink-0 shadow-lg shadow-emerald-900/10"
                                                                >
                                                                    Find Expert
                                                                    <ArrowRight className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmitTask} className="space-y-6">
                        <div className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 shadow-sm">
                            {/* Device Name */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                                    Device Name
                                </label>
                                <input
                                    type="text"
                                    value={deviceName}
                                    onChange={e => setDeviceName(e.target.value)}
                                    placeholder="e.g., Washing Machine, AC Unit, Water Heater..."
                                    required
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                                    Service Location
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        placeholder="e.g., Unit 402, Building A, Mumbai..."
                                        className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Category & Priority Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Category */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                                        Service Category
                                    </label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        required
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select category...</option>
                                        {ROUTINE_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Priority */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                                        Priority
                                    </label>
                                    <div className="flex gap-2">
                                        {PRIORITIES.map(p => (
                                            <button
                                                key={p.value}
                                                type="button"
                                                onClick={() => setPriority(p.value)}
                                                className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                                    priority === p.value
                                                        ? `${p.color} ring-2 ring-offset-1 ring-current shadow-sm`
                                                        : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                                }`}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                                    Notes & Context
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Additional details or model numbers..."
                                    rows={3}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-3 py-5 bg-[#064e3b] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-950 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/10"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <SearchIcon className="w-4 h-4" />
                            )}
                            {submitting ? "Creating Request..." : "Find Available Experts"}
                        </button>
                    </form>
                </>
            )}

            {/* ── PHASE 2: Provider Selection ── */}
            {phase === "providers" && (
                <div className="space-y-6">
                    {/* Task Summary */}
                    {createdTask && (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#064e3b] rounded-xl flex items-center justify-center flex-shrink-0">
                                <Wrench className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black text-[#000000] tracking-tight truncate">{createdTask.title}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                    {createdTask.category} &bull; {createdTask.priority}
                                    {createdTask.location && <> &bull; {createdTask.location}</>}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Providers Grid */}
                    {loadingProviders ? (
                        <div className="flex items-center justify-center h-[30vh]">
                            <div className="w-10 h-10 border-4 border-[#064e3b] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : providers.length === 0 ? (
                        /* ── No Experts Available: task already saved, show alert info ── */
                        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl space-y-5 px-8">
                            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
                                <Bell className="w-8 h-8 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-slate-700 uppercase tracking-wider">No Experts Available Right Now</p>
                                <p className="text-sm text-slate-400 mt-2 font-medium max-w-sm mx-auto leading-relaxed">
                                    Your request has been <span className="font-black text-[#064e3b]">recorded and saved</span>. When an expert becomes available for <span className="font-black">{createdTask?.category}</span>, you can assign them from this page.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                                <Link
                                    href={`/dashboard/providers?category=${encodeURIComponent(createdTask?.category || "")}`}
                                    className="flex items-center gap-2 px-6 py-3 bg-[#064e3b] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-950 transition-all shadow-lg shadow-emerald-900/10"
                                >
                                    <SearchIcon className="w-3.5 h-3.5" />
                                    Find Expert
                                </Link>
                                <button
                                    onClick={() => { setPhase("form"); setProviders([]); setCreatedTask(null); fetchPendingTasks(); }}
                                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#064e3b] transition-all"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    Back to Requests
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {providers.length} expert{providers.length !== 1 ? "s" : ""} available
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {providers.map(provider => (
                                    <div
                                        key={provider.id}
                                        className="bg-white border border-slate-100 rounded-3xl p-6 transition-all hover:shadow-xl hover:shadow-slate-900/5 hover:border-slate-200 hover:-translate-y-1 duration-200"
                                    >
                                        {/* Provider Header */}
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="w-14 h-14 rounded-2xl bg-[#064e3b] overflow-hidden flex-shrink-0">
                                                {getPhotoUrl(provider.profile_photo_url) ? (
                                                    <img
                                                        src={getPhotoUrl(provider.profile_photo_url)!}
                                                        alt={displayName(provider)}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white font-black text-lg">
                                                        {(provider.first_name || provider.owner_name || "?")[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-black text-[#000000] tracking-tight truncate">
                                                        {displayName(provider)}
                                                    </h3>
                                                    {provider.is_verified && (
                                                        <ShieldCheck className="w-4 h-4 text-[#064e3b] flex-shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[provider.availability_status] || "bg-slate-300"}`} />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                        {provider.availability_status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Grid */}
                                        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                                            {provider.location && (
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <MapPin className="w-3 h-3" />
                                                    <span className="font-bold truncate">{provider.location}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Star className="w-3 h-3 text-amber-500" />
                                                <span className="font-bold">{provider.rating.toFixed(1)}/5</span>
                                            </div>
                                            {provider.hourly_rate > 0 && (
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <DollarSign className="w-3 h-3" />
                                                    <span className="font-bold">${provider.hourly_rate}/hr</span>
                                                </div>
                                            )}
                                            {provider.experience_years > 0 && (
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <Clock className="w-3 h-3" />
                                                    <span className="font-bold">{provider.experience_years} yrs exp</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bio */}
                                        {provider.bio && (
                                            <p className="text-xs text-slate-400 font-medium line-clamp-2 mb-5 italic">
                                                &ldquo;{provider.bio}&rdquo;
                                            </p>
                                        )}

                                        {/* Select Button → goes to schedule phase */}
                                        <button
                                            onClick={() => handleSelectProvider(provider)}
                                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 bg-[#064e3b] text-white hover:bg-emerald-950 shadow-lg shadow-emerald-900/10"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Select Expert
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── PHASE 3: Schedule & Send Request ── */}
            {phase === "schedule" && selectedProvider && (
                <div className="space-y-6 animate-fade-in">
                    {/* Task Summary */}
                    {createdTask && (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#064e3b] rounded-xl flex items-center justify-center flex-shrink-0">
                                <Wrench className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black text-[#000000] tracking-tight truncate">{createdTask.title}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                    {createdTask.category} &bull; {createdTask.priority}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Selected Provider Card */}
                    <div className="bg-white border border-emerald-100 rounded-3xl p-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-[#064e3b] overflow-hidden flex-shrink-0">
                                {getPhotoUrl(selectedProvider.profile_photo_url) ? (
                                    <img
                                        src={getPhotoUrl(selectedProvider.profile_photo_url)!}
                                        alt={displayName(selectedProvider)}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white font-black text-lg">
                                        {(selectedProvider.first_name || selectedProvider.owner_name || "?")[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-black text-[#000000] tracking-tight">{displayName(selectedProvider)}</h3>
                                    {selectedProvider.is_verified && <ShieldCheck className="w-4 h-4 text-[#064e3b]" />}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{selectedProvider.category}</span>
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <Star className="w-3 h-3 text-amber-500" /> {selectedProvider.rating.toFixed(1)}
                                    </span>
                                    {selectedProvider.hourly_rate > 0 && (
                                        <span className="text-xs font-bold text-slate-500">${selectedProvider.hourly_rate}/hr</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Schedule Picker */}
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Set Service Schedule</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                                        <CalendarClock className="w-3 h-3 inline mr-1" />
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={scheduledDate}
                                        onChange={e => setScheduledDate(e.target.value)}
                                        min={new Date().toISOString().split("T")[0]}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        Time
                                    </label>
                                    <input
                                        type="time"
                                        value={scheduledTime}
                                        onChange={e => setScheduledTime(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Send Request Button */}
                    <button
                        onClick={handleSendRequest}
                        disabled={!scheduledDate || !scheduledTime || assigning !== null}
                        className="w-full flex items-center justify-center gap-3 py-5 bg-[#064e3b] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-950 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/10"
                    >
                        {assigning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <ArrowRight className="w-4 h-4" />
                        )}
                        {assigning ? "Sending Request..." : "Send Request"}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function RoutineServicePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-[#064e3b] border-t-transparent rounded-full animate-spin" /></div>}>
            <RoutineServiceContent />
        </Suspense>
    );
}

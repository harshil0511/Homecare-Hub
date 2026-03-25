"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
    ChevronRight, ChevronLeft, Check, Info, Upload,
    Wrench, ChevronDown, AlertCircle, Clock
} from "lucide-react";
import ServiceSelector from "@/components/bookings/ServiceSelector";
import ProviderCard from "@/components/bookings/ProviderCard";
import TimeSlotPicker from "@/components/bookings/TimeSlotPicker";
import { Suspense } from "react";

const STEPS = [
    { id: 1, title: "Category", sub: "Select Service" },
    { id: 2, title: "Provider", sub: "Choose Expert" },
    { id: 3, title: "Schedule", sub: "Pick Time" },
    { id: 4, title: "Details", sub: "Issues & Unit" },
    { id: 5, title: "Review", sub: "Confirm" },
];

const PRIORITY_COLORS: Record<string, string> = {
    Normal: "bg-slate-100 text-slate-600",
    High: "bg-amber-50 text-amber-700",
    Emergency: "bg-red-50 text-red-700",
    Routine: "bg-slate-100 text-slate-600",
    Mandatory: "bg-amber-50 text-amber-700",
    Urgent: "bg-red-50 text-red-700",
};

interface PendingTask {
    id: number;
    title: string;
    category: string | null;
    location: string | null;
    priority: string;
    description: string | null;
    booking_id: number | null;
}

function NewBookingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [bookingError, setBookingError] = useState("");

    // Booking State
    const [category, setCategory] = useState("");
    const [providers, setProviders] = useState<any[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<any>(null);
    const [date, setDate] = useState<Date>();
    const [slot, setSlot] = useState("");
    const [description, setDescription] = useState("");
    const [property, setProperty] = useState("");
    const [priority, setPriority] = useState("Normal");

    // Task linking
    const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
    const [linkedTask, setLinkedTask] = useState<PendingTask | null>(null);
    const [taskPickerOpen, setTaskPickerOpen] = useState(false);

    // Fetch pending tasks on mount + handle URL params
    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const data: PendingTask[] = await apiFetch("/maintenance/routine");
                const unassigned = data.filter(t => t.booking_id === null);
                setPendingTasks(unassigned);
            } catch { /* user may not have tasks */ }
        };
        fetchTasks();

        // Pre-fill from URL params (coming from providers page)
        const providerParam = searchParams.get("provider");
        const categoryParam = searchParams.get("category");
        if (categoryParam) setCategory(categoryParam);
        if (providerParam) {
            apiFetch(`/services/providers`).then((all: any[]) => {
                const match = all.find(p => p.id === parseInt(providerParam));
                if (match) { setSelectedProvider(match); setStep(3); }
            }).catch(() => {});
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch providers when category changes (no time filter yet)
    useEffect(() => {
        if (category) {
            apiFetch(`/services/providers?category=${encodeURIComponent(category)}`).then(setProviders);
        }
    }, [category]);

    // Re-fetch providers with time filter when date+slot both set
    useEffect(() => {
        if (category && date && slot) {
            const [h, m] = slot.split(":").map(Number);
            const dt = new Date(date);
            dt.setHours(h, m, 0, 0);
            const iso = dt.toISOString();
            apiFetch(`/services/providers?category=${encodeURIComponent(category)}&scheduled_at=${iso}`)
                .then(setProviders)
                .catch(() => {});
        }
    }, [date, slot, category]);

    const handleNext = () => { setBookingError(""); setStep(s => Math.min(s + 1, 5)); };
    const handleBack = () => { setBookingError(""); setStep(s => Math.max(s - 1, 1)); };

    // Link task: auto-fill category + priority + description
    const handleLinkTask = (task: PendingTask) => {
        setLinkedTask(task);
        if (task.category) setCategory(task.category);
        if (task.priority) setPriority(task.priority);
        if (task.description) setDescription(task.description);
        setTaskPickerOpen(false);
    };

    const handleSubmit = async () => {
        if (!selectedProvider) { setBookingError("Please select a provider first."); return; }
        if (!date || !slot) { setBookingError("Please pick a date and time slot."); return; }
        setLoading(true);
        setBookingError("");
        try {
            const [h, m] = slot.split(":").map(Number);
            const scheduledAt = new Date(date);
            scheduledAt.setHours(h, m, 0, 0);

            const res = await apiFetch("/bookings/create", {
                method: "POST",
                body: JSON.stringify({
                    provider_id: selectedProvider.id,
                    service_type: category,
                    scheduled_at: scheduledAt.toISOString(),
                    priority,
                    issue_description: description || (linkedTask ? linkedTask.title : undefined),
                    property_details: property,
                    estimated_cost: selectedProvider.hourly_rate || 0,
                    task_id: linkedTask?.id ?? null,
                })
            });
            router.push(`/dashboard/bookings/${res.id}`);
        } catch (err: any) {
            setBookingError(err.message || "Failed to create booking. Please try a different time.");
        } finally {
            setLoading(false);
        }
    };

    const scheduledDateTime = date && slot ? (() => {
        const [h, m] = slot.split(":").map(Number);
        const d = new Date(date); d.setHours(h, m);
        return d;
    })() : null;

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-12 bg-white border border-slate-200 p-5 rounded-[2.5rem] shadow-sm">
                {STEPS.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 flex-1 last:flex-none">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-all ${
                            step > s.id ? "bg-[#064e3b] text-white" :
                            step === s.id ? "bg-slate-900 text-white" :
                            "bg-slate-100 text-slate-400"
                        }`}>
                            {step > s.id ? <Check size={16} /> : s.id}
                        </div>
                        <div className="hidden md:block">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#000000]">{s.title}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{s.sub}</p>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className="flex-1 h-px bg-slate-100 mx-3 hidden md:block" />
                        )}
                    </div>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white border border-slate-200 rounded-[3rem] p-10 md:p-16 shadow-xl shadow-slate-200/50 min-h-[500px]">

                {/* ── Step 1: Category ── */}
                {step === 1 && (
                    <div className="space-y-10 animate-fade-in">
                        <div className="text-center">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Select Service</h2>
                            <p className="text-slate-500 font-medium mt-2">Choose the category of help you need today</p>
                        </div>

                        {/* Optional: Link to a pending task */}
                        {pendingTasks.length > 0 && (
                            <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setTaskPickerOpen(p => !p)}
                                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="w-8 h-8 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Wrench className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-[#000000]">
                                            {linkedTask ? `Linked: ${linkedTask.title}` : "Link to an existing task (optional)"}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                            {linkedTask
                                                ? `${linkedTask.category} · ${linkedTask.priority}`
                                                : `${pendingTasks.length} pending request${pendingTasks.length !== 1 ? "s" : ""} available`}
                                        </p>
                                    </div>
                                    {linkedTask && (
                                        <button
                                            onClick={e => { e.stopPropagation(); setLinkedTask(null); setCategory(""); setPriority("Normal"); setDescription(""); }}
                                            className="text-[9px] font-black text-slate-400 hover:text-rose-600 px-2 py-1 transition-colors"
                                        >
                                            Clear
                                        </button>
                                    )}
                                    <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${taskPickerOpen ? "rotate-180" : ""}`} />
                                </button>
                                {taskPickerOpen && (
                                    <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-52 overflow-y-auto">
                                        {pendingTasks.map(task => (
                                            <button
                                                key={task.id}
                                                onClick={() => handleLinkTask(task)}
                                                className={`w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left ${linkedTask?.id === task.id ? "bg-emerald-50" : ""}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                    task.priority === "Urgent" || task.priority === "Emergency" ? "bg-red-500" :
                                                    task.priority === "Mandatory" || task.priority === "High" ? "bg-amber-500" :
                                                    "bg-slate-300"
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-[#000000] truncate">{task.title}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{task.category || "General"}</p>
                                                </div>
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest flex-shrink-0 ${PRIORITY_COLORS[task.priority] || "bg-slate-100 text-slate-500"}`}>
                                                    {task.priority}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <ServiceSelector
                            onSelect={(cat) => { setCategory(cat); handleNext(); }}
                            selectedCategory={category}
                        />
                    </div>
                )}

                {/* ── Step 2: Provider ── */}
                {step === 2 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <button onClick={handleBack} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                                <ChevronLeft size={16} /> Back
                            </button>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Choose Expert</h2>
                        </div>

                        {date && slot && (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-xl">
                                <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <p className="text-xs font-bold text-emerald-700">
                                    Showing availability for <span className="font-black">{scheduledDateTime?.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                </p>
                            </div>
                        )}

                        {providers.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 text-sm font-bold">No experts found for this category.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {providers.map((p: any) => (
                                    <ProviderCard
                                        key={p.id}
                                        provider={p}
                                        onSelect={(prov) => { setSelectedProvider(prov); handleNext(); }}
                                        isSelected={selectedProvider?.id === p.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Step 3: Schedule ── */}
                {step === 3 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <button onClick={handleBack} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                                <ChevronLeft size={16} /> Change Expert
                            </button>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Schedule Session</h2>
                        </div>

                        {selectedProvider && (
                            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                <div className="w-8 h-8 bg-[#064e3b] rounded-lg flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-black text-xs">{selectedProvider.company_name?.[0]}</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-[#000000]">{selectedProvider.company_name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedProvider.availability_status}</p>
                                </div>
                            </div>
                        )}

                        <TimeSlotPicker
                            onSelect={(d, s) => { setDate(d); setSlot(s); }}
                            selectedDate={date}
                            selectedSlot={slot}
                        />

                        {date && slot && (
                            <button onClick={handleNext} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-[#064e3b] transition-all flex items-center justify-center gap-3">
                                Confirm Schedule <ChevronRight size={18} />
                            </button>
                        )}
                    </div>
                )}

                {/* ── Step 4: Details ── */}
                {step === 4 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <button onClick={handleBack} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                                <ChevronLeft size={16} /> Re-schedule
                            </button>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Issue Details</h2>
                        </div>

                        {/* Linked task badge */}
                        {linkedTask && (
                            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                <Wrench className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-amber-800 truncate">Linked Task: {linkedTask.title}</p>
                                    <p className="text-[10px] text-amber-600 font-bold uppercase">{linkedTask.category} · {linkedTask.priority}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Property Unit / Address</label>
                                <input
                                    value={property}
                                    onChange={e => setProperty(e.target.value)}
                                    placeholder="e.g. Apartment 402, Block B"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Description of Issue</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={4}
                                    placeholder="Describe exactly what needs fixing..."
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Priority Level</label>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    >
                                        <option>Normal</option>
                                        <option>High</option>
                                        <option>Emergency</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Attachments</label>
                                    <div className="flex items-center justify-center w-full h-[58px] bg-slate-100 border border-dashed border-slate-300 rounded-2xl text-slate-400 hover:text-[#064e3b] hover:border-[#064e3b] cursor-pointer transition-all">
                                        <Upload size={18} />
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleNext} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-[#064e3b] transition-all flex items-center justify-center gap-3">
                                Final Review <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 5: Review ── */}
                {step === 5 && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <button onClick={handleBack} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                                <ChevronLeft size={16} /> Edit Details
                            </button>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Booking Summary</h2>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 space-y-6">
                            {/* Task link row */}
                            {linkedTask && (
                                <div className="flex items-center justify-between pb-5 border-b border-slate-200/50">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Linked Task</p>
                                        <p className="text-base font-black text-slate-900">{linkedTask.title}</p>
                                    </div>
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${PRIORITY_COLORS[linkedTask.priority] || "bg-slate-100 text-slate-500"}`}>
                                        {linkedTask.priority}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between pb-5 border-b border-slate-200/50">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service</p>
                                    <p className="text-base font-black text-slate-900">{category}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expert</p>
                                    <p className="text-base font-black text-slate-900">{selectedProvider?.company_name}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pb-5 border-b border-slate-200/50">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Scheduled For</p>
                                    <p className="text-base font-black text-slate-900">
                                        {scheduledDateTime?.toLocaleString([], { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority</p>
                                    <span className={`text-xs font-black px-3 py-1 rounded-lg uppercase ${PRIORITY_COLORS[priority] || "bg-slate-100 text-slate-500"}`}>
                                        {priority}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-base font-black text-slate-900 uppercase tracking-tight">Estimated Cost</p>
                                <p className="text-4xl font-black text-[#064e3b] tracking-tighter">${selectedProvider?.hourly_rate?.toFixed(2) || "0.00"}</p>
                            </div>
                        </div>

                        {bookingError && (
                            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p className="text-sm font-bold">{bookingError}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-4 bg-amber-50 p-5 rounded-2xl border border-amber-100 text-amber-700">
                            <Info size={20} className="shrink-0" />
                            <p className="text-xs font-bold leading-relaxed">By confirming, you agree to our service protocol. The provider will review and confirm within 30 minutes.</p>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full bg-[#064e3b] hover:bg-emerald-950 text-white py-7 rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-2xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-4 active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? "Processing..." : <><Check size={22} /> Confirm Booking</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function NewBookingPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-[#064e3b] border-t-transparent rounded-full animate-spin" /></div>}>
            <NewBookingContent />
        </Suspense>
    );
}

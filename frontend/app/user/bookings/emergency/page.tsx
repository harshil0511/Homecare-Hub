"use client";

import { useEffect, useRef, useState } from "react";
import {
    ArrowRight, Check, ChevronLeft, Clock, Loader2,
    ShieldAlert, Users, X, Zap,
} from "lucide-react";
import Link from "next/link";
import {
    apiFetch,
    emergencyApi,
    createUserEmergencySocket,
    EmergencyConfig,
    EmergencyRequestRead,
    EmergencyResponseRead,
    ProviderBasic,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";

const CATEGORIES = [
    "Electrical", "Plumbing", "Gas Leak", "Lock/Door",
    "Appliance Failure", "Structural", "Pest", "Other",
];

type Step = "category" | "details" | "providers" | "waiting" | "done";

interface SOSFormData {
    category: string;
    society_name: string;
    building_name: string;
    flat_no: string;
    landmark: string;
    full_address: string;
    description: string;
    device_name: string;
    contact_name: string;
    contact_phone: string;
}

function useCountdown(expiresAt: string | null) {
    const [remaining, setRemaining] = useState(0);
    useEffect(() => {
        if (!expiresAt) return;
        // expires_at from the server is a naive UTC datetime string (no Z / no offset).
        // JS new Date() without a timezone treats the string as LOCAL time, which makes
        // the countdown appear negative for UTC+ users. Append "Z" to force UTC parsing.
        const utcExpires = expiresAt.endsWith("Z") || expiresAt.includes("+") ? expiresAt : expiresAt + "Z";
        const tick = () => {
            const diff = Math.max(0, Math.floor((new Date(utcExpires).getTime() - Date.now()) / 1000));
            setRemaining(diff);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [expiresAt]);
    return remaining;
}

function EmergencySOSContent() {
    const { success, error: showError } = useToast();

    const [step, setStep] = useState<Step>("category");
    const [loading, setLoading] = useState(false);
    const [checkingActive, setCheckingActive] = useState(true);
    const [configs, setConfigs] = useState<EmergencyConfig[]>([]);

    const [form, setForm] = useState<SOSFormData>({
        category: "",
        society_name: "", building_name: "", flat_no: "",
        landmark: "", full_address: "", description: "",
        device_name: "", contact_name: "", contact_phone: "",
    });

    const [providers, setProviders] = useState<ProviderBasic[]>([]);
    const [providersLoading, setProvidersLoading] = useState(false);
    const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);

    const [emergencyRequest, setEmergencyRequest] = useState<EmergencyRequestRead | null>(null);
    const [responses, setResponses] = useState<EmergencyResponseRead[]>([]);
    const [resultingBookingId, setResultingBookingId] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const countdown = useCountdown(emergencyRequest?.expires_at ?? null);

    // On mount: load configs + check for existing active emergency + prefill user info
    useEffect(() => {
        emergencyApi.getConfigs().then(setConfigs).catch(() => {});

        // Pre-fill contact name from user profile
        apiFetch("/user/me").then((me: Record<string, string>) => {
            setForm(f => ({ ...f, contact_name: f.contact_name || (me.username ?? "") }));
        }).catch(() => {});

        // Read URL params directly (safe in "use client" — runs client-side only)
        const params = new URLSearchParams(window.location.search);
        const preProviderId = params.get("provider_id");
        const preCategory = params.get("category") || "";

        emergencyApi.getActive()
            .then(existing => {
                setEmergencyRequest(existing);
                setForm(f => ({ ...f, category: existing.category }));
                const pendingResponses = (existing.responses || []).filter(r => r.status === "PENDING");
                setResponses(pendingResponses);
                setStep("waiting");
            })
            .catch(() => {
                // No active emergency — check if coming from Find Expert page
                if (preProviderId && preCategory) {
                    setForm(f => ({ ...f, category: preCategory }));
                    setSelectedProviderIds([preProviderId]);
                    setStep("details");
                }
            })
            .finally(() => setCheckingActive(false));
    }, []);

    // WebSocket — only depends on the request ID string, not the whole object
    const emergencyRequestId = emergencyRequest?.id ?? null;
    useEffect(() => {
        if (step !== "waiting" || !emergencyRequestId) return;

        const ws = createUserEmergencySocket(emergencyRequestId);
        wsRef.current = ws;

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.event === "new_response") {
                    setResponses(prev => {
                        if (prev.find(r => r.id === msg.response_id)) return prev;
                        return [...prev, {
                            id: msg.response_id,
                            request_id: emergencyRequestId,
                            provider_id: msg.provider_id,
                            arrival_time: msg.arrival_time,
                            status: "PENDING",
                            penalty_count: 0,
                            created_at: msg.created_at ?? null,
                            provider: {
                                id: msg.provider_id,
                                first_name: msg.provider_name,
                                rating: msg.rating,
                            },
                        }];
                    });
                } else if (msg.event === "request_accepted") {
                    setResultingBookingId(msg.booking_id);
                    setStep("done");
                } else if (msg.event === "request_cancelled") {
                    setEmergencyRequest(null);
                    setResponses([]);
                    setStep("category");
                }
            } catch { /* ignore malformed frames */ }
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [step, emergencyRequestId]);

    // Poll for responses every 10s as fallback
    useEffect(() => {
        if (step !== "waiting" || !emergencyRequestId) return;
        const id = setInterval(async () => {
            try {
                const data = await emergencyApi.getRequest(emergencyRequestId);
                if (data.responses) setResponses(data.responses.filter(r => r.status === "PENDING"));
                if (data.status === "BOOKED" && data.resulting_booking_id) {
                    setResultingBookingId(data.resulting_booking_id);
                    setStep("done");
                }
                if (data.status === "EXPIRED" || data.status === "CANCELLED") {
                    setEmergencyRequest(null);
                    setResponses([]);
                    setStep("category");
                }
            } catch { /* silent */ }
        }, 10000);
        return () => clearInterval(id);
    }, [step, emergencyRequestId]);

    const configFor = (cat: string) => configs.find(c => c.category === cat);

    const handleCategorySelect = (cat: string) => {
        setForm(f => ({ ...f, category: cat }));
        setStep("details");
    };

    const handleDetailsNext = () => {
        const { society_name, landmark, full_address, contact_name, contact_phone } = form;
        if (!society_name || !landmark || !full_address || !contact_name || !contact_phone) {
            showError("Please fill all required fields.");
            return;
        }
        // Always show provider selection — keep any pre-selected provider from Find Expert
        setProvidersLoading(true);
        setProviders([]);
        emergencyApi.getProviders()
            .then(list => setProviders(list || []))
            .catch(() => setProviders([]))
            .finally(() => setProvidersLoading(false));
        setStep("providers");
    };

    const toggleProvider = (id: string) => {
        setSelectedProviderIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        setSelectedProviderIds(providers.map(p => String(p.id)));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const em = await emergencyApi.create({
                society_name: form.society_name,
                building_name: form.building_name || "",
                flat_no: form.flat_no || "",
                landmark: form.landmark,
                full_address: form.full_address,
                category: form.category,
                description: form.description || undefined,
                device_name: form.device_name || undefined,
                contact_name: form.contact_name,
                contact_phone: form.contact_phone,
                // Send selected providers (UUIDs), or omit = broadcast to all available
                provider_ids: selectedProviderIds.length > 0
                    ? selectedProviderIds
                    : undefined,
            });
            setEmergencyRequest(em);
            setResponses([]);
            setStep("waiting");
            const target = selectedProviderIds.length > 0
                ? `${selectedProviderIds.length} expert(s)`
                : "all available experts";
            success(`SOS broadcast sent to ${target}.`);
        } catch (err) {
            if ((err as Error).message?.includes("already have an active")) {
                try {
                    const existing = await emergencyApi.getActive();
                    setEmergencyRequest(existing);
                    setForm(f => ({ ...f, category: existing.category }));
                    const pendingResponses = (existing.responses || []).filter(r => r.status === "PENDING");
                    setResponses(pendingResponses);
                    setStep("waiting");
                    success("Resumed your active SOS request.");
                } catch {
                    showError("You already have an active emergency. Check your active SOS.");
                }
            } else {
                showError((err as Error).message ||"Failed to create emergency request.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (responseId: string) => {
        if (!emergencyRequest) return;
        setLoading(true);
        try {
            const booking = await emergencyApi.accept(emergencyRequest.id, responseId) as { id?: string };
            setResultingBookingId(booking?.id ?? null);
            setStep("done");
            success("Expert accepted. On the way!");
        } catch (err) {
            showError((err as Error).message ||"Failed to accept response.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!emergencyRequest) { setStep("category"); return; }
        setLoading(true);
        try {
            await emergencyApi.cancel(emergencyRequest.id);
            setEmergencyRequest(null);
            setResponses([]);
            setStep("category");
            success("Emergency request cancelled.");
        } catch (err) {
            showError((err as Error).message ||"Failed to cancel.");
        } finally {
            setLoading(false);
        }
    };

    const field = (key: keyof SOSFormData, label: string, placeholder: string, type: "input" | "textarea" = "input") => (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
            {type === "textarea" ? (
                <textarea
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-semibold text-slate-900 text-sm outline-none focus:border-rose-300 transition-colors resize-none"
                />
            ) : (
                <input
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-semibold text-slate-900 text-sm outline-none focus:border-rose-300 transition-colors"
                />
            )}
        </div>
    );

    const providerName = (p: ProviderBasic) =>
        p.first_name || p.company_name || p.owner_name || `Expert #${String(p.id).slice(0, 8)}`;

    // ── Loading while checking active emergency ───────────────────────────────
    if (checkingActive) {
        return (
            <div className="flex justify-center items-center py-32">
                <Loader2 className="animate-spin text-rose-500" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-24 px-4 pt-6">

            {/* ── Step: Category ─────────────────────────────────────────── */}
            {step === "category" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-4 py-6">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border-2 border-rose-100">
                                <ShieldAlert size={32} />
                            </div>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Emergency SOS</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select emergency category</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {CATEGORIES.map(cat => {
                            const cfg = configFor(cat);
                            return (
                                <button
                                    key={cat}
                                    onClick={() => handleCategorySelect(cat)}
                                    className="group p-5 rounded-3xl border-2 border-slate-100 bg-white text-left hover:border-rose-200 hover:bg-rose-50 transition-all duration-200"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 group-hover:bg-rose-100">
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-xs uppercase tracking-wide leading-tight">{cat}</p>
                                            {cfg && (
                                                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                                    ₹{cfg.hourly_rate}/hr
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Step: Details ──────────────────────────────────────────── */}
            {step === "details" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("category")} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                            <ChevronLeft size={18} />
                        </button>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase">{form.category} — Location & Contact</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fill details before selecting expert</p>
                        </div>
                    </div>

                    {configFor(form.category) && (
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl px-5 py-4 flex items-center justify-between">
                            <span className="text-xs font-black text-rose-700 uppercase tracking-wide">Emergency Rates</span>
                            <span className="text-xs font-bold text-rose-600">
                                ₹{configFor(form.category)!.hourly_rate}/hr
                            </span>
                        </div>
                    )}

                    <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-3">Location</p>
                        {field("society_name", "Society / Home *", "e.g. Green Valley Residency or My Home")}
                        <div className="grid grid-cols-2 gap-3">
                            {field("building_name", "Building (optional)", "Building A")}
                            {field("flat_no", "Flat No (optional)", "402")}
                        </div>
                        {field("landmark", "Landmark *", "Near main gate")}
                        {field("full_address", "Full Address *", "123 Park Street, Mumbai 400001")}
                    </div>

                    <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-3">Issue</p>
                        {field("description", "Description (optional, max 500 chars)", "Describe the emergency clearly…", "textarea")}
                        {field("device_name", "Device / Appliance (optional)", "e.g. Washing Machine, Geyser")}
                    </div>

                    <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-3">Contact On-Site</p>
                        <div className="grid grid-cols-2 gap-3">
                            {field("contact_name", "Name *", "Ramesh Sharma")}
                            {field("contact_phone", "Phone *", "9876543210")}
                        </div>
                    </div>

                    <button
                        onClick={handleDetailsNext}
                        className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        Find Expert <ArrowRight size={18} />
                    </button>
                </div>
            )}

            {/* ── Step: Provider Selection ───────────────────────────────── */}
            {step === "providers" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("details")} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                            <ChevronLeft size={18} />
                        </button>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase">Select Experts</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">All Available Experts · SOS broadcast to selected</p>
                        </div>
                    </div>

                    {providersLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-rose-500" size={28} />
                        </div>
                    ) : providers.length === 0 ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center space-y-4">
                            <Users size={32} className="text-amber-500 mx-auto" />
                            <div>
                                <p className="font-black text-amber-800 text-sm uppercase">No Experts Available Right Now</p>
                                <p className="text-xs text-amber-600 mt-1">No experts are currently available. You can still broadcast to all and wait.</p>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <><ShieldAlert size={16} /> Broadcast to All Anyway</>}
                            </button>
                            <Link href="/user/providers" className="block text-xs font-bold text-rose-600 hover:underline">
                                View all providers →
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-500">
                                    {selectedProviderIds.length > 0
                                        ? `${selectedProviderIds.length} selected`
                                        : "Select experts to notify"}
                                </p>
                                <button
                                    onClick={selectedProviderIds.length === providers.length ? () => setSelectedProviderIds([]) : selectAll}
                                    className="text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700"
                                >
                                    {selectedProviderIds.length === providers.length ? "Deselect All" : "Select All"}
                                </button>
                            </div>

                            <div className="space-y-2">
                                {providers.map(p => {
                                    const id = String(p.id);
                                    const selected = selectedProviderIds.includes(id);
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => toggleProvider(id)}
                                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                                                selected
                                                    ? "border-rose-500 bg-rose-50"
                                                    : "border-slate-100 bg-white hover:border-rose-200"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm">{providerName(p)}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">{p.category}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {p.rating != null && (
                                                        <span className="text-xs font-bold text-amber-600">
                                                            {p.rating > 0 ? `★ ${p.rating.toFixed(1)}` : "★ New"}
                                                        </span>
                                                    )}
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? "border-rose-500 bg-rose-500" : "border-slate-300"}`}>
                                                        {selected && <Check size={12} className="text-white" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <><ShieldAlert size={18} />
                                        {selectedProviderIds.length > 0
                                            ? `Broadcast SOS to ${selectedProviderIds.length} Expert${selectedProviderIds.length > 1 ? "s" : ""}`
                                            : "Broadcast SOS to All Experts"
                                        }
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ── Step: Waiting ──────────────────────────────────────────── */}
            {step === "waiting" && emergencyRequest && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-rose-600 rounded-3xl p-6 text-white space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-xs font-black uppercase tracking-widest">SOS Active</span>
                            </div>
                            <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">{emergencyRequest.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-2xl font-black">
                            <Clock size={20} />
                            {countdown > 0
                                ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")} remaining`
                                : "Response window closed"
                            }
                        </div>
                        <p className="text-xs text-rose-100">Waiting for experts to respond with their arrival time…</p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Expert Responses ({responses.length})
                        </h3>

                        {responses.length === 0 && (
                            <div className="bg-slate-50 rounded-2xl p-8 text-center space-y-2">
                                <Loader2 className="animate-spin text-slate-400 mx-auto" size={24} />
                                <p className="text-xs font-bold text-slate-400 uppercase">Waiting for experts…</p>
                                <p className="text-[10px] text-slate-300">Notified experts are reviewing your request</p>
                            </div>
                        )}

                        {responses.map(r => {
                            const cfg = configFor(emergencyRequest.category);
                            const arrivalDate = new Date(r.arrival_time);
                            // eslint-disable-next-line react-hooks/purity
                            const etaMinutes = Math.round((arrivalDate.getTime() - Date.now()) / 60000);
                            const arrivalLabel = arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            return (
                                <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">
                                                {r.provider?.first_name || r.provider?.company_name || `Expert #${r.provider_id.slice(0, 8)}`}
                                            </p>
                                            {r.provider?.rating != null && (
                                                <span className="text-xs font-bold text-amber-500 mt-0.5 block">
                                                    {r.provider.rating > 0 ? `★ ${r.provider.rating.toFixed(1)}` : "★ New"}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-sm font-black text-emerald-600 justify-end">
                                                <Clock size={14} />
                                                {etaMinutes > 0 ? `~${etaMinutes} min away` : `Arriving at ${arrivalLabel}`}
                                            </div>
                                            {cfg && <div className="text-[10px] text-slate-400 mt-1">₹{cfg.hourly_rate}/hr</div>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAccept(r.id)}
                                        disabled={loading}
                                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={16} /> : <><Check size={14} /> Accept — Expert On the Way</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <><X size={14} /> Cancel SOS</>}
                    </button>
                </div>
            )}

            {/* ── Step: Done ─────────────────────────────────────────────── */}
            {step === "done" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-12">
                    <div className="flex justify-center">
                        <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30">
                            <Check size={48} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-black text-slate-900 uppercase">Expert On the Way</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your emergency expert is heading to your location</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                        {resultingBookingId && (
                            <Link
                                href={`/user/bookings/${resultingBookingId}`}
                                className="px-8 py-4 bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-800 transition-all shadow-lg"
                            >
                                View Booking
                            </Link>
                        )}
                        <Link
                            href="/user/dashboard"
                            className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EmergencySOSContent;

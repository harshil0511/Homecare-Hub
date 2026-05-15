"use client";

import { useEffect, useRef, useState } from "react";
import {
    ArrowRight, Check, ChevronLeft, Clock, Loader2,
    Radio, ShieldAlert, Users, X, Zap,
} from "lucide-react";
import Link from "next/link";
import {
    apiFetch,
    emergencyApi,
    createReconnectingSocket,
    EmergencyConfig,
    EmergencyRequestRead,
    EmergencyResponseRead,
    ProviderBasic,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import AutocompleteInput from "@/components/ui/AutocompleteInput";
import { getMemory, saveFormMemory } from "@/lib/formMemory";

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

    const [flowType, setFlowType] = useState<"direct" | "systematic">("systematic");

    const [providers, setProviders] = useState<ProviderBasic[]>([]);
    const [providersLoading, setProvidersLoading] = useState(false);
    const [broadcastMode, setBroadcastMode] = useState<"all" | "one">("all");
    const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);

    const [emergencyRequest, setEmergencyRequest] = useState<EmergencyRequestRead | null>(null);
    const [responses, setResponses] = useState<EmergencyResponseRead[]>([]);
    const [resultingBookingId, setResultingBookingId] = useState<string | null>(null);

    const wsCleanupRef = useRef<(() => void) | null>(null);
    const countdown = useCountdown(emergencyRequest?.expires_at ?? null);

    // On mount: load configs + check for existing active emergency + prefill user info
    useEffect(() => {
        emergencyApi.getConfigs().then(setConfigs).catch(() => {});

        // Pre-fill each address/contact field with the most recently used value
        const recent = (k: string) => getMemory(k)[0] ?? "";
        setForm(f => ({
            ...f,
            society_name:  recent("society_name")  || f.society_name,
            building_name: recent("building_name") || f.building_name,
            flat_no:       recent("flat_no")       || f.flat_no,
            landmark:      recent("landmark")      || f.landmark,
            full_address:  recent("full_address")  || f.full_address,
            contact_name:  recent("contact_name")  || f.contact_name,
            contact_phone: recent("contact_phone") || f.contact_phone,
        }));

        // Pre-fill contact name from user profile (only if not already restored)
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

        const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
            .replace(/\/$/, "").replace(/\/api\/v1$/, "").replace(/^http/, "ws");

        const cleanup = createReconnectingSocket(
            `${WS_BASE}/ws/emergency/${emergencyRequestId}`,
            (evt) => {
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
            }
        );
        wsCleanupRef.current = cleanup;

        return () => {
            cleanup();
            wsCleanupRef.current = null;
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
                    showError("Your emergency request expired — no expert responded in time.");
                }
            } catch { /* silent */ }
        }, 10000);
        return () => clearInterval(id);
    }, [step, emergencyRequestId]);

    // Auto-expire on the frontend the moment the countdown reaches zero
    useEffect(() => {
        if (step !== "waiting" || countdown !== 0 || !emergencyRequest) return;
        setEmergencyRequest(null);
        setResponses([]);
        setStep("category");
        showError("Your emergency request expired — no expert responded within 30 minutes.");
    }, [countdown, step, emergencyRequest]);

    const configFor = (cat: string) => configs.find(c => c.category === cat);

    const handleCategorySelect = (cat: string) => {
        setForm(f => ({ ...f, category: cat }));
        setStep("details");
    };

    const validateForm = (): string | null => {
        const { society_name, landmark, full_address, contact_name, contact_phone } = form;
        if (!society_name.trim() || !landmark.trim() || !full_address.trim() || !contact_name.trim() || !contact_phone.trim())
            return "Please fill all required fields.";
        if (full_address.trim().length < 5)
            return "Full address must be at least 5 characters.";
        if (!/^[a-zA-Z\s\-\.]{2,100}$/.test(contact_name.trim()))
            return "Contact name must contain only letters (min 2 characters).";
        if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(contact_phone.trim()))
            return "Enter a valid 10-digit mobile number (e.g. 9876543210).";
        return null;
    };

    const handleDetailsNext = () => {
        const formError = validateForm();
        if (formError) { showError(formError); return; }
        // Persist address/contact fields so they appear as suggestions next time
        saveFormMemory({
            society_name: form.society_name,
            building_name: form.building_name,
            flat_no: form.flat_no,
            landmark: form.landmark,
            full_address: form.full_address,
            contact_name: form.contact_name,
            contact_phone: form.contact_phone,
        });
        // Reset selection state, then load providers
        setBroadcastMode("all");
        setSelectedProviderIds([]);
        setProvidersLoading(true);
        setProviders([]);
        emergencyApi.getProviders()
            .then(list => setProviders(list || []))
            .catch(() => setProviders([]))
            .finally(() => setProvidersLoading(false));
        setStep("providers");
    };

    const selectOneProvider = (id: string) => {
        setSelectedProviderIds([id]);
    };

    const handleSubmit = async () => {
        if (broadcastMode === "one" && selectedProviderIds.length === 0) {
            showError("Please select an expert to send the SOS to.");
            return;
        }
        const formError = validateForm();
        if (formError) { showError(formError); return; }
        setLoading(true);
        try {
            const providerIds = broadcastMode === "one" && selectedProviderIds.length > 0
                ? selectedProviderIds
                : undefined;

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
                flow_type: flowType,
                provider_ids: providerIds,
            });
            setEmergencyRequest(em);
            setResponses([]);
            setStep("waiting");
            const target = providerIds ? "the selected expert" : "all available experts";
            success(`SOS sent to ${target}.`);
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
                showError((err as Error).message || "Failed to create emergency request.");
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
            showError((err as Error).message || "Failed to accept response.");
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
            showError((err as Error).message || "Failed to cancel.");
        } finally {
            setLoading(false);
        }
    };

    const AUTOCOMPLETE_KEYS: Array<keyof SOSFormData> = [
        "society_name", "building_name", "flat_no", "landmark",
        "full_address", "contact_name", "contact_phone",
    ];

    const inputClass = "w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-semibold text-slate-900 text-xs outline-none focus:border-rose-300 transition-colors";

    const field = (key: keyof SOSFormData, label: string, placeholder: string, type: "input" | "textarea" = "input") => (
        <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</label>
            {type === "textarea" ? (
                <textarea
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    rows={3}
                    className={`${inputClass} resize-none`}
                />
            ) : AUTOCOMPLETE_KEYS.includes(key) ? (
                <AutocompleteInput
                    memoryKey={key}
                    value={form[key]}
                    onChange={val => setForm(f => ({ ...f, [key]: val }))}
                    placeholder={placeholder}
                    className={inputClass}
                />
            ) : (
                <input
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputClass}
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
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-3 py-4">
                        <div className="flex justify-center">
                            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border-2 border-rose-100">
                                <ShieldAlert size={26} />
                            </div>
                        </div>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Emergency SOS</h1>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Select emergency category</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        {CATEGORIES.map(cat => {
                            const cfg = configFor(cat);
                            return (
                                <button
                                    key={cat}
                                    onClick={() => handleCategorySelect(cat)}
                                    className="group p-4 rounded-2xl border-2 border-slate-100 bg-white text-left hover:border-rose-200 hover:bg-rose-50 transition-all duration-200"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 group-hover:bg-rose-100">
                                            <Zap size={15} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-[11px] uppercase tracking-wide leading-tight">{cat}</p>
                                            {cfg && (
                                                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
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
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("category")} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                            <ChevronLeft size={16} />
                        </button>
                        <div>
                            <h2 className="text-base font-black text-slate-900 uppercase">{form.category} — Location & Contact</h2>
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Fill details before selecting expert</p>
                        </div>
                    </div>

                    {configFor(form.category) && (
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 flex items-center justify-between">
                            <span className="text-[11px] font-black text-rose-700 uppercase tracking-wide">Emergency Rates</span>
                            <span className="text-[11px] font-bold text-rose-600">
                                ₹{configFor(form.category)!.hourly_rate}/hr
                            </span>
                        </div>
                    )}

                    <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100 pb-2.5">Location</p>
                        {field("society_name", "Society / Home *", "e.g. Green Valley Residency or My Home")}
                        <div className="grid grid-cols-2 gap-3">
                            {field("building_name", "Building (optional)", "Building A")}
                            {field("flat_no", "Flat No (optional)", "402")}
                        </div>
                        {field("landmark", "Landmark *", "Near main gate")}
                        {field("full_address", "Full Address *", "123 Park Street, Mumbai 400001")}
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100 pb-2.5">Issue</p>
                        {field("description", "Description (optional, max 500 chars)", "Describe the emergency clearly…", "textarea")}
                        {field("device_name", "Device / Appliance (optional)", "e.g. Washing Machine, Geyser")}
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100 pb-2.5">Contact On-Site</p>
                        <div className="grid grid-cols-2 gap-3">
                            {field("contact_name", "Name *", "Ramesh Sharma")}
                            {field("contact_phone", "Phone *", "9876543210")}
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-100 pb-2.5">Payment Method</p>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={`flex flex-col gap-1 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                flowType === "systematic"
                                    ? "border-rose-400 bg-rose-50"
                                    : "border-slate-200 hover:border-slate-300"
                            }`}>
                                <input
                                    type="radio"
                                    name="sos_flow_type"
                                    value="systematic"
                                    checked={flowType === "systematic"}
                                    onChange={() => setFlowType("systematic")}
                                    className="sr-only"
                                />
                                <span className="text-[11px] font-black text-slate-900">Systematic</span>
                                <span className="text-[10px] text-slate-600 leading-tight">Payment tracked in app. Hours recorded after job.</span>
                            </label>
                            <label className={`flex flex-col gap-1 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                flowType === "direct"
                                    ? "border-rose-400 bg-rose-50"
                                    : "border-slate-200 hover:border-slate-300"
                            }`}>
                                <input
                                    type="radio"
                                    name="sos_flow_type"
                                    value="direct"
                                    checked={flowType === "direct"}
                                    onChange={() => setFlowType("direct")}
                                    className="sr-only"
                                />
                                <span className="text-[11px] font-black text-slate-900">Direct</span>
                                <span className="text-[10px] text-slate-600 leading-tight">Pay the expert in person. No app payment needed.</span>
                            </label>
                        </div>
                    </div>

                    <button
                        onClick={handleDetailsNext}
                        className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        Find Expert <ArrowRight size={16} />
                    </button>
                </div>
            )}

            {/* ── Step: Provider Selection ───────────────────────────────── */}
            {step === "providers" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("details")} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                            <ChevronLeft size={16} />
                        </button>
                        <div>
                            <h2 className="text-base font-black text-slate-900 uppercase">Send SOS To</h2>
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Choose who receives your emergency request</p>
                        </div>
                    </div>

                    {/* Mode toggle */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => { setBroadcastMode("all"); setSelectedProviderIds([]); }}
                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                                broadcastMode === "all"
                                    ? "border-rose-500 bg-rose-50"
                                    : "border-slate-200 bg-white hover:border-rose-200"
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    broadcastMode === "all" ? "border-rose-500 bg-rose-500" : "border-slate-300"
                                }`}>
                                    {broadcastMode === "all" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <Users size={13} className={broadcastMode === "all" ? "text-rose-600" : "text-slate-500"} />
                            </div>
                            <p className="font-black text-slate-900 text-[11px] uppercase tracking-wide">All Experts</p>
                            <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">Broadcast to every available expert. Fastest response.</p>
                        </button>

                        <button
                            onClick={() => setBroadcastMode("one")}
                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                                broadcastMode === "one"
                                    ? "border-rose-500 bg-rose-50"
                                    : "border-slate-200 bg-white hover:border-rose-200"
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    broadcastMode === "one" ? "border-rose-500 bg-rose-500" : "border-slate-300"
                                }`}>
                                    {broadcastMode === "one" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <Radio size={13} className={broadcastMode === "one" ? "text-rose-600" : "text-slate-500"} />
                            </div>
                            <p className="font-black text-slate-900 text-[11px] uppercase tracking-wide">Specific Expert</p>
                            <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">Pick one trusted expert. Only they will see this SOS.</p>
                        </button>
                    </div>

                    {/* Send to All — direct submit */}
                    {broadcastMode === "all" && (
                        <div className="space-y-4">
                            <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
                                <p className="text-[11px] font-bold text-rose-700 flex items-center gap-2">
                                    <ShieldAlert size={13} />
                                    SOS will be sent to all experts currently available
                                </p>
                                <p className="text-[10px] text-rose-600 mt-1">All online experts will receive an alert and can respond with their arrival time.</p>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {loading
                                    ? <Loader2 className="animate-spin" size={18} />
                                    : <><ShieldAlert size={16} /> Broadcast SOS to All Experts</>
                                }
                            </button>
                        </div>
                    )}

                    {/* Select One Expert */}
                    {broadcastMode === "one" && (
                        <div className="space-y-3">
                            {providersLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin text-rose-500" size={24} />
                                </div>
                            ) : providers.length === 0 ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
                                    <Users size={24} className="text-amber-500 mx-auto" />
                                    <p className="font-black text-amber-800 text-xs uppercase">No Experts Available</p>
                                    <p className="text-[10px] text-amber-700">No experts are currently available. Switch to &quot;All Experts&quot; mode to broadcast.</p>
                                    <Link href="/user/providers" className="block text-[11px] font-bold text-rose-600 hover:underline">
                                        View all providers →
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                        {selectedProviderIds.length > 0
                                            ? "1 expert selected — only they will receive your SOS"
                                            : "Select one expert below"}
                                    </p>

                                    <div className="space-y-2">
                                        {providers.map(p => {
                                            const id = String(p.id);
                                            const selected = selectedProviderIds[0] === id;
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => selectOneProvider(id)}
                                                    className={`w-full p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                                                        selected
                                                            ? "border-rose-500 bg-rose-50"
                                                            : "border-slate-100 bg-white hover:border-rose-200"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                                            selected ? "border-rose-500 bg-rose-500" : "border-slate-300"
                                                        }`}>
                                                            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-slate-900 text-[11px] truncate">{providerName(p)}</p>
                                                            <p className="text-[10px] text-slate-600 font-semibold uppercase mt-0.5">{p.category}</p>
                                                        </div>
                                                        {p.rating != null && (
                                                            <span className="text-[11px] font-bold text-amber-600 flex-shrink-0">
                                                                {p.rating > 0 ? `★ ${p.rating.toFixed(1)}` : "★ New"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading || selectedProviderIds.length === 0}
                                        className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={18} /> : (
                                            <><ShieldAlert size={16} />
                                                {selectedProviderIds.length > 0
                                                    ? `Send SOS to ${providerName(providers.find(p => String(p.id) === selectedProviderIds[0])!) || "Expert"}`
                                                    : "Select an Expert First"
                                                }
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Step: Waiting ──────────────────────────────────────────── */}
            {step === "waiting" && emergencyRequest && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-rose-600 rounded-2xl p-5 text-white space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-widest">SOS Active</span>
                            </div>
                            <span className="text-[11px] font-bold bg-white/20 px-2.5 py-1 rounded-full">{emergencyRequest.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xl font-black">
                            <Clock size={18} />
                            {countdown > 0
                                ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")} remaining`
                                : "Response window closed"
                            }
                        </div>
                        <p className="text-[11px] text-rose-200">Waiting for experts to respond with their arrival time…</p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                            Expert Responses ({responses.length})
                        </h3>

                        {responses.length === 0 && (
                            <div className="bg-slate-50 rounded-2xl p-6 text-center space-y-2">
                                <Loader2 className="animate-spin text-slate-400 mx-auto" size={22} />
                                <p className="text-[11px] font-bold text-slate-600 uppercase">Waiting for experts…</p>
                                <p className="text-[10px] text-slate-500">Notified experts are reviewing your request</p>
                            </div>
                        )}

                        {responses.map(r => {
                            const cfg = configFor(emergencyRequest.category);
                            const arrivalDate = new Date(r.arrival_time);
                            // eslint-disable-next-line react-hooks/purity
                            const etaMinutes = Math.round((arrivalDate.getTime() - Date.now()) / 60000);
                            const arrivalLabel = arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            return (
                                <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-black text-slate-900 text-[11px]">
                                                {r.provider?.first_name || r.provider?.company_name || `Expert #${r.provider_id.slice(0, 8)}`}
                                            </p>
                                            {r.provider?.rating != null && (
                                                <span className="text-[11px] font-bold text-amber-500 mt-0.5 block">
                                                    {r.provider.rating > 0 ? `★ ${r.provider.rating.toFixed(1)}` : "★ New"}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600 justify-end">
                                                <Clock size={12} />
                                                {etaMinutes > 0 ? `~${etaMinutes} min away` : `Arriving at ${arrivalLabel}`}
                                            </div>
                                            {cfg && <div className="text-[10px] text-slate-500 mt-1">₹{cfg.hourly_rate}/hr</div>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAccept(r.id)}
                                        disabled={loading}
                                        className="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={14} /> : <><Check size={13} /> Accept — Expert On the Way</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <><X size={13} /> Cancel SOS</>}
                    </button>
                </div>
            )}

            {/* ── Step: Done ─────────────────────────────────────────────── */}
            {step === "done" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-10">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30">
                            <Check size={40} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <h1 className="text-xl font-black text-slate-900 uppercase">Expert On the Way</h1>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Your emergency expert is heading to your location</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                        {resultingBookingId && (
                            <Link
                                href={`/user/bookings/${resultingBookingId}`}
                                className="px-7 py-3.5 bg-emerald-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-800 transition-all shadow-lg"
                            >
                                View Booking
                            </Link>
                        )}
                        <Link
                            href="/user/dashboard"
                            className="px-7 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all"
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

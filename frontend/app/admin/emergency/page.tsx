"use client";

import { useEffect, useState } from "react";
import {
    ShieldAlert, AlertTriangle, Star,
    ChevronDown, ChevronUp, Check, Loader2, Edit3,
} from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import {
    adminEmergencyApi,
    EmergencyConfig,
    EmergencyPenaltyConfig,
    EmergencyRequestRead,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";

type AdminTab = "pricing" | "penalties" | "requests" | "star";

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    BOOKED: "bg-blue-100 text-blue-700",
    EXPIRED: "bg-slate-100 text-slate-500",
    CANCELLED: "bg-rose-100 text-rose-700",
    ACTIVE: "bg-emerald-100 text-emerald-700",
};

export default function AdminEmergencyPage() {
    const { success, error: showError } = useToast();
    const [activeTab, setActiveTab] = useState<AdminTab>("pricing");

    // ── Pricing Config state ───────────────────────────────────────────────────
    const [configs, setConfigs] = useState<EmergencyConfig[]>([]);
    const [configsLoading, setConfigsLoading] = useState(false);
    const [editingConfig, setEditingConfig] = useState<EmergencyConfig | null>(null);
    const [editCallout, setEditCallout] = useState("");
    const [editHourly, setEditHourly] = useState("");
    const [savingConfig, setSavingConfig] = useState(false);

    // New config form
    const [newCategory, setNewCategory] = useState("");
    const [newCallout, setNewCallout] = useState("");
    const [newHourly, setNewHourly] = useState("");
    const [creatingConfig, setCreatingConfig] = useState(false);

    // ── Penalty Config state ───────────────────────────────────────────────────
    const [penalties, setPenalties] = useState<EmergencyPenaltyConfig[]>([]);
    const [penaltiesLoading, setPenaltiesLoading] = useState(false);
    const [editingPenalty, setEditingPenalty] = useState<string | null>(null);
    const [editDeduction, setEditDeduction] = useState("");
    const [savingPenalty, setSavingPenalty] = useState(false);

    // ── Requests state ─────────────────────────────────────────────────────────
    const [requests, setRequests] = useState<EmergencyRequestRead[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState("");
    const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

    // ── Star adjust state ──────────────────────────────────────────────────────
    const [starProviderId, setStarProviderId] = useState("");
    const [starDelta, setStarDelta] = useState("");
    const [starReason, setStarReason] = useState("");
    const [submittingStar, setSubmittingStar] = useState(false);

    // ── Data loaders ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeTab === "pricing") {
            setConfigsLoading(true);
            adminEmergencyApi.getConfigs()
                .then(setConfigs)
                .catch(() => showError("Failed to load pricing configs."))
                .finally(() => setConfigsLoading(false));
        }
    }, [activeTab, showError]);

    useEffect(() => {
        if (activeTab === "penalties") {
            setPenaltiesLoading(true);
            adminEmergencyApi.getPenalties()
                .then(setPenalties)
                .catch(() => showError("Failed to load penalty configs."))
                .finally(() => setPenaltiesLoading(false));
        }
    }, [activeTab, showError]);

    useEffect(() => {
        if (activeTab === "requests") {
            setRequestsLoading(true);
            adminEmergencyApi.getRequests(statusFilter || undefined)
                .then(setRequests)
                .catch(() => showError("Failed to load emergency requests."))
                .finally(() => setRequestsLoading(false));
        }
    }, [activeTab, statusFilter, showError]);

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleSaveConfig = async () => {
        if (!editingConfig) return;
        setSavingConfig(true);
        try {
            const updated = await adminEmergencyApi.updateConfig(editingConfig.id, {
                callout_fee: parseFloat(editCallout),
                hourly_rate: parseFloat(editHourly),
            });
            setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
            setEditingConfig(null);
            success("Pricing updated.");
        } catch (err) {
            showError((err as Error).message ||"Failed to update config.");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleCreateConfig = async () => {
        if (!newCategory || !newCallout || !newHourly) return;
        setCreatingConfig(true);
        try {
            const created = await adminEmergencyApi.createConfig({
                category: newCategory,
                callout_fee: parseFloat(newCallout),
                hourly_rate: parseFloat(newHourly),
            });
            setConfigs(prev => [...prev, created]);
            setNewCategory(""); setNewCallout(""); setNewHourly("");
            success("Config created.");
        } catch (err) {
            showError((err as Error).message ||"Failed to create config.");
        } finally {
            setCreatingConfig(false);
        }
    };

    const handleSavePenalty = async () => {
        if (!editingPenalty) return;
        setSavingPenalty(true);
        try {
            const updated = await adminEmergencyApi.updatePenalty(editingPenalty, parseFloat(editDeduction));
            setPenalties(prev => prev.map(p => p.event_type === updated.event_type ? updated : p));
            setEditingPenalty(null);
            success("Penalty rate updated.");
        } catch (err) {
            showError((err as Error).message ||"Failed to update penalty.");
        } finally {
            setSavingPenalty(false);
        }
    };

    const handleStarAdjust = async () => {
        const pid = starProviderId.trim();
        const delta = parseFloat(starDelta);
        if (!pid || isNaN(delta) || !starReason.trim()) {
            showError("Fill provider ID, delta, and reason.");
            return;
        }
        setSubmittingStar(true);
        try {
            await adminEmergencyApi.starAdjust(pid, { delta, reason: starReason });
            setStarProviderId(""); setStarDelta(""); setStarReason("");
            success(`Star rating adjusted by ${delta > 0 ? "+" : ""}${delta} for provider ${pid}.`);
        } catch (err) {
            showError((err as Error).message ||"Failed to adjust stars.");
        } finally {
            setSubmittingStar(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    const tabs: { key: AdminTab; label: string }[] = [
        { key: "pricing", label: "Pricing Config" },
        { key: "penalties", label: "Penalty Rates" },
        { key: "requests", label: "All Requests" },
        { key: "star", label: "Star Adjust" },
    ];

    return (
        <div className="space-y-8 pb-16">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                    <ShieldAlert size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Emergency SOS Management</h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        Pricing · Penalties · Requests · Star Ratings
                    </p>
                </div>
            </div>

            {/* Tab strip */}
            <div className="flex border-b border-slate-200 gap-1">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
                            activeTab === t.key
                                ? "border-rose-500 text-rose-600"
                                : "border-transparent text-slate-400 hover:text-slate-700"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Pricing Config ─────────────────────────────────────────────────── */}
            {activeTab === "pricing" && (
                <div className="space-y-6">
                    {configsLoading ? (
                        <div className="flex justify-center py-12"><Spinner /></div>
                    ) : (
                        <div className="space-y-3">
                            {configs.map(cfg => (
                                <div key={cfg.id} className="bg-white border border-slate-100 rounded-2xl p-5">
                                    {editingConfig?.id === cfg.id ? (
                                        <div className="space-y-4">
                                            <p className="font-black text-slate-900 text-sm uppercase">{cfg.category}</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Callout Fee (₹)</label>
                                                    <input type="number" min="0" value={editCallout} onChange={e => setEditCallout(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-400" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hourly Rate (₹)</label>
                                                    <input type="number" min="0" value={editHourly} onChange={e => setEditHourly(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-400" />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleSaveConfig} disabled={savingConfig} className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2">
                                                    {savingConfig ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Save
                                                </button>
                                                <button onClick={() => setEditingConfig(null)} className="px-5 py-2 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-50">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-black text-slate-900 text-sm uppercase">{cfg.category}</p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Callout <span className="font-bold text-slate-700">₹{cfg.callout_fee}</span>
                                                    {" · "}
                                                    Hourly <span className="font-bold text-slate-700">₹{cfg.hourly_rate}/hr</span>
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => { setEditingConfig(cfg); setEditCallout(String(cfg.callout_fee)); setEditHourly(String(cfg.hourly_rate)); }}
                                                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add new config */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Add New Category</p>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                                <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Electrical" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-400 bg-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Callout (₹)</label>
                                <input type="number" min="0" value={newCallout} onChange={e => setNewCallout(e.target.value)} placeholder="500" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-400 bg-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hourly (₹)</label>
                                <input type="number" min="0" value={newHourly} onChange={e => setNewHourly(e.target.value)} placeholder="200" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-400 bg-white" />
                            </div>
                        </div>
                        <button onClick={handleCreateConfig} disabled={creatingConfig || !newCategory || !newCallout || !newHourly} className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2">
                            {creatingConfig ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Create Config
                        </button>
                    </div>
                </div>
            )}

            {/* ── Penalty Rates ──────────────────────────────────────────────────── */}
            {activeTab === "penalties" && (
                <div className="space-y-3">
                    {penaltiesLoading ? (
                        <div className="flex justify-center py-12"><Spinner /></div>
                    ) : penalties.length === 0 ? (
                        <p className="text-center text-slate-400 py-12 text-sm">No penalty configs found. They are seeded on server startup.</p>
                    ) : penalties.map(p => (
                        <div key={p.event_type} className="bg-white border border-slate-100 rounded-2xl p-5">
                            {editingPenalty === p.event_type ? (
                                <div className="space-y-4">
                                    <p className="font-black text-slate-900 text-sm uppercase">{p.event_type.replace(/_/g, " ")}</p>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Star Deduction</label>
                                        <input type="number" min="0" max="5" step="0.1" value={editDeduction} onChange={e => setEditDeduction(e.target.value)} className="w-40 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-400" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleSavePenalty} disabled={savingPenalty} className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2">
                                            {savingPenalty ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Save
                                        </button>
                                        <button onClick={() => setEditingPenalty(null)} className="px-5 py-2 border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-50">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-slate-900 text-sm">{p.event_type.replace(/_/g, " ")}</p>
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                            <Star size={12} className="text-amber-400" fill="currentColor" />
                                            -{p.star_deduction} stars per event
                                        </p>
                                    </div>
                                    <button onClick={() => { setEditingPenalty(p.event_type); setEditDeduction(String(p.star_deduction)); }} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                                        <Edit3 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── All Requests ───────────────────────────────────────────────────── */}
            {activeTab === "requests" && (
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by status:</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-rose-400 bg-white">
                            <option value="">All</option>
                            {["PENDING", "BOOKED", "CANCELLED", "EXPIRED", "ACTIVE"].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {requestsLoading ? (
                        <div className="flex justify-center py-12"><Spinner /></div>
                    ) : requests.length === 0 ? (
                        <EmptyState icon={ShieldAlert} title="No emergency requests" />
                    ) : (
                        <div className="space-y-3">
                            {requests.map(req => {
                                const expanded = expandedRequest === req.id;
                                const statusClass = STATUS_COLORS[req.status] ?? "bg-slate-100 text-slate-500";
                                return (
                                    <div key={req.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                                        <button
                                            onClick={() => setExpandedRequest(expanded ? null : req.id)}
                                            className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase ${statusClass}`}>{req.status}</span>
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm">{req.category} — {req.building_name}, {req.flat_no}</p>
                                                    <p className="text-xs text-slate-400">{req.created_at ? new Date(req.created_at).toLocaleString() : ""}</p>
                                                </div>
                                            </div>
                                            {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                        </button>

                                        {expanded && (
                                            <div className="px-5 pb-5 border-t border-slate-50 pt-4 grid grid-cols-2 gap-4 text-xs text-slate-600">
                                                <div><span className="font-black text-slate-400 uppercase text-[10px] block">Society</span>{req.society_name}</div>
                                                <div><span className="font-black text-slate-400 uppercase text-[10px] block">Contact</span>{req.contact_name} · {req.contact_phone}</div>
                                                <div className="col-span-2"><span className="font-black text-slate-400 uppercase text-[10px] block">Description</span>{req.description}</div>
                                                <div><span className="font-black text-slate-400 uppercase text-[10px] block">Expires</span>{new Date(req.expires_at).toLocaleTimeString()}</div>
                                                <div><span className="font-black text-slate-400 uppercase text-[10px] block">Responses</span>{req.responses?.length ?? 0}</div>
                                                {req.resulting_booking_id && (
                                                    <div><span className="font-black text-slate-400 uppercase text-[10px] block">Booking ID</span>BK-{req.resulting_booking_id}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Star Adjustment ────────────────────────────────────────────────── */}
            {activeTab === "star" && (
                <div className="space-y-6 max-w-lg">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-700 text-xs">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <p>Star adjustments are permanent and logged. Use this for penalty corrections or rewards. Delta is clamped to the provider&apos;s [0.0, 5.0] range.</p>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Provider UUID *</label>
                            <input type="text" value={starProviderId} onChange={e => setStarProviderId(e.target.value)} placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-400 font-mono" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Delta (±5.0) *</label>
                            <input type="number" min="-5" max="5" step="0.1" value={starDelta} onChange={e => setStarDelta(e.target.value)} placeholder="e.g. -1.0 or +0.5" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-400" />
                            <p className="text-[10px] text-slate-400 mt-1">Negative = deduct, positive = reward</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason *</label>
                            <textarea value={starReason} onChange={e => setStarReason(e.target.value)} placeholder="e.g. No-show on emergency request #42" rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-400 resize-none" />
                        </div>
                        <button
                            onClick={handleStarAdjust}
                            disabled={submittingStar}
                            className="w-full py-3.5 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                        >
                            {submittingStar ? <Loader2 className="animate-spin" size={16} /> : <Star size={16} />}
                            Apply Star Adjustment
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

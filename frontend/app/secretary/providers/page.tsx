"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Wrench, Star, Phone, CheckSquare, Square, Send, Users, X, ShieldCheck } from "lucide-react";

interface Provider {
    id: string;
    company_name: string;
    category: string;
    categories?: string[];
    rating: number;
    availability_status: string;
    phone: string;
    is_verified?: boolean;
}

const AVAIL_STYLE: Record<string, string> = {
    AVAILABLE: "text-emerald-700 bg-emerald-50",
    WORKING: "text-blue-700 bg-blue-50",
    VACATION: "text-slate-500 bg-slate-100",
};

const CATEGORIES = ["All", "Plumbing", "Electrical", "Cleaning", "Mechanical", "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair"];

export default function SecretaryProvidersPage() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);

    const [categoryFilter, setCategoryFilter] = useState("All");
    const [availFilter, setAvailFilter] = useState("All");
    const [ratingFilter, setRatingFilter] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBehalfModal, setShowBehalfModal] = useState(false);
    const [submittingBehalf, setSubmittingBehalf] = useState(false);
    const [memberName, setMemberName] = useState("");
    const [memberUnit, setMemberUnit] = useState("");
    const [memberMobile, setMemberMobile] = useState("");
    const [behalfProblem, setBehalfProblem] = useState("");
    const [behalfDesc, setBehalfDesc] = useState("");
    const [behalfUrgency, setBehalfUrgency] = useState<"Normal" | "High" | "Emergency">("Normal");

    useEffect(() => {
        apiFetch("/secretary/providers")
            .then((d) => setProviders(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filteredProviders = (providers || []).filter((p: Provider) => {
        const catMatch = categoryFilter === "All" || (p.categories || []).includes(categoryFilter) || p.category === categoryFilter;
        const availMatch = availFilter === "All" || p.availability_status === availFilter;
        const ratingMatch = !ratingFilter || (p.rating || 0) >= ratingFilter;
        return catMatch && availMatch && ratingMatch;
    });

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBehalfSubmit = async () => {
        if (!memberName || !memberMobile || !behalfProblem) return;
        setSubmittingBehalf(true);
        try {
            await apiFetch("/requests", {
                method: "POST",
                body: JSON.stringify({
                    provider_ids: Array.from(selectedIds),
                    contact_name: memberName,
                    contact_mobile: memberMobile,
                    location: memberUnit,
                    device_or_issue: behalfProblem,
                    description: behalfDesc,
                    urgency: behalfUrgency,
                }),
            });
            setShowBehalfModal(false);
            setSelectedIds(new Set());
            setMemberName(""); setMemberUnit(""); setMemberMobile("");
            setBehalfProblem(""); setBehalfDesc(""); setBehalfUrgency("Normal");
        } catch (err) {
            console.error("Failed to submit behalf request:", err);
        } finally {
            setSubmittingBehalf(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trusted Providers</h1>
                <p className="text-slate-500 text-sm mt-1">Service providers trusted by your society.</p>
            </div>

            {/* Filters */}
            <div className="mb-6 space-y-3">
                {/* Category pills */}
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                categoryFilter === cat
                                    ? "bg-[#064e3b] text-white"
                                    : "bg-white border border-slate-200 text-slate-500 hover:border-[#064e3b] hover:text-[#064e3b]"
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                {/* Availability + Rating */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex gap-2">
                        {["All", "AVAILABLE", "WORKING", "VACATION"].map(s => (
                            <button
                                key={s}
                                onClick={() => setAvailFilter(s)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                    availFilter === s
                                        ? "bg-[#064e3b] text-white"
                                        : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                                }`}
                            >
                                {s === "All" ? "All Status" : s}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400" />
                        <select
                            value={ratingFilter}
                            onChange={e => setRatingFilter(Number(e.target.value))}
                            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 bg-white outline-none focus:border-[#064e3b]"
                        >
                            <option value={0}>Any Rating</option>
                            <option value={3}>3+ Stars</option>
                            <option value={5}>5+ Stars</option>
                            <option value={8}>8+ Stars</option>
                            <option value={10}>10 Stars (Auto-Verified)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                    <div className="col-span-3 flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : filteredProviders.length === 0 ? (
                    <div className="col-span-3 text-center py-16 text-slate-400">
                        <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No trusted providers yet</p>
                    </div>
                ) : filteredProviders.map((p) => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all">
                        <button
                            onClick={() => toggleSelect(p.id)}
                            className="p-1 rounded-lg hover:bg-slate-100 transition-colors mb-2"
                        >
                            {selectedIds.has(p.id)
                                ? <CheckSquare className="w-5 h-5 text-[#064e3b]" />
                                : <Square className="w-5 h-5 text-slate-400" />}
                        </button>
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <Wrench className="w-5 h-5 text-emerald-700" />
                            </div>
                            <span className={`text-xs font-black px-2 py-1 rounded-full uppercase ${AVAIL_STYLE[p.availability_status] ?? "text-slate-500 bg-slate-100"}`}>
                                {p.availability_status}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-black text-slate-900">{p.company_name}</p>
                            {p.is_verified && (
                                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <ShieldCheck size={10} /> Verified
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{p.category}</p>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span className="font-black text-amber-500">
                                {(p.rating || 0) > 0 ? `★ ${p.rating.toFixed(1)}` : "★ 0.0"}
                            </span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone || "—"}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating selection bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#064e3b] text-white rounded-2xl px-8 py-4 shadow-2xl">
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-bold">{selectedIds.size} provider{selectedIds.size !== 1 ? "s" : ""} selected</span>
                    <button
                        onClick={() => setShowBehalfModal(true)}
                        className="flex items-center gap-2 px-5 py-2 bg-white text-[#064e3b] text-xs font-black uppercase rounded-xl hover:bg-emerald-50 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                        Send Request on Behalf
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-2 hover:bg-white/20 rounded-lg">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Behalf Modal */}
            {showBehalfModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Request on Behalf</h2>
                                    <p className="text-xs text-slate-500 mt-1">Sending to {selectedIds.size} provider{selectedIds.size !== 1 ? "s" : ""}</p>
                                </div>
                                <button onClick={() => setShowBehalfModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Member Information</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Member Name *" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                        <input value={memberMobile} onChange={e => setMemberMobile(e.target.value)} placeholder="Mobile Number *" type="tel" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    </div>
                                    <input value={memberUnit} onChange={e => setMemberUnit(e.target.value)} placeholder="Unit/Flat Number or Address" className="mt-3 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Problem Details</p>
                                    <select value={behalfProblem} onChange={e => setBehalfProblem(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white mb-3">
                                        <option value="">Select Problem Type *</option>
                                        {["Plumbing", "Electrical", "Cleaning", "Mechanical", "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair", "Other"].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <textarea value={behalfDesc} onChange={e => setBehalfDesc(e.target.value)} placeholder="Describe the issue..." rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                                </div>

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Urgency</p>
                                    <div className="flex gap-3">
                                        {(["Normal", "High", "Emergency"] as const).map(u => (
                                            <button
                                                key={u}
                                                onClick={() => setBehalfUrgency(u)}
                                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-colors ${
                                                    behalfUrgency === u
                                                        ? u === "Emergency" ? "bg-rose-600 text-white"
                                                            : u === "High" ? "bg-amber-500 text-white"
                                                            : "bg-[#064e3b] text-white"
                                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                }`}
                                            >
                                                {u === "High" ? "Urgent" : u}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowBehalfModal(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBehalfSubmit}
                                    disabled={submittingBehalf || !memberName || !memberMobile || !behalfProblem}
                                    className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submittingBehalf ? "Sending..." : <><Send className="w-4 h-4" /> Send Request</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

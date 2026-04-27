"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Briefcase, Clock, Send, X } from "lucide-react";

interface ProviderSummary {
    id: string;
    company_name: string;
    category: string;
    rating: number;
    availability_status: string;
}

interface SocietyDispatch {
    id: string;
    service_type: string;
    scheduled_at: string;
    job_price: number;
    notes?: string;
    status: string;
}

interface SocietyContract {
    id: string;
    duration_months: number;
    counter_duration_months?: number;
    monthly_rate: number;
    start_date?: string;
    end_date?: string;
    status: string;
    secretary_notes?: string;
    servicer_notes?: string;
    created_at: string;
    provider?: ProviderSummary;
    dispatches: SocietyDispatch[];
}

interface Member {
    id: string;
    username: string;
    home_number?: string;
}

type Tab = "active" | "pending";

const STATUS_STYLE: Record<string, string> = {
    ACTIVE: "text-emerald-700 bg-emerald-50",
    PENDING: "text-amber-700 bg-amber-50",
    COUNTER_PROPOSED: "text-blue-700 bg-blue-50",
    CANCELLED: "text-slate-500 bg-slate-100",
    EXPIRED: "text-rose-700 bg-rose-50",
    REJECTED: "text-rose-600 bg-rose-50",
};

const DISPATCH_STYLE: Record<string, string> = {
    ASSIGNED: "text-amber-700 bg-amber-50",
    IN_PROGRESS: "text-blue-700 bg-blue-50",
    COMPLETED: "text-emerald-700 bg-emerald-50",
};

const SERVICE_TYPES = [
    "Plumbing", "Electrical", "Cleaning", "Carpentry",
    "Painting", "Pest Control", "Appliance Repair", "General Maintenance", "Other",
];

export default function SecretaryContractsPage() {
    const [contracts, setContracts] = useState<SocietyContract[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>("active");
    const [actionId, setActionId] = useState<string | null>(null);

    // Dispatch modal
    const [showDispatch, setShowDispatch] = useState(false);
    const [dispatchContractId, setDispatchContractId] = useState("");
    const [dMemberId, setDMemberId] = useState("");
    const [dServiceType, setDServiceType] = useState("");
    const [dDate, setDDate] = useState("");
    const [dPrice, setDPrice] = useState("");
    const [dNotes, setDNotes] = useState("");
    const [dispatching, setDispatching] = useState(false);

    const reload = async () => {
        try {
            const data = await apiFetch("/secretary/contracts");
            setContracts(data || []);
        } catch {}
    };

    useEffect(() => {
        Promise.all([
            apiFetch("/secretary/contracts").catch(() => []),
            apiFetch("/secretary/members").catch(() => []),
        ]).then(([c, m]) => {
            setContracts(c || []);
            setMembers(m || []);
        }).finally(() => setLoading(false));
    }, []);

    const active = contracts.filter(c => c.status === "ACTIVE");
    const pending = contracts.filter(c => ["PENDING", "COUNTER_PROPOSED"].includes(c.status));
    const history = contracts.filter(c => ["REJECTED", "CANCELLED", "EXPIRED"].includes(c.status));

    const act = async (url: string, method: string, id: string) => {
        setActionId(id);
        try { await apiFetch(url, { method }); await reload(); }
        catch {} finally { setActionId(null); }
    };

    const openDispatch = (cid: string) => {
        setDispatchContractId(cid);
        setDMemberId(""); setDServiceType(""); setDDate(""); setDPrice(""); setDNotes("");
        setShowDispatch(true);
    };

    const handleDispatch = async () => {
        if (!dMemberId || !dServiceType || !dDate || !dPrice) return;
        setDispatching(true);
        try {
            await apiFetch(`/secretary/contracts/${dispatchContractId}/dispatch`, {
                method: "POST",
                body: JSON.stringify({
                    member_id: dMemberId,
                    service_type: dServiceType,
                    scheduled_at: new Date(dDate).toISOString(),
                    job_price: parseFloat(dPrice),
                    notes: dNotes || null,
                }),
            });
            setShowDispatch(false);
            await reload();
        } catch {} finally { setDispatching(false); }
    };

    const daysLeft = (end: string) => {
        // eslint-disable-next-line react-hooks/purity
        const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
        return d > 0 ? `${d} days left` : "Expiring soon";
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Contracts</h1>
                <p className="text-slate-500 text-sm mt-1">Manage contracted providers for your society.</p>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
                {([
                    { key: "active", label: `Active (${active.length})` },
                    { key: "pending", label: `Pending / History (${pending.length + history.length})` },
                ] as { key: Tab; label: string }[]).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${tab === t.key ? "bg-white text-[#064e3b] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-emerald-200 border-t-[#064e3b] rounded-full animate-spin" />
                </div>
            ) : tab === "active" ? (
                <div className="space-y-4">
                    {active.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-slate-400">
                            <Briefcase className="w-12 h-12 mb-3 opacity-30" />
                            <p className="font-black text-sm uppercase tracking-widest">No active contracts</p>
                        </div>
                    ) : active.map(c => (
                        <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-black text-slate-900">{c.provider?.company_name || "Provider"}</h3>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-500">{c.provider?.category}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openDispatch(c.id)}
                                        className="px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 flex items-center gap-1">
                                        <Send className="w-3 h-3" /> Dispatch
                                    </button>
                                    <button onClick={() => act(`/secretary/contracts/${c.id}`, "DELETE", c.id + "_cancel")}
                                        disabled={actionId === c.id + "_cancel"}
                                        className="px-4 py-2 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 disabled:opacity-50">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl mb-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</p>
                                    <p className="text-sm font-black text-slate-900 mt-1">{c.duration_months} months</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Rate</p>
                                    <p className="text-sm font-black text-slate-900 mt-1">₹{c.monthly_rate?.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Left</p>
                                    <p className="text-sm font-black text-emerald-700 mt-1">{c.end_date ? daysLeft(c.end_date) : "—"}</p>
                                </div>
                            </div>
                            {c.dispatches.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatched Jobs</p>
                                    {c.dispatches.map(d => (
                                        <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{d.service_type}</p>
                                                <p className="text-xs text-slate-500">{new Date(d.scheduled_at).toLocaleDateString()} · ₹{d.job_price}</p>
                                            </div>
                                            <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${DISPATCH_STYLE[d.status] ?? "text-slate-500 bg-slate-100"}`}>{d.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {pending.length > 0 && (
                        <>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting Response</p>
                            {pending.map(c => (
                                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-black text-slate-900">{c.provider?.company_name}</h3>
                                                <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[c.status]}`}>
                                                    {c.status === "COUNTER_PROPOSED" ? "Counter Proposed" : c.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">{c.provider?.category} · {c.duration_months}mo · ₹{c.monthly_rate?.toLocaleString()}/mo</p>
                                        </div>
                                    </div>
                                    {c.status === "COUNTER_PROPOSED" && (
                                        <div className="p-4 bg-blue-50 rounded-xl">
                                            <p className="text-xs font-black text-blue-700 mb-1">Provider Counter-Proposed</p>
                                            <p className="text-sm text-blue-900">Duration: <strong>{c.counter_duration_months} months</strong></p>
                                            {c.servicer_notes && <p className="text-xs text-blue-600 mt-1 italic">&ldquo;{c.servicer_notes}&rdquo;</p>}
                                            <div className="flex gap-2 mt-3">
                                                <button onClick={() => act(`/secretary/contracts/${c.id}/confirm-counter`, "POST", c.id + "_confirm")}
                                                    disabled={actionId === c.id + "_confirm"}
                                                    className="px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 disabled:opacity-50">
                                                    Confirm Counter
                                                </button>
                                                <button onClick={() => act(`/secretary/contracts/${c.id}/reject-counter`, "POST", c.id + "_reject")}
                                                    disabled={actionId === c.id + "_reject"}
                                                    className="px-4 py-2 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 disabled:opacity-50">
                                                    Reject Counter
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                    {history.length > 0 && (
                        <>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">History</p>
                            {history.map(c => (
                                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 opacity-70">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-slate-900">{c.provider?.company_name}</p>
                                            <p className="text-xs text-slate-500">{c.duration_months}mo · ₹{c.monthly_rate?.toLocaleString()}/mo</p>
                                        </div>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                    {pending.length === 0 && history.length === 0 && (
                        <div className="flex flex-col items-center py-16 text-slate-400">
                            <Clock className="w-12 h-12 mb-3 opacity-30" />
                            <p className="font-black text-sm uppercase tracking-widest">No pending or past contracts</p>
                        </div>
                    )}
                </div>
            )}

            {/* Dispatch Modal */}
            {showDispatch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Dispatch Job</h2>
                                    <p className="text-xs text-slate-500 mt-1">Assign the contracted provider to a society member</p>
                                </div>
                                <button onClick={() => setShowDispatch(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Member *</p>
                                    <select value={dMemberId} onChange={e => setDMemberId(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white">
                                        <option value="">Select Member</option>
                                        {members.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.username}{m.home_number ? ` — Unit ${m.home_number}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Service Type *</p>
                                    <select value={dServiceType} onChange={e => setDServiceType(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white">
                                        <option value="">Select Service</option>
                                        {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Scheduled Date & Time *</p>
                                    <input type="datetime-local" value={dDate} onChange={e => setDDate(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Job Price (₹) *</p>
                                    <input type="number" value={dPrice} onChange={e => setDPrice(e.target.value)}
                                        placeholder="e.g. 1500" min="1"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</p>
                                    <textarea value={dNotes} onChange={e => setDNotes(e.target.value)} rows={2}
                                        placeholder="Special instructions..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowDispatch(false)}
                                    className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                                    Cancel
                                </button>
                                <button onClick={handleDispatch}
                                    disabled={dispatching || !dMemberId || !dServiceType || !dDate || !dPrice}
                                    className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {dispatching ? "Dispatching..." : <><Send className="w-4 h-4" /> Dispatch</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

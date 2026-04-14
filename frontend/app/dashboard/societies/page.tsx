"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Users, MapPin, Search, CheckCircle2, Loader2, X, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Society {
    id: number;
    name: string;
    address: string;
    registration_number?: string;
    secretary_name?: string;
    is_legal?: boolean;
    created_at?: string;
}

export default function SocietiesPage() {
    const [societies, setSocieties] = useState<Society[]>([]);
    const [mySociety, setMySociety] = useState<Society | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createMsg, setCreateMsg] = useState("");
    const [form, setForm] = useState({
        name: "",
        address: "",
        registration_number: "",
        secretary_name: "",
        is_legal: true,
        creator_role: "OWNER",
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const all = await apiFetch("/services/societies").catch(() => []);
            setSocieties(all || []);

            // Only check provider profile if a servicer token exists
            const servicerToken = sessionStorage.getItem("hc_token_SERVICER");
            if (servicerToken) {
                const profile = await apiFetch("/services/providers/me").catch(() => null);
                if (profile?.society_id) {
                    const found = (all || []).find((s: Society) => s.id === profile.society_id);
                    setMySociety(found || null);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleJoin = async (id: number) => {
        setJoining(id);
        try {
            await apiFetch(`/services/societies/join/${id}`, { method: "POST" });
            await fetchData();
        } catch (err) {
            alert((err as Error).message || "Failed to join society");
        } finally {
            setJoining(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateMsg("");
        try {
            await apiFetch("/services/societies", {
                method: "POST",
                body: JSON.stringify(form),
            });
            setShowCreate(false);
            setForm({ name: "", address: "", registration_number: "", secretary_name: "", is_legal: true, creator_role: "OWNER" });
            await fetchData();
        } catch (err) {
            setCreateMsg((err as Error).message || "Failed to create society");
        } finally {
            setCreating(false);
        }
    };

    const filtered = societies.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.address.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Infrastructure</h1>
                    <p className="text-slate-500 text-sm mt-1">Browse and manage housing society networks</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                >
                    <Plus className="w-4 h-4" />
                    Create Society
                </button>
            </div>

            {/* Current Society */}
            {mySociety && (
                <div className="bg-[#0B1320] p-8 rounded-[2rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-900/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Your Active Society</p>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">{mySociety.name}</h2>
                            <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {mySociety.address}
                            </p>
                        </div>
                        <span className="px-3 py-1.5 bg-emerald-900 text-emerald-400 text-[9px] font-black uppercase tracking-[0.3em] rounded-lg border border-emerald-800">
                            Joined
                        </span>
                    </div>
                    {mySociety.is_legal && (
                        <div className="relative z-10 flex items-center gap-1.5 mt-4">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Legally Registered</span>
                        </div>
                    )}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search societies by name or address..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {search ? "No societies match your search" : "No societies found"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(society => {
                        const isJoined = mySociety?.id === society.id;
                        return (
                            <div
                                key={society.id}
                                className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-md hover:border-slate-200 transition-all group"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                                        <Building2 className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                                    </div>
                                    {isJoined && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-lg">
                                            <CheckCircle2 className="w-3 h-3" /> Active
                                        </span>
                                    )}
                                    {society.is_legal && !isJoined && (
                                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    )}
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1 truncate">{society.name}</h3>
                                <p className="text-[10px] text-slate-500 font-medium flex items-start gap-1 mb-4 leading-relaxed">
                                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" />{society.address}
                                </p>
                                {society.secretary_name && (
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Secretary: {society.secretary_name}
                                    </p>
                                )}
                                {!isJoined && (
                                    <button
                                        onClick={() => handleJoin(society.id)}
                                        disabled={joining === society.id}
                                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {joining === society.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Join Society"}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Create Society</h2>
                            <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Society Name *</label>
                                <input
                                    required
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                    placeholder="e.g. Green Valley Society"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Address *</label>
                                <input
                                    required
                                    value={form.address}
                                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                    placeholder="Full address"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Registration Number</label>
                                <input
                                    value={form.registration_number}
                                    onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                    placeholder="Optional"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Secretary Name</label>
                                <input
                                    value={form.secretary_name}
                                    onChange={e => setForm(f => ({ ...f, secretary_name: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                    placeholder="Optional"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Your Role</label>
                                <select
                                    value={form.creator_role}
                                    onChange={e => setForm(f => ({ ...f, creator_role: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                                >
                                    <option value="OWNER">Owner</option>
                                    <option value="SECRETARY">Secretary</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_legal}
                                    onChange={e => setForm(f => ({ ...f, is_legal: e.target.checked }))}
                                    className="w-4 h-4 accent-emerald-600"
                                />
                                <span className="text-xs font-bold text-slate-700">Legally registered organization</span>
                            </label>
                            {createMsg && (
                                <p className="text-xs text-red-600 font-medium">{createMsg}</p>
                            )}
                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Society"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

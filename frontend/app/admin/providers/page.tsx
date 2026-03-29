"use client";

import { useEffect, useState } from "react";
import { Wrench, Star, Phone, Mail, BadgeCheck, XCircle, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Provider {
    id: number;
    company_name: string;
    owner_name: string;
    first_name: string | null;
    last_name: string | null;
    category: string;
    email: string;
    phone: string;
    rating: number;
    is_verified: boolean;
    availability_status: string;
}

const AVAIL_STYLE: Record<string, string> = {
    AVAILABLE: "text-emerald-700 bg-emerald-50",
    WORKING:   "text-blue-700 bg-blue-50",
    VACATION:  "text-slate-500 bg-slate-100",
};

export default function AdminProvidersPage() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [verifiedFilter, setVerifiedFilter] = useState("ALL");
    const [actionMsg, setActionMsg] = useState("");

    useEffect(() => {
        apiFetch("/admin/providers")
            .then((d) => setProviders(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const verifyProvider = async (id: number) => {
        try {
            await apiFetch(`/admin/providers/${id}/verify`, { method: "PATCH" });
            setProviders((prev) => prev.map((p) => p.id === id ? { ...p, is_verified: true } : p));
            setActionMsg("Provider verified.");
            setTimeout(() => setActionMsg(""), 2500);
        } catch (err: any) {
            setActionMsg(err.message || "Failed.");
            setTimeout(() => setActionMsg(""), 3000);
        }
    };

    const filtered = providers.filter((p) => {
        const matchSearch =
            (p.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
            (p.category || "").toLowerCase().includes(search.toLowerCase()) ||
            (p.email || "").toLowerCase().includes(search.toLowerCase());
        const matchVerified =
            verifiedFilter === "ALL" ||
            (verifiedFilter === "VERIFIED" && p.is_verified) ||
            (verifiedFilter === "PENDING" && !p.is_verified);
        return matchSearch && matchVerified;
    });

    const pendingCount = providers.filter((p) => !p.is_verified).length;
    const verifiedCount = providers.filter((p) => p.is_verified).length;

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Service Providers</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">
                        {providers.length} total · {pendingCount} pending verification
                    </p>
                </div>
                {actionMsg && (
                    <div className="px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest">
                        {actionMsg}
                    </div>
                )}
            </div>

            {!loading && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Total", value: providers.length, style: "bg-slate-50 border-slate-200 text-slate-700" },
                        { label: "Verified", value: verifiedCount, style: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                        { label: "Pending", value: pendingCount, style: "bg-amber-50 border-amber-200 text-amber-700" },
                    ].map((s) => (
                        <div key={s.label} className={`p-5 rounded-2xl border ${s.style}`}>
                            <p className="text-2xl font-black">{s.value}</p>
                            <p className="text-[10px] font-black uppercase tracking-wider mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-3 flex-wrap items-center">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input className="bg-white border border-slate-200 rounded-xl py-2.5 pl-12 pr-4 text-xs font-black outline-none focus:ring-1 focus:ring-emerald-500 w-60 transition-all"
                        placeholder="Search providers..."
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {["ALL","VERIFIED","PENDING"].map((f) => (
                    <button key={f} onClick={() => setVerifiedFilter(f)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            verifiedFilter === f ? "bg-[#064e3b] text-white border-[#064e3b]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}>{f}</button>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                    <Wrench className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">
                        Provider Registry — {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-semibold text-sm">No providers found</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/20">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Provider</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Category</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rating</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Availability</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Verified</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <Wrench className="w-4 h-4 text-emerald-700" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-[#000000] uppercase tracking-tight">{p.company_name}</p>
                                                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{p.email || "—"}</p>
                                                    {p.phone && <p className="text-[10px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-black text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 uppercase">{p.category || "—"}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-1 text-sm font-black text-amber-600">
                                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                                {p.rating?.toFixed(1) ?? "—"}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${AVAIL_STYLE[p.availability_status] ?? "text-slate-500 bg-slate-100"}`}>
                                                {p.availability_status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            {p.is_verified
                                                ? <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase"><BadgeCheck className="w-4 h-4" />Verified</span>
                                                : <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 uppercase"><XCircle className="w-4 h-4" />Pending</span>}
                                        </td>
                                        <td className="px-8 py-5">
                                            {!p.is_verified && (
                                                <button onClick={() => verifyProvider(p.id)}
                                                    className="text-[10px] font-black px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 uppercase tracking-widest transition-all">
                                                    Verify
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

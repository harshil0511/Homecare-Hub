"use client";

import { useEffect, useState } from "react";
import {
    Wrench, Star, Phone, Mail, BadgeCheck, XCircle, Search,
    X, MapPin, DollarSign, ClipboardList, ShieldCheck, Eye,
    AlertTriangle, ShieldAlert, UserCheck, FileText, ExternalLink
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

interface Provider {
    id: string;
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

interface ProviderCertificate {
    id: string;
    title: string;
    category: string;
    certificate_url: string | null;
    is_verified: boolean;
}

interface ProviderDetail {
    id: string;
    name: string;
    category: string;
    rating: number;
    is_verified: boolean;
    availability_status: string;
    location: string | null;
    hourly_rate: number | null;
    bio_excerpt: string | null;
    certificate_count: number;
    total_bookings: number;
    email: string;
    phone: string;
    certificates: ProviderCertificate[];
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

    // Review panel state
    const [reviewProvider, setReviewProvider] = useState<ProviderDetail | null>(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);

    // Revoke verification state
    const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
    const [revokeReason, setRevokeReason] = useState("");
    const [revokeLoading, setRevokeLoading] = useState(false);
    const [revokeError, setRevokeError] = useState("");

    useEffect(() => {
        apiFetch("/admin/providers")
            .then((d) => setProviders(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const openReview = async (id: string) => {
        setReviewLoading(true);
        setReviewProvider(null);
        setShowRejectInput(false);
        setRejectReason("");
        try {
            const detail = await apiFetch(`/admin/providers/${id}/detail`);
            setReviewProvider(detail);
        } catch {
            setActionMsg("Could not load provider details.");
            setTimeout(() => setActionMsg(""), 3000);
        } finally {
            setReviewLoading(false);
        }
    };

    const verifyProvider = async (id: string) => {
        try {
            await apiFetch(`/admin/providers/${id}/verify`, { method: "PATCH" });
            setProviders((prev) => prev.map((p) => p.id === id ? { ...p, is_verified: true } : p));
            setReviewProvider(null);
            setActionMsg("Provider verified successfully.");
            setTimeout(() => setActionMsg(""), 2500);
        } catch (err) {
            setActionMsg((err as Error).message || "Failed to verify.");
            setTimeout(() => setActionMsg(""), 3000);
        }
    };

    const rejectProvider = async (_id: string) => {
        setActionMsg(`Provider rejected${rejectReason ? `: ${rejectReason}` : ""}.`);
        setTimeout(() => setActionMsg(""), 3000);
        setReviewProvider(null);
    };

    const handleRevoke = async () => {
        if (!revokeTarget) return;
        setRevokeLoading(true);
        setRevokeError("");
        try {
            await apiFetch(`/admin/providers/${revokeTarget.id}/revoke-verify`, {
                method: "PATCH",
                body: JSON.stringify({ is_verified: false, reason: revokeReason }),
            });
            setProviders((prev) =>
                prev.map((p) => p.id === revokeTarget.id ? { ...p, is_verified: false } : p)
            );
            setActionMsg(`Verification revoked for ${revokeTarget.name}.`);
            setTimeout(() => setActionMsg(""), 3000);
            setRevokeTarget(null);
            setRevokeReason("");
        } catch (err) {
            setRevokeError((err as Error).message || "Failed to revoke verification.");
        } finally {
            setRevokeLoading(false);
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
                        { label: "Pending Review", value: pendingCount, style: "bg-amber-50 border-amber-200 text-amber-700" },
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
                    <input
                        className="bg-white border border-slate-200 rounded-xl py-2.5 pl-12 pr-4 text-xs font-black outline-none focus:ring-1 focus:ring-emerald-500 w-60 transition-all"
                        placeholder="Search providers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {["ALL", "VERIFIED", "PENDING"].map((f) => (
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
                        <Spinner size="lg" />
                    ) : filtered.length === 0 ? (
                        <EmptyState icon={UserCheck} title="No providers found" />
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/20">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Provider</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Category</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rating</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Availability</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
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
                                                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <Mail className="w-3 h-3" />{p.email || "—"}
                                                    </p>
                                                    {p.phone && (
                                                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            <Phone className="w-3 h-3" />{p.phone}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-black text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 uppercase">
                                                {p.category || "—"}
                                            </span>
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
                                                : <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 uppercase"><XCircle className="w-4 h-4" />Pending</span>
                                            }
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openReview(p.id)}
                                                    className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 uppercase tracking-widest transition-all"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Review
                                                </button>
                                                {!p.is_verified && (
                                                    <button
                                                        onClick={() => verifyProvider(p.id)}
                                                        className="text-[10px] font-black px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 uppercase tracking-widest transition-all"
                                                    >
                                                        Verify
                                                    </button>
                                                )}
                                                {p.is_verified && (
                                                    <button
                                                        onClick={() => { setRevokeTarget({ id: p.id, name: p.company_name }); setRevokeReason(""); setRevokeError(""); }}
                                                        className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 uppercase tracking-widest transition-all"
                                                    >
                                                        <ShieldAlert className="w-3.5 h-3.5" />
                                                        Revoke
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Revoke Verification Modal */}
            {revokeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!revokeLoading) { setRevokeTarget(null); setRevokeReason(""); setRevokeError(""); } }}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 mx-4" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <ShieldAlert className="w-6 h-6 text-rose-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#000000] uppercase tracking-tight">Revoke Verification</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">This action will remove verified status</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-600 mb-6">
                            You are about to revoke verification for{" "}
                            <span className="font-black text-[#000000]">{revokeTarget.name}</span>.
                            The provider will be notified.
                        </p>

                        {/* Reason Field */}
                        <div className="mb-6 space-y-2">
                            <label className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3em]">Reason (optional)</label>
                            <textarea
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="Explain why verification is being revoked..."
                                rows={3}
                                className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:border-rose-400 resize-none"
                            />
                        </div>

                        {/* Error Message */}
                        {revokeError && (
                            <div className="mb-4 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-black uppercase tracking-widest">
                                {revokeError}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleRevoke}
                                disabled={revokeLoading}
                                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                {revokeLoading ? (
                                    <Spinner size="sm" py="py-0" />
                                ) : (
                                    <ShieldAlert className="w-4 h-4" />
                                )}
                                {revokeLoading ? "Revoking..." : "Confirm Revoke"}
                            </button>
                            <button
                                onClick={() => { setRevokeTarget(null); setRevokeReason(""); setRevokeError(""); }}
                                disabled={revokeLoading}
                                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full-Screen Review Panel */}
            {(reviewProvider || reviewLoading) && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setReviewProvider(null); setReviewLoading(false); }} />
                    <div className="relative bg-white w-full max-w-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-[#000000] uppercase tracking-tight">Provider Review</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Full profile verification</p>
                            </div>
                            <button
                                onClick={() => { setReviewProvider(null); setReviewLoading(false); }}
                                className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {reviewLoading ? (
                            <Spinner size="lg" py="py-20" />
                        ) : reviewProvider && (
                            <>
                                <div className="overflow-y-auto flex-1 p-10 space-y-8">
                                    {/* Identity */}
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <Wrench className="w-8 h-8 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-[#000000] uppercase tracking-tighter">{reviewProvider.name}</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{reviewProvider.category}</p>
                                            {reviewProvider.is_verified
                                                ? <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg mt-1"><BadgeCheck className="w-3 h-3" />Verified</span>
                                                : <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg mt-1"><AlertTriangle className="w-3 h-3" />Pending Verification</span>
                                            }
                                        </div>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
                                            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                                                <Star className="w-4 h-4 fill-amber-400" />
                                                <span className="text-xl font-black">{reviewProvider.rating}</span>
                                            </div>
                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Rating</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center">
                                            <div className="flex items-center justify-center gap-1 text-slate-700 mb-1">
                                                <ClipboardList className="w-4 h-4" />
                                                <span className="text-xl font-black">{reviewProvider.total_bookings}</span>
                                            </div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bookings</p>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center">
                                            <div className="flex items-center justify-center gap-1 text-blue-700 mb-1">
                                                <ShieldCheck className="w-4 h-4" />
                                                <span className="text-xl font-black">{reviewProvider.certificate_count}</span>
                                            </div>
                                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Certificates</p>
                                        </div>
                                    </div>

                                    {/* Contact & Details */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Contact & Details</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-3">
                                                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Email</p>
                                                    <p className="text-sm font-bold text-slate-700">{reviewProvider.email || "—"}</p>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-3">
                                                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Phone</p>
                                                    <p className="text-sm font-bold text-slate-700">{reviewProvider.phone || "—"}</p>
                                                </div>
                                            </div>
                                            {reviewProvider.location && (
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-3">
                                                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">Location</p>
                                                        <p className="text-sm font-bold text-slate-700">{reviewProvider.location}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {reviewProvider.hourly_rate !== null && reviewProvider.hourly_rate !== undefined && (
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-3">
                                                    <DollarSign className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">Hourly Rate</p>
                                                        <p className="text-sm font-bold text-slate-700">₹{reviewProvider.hourly_rate}/hr</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bio */}
                                    {reviewProvider.bio_excerpt && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Bio</p>
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                                <p className="text-sm text-slate-600 leading-relaxed">{reviewProvider.bio_excerpt}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Certificates */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                            Uploaded Certificates ({reviewProvider.certificates?.length ?? 0})
                                        </p>
                                        {(!reviewProvider.certificates || reviewProvider.certificates.length === 0) ? (
                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
                                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                <p className="text-xs font-semibold text-amber-700">No certificates uploaded. Review carefully before verifying.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {reviewProvider.certificates.map(cert => (
                                                    <div key={cert.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 gap-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-slate-900 truncate">{cert.title || "Untitled"}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase">{cert.category}</span>
                                                                    {cert.is_verified
                                                                        ? <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Verified</span>
                                                                        : <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">Pending</span>
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {cert.certificate_url && (
                                                            <a
                                                                href={cert.certificate_url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${cert.certificate_url}` : cert.certificate_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline flex-shrink-0"
                                                            >
                                                                <ExternalLink className="w-3 h-3" /> View
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Rejection reason input */}
                                    {showRejectInput && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3em]">Rejection Reason</label>
                                            <textarea
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                                placeholder="Explain why this provider is being rejected..."
                                                rows={3}
                                                className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:border-rose-400 resize-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {!reviewProvider.is_verified && (
                                    <div className="px-10 py-6 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-white">
                                        {!showRejectInput ? (
                                            <>
                                                <button
                                                    onClick={() => verifyProvider(reviewProvider.id)}
                                                    className="flex-1 py-4 bg-[#064e3b] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#053e2f] transition-all shadow-lg flex items-center justify-center gap-2"
                                                >
                                                    <BadgeCheck className="w-4 h-4" />
                                                    Approve & Verify
                                                </button>
                                                <button
                                                    onClick={() => setShowRejectInput(true)}
                                                    className="flex-1 py-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Reject
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => rejectProvider(reviewProvider.id)}
                                                    className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                                                >
                                                    Confirm Rejection
                                                </button>
                                                <button
                                                    onClick={() => setShowRejectInput(false)}
                                                    className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

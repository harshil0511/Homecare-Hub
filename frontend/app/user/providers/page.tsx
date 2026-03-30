"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, ShieldCheck, DollarSign, ChevronRight, Briefcase, Filter, WifiOff, RefreshCw, Award, AlertTriangle, Star, CheckSquare, Square, Send, Users, X } from "lucide-react";
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
    certificates: { id: number; category: string; certificate_url: string; is_verified: boolean; uploaded_at: string }[];
}

const CATEGORIES = ["All", "Plumbing", "Electrical", "Cleaning", "Mechanical", "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair"];

const STATUS_COLORS: Record<string, string> = {
    AVAILABLE: "bg-emerald-500",
    WORKING: "bg-amber-500",
    VACATION: "bg-slate-400",
};

function ProvidersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [isEmergency, setIsEmergency] = useState(false);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [submittingRequest, setSubmittingRequest] = useState(false);
    const [reqName, setReqName] = useState("");
    const [reqMobile, setReqMobile] = useState("");
    const [reqLocation, setReqLocation] = useState("");
    const [reqProblemType, setReqProblemType] = useState("");
    const [reqDescription, setReqDescription] = useState("");
    const [reqPhotos, setReqPhotos] = useState<File[]>([]);
    const [reqDateStart, setReqDateStart] = useState("");
    const [reqDateEnd, setReqDateEnd] = useState("");
    const [reqUrgency, setReqUrgency] = useState<"Normal" | "High" | "Emergency">("Normal");

    // Read URL params on mount: ?category=X&emergency=true
    useEffect(() => {
        const catParam = searchParams.get("category");
        const emergencyParam = searchParams.get("emergency");
        if (catParam) {
            const match = CATEGORIES.find(c => c.toLowerCase() === catParam.toLowerCase());
            if (match) setActiveCategory(match);
        }
        if (emergencyParam === "true") setIsEmergency(true);
    }, [searchParams]);

    const fetchProviders = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const params = new URLSearchParams();
            if (activeCategory !== "All") params.append("category", activeCategory);
            if (searchQuery.trim()) params.append("search", searchQuery.trim());
            const queryStr = params.toString() ? `?${params.toString()}` : "";
            const data = await apiFetch(`/services/providers${queryStr}`);
            setProviders(data ?? []);
            setFocusedIndex(-1);
        } catch (err: any) {
            const msg = err?.message || "";
            if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("timed out")) {
                setFetchError("backend_offline");
            } else {
                setFetchError(msg || "Could not load experts.");
            }
            setProviders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
    }, [activeCategory]);

    // Toggle provider selection
    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Photo handler
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setReqPhotos(prev => [...prev, ...files].slice(0, 3));
    };

    // Submit handler
    const handleSubmitRequest = async () => {
        if (!reqName || !reqMobile || !reqLocation || !reqProblemType) return;
        setSubmittingRequest(true);
        try {
            const body = {
                provider_ids: Array.from(selectedIds),
                contact_name: reqName,
                contact_mobile: reqMobile,
                location: reqLocation,
                device_or_issue: reqProblemType,
                description: reqDescription,
                preferred_dates: reqDateStart ? [reqDateStart, reqDateEnd].filter(Boolean) : [],
                urgency: reqUrgency,
            };
            await apiFetch("/requests", { method: "POST", body: JSON.stringify(body) });
            setShowRequestModal(false);
            setSelectedIds(new Set());
            setReqName(""); setReqMobile(""); setReqLocation("");
            setReqProblemType(""); setReqDescription(""); setReqPhotos([]);
            setReqDateStart(""); setReqDateEnd(""); setReqUrgency("Normal");
            router.push("/user/bookings");
        } catch (err) {
            console.error("Failed to submit request:", err);
        } finally {
            setSubmittingRequest(false);
        }
    };

    // Keyboard Navigation Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (providers.length === 0 || loading) return;

            // Don't intercept if user is typing in the search bar
            if (document.activeElement?.tagName === "INPUT") {
                if (e.key === "ArrowDown" && focusedIndex === -1) {
                    setFocusedIndex(0);
                    e.preventDefault();
                }
                return;
            }

            if (e.key === "ArrowDown") {
                setFocusedIndex(prev => Math.min(prev + 1, providers.length - 1));
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                e.preventDefault();
            } else if (e.key === "Enter" && focusedIndex !== -1) {
                if (focusedIndex >= 0 && providers[focusedIndex]) {
                    const p = providers[focusedIndex];
                    setSelectedIds(new Set([p.id]));
                    setShowRequestModal(true);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [providers, focusedIndex, loading]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchProviders();
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

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Expert Discovery</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Verified Professional Network · Use ↑↓ to navigate</p>
                </div>
            </div>

            {/* Emergency Banner */}
            {isEmergency && (
                <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl animate-fade-in">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider">Emergency Mode</p>
                        <p className="text-[10px] font-bold mt-0.5">No verified expert was auto-available. Please select a provider manually and send a request.</p>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name, location, or skill..."
                        className="w-full pl-11 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                    />
                </div>
                <button
                    type="submit"
                    className="bg-[#064e3b] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-950 transition-all active:scale-95"
                >
                    Search
                </button>
            </form>

            {/* Category Filters */}
            <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat
                            ? "bg-[#064e3b] text-white shadow-lg shadow-emerald-900/10"
                            : "bg-white border border-slate-200 text-slate-500 hover:border-[#064e3b] hover:text-[#064e3b]"
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Results */}
            {loading ? (
                <div className="flex items-center justify-center h-[30vh]">
                    <div className="w-10 h-10 border-4 border-[#064e3b] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : fetchError === "backend_offline" ? (
                <div className="text-center py-20 bg-white border border-red-100 rounded-3xl space-y-4">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                        <WifiOff className="w-8 h-8 text-red-400" />
                    </div>
                    <div>
                        <p className="text-base font-black text-slate-700 uppercase tracking-wider">Backend Server Offline</p>
                        <p className="text-sm text-slate-400 mt-1">Start the backend server, then try again.</p>
                        <code className="inline-block mt-3 bg-slate-100 text-slate-600 text-xs font-mono px-4 py-2 rounded-xl">
                            cd backend &amp;&amp; npm run dev
                        </code>
                    </div>
                    <button
                        onClick={fetchProviders}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#064e3b] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-950 transition-all"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry
                    </button>
                </div>
            ) : fetchError ? (
                <div className="text-center py-16 bg-white border border-red-100 rounded-3xl space-y-3">
                    <p className="text-sm font-black text-red-600 uppercase tracking-wider">Error Loading Experts</p>
                    <p className="text-xs text-slate-400">{fetchError}</p>
                    <button onClick={fetchProviders} className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#064e3b] transition-all">
                        <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                </div>
            ) : providers.length === 0 ? (
                <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl">
                    <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-lg font-black text-slate-400 uppercase tracking-wider">No Servicers Found</p>
                    <p className="text-sm text-slate-400 mt-2">Try a different search or category</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {providers.map((provider, index) => (
                        <div
                            key={provider.id}
                            tabIndex={0}
                            onFocus={() => setFocusedIndex(index)}
                            className={`relative bg-white border rounded-3xl p-6 transition-all duration-200 group outline-none cursor-pointer ${focusedIndex === index
                                ? "border-[#064e3b] ring-4 ring-[#064e3b]/5 shadow-xl shadow-emerald-900/5 -translate-y-1"
                                : "border-slate-100 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 hover:border-slate-200"
                                }`}
                        >
                            {/* Checkbox overlay */}
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleSelect(provider.id); }}
                                className="absolute top-3 left-3 z-10 p-1 rounded-lg bg-white/90 shadow-sm hover:bg-white transition-colors"
                            >
                                {selectedIds.has(provider.id)
                                    ? <CheckSquare className="w-5 h-5 text-[#064e3b]" />
                                    : <Square className="w-5 h-5 text-slate-400" />}
                            </button>

                            {/* Provider Header */}
                            <div className="flex items-start gap-4 mb-5">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                                    {getPhotoUrl(provider.profile_photo_url) ? (
                                        <img
                                            src={getPhotoUrl(provider.profile_photo_url)!}
                                            alt={displayName(provider)}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#064e3b] text-white font-black text-lg">
                                            {(provider.first_name || provider.owner_name || "?")[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-[#000000] tracking-tight truncate">{displayName(provider)}</h3>
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

                            {/* Categories */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {(provider.categories || []).slice(0, 3).map(cat => (
                                    <span
                                        key={cat}
                                        className="px-3 py-1 bg-emerald-50 text-[#064e3b] text-[9px] font-black uppercase tracking-widest rounded-full"
                                    >
                                        {cat}
                                    </span>
                                ))}
                                {(provider.categories || []).length > 3 && (
                                    <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-full">
                                        +{provider.categories.length - 3}
                                    </span>
                                )}
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                                {provider.location && (
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <MapPin className="w-3 h-3" />
                                        <span className="font-bold truncate">{provider.location}</span>
                                    </div>
                                )}
                                {provider.hourly_rate > 0 && (
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <DollarSign className="w-3 h-3" />
                                        <span className="font-bold">${provider.hourly_rate}/hr</span>
                                    </div>
                                )}
                            </div>

                            {/* Dynamic Star Rating */}
                            {provider.rating > 0 && (
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star
                                                key={s}
                                                size={13}
                                                className={`${provider.rating >= s ? "text-amber-400 fill-amber-400" : provider.rating >= s - 0.5 ? "text-amber-400 fill-amber-200" : "text-slate-200"}`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 tracking-wider">{provider.rating.toFixed(1)}</span>
                                </div>
                            )}

                            {/* Certificates */}
                            {provider.certificates && provider.certificates.length > 0 && (
                                <div className="flex items-center gap-1.5 mb-4">
                                    <Award className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">
                                        {provider.certificates.length} Certificate{provider.certificates.length !== 1 ? "s" : ""}
                                    </span>
                                    {provider.certificates.some(c => c.is_verified) && (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-[#064e3b] text-[8px] font-black uppercase tracking-widest rounded-full">
                                            Verified
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Bio */}
                            {provider.bio && (
                                <p className="text-xs text-slate-400 font-medium line-clamp-2 mb-5 italic">
                                    &ldquo;{provider.bio}&rdquo;
                                </p>
                            )}

                            {/* Action */}
                            <button
                                onClick={() => {
                                    if (!selectedIds.has(provider.id)) {
                                        setSelectedIds(new Set([provider.id]));
                                    }
                                    setShowRequestModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                                Send Request
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Results Count */}
            {!loading && providers.length > 0 && (
                <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Showing {providers.length} servicer{providers.length !== 1 ? "s" : ""}
                </p>
            )}

            {/* Request Form Modal */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Send Service Request</h2>
                                    <p className="text-xs text-slate-500 mt-1">Sending to {selectedIds.size} provider{selectedIds.size !== 1 ? "s" : ""}</p>
                                </div>
                                <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            {/* Contact Info */}
                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact Information</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="Your Name *" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    <input value={reqMobile} onChange={e => setReqMobile(e.target.value)} placeholder="Mobile Number *" type="tel" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>
                                <input value={reqLocation} onChange={e => setReqLocation(e.target.value)} placeholder="Your Address / Location *" className="mt-3 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                            </div>

                            {/* Problem */}
                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Problem Details</p>
                                <select value={reqProblemType} onChange={e => setReqProblemType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white mb-3">
                                    <option value="">Select Problem Type *</option>
                                    {["Plumbing", "Electrical", "Cleaning", "Mechanical", "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair", "Other"].map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <textarea value={reqDescription} onChange={e => setReqDescription(e.target.value)} placeholder="Describe the problem in detail..." rows={4} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                            </div>

                            {/* Dates */}
                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Preferred Schedule</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">From Date</label>
                                        <input type="date" value={reqDateStart} onChange={e => setReqDateStart(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">To Date</label>
                                        <input type="date" value={reqDateEnd} onChange={e => setReqDateEnd(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    </div>
                                </div>
                            </div>

                            {/* Urgency */}
                            <div className="mb-8">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Urgency Level</p>
                                <div className="flex gap-3">
                                    {(["Normal", "High", "Emergency"] as const).map(u => (
                                        <button
                                            key={u}
                                            onClick={() => setReqUrgency(u)}
                                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                                                reqUrgency === u
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

                            {/* Footer */}
                            <div className="flex gap-3">
                                <button onClick={() => setShowRequestModal(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitRequest}
                                    disabled={submittingRequest || !reqName || !reqMobile || !reqLocation || !reqProblemType}
                                    className="flex-1 py-4 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submittingRequest ? "Sending..." : <><Send className="w-4 h-4" /> Send Request</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Selection Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#064e3b] text-white rounded-2xl px-8 py-4 shadow-2xl">
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-bold">{selectedIds.size} servicer{selectedIds.size !== 1 ? "s" : ""} selected</span>
                    <button
                        onClick={() => setShowRequestModal(true)}
                        className="flex items-center gap-2 px-5 py-2 bg-white text-[#064e3b] text-xs font-black uppercase rounded-xl hover:bg-emerald-50 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                        Send Request ({selectedIds.size})
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

        </div>
    );
}

export default function ProvidersPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-[#064e3b] border-t-transparent rounded-full animate-spin" /></div>}>
            <ProvidersContent />
        </Suspense>
    );
}

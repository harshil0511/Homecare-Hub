"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Search, MapPin, ShieldCheck, DollarSign,
    Filter, WifiOff, RefreshCw, Award, AlertTriangle,
    CheckSquare, Square, Send, Users, X, SlidersHorizontal,
    Check,
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
    categories: string[];
    profile_photo_url: string | null;
    hourly_rate: number;
    availability_status: string;
    is_verified: boolean;
    rating: number;
    completed_jobs: number;
    emergency_jobs: number;
    experience_years: number;
    location: string | null;
    bio: string | null;
    certificates: { id: string; category: string; certificate_url: string; is_verified: boolean; uploaded_at: string }[];
}

const CATEGORIES = [
    "All", "Plumbing", "Electrical", "Cleaning", "Mechanical",
    "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair",
];

const STATUS_COLORS: Record<string, string> = {
    AVAILABLE: "bg-emerald-500",
    WORKING: "bg-amber-500",
    VACATION: "bg-slate-400",
};

type SortKey = "rating_desc" | "rate_asc" | "rate_desc" | "name_asc";

const SORT_LABELS: Record<SortKey, string> = {
    rating_desc: "Top Rated",
    rate_asc: "Price: Low → High",
    rate_desc: "Price: High → Low",
    name_asc: "Name A → Z",
};

function matchesSearch(p: Provider, q: string): boolean {
    const lower = q.toLowerCase();
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""} ${p.owner_name} ${p.company_name}`.toLowerCase();
    const location = (p.location ?? "").toLowerCase();
    const cats = (p.categories ?? []).join(" ").toLowerCase();
    return name.includes(lower) || location.includes(lower) || cats.includes(lower);
}

function ProviderDetailModal({ provider, onClose }: { provider: Provider; onClose: () => void }) {
    const photoUrl = provider.profile_photo_url
        ? provider.profile_photo_url.startsWith("/")
            ? `${process.env.NEXT_PUBLIC_API_URL}${provider.profile_photo_url}`
            : provider.profile_photo_url
        : null;
    const name = provider.first_name && provider.last_name
        ? `${provider.first_name} ${provider.last_name}`
        : provider.owner_name || provider.company_name;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all"
                >
                    <X size={16} />
                </button>

                <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                        {photoUrl ? (
                            <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl font-black text-slate-300">{name.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">{name}</h2>
                            {provider.is_verified && (
                                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <ShieldCheck size={10} /> Verified
                                </span>
                            )}
                        </div>
                        <div className="mt-1">
                            <span className="text-base font-black text-amber-500 tracking-tight">
                                {provider.rating > 0 ? `★ ${provider.rating.toFixed(1)}` : "★ 0.0"}
                            </span>
                        </div>
                    </div>
                </div>

                {provider.bio && (
                    <p className="text-xs font-bold text-slate-600 leading-relaxed mb-5 border-b border-slate-100 pb-5">
                        {provider.bio}
                    </p>
                )}

                {provider.categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                        {provider.categories.map((cat: string) => (
                            <span key={cat} className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                {cat}
                            </span>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-wide">
                    {provider.experience_years > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-400 mb-0.5">Experience</p>
                            <p className="text-slate-900">{provider.experience_years} yrs</p>
                        </div>
                    )}
                    {provider.hourly_rate > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-400 mb-0.5">Rate</p>
                            <p className="text-slate-900">₹{provider.hourly_rate}/hr</p>
                        </div>
                    )}
                    {provider.completed_jobs > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-400 mb-0.5">Jobs Done</p>
                            <p className="text-slate-900">{provider.completed_jobs}</p>
                        </div>
                    )}
                    {provider.emergency_jobs > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-400 mb-0.5">Emergency Jobs</p>
                            <p className="text-slate-900">{provider.emergency_jobs}</p>
                        </div>
                    )}
                    {provider.location && (
                        <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                            <p className="text-slate-400 mb-0.5">Location</p>
                            <p className="text-slate-900">{provider.location}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProvidersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // ── Source data ──────────────────────────────────────────────────────────
    const [allProviders, setAllProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // ── Applied filter state (drives useMemo) ────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [minRating, setMinRating] = useState(0);
    const [availabilityFilter, setAvailabilityFilter] = useState("All");
    const [sortKey, setSortKey] = useState<SortKey>("rating_desc");

    // ── Draft filter state (inside panel, not applied until button click) ────
    const [draftMinRating, setDraftMinRating] = useState(0);
    const [draftAvailability, setDraftAvailability] = useState("All");
    const [draftSortKey, setDraftSortKey] = useState<SortKey>("rating_desc");

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [isEmergency, setIsEmergency] = useState(false);

    // ── Selection & request state ────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
    const [submittingRequest, setSubmittingRequest] = useState(false);
    const [reqName, setReqName] = useState("");
    const [reqMobile, setReqMobile] = useState("");
    const [reqLocation, setReqLocation] = useState("");
    const [reqProblemType, setReqProblemType] = useState("");
    const [reqDescription, setReqDescription] = useState("");
    const [reqDateStart, setReqDateStart] = useState("");
    const [reqDateEnd, setReqDateEnd] = useState("");
    const [reqUrgency, setReqUrgency] = useState<"Normal" | "High" | "Emergency">("Normal");

    // ── URL params on mount ──────────────────────────────────────────────────
    useEffect(() => {
        const catParam = searchParams.get("category");
        const emergencyParam = searchParams.get("emergency");
        if (catParam) {
            const match = CATEGORIES.find(c => c.toLowerCase() === catParam.toLowerCase());
            if (match) setActiveCategory(match);
        }
        if (emergencyParam === "true") setIsEmergency(true);
    }, [searchParams]);

    // ── Single API fetch on mount ────────────────────────────────────────────
    const fetchProviders = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const data = await apiFetch("/services/providers");
            setAllProviders(data ?? []);
        } catch (err: any) {
            const msg = err?.message || "";
            if (
                msg.toLowerCase().includes("failed to fetch") ||
                msg.toLowerCase().includes("network") ||
                msg.toLowerCase().includes("timed out")
            ) {
                setFetchError("backend_offline");
            } else {
                setFetchError(msg || "Could not load experts.");
            }
            setAllProviders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProviders(); }, []);

    // ── Client-side filtered + sorted list ──────────────────────────────────
    const filteredProviders = useMemo(() => {
        let result = allProviders;

        if (activeCategory !== "All") {
            result = result.filter(p =>
                p.category === activeCategory ||
                (p.categories ?? []).includes(activeCategory)
            );
        }

        if (searchQuery.trim()) {
            result = result.filter(p => matchesSearch(p, searchQuery.trim()));
        }

        if (minRating > 0) {
            result = result.filter(p => p.rating >= minRating);
        }

        if (availabilityFilter !== "All") {
            result = result.filter(p => p.availability_status === availabilityFilter);
        }

        return [...result].sort((a, b) => {
            if (sortKey === "rating_desc") return b.rating - a.rating;
            if (sortKey === "rate_asc") return a.hourly_rate - b.hourly_rate;
            if (sortKey === "rate_desc") return b.hourly_rate - a.hourly_rate;
            if (sortKey === "name_asc") {
                const na = displayName(a).toLowerCase();
                const nb = displayName(b).toLowerCase();
                return na < nb ? -1 : na > nb ? 1 : 0;
            }
            return 0;
        });
    }, [allProviders, activeCategory, searchQuery, minRating, availabilityFilter, sortKey]);

    const activeFilterCount = [
        minRating > 0,
        availabilityFilter !== "All",
        sortKey !== "rating_desc",
    ].filter(Boolean).length;

    // ── Keyboard navigation ──────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (filteredProviders.length === 0 || loading) return;
            if (document.activeElement?.tagName === "INPUT") {
                if (e.key === "ArrowDown" && focusedIndex === -1) {
                    setFocusedIndex(0);
                    e.preventDefault();
                }
                return;
            }
            if (e.key === "ArrowDown") {
                setFocusedIndex(prev => Math.min(prev + 1, filteredProviders.length - 1));
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                e.preventDefault();
            } else if (e.key === "Enter" && focusedIndex !== -1) {
                const p = filteredProviders[focusedIndex];
                if (p) { setSelectedIds(new Set([p.id])); setShowRequestModal(true); }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filteredProviders, focusedIndex, loading]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSubmitRequest = async () => {
        if (!reqName || !reqMobile || !reqLocation || !reqProblemType) return;
        setSubmittingRequest(true);
        try {
            await apiFetch("/requests", {
                method: "POST",
                body: JSON.stringify({
                    provider_ids: Array.from(selectedIds),
                    contact_name: reqName,
                    contact_mobile: reqMobile,
                    location: reqLocation,
                    device_or_issue: reqProblemType,
                    description: reqDescription,
                    preferred_dates: reqDateStart ? [reqDateStart, reqDateEnd].filter(Boolean) : [],
                    urgency: reqUrgency,
                }),
            });
            setShowRequestModal(false);
            setSelectedIds(new Set());
            setReqName(""); setReqMobile(""); setReqLocation("");
            setReqProblemType(""); setReqDescription("");
            setReqDateStart(""); setReqDateEnd(""); setReqUrgency("Normal");
            router.push("/user/bookings");
        } catch (err) {
            console.error("Failed to submit request:", err);
        } finally {
            setSubmittingRequest(false);
        }
    };

    function displayName(p: Provider) {
        if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
        return p.owner_name || p.company_name;
    }

    const getPhotoUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith("/")) return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
        return url;
    };

    // Open panel → sync drafts from applied state
    const openFilterPanel = () => {
        setDraftMinRating(minRating);
        setDraftAvailability(availabilityFilter);
        setDraftSortKey(sortKey);
        setShowFilterPanel(true);
    };

    const applyFilters = () => {
        setMinRating(draftMinRating);
        setAvailabilityFilter(draftAvailability);
        setSortKey(draftSortKey);
        setShowFilterPanel(false);
        setFocusedIndex(-1);
    };

    const resetDrafts = () => {
        setDraftMinRating(0);
        setDraftAvailability("All");
        setDraftSortKey("rating_desc");
    };

    const clearAllFilters = () => {
        setActiveCategory("All");
        setSearchQuery("");
        setMinRating(0);
        setAvailabilityFilter("All");
        setSortKey("rating_desc");
        setDraftMinRating(0);
        setDraftAvailability("All");
        setDraftSortKey("rating_desc");
        setShowFilterPanel(false);
        setFocusedIndex(-1);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 pb-24">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Expert Discovery</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                        Verified Professional Network · Use ↑↓ to navigate
                    </p>
                </div>
                {!loading && !fetchError && (
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        {allProviders.length} total · {" "}
                        <span className="text-[#064e3b]">{filteredProviders.length}</span> shown
                    </p>
                )}
            </div>

            {/* Emergency Banner */}
            {isEmergency && (
                <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider">Emergency Mode</p>
                        <p className="text-[10px] font-bold mt-0.5">Select a provider and send a request.</p>
                    </div>
                </div>
            )}

            {/* Search + Filter row */}
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setFocusedIndex(-1); }}
                        placeholder="Search by name, location, or skill..."
                        className="w-full pl-11 pr-10 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Filters button — opens panel with draft state */}
                <button
                    onClick={showFilterPanel ? () => setShowFilterPanel(false) : openFilterPanel}
                    className={`relative flex items-center gap-2 px-5 py-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${showFilterPanel || activeFilterCount > 0
                        ? "bg-[#064e3b] text-white border-[#064e3b]"
                        : "bg-white border-slate-200 text-slate-600 hover:border-[#064e3b] hover:text-[#064e3b]"
                        }`}
                >
                    <SlidersHorizontal size={15} />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                            {activeFilterCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Advanced Filter Panel — draft state, only applies on button click */}
            {showFilterPanel && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Advanced Filters</p>
                        <button onClick={resetDrafts} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700">
                            Reset
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Min Rating */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Min Rating: {draftMinRating > 0 ? `${draftMinRating}+` : "Any"}
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {[0, 3, 5, 8, 10].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setDraftMinRating(r)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${draftMinRating === r
                                            ? "bg-amber-500 text-white"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            }`}
                                    >
                                        {r === 0 ? "Any" : r === 10 ? "10 (Verified)" : `${r}+`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Availability */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Availability</label>
                            <div className="flex gap-2 flex-wrap">
                                {["All", "AVAILABLE", "WORKING"].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setDraftAvailability(s)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${draftAvailability === s
                                            ? "bg-[#064e3b] text-white"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            }`}
                                    >
                                        {s === "All" ? "All" : s === "AVAILABLE" ? "Available" : "Working"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sort By</label>
                            <div className="flex flex-col gap-1.5">
                                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                                    <button
                                        key={k}
                                        onClick={() => setDraftSortKey(k)}
                                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${draftSortKey === k
                                            ? "bg-[#064e3b] text-white"
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            }`}
                                    >
                                        {SORT_LABELS[k]}
                                        {draftSortKey === k && <Check size={11} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Apply / Cancel row */}
                    <div className="flex gap-3 pt-2 border-t border-slate-100">
                        <button
                            onClick={() => setShowFilterPanel(false)}
                            className="flex-1 py-3 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={applyFilters}
                            className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2"
                        >
                            <Check size={13} /> Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setFocusedIndex(-1); }}
                        className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat
                            ? "bg-[#064e3b] text-white shadow-lg shadow-emerald-900/10 ring-2 ring-[#064e3b]/20 scale-105"
                            : "bg-white border border-slate-200 text-slate-500 hover:border-[#064e3b] hover:text-[#064e3b]"
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Results bar */}
            {!loading && !fetchError && (
                <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Showing <span className="text-[#064e3b]">{filteredProviders.length}</span>
                        {" "}of {allProviders.length}{" "}
                        {activeCategory !== "All" ? activeCategory : ""}
                        {" "}provider{filteredProviders.length !== 1 ? "s" : ""}
                    </p>
                    {(activeCategory !== "All" || searchQuery || activeFilterCount > 0) && (
                        <button
                            onClick={clearAllFilters}
                            className="text-[9px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors flex items-center gap-1"
                        >
                            <X size={10} /> Clear All
                        </button>
                    )}
                </div>
            )}

            {/* Results */}
            {loading ? (
                <Spinner size="lg" py="py-[30vh]" />
            ) : fetchError === "backend_offline" ? (
                <div className="text-center py-20 bg-white border border-red-100 rounded-3xl space-y-4">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                        <WifiOff className="w-8 h-8 text-red-400" />
                    </div>
                    <div>
                        <p className="text-base font-black text-slate-700 uppercase tracking-wider">Backend Server Offline</p>
                        <p className="text-sm text-slate-400 mt-1">Start the backend server, then try again.</p>
                    </div>
                    <button
                        onClick={fetchProviders}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#064e3b] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-950 transition-all"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
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
            ) : filteredProviders.length === 0 ? (
                <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl space-y-3">
                    <EmptyState icon={Search} title="No providers found" description="Try adjusting your filters" />
                    {allProviders.length > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-950 transition-all"
                        >
                            <X className="w-3.5 h-3.5" /> Clear Filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {filteredProviders.map((p, idx) => {
                        const name = displayName(p);
                        const photoUrl = getPhotoUrl(p.profile_photo_url);
                        const isSelected = selectedIds.has(p.id);
                        const isFocused = focusedIndex === idx;
                        return (
                            <div
                                key={p.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${isSelected ? "border-[#064e3b] bg-emerald-50/50"
                                    : isFocused ? "border-slate-300 bg-slate-50"
                                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                                    }`}
                            >
                                <button onClick={() => toggleSelect(p.id)} className="flex-shrink-0 text-slate-300 hover:text-[#064e3b] transition-colors">
                                    {isSelected ? <CheckSquare size={16} className="text-[#064e3b]" /> : <Square size={16} />}
                                </button>
                                <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-black text-slate-300">{name.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-sm font-black text-[#000000] uppercase tracking-tight truncate">{name}</span>
                                    {p.is_verified && <ShieldCheck size={13} className="text-emerald-600 flex-shrink-0" />}
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[p.availability_status] || "bg-slate-300"}`} />
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-xs font-black text-amber-500">
                                        {p.rating > 0 ? `★ ${p.rating.toFixed(1)}` : "★ 0.0"}
                                    </span>
                                </div>
                                <span className="hidden md:block text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase tracking-wide flex-shrink-0">
                                    {p.category}
                                </span>
                                <span className="hidden lg:block text-[10px] font-black text-slate-500 flex-shrink-0">
                                    ₹{p.hourly_rate}/hr
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                                    className="flex-shrink-0 text-[9px] font-black text-[#064e3b] bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-all uppercase tracking-wide"
                                >
                                    Details
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([p.id])); setShowRequestModal(true); }}
                                    className="flex-shrink-0 text-[9px] font-black text-white bg-[#064e3b] border border-[#064e3b] px-3 py-1.5 rounded-xl hover:bg-emerald-800 transition-all uppercase tracking-wide"
                                >
                                    Request
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Request Modal */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
                    <div className="flex min-h-full items-center justify-center px-4 sm:px-8 py-5 sm:py-7">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-lg mx-auto animate-fade-in shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-slate-100">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Send Service Request</h2>
                                    <p className="text-xs text-slate-500 mt-1">Sending to {selectedIds.size} provider{selectedIds.size !== 1 ? "s" : ""}</p>
                                </div>
                                <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-8 py-6 flex flex-col gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact Information</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="Your Name *" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                        <input value={reqMobile} onChange={e => setReqMobile(e.target.value)} placeholder="Mobile Number *" type="tel" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    </div>
                                    <input value={reqLocation} onChange={e => setReqLocation(e.target.value)} placeholder="Your Address / Location *" className="mt-3 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Problem Details</p>
                                    <select value={reqProblemType} onChange={e => setReqProblemType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white mb-3">
                                        <option value="">Select Problem Type *</option>
                                        {["Plumbing", "Electrical", "Cleaning", "Mechanical", "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair", "Other"].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <textarea value={reqDescription} onChange={e => setReqDescription(e.target.value)} placeholder="Describe the problem in detail..." rows={4} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                                </div>

                                <div>
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

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Urgency Level</p>
                                    <div className="flex gap-3">
                                        {(["Normal", "High", "Emergency"] as const).map(u => (
                                            <button key={u} onClick={() => setReqUrgency(u)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${reqUrgency === u
                                                ? u === "Emergency" ? "bg-rose-600 text-white" : u === "High" ? "bg-amber-500 text-white" : "bg-[#064e3b] text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                }`}>
                                                {u === "High" ? "Urgent" : u}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex gap-3 px-8 pb-8 pt-2">
                                <button onClick={() => setShowRequestModal(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
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

            {/* Floating selection bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#064e3b] text-white rounded-2xl px-8 py-4 shadow-2xl">
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-bold">{selectedIds.size} provider{selectedIds.size !== 1 ? "s" : ""} selected</span>
                    <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-5 py-2 bg-white text-[#064e3b] text-xs font-black uppercase rounded-xl hover:bg-emerald-50 transition-colors">
                        <Send className="w-4 h-4" /> Send Request ({selectedIds.size})
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {selectedProvider && (
                <ProviderDetailModal
                    provider={selectedProvider}
                    onClose={() => setSelectedProvider(null)}
                />
            )}
        </div>
    );
}

export default function ProvidersPage() {
    return (
        <Suspense fallback={<Spinner size="lg" />}>
            <ProvidersContent />
        </Suspense>
    );
}

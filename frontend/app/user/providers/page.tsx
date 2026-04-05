"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Search, MapPin, ShieldCheck, DollarSign,
    Filter, WifiOff, RefreshCw, Award, AlertTriangle,
    Star, CheckSquare, Square, Send, Users, X, SlidersHorizontal,
    Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

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
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [showRequestModal, setShowRequestModal] = useState(false);
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
    const toggleSelect = (id: number) => {
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
        <div className="space-y-6 animate-fade-in pb-24">

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
                    className={`relative flex items-center gap-2 px-5 py-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${
                        showFilterPanel || activeFilterCount > 0
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
                                {[0, 3, 3.5, 4, 4.5].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setDraftMinRating(r)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                            draftMinRating === r
                                                ? "bg-amber-500 text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        }`}
                                    >
                                        {r === 0 ? "Any" : `${r}+`}
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
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                                            draftAvailability === s
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
                                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                            draftSortKey === k
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
                        className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeCategory === cat
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
                    <Filter className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-lg font-black text-slate-400 uppercase tracking-wider">No Providers Found</p>
                    <p className="text-sm text-slate-400">
                        {allProviders.length > 0
                            ? "Try adjusting your filters or search query."
                            : "No providers are registered yet."}
                    </p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProviders.map((provider, index) => (
                        <div
                            key={provider.id}
                            tabIndex={0}
                            onFocus={() => setFocusedIndex(index)}
                            className={`relative bg-white border rounded-3xl p-6 transition-all duration-200 group outline-none cursor-pointer ${
                                focusedIndex === index
                                    ? "border-[#064e3b] ring-4 ring-[#064e3b]/5 shadow-xl shadow-emerald-900/5 -translate-y-1"
                                    : "border-slate-100 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 hover:border-slate-200"
                            }`}
                        >
                            {/* Checkbox */}
                            <button
                                onClick={e => { e.stopPropagation(); toggleSelect(provider.id); }}
                                className="absolute top-3 left-3 z-10 p-1 rounded-lg bg-white/90 shadow-sm hover:bg-white transition-colors"
                            >
                                {selectedIds.has(provider.id)
                                    ? <CheckSquare className="w-5 h-5 text-[#064e3b]" />
                                    : <Square className="w-5 h-5 text-slate-400" />}
                            </button>

                            {/* Header */}
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
                                        {provider.is_verified && <ShieldCheck className="w-4 h-4 text-[#064e3b] flex-shrink-0" />}
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
                                    <span key={cat} className="px-3 py-1 bg-emerald-50 text-[#064e3b] text-[9px] font-black uppercase tracking-widest rounded-full">
                                        {cat}
                                    </span>
                                ))}
                                {(provider.categories || []).length > 3 && (
                                    <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-full">
                                        +{provider.categories.length - 3}
                                    </span>
                                )}
                            </div>

                            {/* Info */}
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
                                        <span className="font-bold">₹{provider.hourly_rate}/hr</span>
                                    </div>
                                )}
                            </div>

                            {/* Rating */}
                            {provider.rating > 0 && (
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star
                                                key={s}
                                                size={13}
                                                className={
                                                    provider.rating >= s ? "text-amber-400 fill-amber-400"
                                                    : provider.rating >= s - 0.5 ? "text-amber-400 fill-amber-200"
                                                    : "text-slate-200"
                                                }
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
                                    if (!selectedIds.has(provider.id)) setSelectedIds(new Set([provider.id]));
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

            {/* Request Modal */}
            {showRequestModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Send Service Request</h2>
                                    <p className="text-xs text-slate-500 mt-1">Sending to {selectedIds.size} provider{selectedIds.size !== 1 ? "s" : ""}</p>
                                </div>
                                <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact Information</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="Your Name *" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                    <input value={reqMobile} onChange={e => setReqMobile(e.target.value)} placeholder="Mobile Number *" type="tel" className="border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                                </div>
                                <input value={reqLocation} onChange={e => setReqLocation(e.target.value)} placeholder="Your Address / Location *" className="mt-3 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b]" />
                            </div>

                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Problem Details</p>
                                <select value={reqProblemType} onChange={e => setReqProblemType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] bg-white mb-3">
                                    <option value="">Select Problem Type *</option>
                                    {["Plumbing","Electrical","Cleaning","Mechanical","Carpentry","Painting","Gardening","HVAC","Pest Control","Appliance Repair","Other"].map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                <textarea value={reqDescription} onChange={e => setReqDescription(e.target.value)} placeholder="Describe the problem in detail..." rows={4} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#064e3b] resize-none" />
                            </div>

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

                            <div className="mb-8">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Urgency Level</p>
                                <div className="flex gap-3">
                                    {(["Normal", "High", "Emergency"] as const).map(u => (
                                        <button key={u} onClick={() => setReqUrgency(u)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                                            reqUrgency === u
                                                ? u === "Emergency" ? "bg-rose-600 text-white" : u === "High" ? "bg-amber-500 text-white" : "bg-[#064e3b] text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        }`}>
                                            {u === "High" ? "Urgent" : u}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
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

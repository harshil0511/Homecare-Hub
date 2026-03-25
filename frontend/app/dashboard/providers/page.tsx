"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Star, ShieldCheck, Clock, DollarSign, ChevronRight, Briefcase, Filter, WifiOff, RefreshCw } from "lucide-react";
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
}

const CATEGORIES = ["All", "Plumbing", "Electrical", "Cleaning", "Mechanical", "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair"];

const STATUS_COLORS: Record<string, string> = {
    AVAILABLE: "bg-emerald-500",
    WORKING: "bg-amber-500",
    VACATION: "bg-slate-400",
};

export default function ProvidersPage() {
    const router = useRouter();
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [focusedIndex, setFocusedIndex] = useState(-1);

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
                const p = providers[focusedIndex];
                router.push(`/dashboard/bookings/new?provider=${p.id}&category=${p.category}`);
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
                            className={`bg-white border rounded-3xl p-6 transition-all duration-200 group outline-none cursor-pointer ${focusedIndex === index
                                ? "border-[#064e3b] ring-4 ring-[#064e3b]/5 shadow-xl shadow-emerald-900/5 -translate-y-1"
                                : "border-slate-100 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 hover:border-slate-200"
                                }`}
                        >
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
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <Star className="w-3 h-3 text-amber-500" />
                                    <span className="font-bold">{provider.rating.toFixed(1)}/5</span>
                                </div>
                                {provider.hourly_rate > 0 && (
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <DollarSign className="w-3 h-3" />
                                        <span className="font-bold">${provider.hourly_rate}/hr</span>
                                    </div>
                                )}
                                {provider.experience_years > 0 && (
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Clock className="w-3 h-3" />
                                        <span className="font-bold">{provider.experience_years} yrs exp</span>
                                    </div>
                                )}
                            </div>

                            {/* Bio */}
                            {provider.bio && (
                                <p className="text-xs text-slate-400 font-medium line-clamp-2 mb-5 italic">
                                    &ldquo;{provider.bio}&rdquo;
                                </p>
                            )}

                            {/* Action */}
                            <Link
                                href={`/dashboard/bookings/new?provider=${provider.id}&category=${provider.category}`}
                                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 ${focusedIndex === index
                                    ? "bg-[#064e3b] text-white shadow-lg"
                                    : "bg-slate-900 text-white hover:bg-[#064e3b]"
                                    }`}
                            >
                                <Briefcase className="w-3.5 h-3.5" />
                                Book Now
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
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

        </div>
    );
}


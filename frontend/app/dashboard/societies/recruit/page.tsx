"use client";

import { useState, useEffect } from "react";
import { 
    Search, 
    UserPlus, 
    ArrowLeft, 
    MapPin, 
    BadgeCheck, 
    ShieldCheck,
    AlertCircle,
    Loader2,
    CheckCircle2
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RecruitmentPage() {
    const router = useRouter();
    const [providers, setProviders] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [loading, setLoading] = useState(true);
    const [invitingId, setInvitingId] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const categories = ["All", "Plumber", "Electrician", "Cleaner", "Security", "Carpenter"];

    useEffect(() => {
        const init = async () => {
            try {
                const [userData, providersData] = await Promise.all([
                    apiFetch("/user/me"),
                    apiFetch("/services/providers")
                ]);
                setUser(userData);
                setProviders(providersData);
                
                if (!userData.society_id) {
                    router.push("/dashboard/societies");
                }
            } catch (err) {
                console.error("Recruitment init error:", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [router]);

    const handleInvite = async (providerId: number) => {
        setInvitingId(providerId);
        setSuccessMessage(null);
        setErrorMessage(null);
        try {
            await apiFetch("/services/societies/request", {
                method: "POST",
                body: JSON.stringify({
                    society_id: user.society_id,
                    provider_id: providerId,
                    message: `Join our community at ${user.username}'s Society!`
                })
            });
            setSuccessMessage("Invitation sent successfully!");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to send invitation");
        } finally {
            setInvitingId(null);
        }
    };

    const filteredProviders = providers.filter(p => {
        const matchesCat = selectedCategory === "All" || p.category.toLowerCase() === selectedCategory.toLowerCase();
        const matchesSearch = p.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             p.owner_name.toLowerCase().includes(searchQuery.toLowerCase());
        // Don't show providers already in a society
        return matchesCat && matchesSearch && !p.society_id;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-[#064e3b] animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link 
                        href="/dashboard/societies" 
                        className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[#064e3b] transition-colors uppercase tracking-widest mb-2"
                    >
                        <ArrowLeft className="w-3 h-3" /> Back to Society
                    </Link>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <UserPlus className="w-8 h-8 text-[#064e3b]" />
                        Recruit Experts
                    </h1>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">Build your society's trusted service network</p>
                </div>
            </div>

            {successMessage && (
                <div className="bg-emerald-50 border border-emerald-100 text-[#064e3b] p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wide">{successMessage}</span>
                </div>
            )}

            {errorMessage && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wide">{errorMessage}</span>
                </div>
            )}

            {/* Search & Filters (SS2 Style) */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Find professionals by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-14 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#064e3b]/10 transition-all outline-none"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-2">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-6 py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                                    selectedCategory === cat 
                                    ? "bg-[#064e3b] text-white shadow-lg shadow-emerald-900/20" 
                                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Professionals List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                {filteredProviders.map((host) => (
                    <div key={host.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:border-[#064e3b]/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#064e3b]/5 -mr-16 -mt-16 rounded-full group-hover:bg-[#064e3b]/10 transition-colors" />
                        
                        <div className="relative flex flex-col h-full">
                            <div className="flex items-start justify-between mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:border-[#064e3b]/30 transition-colors overflow-hidden">
                                    {host.profile_photo_url ? (
                                        <img src={host.profile_photo_url} alt={host.company_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <ShieldCheck className="w-8 h-8 text-slate-200" />
                                    )}
                                </div>
                                <div className="px-4 py-2 bg-emerald-50 text-[#064e3b] rounded-lg text-[8px] font-black uppercase tracking-[0.3em] border border-emerald-100">
                                    {host.category}
                                </div>
                            </div>

                            <div className="space-y-2 mb-10 text-left">
                                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
                                    {host.company_name}
                                    {host.is_verified && <BadgeCheck className="w-5 h-5 text-[#064e3b]" />}
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {host.location || "Nearby"}
                                </div>
                            </div>

                            <div className="mt-auto">
                                <button
                                    onClick={() => handleInvite(host.id)}
                                    disabled={invitingId === host.id}
                                    className="w-full py-5 bg-[#064e3b] text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
                                >
                                    {invitingId === host.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <UserPlus className="w-4 h-4" />
                                    )}
                                    {invitingId === host.id ? "Inviting..." : "Recruitment Link"}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredProviders.length === 0 && (
                <div className="bg-white border-2 border-dashed border-slate-100 rounded-[3rem] p-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-center mx-auto mb-8 shadow-sm">
                        <Search className="w-8 h-8 text-slate-200" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.4em]">No Professionals Found</h3>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Try adjusting your filters or search term</p>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Hammer, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import ProviderCard from "@/components/community/ProviderCard";
import Link from "next/link";

interface Provider {
    id: number;
    company_name: string;
    owner_name: string;
    category: string;
    phone: string;
    email: string;
    is_verified: boolean;
    qualification: string;
    government_id: string;
    rating: number;
}

export default function MaintenancePage() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [category, setCategory] = useState("All");
    const [userRole, setUserRole] = useState("client");

    const fetchData = async () => {
        try {
            const [providersData, userData] = await Promise.all([
                apiFetch("/services/providers"),
                apiFetch("/user/me")
            ]);
            setProviders(providersData);
            setUserRole(userData.role);
        } catch (err) {
            console.error("Failed to fetch maintenance data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredProviders = providers.filter(p => {
        const matchesSearch = p.company_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = category === "All" || p.category === category;
        return matchesSearch && matchesCategory;
    });

    const categories = ["All", "Plumbing", "Electrical", "Air Conditioning", "Security Systems"];

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#000000] tracking-tighter uppercase">Home Health Hub</h1>
                    <p className="text-slate-600 mt-2 font-black uppercase text-[10px] tracking-[0.4em]">Predictive Maintenance & Device Schedules</p>
                </div>
                {userRole === "provider" && (
                    <Link
                        href="/dashboard/provider/setup"
                        className="flex items-center space-x-2 bg-[#064e3b] hover:bg-emerald-950 text-white px-6 py-3 rounded-2xl transition-all shadow-xl shadow-emerald-900/20 active:scale-95"
                    >
                        <Building2 className="w-5 h-5" />
                        <span className="font-bold text-sm uppercase tracking-widest">Register My Business</span>
                    </Link>
                )}
            </div>

            {/* Premium Filter Section */}
            <div className="flex flex-col lg:flex-row gap-5">
                <div className="flex-1 relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search certified companies..."
                        className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-4 pl-14 pr-6 text-[#000000] font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/10 outline-none transition-all placeholder:text-slate-400 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center space-x-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${category === cat
                                    ? 'bg-[#064e3b] text-white border-[#064e3b] shadow-lg shadow-emerald-900/10'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-72 bg-slate-100 rounded-[2.5rem] animate-pulse"></div>
                    ))}
                </div>
            ) : filteredProviders.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-[3rem] border border-slate-200 border-dashed">
                    <Hammer className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-700 text-xl font-bold">No certified experts found.</p>
                    <p className="text-slate-500 mt-2">Try adjusting your filters or search term.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredProviders.map((provider) => (
                        <ProviderCard key={provider.id} provider={provider} />
                    ))}
                </div>
            )}

        </div>
    );
}

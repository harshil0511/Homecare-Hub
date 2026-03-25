"use client";

import { Phone, ShieldCheck, Star, BadgeCheck, Building2, GraduationCap, MessageCircle } from "lucide-react";
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

export default function ProviderCard({ provider }: { provider: Provider }) {
    return (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 group hover:border-emerald-100 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 transition-all duration-200 shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-[#064e3b] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-900/10">
                        <span className="text-white font-black text-base">
                            {provider.company_name?.[0]?.toUpperCase() || "?"}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-black text-[#000000] tracking-tight truncate">{provider.company_name}</h3>
                            {provider.is_verified && (
                                <BadgeCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            )}
                        </div>
                        <div className="flex items-center text-slate-400 text-[10px] font-bold mt-0.5 gap-1">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{provider.owner_name}</span>
                        </div>
                    </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-xl flex-shrink-0 ml-2">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-black text-slate-700">{provider.rating}</span>
                </div>
            </div>

            {/* Category */}
            <span className="inline-block text-[9px] font-black text-[#064e3b] bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full uppercase tracking-widest mb-4">
                {provider.category}
            </span>

            {/* Details */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5 mb-5">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span className="font-bold">Expertise</span>
                    </div>
                    <span className="text-[#000000] font-black text-right truncate max-w-[120px]">
                        {provider.qualification || "General Professional"}
                    </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-bold">License ID</span>
                    <span className="text-slate-600 font-mono font-bold">{provider.government_id || "VERIFYING"}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
                <a
                    href={`tel:${provider.phone}`}
                    className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 py-3 rounded-xl transition-all"
                >
                    <Phone className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Call</span>
                </a>
                <Link
                    href={`/dashboard/bookings/new?category=${provider.category}`}
                    className="flex items-center justify-center gap-2 bg-[#064e3b] hover:bg-emerald-950 text-white py-3 rounded-xl transition-all shadow-md shadow-emerald-900/10"
                >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Book</span>
                </Link>
            </div>

            {/* Verification footer */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                <ShieldCheck className={`w-3 h-3 ${provider.is_verified ? "text-emerald-600" : "text-slate-300"}`} />
                <span>{provider.is_verified ? "Government Verified & Active" : "Verification in Progress"}</span>
            </div>
        </div>
    );
}

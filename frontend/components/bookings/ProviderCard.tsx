"use client";

import { Star, ShieldCheck, Clock, MapPin, ChevronRight } from "lucide-react";

interface Provider {
    id: number;
    company_name: string;
    owner_name: string;
    rating: number;
    category: string;
    hourly_rate: number;
    is_verified: boolean;
    availability_status?: string;
}

interface ProviderCardProps {
    provider: Provider;
    onSelect: (provider: Provider) => void;
    isSelected?: boolean;
}

export default function ProviderCard({ provider, onSelect, isSelected }: ProviderCardProps) {
    return (
        <div
            onClick={() => onSelect(provider)}
            className={`p-8 rounded-[2.5rem] border cursor-pointer transition-all duration-500 relative overflow-hidden group ${
                isSelected
                    ? "bg-slate-900 border-emerald-500 shadow-2xl shadow-emerald-500/20"
                    : "bg-white border-slate-100 hover:border-emerald-200 hover:shadow-2xl hover:shadow-slate-200/50"
            }`}
        >
            <div className="flex items-start justify-between relative z-10 mb-8">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-800">
                        {provider.company_name.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={`text-xl font-black tracking-tight ${isSelected ? "text-white" : "text-slate-900"}`}>
                                {provider.company_name}
                            </h3>
                            {provider.is_verified && (
                                <ShieldCheck size={18} className="text-emerald-500" />
                            )}
                        </div>
                        <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isSelected ? "text-emerald-400" : "text-slate-400"}`}>
                            {provider.category}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                        <Star size={16} fill="currentColor" className="text-amber-400" />
                        <span className={`text-lg font-black ${isSelected ? "text-white" : "text-slate-900"}`}>{provider.rating.toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Service</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className={`p-4 rounded-2xl border ${isSelected ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Standard Rate</p>
                    <p className={`text-lg font-black ${isSelected ? "text-white" : "text-slate-900"}`}>${provider.hourly_rate}/hr</p>
                </div>
                <div className={`p-4 rounded-2xl border ${isSelected ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</p>
                    <p className={`text-sm font-black uppercase ${
                        provider.availability_status === "WORKING" ? "text-amber-500" :
                        provider.availability_status === "VACATION" ? "text-slate-400" :
                        "text-emerald-500"
                    }`}>
                        {provider.availability_status === "WORKING" ? "Working" :
                         provider.availability_status === "VACATION" ? "On Leave" :
                         "Available"}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`w-8 h-8 rounded-full border-2 ${isSelected ? "border-slate-800" : "border-white"} bg-slate-100`} />
                        ))}
                    </div>
                    <span className={`text-[10px] font-bold ${isSelected ? "text-white/60" : "text-slate-400"}`}>+24 verified reviews</span>
                </div>
                <button className={`p-3 rounded-xl transition-all ${isSelected ? "bg-emerald-500 text-white" : "bg-slate-900 text-white group-hover:bg-emerald-500"}`}>
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
}

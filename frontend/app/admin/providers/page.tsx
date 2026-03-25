"use client";

import { useEffect, useState } from "react";
import { UserCheck, Award, MapPin, Search, MoreVertical, BadgeCheck, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function AdminProvidersPage() {
    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Provider Registry</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">Managing certified service professionals</p>
                </div>
                <button className="bg-[#064e3b] hover:bg-emerald-950 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Register New Pro
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-slate-200 p-10 rounded-[3rem] shadow-sm hover:shadow-xl transition-all group">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                            <div className="flex items-center gap-8">
                                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center border-2 border-slate-100 relative group-hover:bg-[#064e3b] group-hover:text-white transition-colors duration-500">
                                    <UserCheck className="w-10 h-10" />
                                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full border-4 border-white">
                                        <BadgeCheck size={20} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg uppercase tracking-widest border border-emerald-100">Verified Pro</span>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID: PR-00{i}</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-[#000000] tracking-tight">TechOps Solutions {i}</h3>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                                            <Award className="w-4 h-4 text-blue-600" />
                                            Master Electrician
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                                            <MapPin className="w-4 h-4 text-[#064e3b]" />
                                            Global Region
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <div className="bg-slate-50 px-6 py-4 rounded-2xl text-center">
                                    <p className="text-lg font-black text-[#000000]">12.4k</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Jobs</p>
                                </div>
                                <div className="bg-slate-50 px-6 py-4 rounded-2xl text-center">
                                    <p className="text-lg font-black text-emerald-600">4.9</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Avg Rating</p>
                                </div>
                                <button className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-[#064e3b] transition-all">
                                    <ShieldCheck className="w-6 h-6" />
                                </button>
                                <button className="p-4 bg-slate-100 text-slate-300 hover:text-slate-900 rounded-2xl transition-all">
                                    <MoreVertical className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

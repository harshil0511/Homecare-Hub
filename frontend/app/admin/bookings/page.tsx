"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Calendar, Clock, DollarSign, Search, Filter, ChevronRight } from "lucide-react";

export default function AdminBookingsPage() {
    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Master Ledger</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">Global audit of all service transactions</p>
                </div>
                <div className="bg-white border border-slate-200 px-8 py-4 rounded-[2rem] flex items-center gap-10 shadow-sm">
                    <div className="text-center">
                        <p className="text-xl font-black text-[#000000]">$4,2k</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Today's yield</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="text-center">
                        <p className="text-xl font-black text-blue-600">124</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Bookings</p>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[3rem] shadow-sm overflow-hidden flex flex-col">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                        <ClipboardList className="w-4 h-4 text-slate-900" />
                        Global Transaction Log
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <input className="bg-white border border-slate-200 rounded-xl py-2 pl-12 pr-4 text-[10px] font-black uppercase w-64 outline-none transition-all" placeholder="Search BK_ID..." />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ecosystem Participant</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Service Pro</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Context</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Financials</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <tr key={i} className="group hover:bg-slate-50/30 transition-colors cursor-pointer">
                                    <td className="px-10 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-[#000000] uppercase">User_ID_{i}00</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Society A, Block B</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-black text-[#000000] uppercase tracking-tight">Pro_Ops_{i}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Electrical Fix</span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5">Jan 1{i}, 2024</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <span className="text-sm font-black text-[#000000] tracking-tighter">$140.00</span>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex items-center justify-end gap-4">
                                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest ${
                                                i % 2 === 0 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                                            }`}>
                                                {i % 2 === 0 ? "Settled" : "In Flight"}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-black transition-colors" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Aggregate Log sync complete / Next cycle in 12s</p>
                    <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Download Comprehensive Report</button>
                </div>
            </div>
        </div>
    );
}

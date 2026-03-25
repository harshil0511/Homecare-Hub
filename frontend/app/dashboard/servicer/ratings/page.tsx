"use client";

import { useEffect, useState } from "react";
import { Star, TrendingUp, MessageSquare, Award, Zap, ShieldCheck, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ServicerRatingsPage() {
    const [stats, setStats] = useState({
        avgRating: 4.8,
        totalReviews: 124,
        completionRate: "98%",
        badges: ["Certified", "Top Pro", "Society Favorite"]
    });

    const reviews = [
        { id: 1, user: "John D.", rating: 5, comment: "Excellent work on the electrical short. Very professional and arrived on time.", date: "2 days ago" },
        { id: 2, user: "Sarah M.", rating: 5, comment: "Fixed my AC perfectly. The technician explained everything clearly.", date: "1 week ago" },
        { id: 3, user: "Borg O.", rating: 4, comment: "Good service, very knowledgeable. Recommended for plumbing needs.", date: "2 weeks ago" },
    ];

    return (
        <div className="space-y-10 animate-fade-in pb-16">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Performance Metrics</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">Your professional standing and customer feedback</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-100 overflow-hidden shadow-sm">
                                <img src={`https://i.pravatar.cc/100?img=${i + 40}`} alt="badge" />
                            </div>
                        ))}
                    </div>
                    <span className="text-[10px] font-black text-[#000000] uppercase tracking-widest bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100">
                        Top Rated Expert
                    </span>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Aggregate Rating", value: stats.avgRating, icon: Star, color: "text-amber-500", bg: "bg-amber-50" },
                    { label: "Client Feedbacks", value: stats.totalReviews, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Success Quotient", value: stats.completionRate, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Active Badges", value: stats.badges.length, icon: Award, color: "text-purple-600", bg: "bg-purple-50" },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:translate-y-1 transition-all">
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6`}>
                            <stat.icon className="w-7 h-7" />
                        </div>
                        <p className="text-3xl font-black text-[#000000] tracking-tighter">{stat.value}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Review Ledger */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                            <MessageSquare className="w-4 h-4 text-[#064e3b]" />
                            Critical Reviews
                        </h2>
                        <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#064e3b] transition-colors">View All Archive</button>
                    </div>
                    
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div key={review.id} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm group hover:border-[#064e3b] transition-all cursor-default">
                                <div className="flex items-start justify-between gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex text-amber-500">
                                                {[...Array(review.rating)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{review.date}</span>
                                        </div>
                                        <p className="text-sm font-bold text-[#000000] leading-relaxed">"{review.comment}"</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-400">
                                                {review.user.charAt(0)}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{review.user} / Verified Unit</span>
                                        </div>
                                    </div>
                                    <button className="p-2 text-slate-200 group-hover:text-slate-900 transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

              </div>
              </div>
    );
}

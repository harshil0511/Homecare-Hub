"use client";

import { useEffect, useState } from "react";
import { Star, TrendingUp, MessageSquare, Award, ShieldCheck, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Review {
    id: number;
    rating: number;
    review_text: string | null;
    quality_rating: number;
    punctuality_rating: number;
    professionalism_rating: number;
    created_at: string | null;
    service_type: string;
    user_name: string;
}

export default function ServicerRatingsPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        avgRating: 0,
        totalReviews: 0,
        completionRate: "0%",
        totalCompleted: 0
    });
    const [reviews, setReviews] = useState<Review[]>([]);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileData, allBookings, contractedBookings, reviewsData] = await Promise.all([
                    apiFetch("/services/providers/me"),
                    apiFetch("/bookings/list"),
                    apiFetch("/bookings/list?status=contracted"),
                    apiFetch("/services/providers/me/reviews").catch(() => [])
                ]);

                const completed = contractedBookings.filter((b: any) => b.status === "Completed");
                const total = allBookings.length;
                const rate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

                setProfile(profileData);
                setReviews(reviewsData);
                setStats({
                    avgRating: profileData.rating || 0,
                    totalReviews: reviewsData.length,
                    completionRate: `${rate}%`,
                    totalCompleted: completed.length
                });
            } catch (err) {
                console.error("Failed to fetch ratings data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "Unknown";
        const d = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 0) return "Today";
        if (diff === 1) return "Yesterday";
        if (diff < 7) return `${diff} days ago`;
        if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
        return d.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-[#064e3b] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fade-in pb-16">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">Performance Metrics</h1>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-widest mt-1 opacity-60">Your professional standing and customer feedback</p>
                </div>
                <div className="flex items-center gap-4">
                    {profile?.is_verified && (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Verified Expert
                        </span>
                    )}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Aggregate Rating", value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "N/A", icon: Star, color: "text-amber-500", bg: "bg-amber-50" },
                    { label: "Client Feedbacks", value: stats.totalReviews, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Success Quotient", value: stats.completionRate, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Jobs Completed", value: stats.totalCompleted, icon: Award, color: "text-purple-600", bg: "bg-purple-50" },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm hover:-translate-y-1 transition-all">
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6`}>
                            <stat.icon className="w-7 h-7" />
                        </div>
                        <p className="text-3xl font-black text-[#000000] tracking-tighter">{stat.value}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Skills/Categories */}
            {profile?.categories?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3 mb-6">
                        <Award className="w-4 h-4 text-[#064e3b]" />
                        Your Skill Badges
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {(Array.isArray(profile.categories) ? profile.categories : []).map((cat: string) => (
                            <span key={cat} className="px-5 py-2.5 bg-emerald-50 text-[#064e3b] text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                                {cat}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Reviews */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em] flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-[#064e3b]" />
                        Client Reviews
                    </h2>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{reviews.length} Total</span>
                </div>

                {reviews.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-slate-200 border-dashed rounded-[2.5rem]">
                        <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No reviews yet</p>
                        <p className="text-slate-300 text-xs font-bold mt-2">Complete jobs to receive client feedback</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div key={review.id} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm group hover:border-[#064e3b]/20 transition-all">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Star key={s} size={14} className={`${review.rating >= s ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                                                ))}
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">
                                                {review.service_type}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(review.created_at)}</span>
                                    </div>
                                    {review.review_text && (
                                        <p className="text-sm font-bold text-[#000000] leading-relaxed">&ldquo;{review.review_text}&rdquo;</p>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-400">
                                                {review.user_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{review.user_name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>Quality: {review.quality_rating}/5</span>
                                            <span>Punctuality: {review.punctuality_rating}/5</span>
                                            <span>Professional: {review.professionalism_rating}/5</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

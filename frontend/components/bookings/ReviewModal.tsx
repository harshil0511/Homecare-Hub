"use client";

import { useState } from "react";
import { Star, X, Upload, Check } from "lucide-react";

interface ReviewModalProps {
    bookingId: number;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

export default function ReviewModal({ bookingId, onClose, onSubmit }: ReviewModalProps) {
    const [rating, setRating] = useState(5);
    const [quality, setQuality] = useState(5);
    const [punctuality, setPunctuality] = useState(5);
    const [professionalism, setProfessionalism] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const data = {
                rating,
                review_text: reviewText,
                quality_rating: quality,
                punctuality_rating: punctuality,
                professionalism_rating: professionalism
            };
            onSubmit(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl p-10 md:p-14 space-y-10 animate-scale-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Rate Your Service</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Booking #{bookingId}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-12">
                    {/* Main Rating */}
                    <div className="text-center space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Overall Experience</p>
                        <div className="flex items-center justify-center gap-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`transition-all duration-300 ${rating >= star ? "text-amber-400 scale-125" : "text-slate-100"}`}
                                >
                                    <Star size={40} fill="currentColor" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Detailed Ratings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { label: "Quality", val: quality, set: setQuality },
                            { label: "Punctuality", val: punctuality, set: setPunctuality },
                            { label: "Professionalism", val: professionalism, set: setProfessionalism },
                        ].map((item) => (
                            <div key={item.label} className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{item.label}</p>
                                <div className="flex items-center justify-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => item.set(s)}
                                            className={`transition-colors ${item.val >= s ? "text-amber-400" : "text-slate-100"}`}
                                        >
                                            <Star size={16} fill="currentColor" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Review Text */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Written Feedback</label>
                        <textarea
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            rows={4}
                            placeholder="Share your experience with the community..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={onClose} className="py-5 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={loading}
                            className="py-5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? "Submitting..." : <>Submit Feedback <Check size={16} /></>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

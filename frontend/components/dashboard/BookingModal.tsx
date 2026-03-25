"use client";

import { useState } from "react";
import { X, Calendar, Clock, MessageSquare, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Provider {
    id: number;
    company_name: string;
    category: string;
}

interface BookingModalProps {
    provider: Provider;
    onClose: () => void;
    onSuccess: () => void;
}

export default function BookingModal({ provider, onClose, onSuccess }: BookingModalProps) {
    const [scheduledAt, setScheduledAt] = useState("");
    const [scheduledTime, setScheduledTime] = useState("10:00");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const combinedDateTime = `${scheduledAt}T${scheduledTime}:00`;
            await apiFetch("/bookings/create", {
                method: "POST",
                body: JSON.stringify({
                    provider_id: provider.id,
                    service_type: provider.category,
                    scheduled_at: combinedDateTime,
                    issue_description: notes
                })
            });
            onSuccess();
        } catch (err) {
            alert("Failed to book service. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.15)] w-full max-w-lg p-10 relative">
                <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition p-2">
                    <X className="w-6 h-6" />
                </button>

                <div className="mb-8">
                    <h2 className="text-2xl font-black text-[#000000] uppercase tracking-tight">Request Service</h2>
                    <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">
                        Booking with <span className="text-blue-600">{provider.company_name}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Preferred Date
                            </label>
                            <input
                                type="date"
                                required
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                Preferred Time
                            </label>
                            <input
                                type="time"
                                required
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" />
                            Additional Notes
                        </label>
                        <textarea
                            placeholder="Tell the expert about your requirements..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none h-32 resize-none transition-all placeholder:font-medium"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-blue-900/10 uppercase tracking-[0.2em] text-xs transition active:scale-95 mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? "Processing..." : (
                            <>
                                <span>Confirm Booking Request</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                        No payment required now. Provider will confirm details.
                    </p>
                </form>
            </div>
        </div>
    );
}

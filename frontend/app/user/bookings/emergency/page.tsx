"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
    AlertTriangle, ShieldAlert, Zap,
    ArrowRight, Search,
    ShieldCheck, Loader2, Check, XCircle
} from "lucide-react";
import Link from "next/link";

export default function EmergencyBookingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [category, setCategory] = useState("Plumbing");
    const [description, setDescription] = useState("");
    const [unit, setUnit] = useState("");
    const [error, setError] = useState("");
    const [bookingId, setBookingId] = useState<number | null>(null);
    const [providerName, setProviderName] = useState("");

    const handleEmergencyRequest = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await apiFetch("/bookings/emergency", {
                method: "POST",
                body: JSON.stringify({
                    category,
                    description,
                    location: unit
                })
            });

            if (res.provider_found) {
                setBookingId(res.booking_id);
                setProviderName(res.provider_name || "Expert");
                setStep(3); // Request sent successfully
            } else {
                setStep(4); // No expert available
            }
        } catch (err: any) {
            setError(err.message || "Failed to send emergency request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto pb-20 px-4">
            {/* Step 1: Category Selection */}
            {step === 1 && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700 text-center py-12">
                    <div className="flex justify-center relative">
                        <div className="absolute inset-0 bg-rose-500/10 rounded-full scale-125 blur-xl animate-pulse" />
                        <div className="relative w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border-[3px] border-white shadow-lg">
                            <ShieldAlert size={40} className="animate-bounce-subtle" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight uppercase leading-none">Emergency Support</h1>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.25em] text-[10px]">Priority dispatch within 30 minutes</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                        {[
                            { id: "Plumbing", icon: <Zap size={32} /> },
                            { id: "Electrical", icon: <Zap size={32} /> },
                            { id: "AC Service", icon: <Zap size={32} /> },
                            { id: "Appliance Repair", icon: <Zap size={32} /> },
                            { id: "Home Cleaning", icon: <Zap size={32} /> },
                            { id: "Pest Control", icon: <Zap size={32} /> },
                            { id: "Painting", icon: <Zap size={32} /> },
                            { id: "Carpentry", icon: <Zap size={32} /> },
                            { id: "General Maintenance", icon: <Zap size={32} /> }
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id)}
                                className={`group p-8 rounded-[2rem] border-2 transition-all duration-400 relative overflow-hidden ${
                                    category === cat.id
                                        ? "bg-[#ff1e56] border-[#ff1e56] text-white shadow-[0_15px_40px_rgba(255,30,86,0.25)] scale-[1.03]"
                                        : "bg-white border-slate-50 text-slate-300 hover:border-rose-100 hover:text-rose-400"
                                }`}
                            >
                                <div className="transition-transform duration-400 group-hover:scale-110 mb-3 flex justify-center">
                                    {cat.icon}
                                </div>
                                <span className="font-black uppercase tracking-[0.1em] text-[10px] leading-none block">{cat.id}</span>

                                {category === cat.id && (
                                    <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-bl-[1.5rem] flex items-center justify-center">
                                        <Check size={16} className="text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    <div>
                        <button
                            onClick={() => setStep(2)}
                            className="w-full bg-[#ff1e56] text-white py-6 rounded-[2rem] font-black text-base uppercase tracking-[0.2em] shadow-[0_15px_50px_rgba(255,30,86,0.35)] hover:bg-rose-700 transition-all active:scale-[0.98] flex items-center justify-center gap-4 group"
                        >
                            Activate Priority Signal
                            <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Fill Details & Submit */}
            {step === 2 && (
                <div className="bg-white border border-slate-200 rounded-[3rem] p-10 md:p-16 shadow-xl shadow-slate-200/50 space-y-10 animate-scale-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase">Emergency Protocol</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provide critical incident data</p>
                            </div>
                        </div>
                        <span className="text-xs font-black text-rose-500 bg-rose-50 px-4 py-2 rounded-xl uppercase tracking-widest animate-pulse">Live Tracking Enabled</span>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-xs font-bold flex-1">{error}</p>
                            <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600 text-xs font-black">Dismiss</button>
                        </div>
                    )}

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Property Unit</label>
                            <input
                                value={unit}
                                onChange={e => setUnit(e.target.value)}
                                placeholder="e.g. Unit 402, Building A"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Hazard Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Leakage, short circuit, etc..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none"
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-start gap-4 text-amber-700">
                        <ShieldCheck size={24} className="shrink-0" />
                        <p className="text-xs font-bold leading-relaxed">System will find the nearest verified specialist and send your emergency request. Emergency rates (+50%) apply for immediate mobilization.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setStep(1)} className="py-6 rounded-2xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Cancel Request</button>
                        <button
                            onClick={handleEmergencyRequest}
                            disabled={loading || !unit || !description}
                            className="py-6 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : "Dispatch Specialist Now"}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Request Sent Successfully */}
            {step === 3 && (
                <div className="space-y-10 animate-scale-in text-center py-16">
                    <div className="flex justify-center">
                        <div className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40">
                            <Check size={56} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Emergency Request Sent</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                            Request sent to {providerName}. Awaiting their response.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        {bookingId && (
                            <Link
                                href={`/dashboard/bookings/${bookingId}`}
                                className="px-8 py-4 bg-[#064e3b] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-950 transition-all shadow-lg shadow-emerald-900/10"
                            >
                                View Request
                            </Link>
                        )}
                        <Link
                            href="/dashboard"
                            className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            )}

            {/* Step 4: No Expert Available */}
            {step === 4 && (
                <div className="space-y-10 animate-scale-in text-center py-16">
                    <div className="flex justify-center">
                        <div className="w-28 h-28 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-xl">
                            <XCircle size={56} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">No Expert Available</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs max-w-md mx-auto">
                            No verified specialist found for {category} right now. Please select one manually from our expert network.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Link
                            href={`/dashboard/providers?category=${encodeURIComponent(category)}&emergency=true`}
                            className="px-8 py-4 bg-[#064e3b] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-950 transition-all shadow-lg shadow-emerald-900/10 flex items-center gap-2"
                        >
                            <Search size={16} />
                            Find Expert
                        </Link>
                        <button
                            onClick={() => { setStep(1); setError(""); }}
                            className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Try Different Category
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

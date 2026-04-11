"use client";

import { Check, Clock, Play, CheckCircle2, XCircle, Hourglass } from "lucide-react";

const STAGES = [
    { id: "Pending", label: "Requested", icon: Clock },
    { id: "Accepted", label: "Accepted", icon: Check },
    { id: "In Progress", label: "In Progress", icon: Play },
    { id: "Pending Confirmation", label: "Awaiting Confirm", icon: Hourglass },
    { id: "Completed", label: "Completed", icon: CheckCircle2 },
];

interface BookingStatusTimelineProps {
    currentStatus: string;
    history?: any[];
}

export default function BookingStatusTimeline({ currentStatus, history = [] }: BookingStatusTimelineProps) {
    if (currentStatus === "Cancelled") {
        return (
            <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2rem] flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-rose-500 flex items-center justify-center text-white">
                    <XCircle size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-rose-900 uppercase tracking-tight">Booking Cancelled</h3>
                    <p className="text-rose-600 font-bold text-sm mt-1">This service request has been terminated.</p>
                </div>
            </div>
        );
    }

    const currentIdx = STAGES.findIndex(s => s.id === currentStatus);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between relative px-4">
                {/* Connector Line */}
                <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-100 -z-10" />
                <div 
                    className="absolute top-5 left-10 h-0.5 bg-emerald-500 transition-all duration-1000 -z-10" 
                    style={{ width: `${(currentIdx / (STAGES.length - 1)) * 100}%` }}
                />

                {STAGES.map((stage, i) => {
                    const isPassed = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const Icon = stage.icon;

                    return (
                        <div key={stage.id} className="flex flex-col items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 border-2 ${
                                isCurrent 
                                    ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110" 
                                    : isPassed 
                                        ? "bg-slate-900 border-slate-900 text-white" 
                                        : "bg-white border-slate-200 text-slate-300"
                            }`}>
                                <Icon size={18} />
                            </div>
                            <div className="text-center">
                                <p className={`text-[9px] font-black uppercase tracking-widest ${isCurrent ? "text-emerald-500" : isPassed ? "text-slate-900" : "text-slate-300"}`}>
                                    {stage.label}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* History Feed */}
            {history.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</h4>
                    <div className="space-y-4">
                        {history.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((h, i) => (
                            <div key={i} className="flex items-start gap-4">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                                <div>
                                    <p className="text-sm font-black text-slate-900">{h.status}</p>
                                    <p className="text-[11px] font-bold text-slate-500">{h.notes}</p>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase mt-1">{new Date(h.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

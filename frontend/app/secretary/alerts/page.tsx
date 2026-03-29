"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Bell } from "lucide-react";

interface Alert { id: number; title: string; status: string; priority: string; created_at: string; user_id: number; }

const STATUS_STYLE: Record<string, string> = {
    PENDING: "text-amber-700 bg-amber-50",
    IN_PROGRESS: "text-blue-700 bg-blue-50",
    COMPLETED: "text-emerald-700 bg-emerald-50",
    CANCELLED: "text-slate-500 bg-slate-100",
};

export default function SecretaryAlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/secretary/alerts")
            .then((d) => setAlerts(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Alerts</h1>
                <p className="text-slate-500 text-sm mt-1">Maintenance tasks raised by society members.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No alerts</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {alerts.map((a) => (
                            <div key={a.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div>
                                    <p className="font-semibold text-slate-900 text-sm">{a.title}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{new Date(a.created_at).toLocaleDateString()}</p>
                                </div>
                                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wide ${STATUS_STYLE[a.status] ?? "text-slate-500 bg-slate-100"}`}>
                                    {a.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

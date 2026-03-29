"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Wrench, Star, Phone } from "lucide-react";

interface Provider { id: number; company_name: string; category: string; rating: number; availability_status: string; phone: string; }

const AVAIL_STYLE: Record<string, string> = {
    AVAILABLE: "text-emerald-700 bg-emerald-50",
    WORKING: "text-blue-700 bg-blue-50",
    VACATION: "text-slate-500 bg-slate-100",
};

export default function SecretaryProvidersPage() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/secretary/providers")
            .then((d) => setProviders(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trusted Providers</h1>
                <p className="text-slate-500 text-sm mt-1">Service providers trusted by your society.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading ? (
                    <div className="col-span-3 flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : providers.length === 0 ? (
                    <div className="col-span-3 text-center py-16 text-slate-400">
                        <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No trusted providers yet</p>
                    </div>
                ) : providers.map((p) => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <Wrench className="w-5 h-5 text-emerald-700" />
                            </div>
                            <span className={`text-xs font-black px-2 py-1 rounded-full uppercase ${AVAIL_STYLE[p.availability_status] ?? "text-slate-500 bg-slate-100"}`}>
                                {p.availability_status}
                            </span>
                        </div>
                        <p className="font-black text-slate-900 mb-1">{p.company_name}</p>
                        <p className="text-xs text-slate-500 mb-3">{p.category}</p>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" />{p.rating?.toFixed(1)}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone || "—"}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

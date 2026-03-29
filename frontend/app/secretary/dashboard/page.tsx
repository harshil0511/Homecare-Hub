"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getUsername } from "@/lib/auth";
import { Building2, Users, Bell, Wrench } from "lucide-react";
import Link from "next/link";

export default function SecretaryDashboard() {
    const [society, setSociety] = useState<any>(null);
    const [memberCount, setMemberCount] = useState(0);
    const [alertCount, setAlertCount] = useState(0);
    const [providerCount, setProviderCount] = useState(0);
    const username = getUsername();

    useEffect(() => {
        apiFetch("/secretary/society").then(setSociety).catch(() => {});
        apiFetch("/secretary/members").then((d) => setMemberCount(d?.length ?? 0)).catch(() => {});
        apiFetch("/secretary/alerts").then((d) => setAlertCount(d?.length ?? 0)).catch(() => {});
        apiFetch("/secretary/providers").then((d) => setProviderCount(d?.length ?? 0)).catch(() => {});
    }, []);

    const stats = [
        { label: "Society", value: society?.name ?? "—", icon: Building2, href: "/secretary/society", color: "bg-emerald-50 text-emerald-700" },
        { label: "Members", value: memberCount, icon: Users, href: "/secretary/members", color: "bg-blue-50 text-blue-700" },
        { label: "Open Alerts", value: alertCount, icon: Bell, href: "/secretary/alerts", color: "bg-amber-50 text-amber-700" },
        { label: "Trusted Providers", value: providerCount, icon: Wrench, href: "/secretary/providers", color: "bg-purple-50 text-purple-700" },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Secretary Dashboard</h1>
                <p className="text-slate-500 text-sm mt-1">Welcome back, {username}. Here is your society overview.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {stats.map((s) => {
                    const Icon = s.icon;
                    return (
                        <Link key={s.label} href={s.href}
                            className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between hover:shadow-md transition-all group">
                            <div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.color}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

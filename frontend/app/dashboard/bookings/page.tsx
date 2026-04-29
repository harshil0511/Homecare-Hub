"use client";

import Link from "next/link";
import { Home, Wrench, Cpu, ArrowRight, ChevronLeft, Users } from "lucide-react";

const SERVICES = [
    {
        icon: Home,
        iconBg: "bg-emerald-600",
        accentBorder: "border-l-emerald-500",
        label: "Home Maintenance",
        tagline: "Repairs, upkeep & preventive servicing",
        summary:
            "Plumbing, electrical, carpentry, AC servicing, painting and more — all on-demand or scheduled for your residence.",
        href: "/dashboard/home/info",
    },
    {
        icon: Wrench,
        iconBg: "bg-blue-600",
        accentBorder: "border-l-blue-500",
        label: "Household Support",
        tagline: "Cleaning, pest control & day-to-day help",
        summary:
            "Regular household tasks handled by verified professionals — deep cleaning, pest management, move-in packages and more.",
        href: "/dashboard/household/info",
    },
    {
        icon: Cpu,
        iconBg: "bg-violet-600",
        accentBorder: "border-l-violet-500",
        label: "Technical Audit",
        tagline: "Safety inspections & compliance checks",
        summary:
            "Full home safety walkthrough covering electrical panels, gas lines, structural elements and smart devices.",
        href: "/dashboard/technical/info",
    },
];

export default function BookingsPage() {
    return (
        <div className="max-w-4xl mx-auto pb-20 space-y-10">
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors"
            >
                <ChevronLeft size={14} /> Back to Dashboard
            </Link>

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-md">
                    <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Service Domains</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-0.5">
                        Select a domain to learn more & send a request
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                {SERVICES.map((svc) => {
                    const Icon = svc.icon;
                    return (
                        <div
                            key={svc.label}
                            className={`bg-white border border-slate-200 border-l-4 ${svc.accentBorder} rounded-[2rem] p-7 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-12 h-12 ${svc.iconBg} rounded-2xl flex items-center justify-center shadow-md flex-shrink-0`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{svc.label}</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{svc.tagline}</p>
                                        <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed line-clamp-2">{svc.summary}</p>
                                    </div>
                                </div>
                                <Link
                                    href={svc.href}
                                    className="flex-shrink-0 flex items-center gap-2 bg-slate-900 hover:bg-[#064e3b] text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-md group"
                                >
                                    Learn More
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

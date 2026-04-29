"use client";

import Link from "next/link";
import {
    ChevronLeft, Home, Wrench, Zap, Droplets,
    Paintbrush, TreePine, ShieldCheck, Clock,
    CheckCircle2, AlertTriangle, TrendingUp, Calendar,
    Star, ArrowRight
} from "lucide-react";

const WHY_NEEDED = [
    {
        icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50",
        title: "Prevent Costly Breakdowns",
        body: "A minor pipe leak ignored for weeks can damage walls, flooring and electrical wiring. Scheduled maintenance catches issues before they become emergencies — saving 5–10× the repair cost.",
    },
    {
        icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50",
        title: "Protect Property Value",
        body: "Well-maintained homes retain market value. Peeling paint, broken fittings and faulty wiring visibly reduce a property's appeal and resale price.",
    },
    {
        icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50",
        title: "Safety & Compliance",
        body: "Faulty electrical wiring and gas fittings are leading causes of home fires. Regular professional checks keep your home legally compliant and physically safe.",
    },
    {
        icon: Clock, color: "text-violet-600", bg: "bg-violet-50",
        title: "Time & Convenience",
        body: "Booking a verified expert through Homecare Hub takes minutes. No phone-tag with unknown contractors — tracked, rated, and accountable professionals at your door.",
    },
];

const SERVICES = [
    { icon: Droplets,   label: "Plumbing",            examples: "Pipe leaks, tap replacement, drain unblocking, water heater installation" },
    { icon: Zap,        label: "Electrical",           examples: "Fault detection, wiring fixes, MCB/fuse replacement, fan & light installation" },
    { icon: Wrench,     label: "Appliance Repair",     examples: "AC servicing, washing machine, refrigerator, microwave & geyser repair" },
    { icon: Paintbrush, label: "Painting",             examples: "Interior walls, exterior facade, waterproofing paint, texture & polish" },
    { icon: TreePine,   label: "Carpentry",            examples: "Door & window repairs, furniture assembly, cabinet installation, flooring" },
    { icon: ShieldCheck,label: "General Maintenance",  examples: "Annual home health check, handyman tasks, fixture tightening, caulking" },
];

const HOW_TO_USE = [
    { step: "01", title: "Login to Your Account",     desc: "Sign in to your Homecare Hub account to access the service request system." },
    { step: "02", title: "Go to My Requests",         desc: "Navigate to the Requests section from your dashboard sidebar." },
    { step: "03", title: "Describe Your Issue",       desc: "Select the service type, write a brief description and set urgency level." },
    { step: "04", title: "Broadcast to Providers",    desc: "Your request is sent to verified providers in your society's trusted network." },
    { step: "05", title: "Review & Accept an Offer",  desc: "Providers respond with proposed date, price and estimated hours. Accept the best fit." },
    { step: "06", title: "Rate After Completion",     desc: "Leave a star rating — quality, punctuality and professionalism — to help the community." },
];

const FUTURE_FEATURES = [
    { title: "Preventive Maintenance Schedules",  desc: "Set recurring reminders for AC filter changes, plumbing checks, and pest control — Homecare Hub will auto-alert you and broadcast to providers." },
    { title: "Home Health Score",                 desc: "An AI-generated score based on your completed maintenance history, overdue alerts and provider feedback — giving you a live view of your home's condition." },
    { title: "Material Cost Transparency",        desc: "Providers will attach itemised material bills alongside labour charges so residents can audit every line item before confirming payment." },
    { title: "Multi-Unit Coordination",           desc: "Societies will be able to batch maintenance requests across multiple flats — shared discounts and coordinated visits from a single provider." },
];

export default function HomeMaintenanceInfoPage() {
    return (
        <div className="pb-24 space-y-12">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors">
                <ChevronLeft size={14} /> Back to Home
            </Link>

            {/* Hero */}
            <div className="bg-[#064e3b] rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex items-start gap-6">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/20">
                        <Home className="w-8 h-8 text-emerald-300" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-2">Service Domain</p>
                        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-3">Home Maintenance</h1>
                        <p className="text-emerald-200 text-sm font-medium leading-relaxed max-w-xl">
                            Professional, on-demand repair and upkeep services for every part of your home — from a dripping tap to a complete electrical overhaul.
                        </p>
                    </div>
                </div>
            </div>

            {/* Why You Need It */}
            <section className="space-y-5">
                <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">Why You Need It</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Four reasons home maintenance should never be delayed</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {WHY_NEEDED.map((w) => {
                        const Icon = w.icon;
                        return (
                            <div key={w.title} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                                <div className={`w-10 h-10 ${w.bg} rounded-xl flex items-center justify-center mb-4`}>
                                    <Icon className={`w-5 h-5 ${w.color}`} />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">{w.title}</h3>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">{w.body}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* What's Covered */}
            <section className="space-y-5">
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">What's Covered</h2>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {SERVICES.map((s) => {
                        const Icon = s.icon;
                        return (
                            <div key={s.label} className="flex items-start gap-4 p-5 hover:bg-slate-50 transition-colors">
                                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{s.label}</p>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">{s.examples}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* How to Use */}
            <section className="space-y-5">
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">How to Use</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {HOW_TO_USE.map((h) => (
                        <div key={h.step} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex gap-4">
                            <span className="text-2xl font-black text-slate-100 leading-none flex-shrink-0 w-10">{h.step}</span>
                            <div>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1">{h.title}</p>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{h.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Future Features */}
            <section className="space-y-5">
                <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">What's Coming Next</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Upcoming features in this service domain</p>
                </div>
                <div className="space-y-3">
                    {FUTURE_FEATURES.map((f, i) => (
                        <div key={f.title} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex gap-4">
                            <div className="w-7 h-7 bg-[#064e3b] rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                                {String(i + 1).padStart(2, "0")}
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1">{f.title}</p>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { icon: Star,         value: "9 categories", label: "Service types" },
                    { icon: CheckCircle2, value: "Verified",     label: "All providers" },
                    { icon: Calendar,     value: "On-demand",    label: "Booking mode" },
                ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
                        <Icon className="w-5 h-5 text-[#064e3b] mx-auto mb-2" />
                        <p className="text-sm font-black text-slate-900">{value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="bg-[#064e3b] rounded-[2rem] p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <p className="text-white font-black text-lg uppercase tracking-tight">Ready to book?</p>
                    <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">Login to send a request to verified providers</p>
                </div>
                <Link href="/login" className="flex items-center gap-2 bg-white text-[#064e3b] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors shadow-md">
                    Login & Book <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}

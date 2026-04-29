"use client";

import Link from "next/link";
import {
    ChevronLeft, Cpu, Zap, Flame, Building2, Wifi,
    ShieldCheck, Clock, CheckCircle2, TrendingUp,
    AlertTriangle, Star, Calendar, ArrowRight, FileText
} from "lucide-react";

const WHY_NEEDED = [
    {
        icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50",
        title: "Fire & Shock Prevention",
        body: "Overloaded circuits, loose wiring and unchecked gas fittings are the top causes of residential fires in India. An annual electrical and gas audit catches these before they become life-threatening.",
    },
    {
        icon: ShieldCheck, color: "text-violet-600", bg: "bg-violet-50",
        title: "Legal & Insurance Compliance",
        body: "Many home insurance policies require proof of periodic safety inspections. Failing an audit can void a claim after a fire or flood. Documented audits protect your coverage.",
    },
    {
        icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50",
        title: "Energy Efficiency",
        body: "An electrical audit identifies phantom loads, oversized AC units and outdated lighting — changes that typically cut electricity bills by 15–25%.",
    },
    {
        icon: Clock, color: "text-amber-600", bg: "bg-amber-50",
        title: "Pre-Purchase / Handover Protection",
        body: "Before buying or renting a property, a technical audit reveals hidden defects — waterproofing failures, structural cracks, faulty wiring — that aren't visible to the naked eye.",
    },
];

const SERVICES = [
    { icon: Zap,        label: "Electrical Safety Audit",      examples: "Panel inspection, load balancing, earthing check, MCB ratings, meter room safety" },
    { icon: Flame,      label: "Gas Line Inspection",           examples: "Pipe pressure test, regulator check, LPG/PNG fitting safety, leak detection" },
    { icon: Building2,  label: "Structural Assessment",         examples: "Crack mapping, concrete spalling, waterproofing failure, slab health check" },
    { icon: Wifi,       label: "Smart Home & Network Audit",    examples: "Router placement, smart device security review, camera blind spot analysis, cable management" },
    { icon: FileText,   label: "Compliance Report",             examples: "Full written audit report with photo evidence, risk ratings and remediation recommendations" },
    { icon: ShieldCheck,label: "Post-Renovation Safety Check",  examples: "Verify contractor work quality, confirm code compliance after remodelling or new construction" },
];

const HOW_TO_USE = [
    { step: "01", title: "Login to Your Account",   desc: "Sign in to your Homecare Hub account to access the service request system." },
    { step: "02", title: "Select Technical Audit",  desc: "From the Requests section, choose Technical Audit as the service type." },
    { step: "03", title: "Specify Scope",           desc: "Choose which systems to audit — electrical only, full home, or pre-purchase bundle." },
    { step: "04", title: "Provider Assigned",       desc: "A certified technical inspector from your society's trusted network accepts the job." },
    { step: "05", title: "On-site Inspection",      desc: "The expert visits and systematically inspects each system using calibrated tools." },
    { step: "06", title: "Receive Audit Report",    desc: "A detailed written report with findings, risk levels and recommended actions is shared with you." },
];

const FUTURE_FEATURES = [
    { title: "Digital Audit Reports with QR Verification",    desc: "Audit reports will be digitally signed, timestamped and accessible via a QR code — shareable with landlords, insurers or buyers as verified proof." },
    { title: "AI-Assisted Risk Scoring",                      desc: "Uploaded audit photos will be processed by AI to flag structural cracks, corrosion or wiring anomalies, generating an automated risk score." },
    { title: "Scheduled Annual Audit Reminders",              desc: "Homecare Hub will automatically remind you when your last audit was due for renewal — with one-click rebooking." },
    { title: "Society-Wide Infrastructure Health Dashboard",  desc: "Secretaries will be able to view aggregated audit data across all society units — identifying common infrastructure failures." },
];

export default function TechnicalAuditInfoPage() {
    return (
        <div className="pb-24 space-y-12">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors">
                <ChevronLeft size={14} /> Back to Home
            </Link>

            {/* Hero */}
            <div className="bg-violet-700 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex items-start gap-6">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/20">
                        <Cpu className="w-8 h-8 text-violet-200" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-violet-300 uppercase tracking-[0.4em] mb-2">Service Domain</p>
                        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-3">Technical Audit</h1>
                        <p className="text-violet-100 text-sm font-medium leading-relaxed max-w-xl">
                            Comprehensive safety and compliance inspections of your home's critical systems — electrical, gas, structural and smart infrastructure — by certified experts.
                        </p>
                    </div>
                </div>
            </div>

            {/* Why You Need It */}
            <section className="space-y-5">
                <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">Why You Need It</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Four reasons technical audits are non-negotiable</p>
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
                                <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-violet-600" />
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
                            <div className="w-7 h-7 bg-violet-700 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
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
                    { icon: Star,         value: "Certified",  label: "Inspectors only" },
                    { icon: CheckCircle2, value: "Written",    label: "Audit report" },
                    { icon: Calendar,     value: "Annual",     label: "Recommended cycle" },
                ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
                        <Icon className="w-5 h-5 text-violet-700 mx-auto mb-2" />
                        <p className="text-sm font-black text-slate-900">{value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="bg-violet-700 rounded-[2rem] p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <p className="text-white font-black text-lg uppercase tracking-tight">Ready to book?</p>
                    <p className="text-violet-200 text-[10px] font-bold uppercase tracking-widest mt-0.5">Login to send a request to certified inspectors</p>
                </div>
                <Link href="/login" className="flex items-center gap-2 bg-white text-violet-700 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-50 transition-colors shadow-md">
                    Login & Book <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}

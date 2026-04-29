"use client";

import Link from "next/link";
import {
    ChevronLeft, Wrench, Bug, Wind, Shirt,
    ShieldCheck, Clock, CheckCircle2, TrendingUp,
    AlertTriangle, Star, Calendar, ArrowRight, Sparkles
} from "lucide-react";

const WHY_NEEDED = [
    {
        icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-50",
        title: "Health & Hygiene",
        body: "Dust mites, mould and pest infestations are major triggers for allergies and respiratory illness. Professional deep-cleaning eliminates what regular sweeping misses.",
    },
    {
        icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50",
        title: "Time Savings",
        body: "An average household spends 6–8 hours per week on cleaning and upkeep. Delegating to a scheduled professional frees up that time entirely.",
    },
    {
        icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50",
        title: "Pest Prevention",
        body: "Unchecked cockroach or rodent infestations can damage wiring, contaminate food supplies and spread disease. Quarterly pest control prevents colonies from establishing.",
    },
    {
        icon: Clock, color: "text-violet-600", bg: "bg-violet-50",
        title: "Stress-Free Living",
        body: "A clean, well-maintained home reduces daily stress. Knowing professional help is one booking away gives residents peace of mind.",
    },
];

const SERVICES = [
    { icon: Sparkles, label: "Deep Home Cleaning",   examples: "Kitchen scrubbing, bathroom sanitisation, sofa & carpet vacuuming, window cleaning" },
    { icon: Bug,      label: "Pest Control",          examples: "Cockroaches, ants, bedbugs, rodents, termites — gel treatment or spray-based" },
    { icon: Wind,     label: "Air Quality Services",  examples: "AC duct cleaning, exhaust fan servicing, ventilation checks" },
    { icon: Shirt,    label: "Laundry Support",       examples: "Linen washing & pressing, curtain dry-clean coordination, mattress cleaning" },
    { icon: Wrench,   label: "Sanitisation",          examples: "Post-illness deep sanitise, move-in/move-out disinfection, surface anti-bacterial treatment" },
    { icon: ShieldCheck, label: "Routine Upkeep",    examples: "Garbage management coordination, storage organisation, minor household odd-jobs" },
];

const HOW_TO_USE = [
    { step: "01", title: "Login to Your Account",    desc: "Sign in to your Homecare Hub account to access the service request system." },
    { step: "02", title: "Pick a Service Category",  desc: "Choose from cleaning, pest control, laundry support or any other household service." },
    { step: "03", title: "Set Frequency",            desc: "One-time visit or recurring schedule — weekly, fortnightly or monthly." },
    { step: "04", title: "Request Sent to Network",  desc: "Providers verified by your society receive your request immediately." },
    { step: "05", title: "Accept a Provider Offer",  desc: "Review proposed dates, prices and provider ratings before accepting." },
    { step: "06", title: "Ongoing Reminders",        desc: "Homecare Hub sends you automatic alerts when your next scheduled clean is due." },
];

const FUTURE_FEATURES = [
    { title: "Subscription Cleaning Packages",   desc: "Monthly flat-rate packages with a dedicated cleaning professional assigned to your unit — no need to rebook every time." },
    { title: "Before & After Photo Verification",desc: "Providers will attach before/after photos on job completion so residents can verify quality without being home." },
    { title: "Eco-Friendly Service Filter",       desc: "A filter to choose providers who use biodegradable cleaning products and eco-certified pest control methods." },
    { title: "Society-Wide Group Bookings",       desc: "Coordinate a building-wide cleaning or pest control session — bulk pricing, single scheduling window, minimal disruption." },
];

export default function HouseholdSupportInfoPage() {
    return (
        <div className="pb-24 space-y-12">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors">
                <ChevronLeft size={14} /> Back to Home
            </Link>

            {/* Hero */}
            <div className="bg-blue-700 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex items-start gap-6">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/20">
                        <Wrench className="w-8 h-8 text-blue-200" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-300 uppercase tracking-[0.4em] mb-2">Service Domain</p>
                        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-3">Household Support</h1>
                        <p className="text-blue-100 text-sm font-medium leading-relaxed max-w-xl">
                            Day-to-day home management handled by verified professionals — from a single deep-clean to full recurring upkeep of your living space.
                        </p>
                    </div>
                </div>
            </div>

            {/* Why You Need It */}
            <section className="space-y-5">
                <div>
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">Why You Need It</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Four reasons household support matters every month</p>
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
                                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-blue-600" />
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
                            <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
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
                    { icon: Star,         value: "6 categories", label: "Service types" },
                    { icon: CheckCircle2, value: "Recurring",    label: "Booking option" },
                    { icon: Calendar,     value: "On-demand",    label: "Booking mode" },
                ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
                        <Icon className="w-5 h-5 text-blue-700 mx-auto mb-2" />
                        <p className="text-sm font-black text-slate-900">{value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="bg-blue-700 rounded-[2rem] p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <p className="text-white font-black text-lg uppercase tracking-tight">Ready to book?</p>
                    <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mt-0.5">Login to send a request to verified providers</p>
                </div>
                <Link href="/login" className="flex items-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-colors shadow-md">
                    Login & Book <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}

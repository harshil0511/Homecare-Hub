"use client";

import Link from "next/link";
import {
  Hammer,
  Users,
  Wrench,
  ArrowRight,
  ShieldCheck,
  CalendarCheck,
  Star,
  CheckCircle,
  Phone,
  Handshake,
  Building2
} from "lucide-react";

export default function HomecareLandingPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-emerald-600/10">
      {/* Navbar section */}
      <nav className="h-20 border-b border-slate-200/60 flex items-center justify-between px-6 md:px-16 sticky top-0 bg-white/70 backdrop-blur-xl z-[100] shadow-sm">
        <div className="flex items-center space-x-3 group cursor-pointer">
          <div className="w-10 h-10 bg-[#064e3b] rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-900/20 group-hover:scale-105 transition-transform">
            <Wrench size={24} />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-slate-800">Homecare<span className="text-emerald-700">Hub</span></span>
        </div>

        <div className="hidden md:flex items-center space-x-10 text-sm font-bold text-slate-500">
          <Link href="#services" className="hover:text-emerald-700 transition-colors relative group">
            Services
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-700 transition-all group-hover:w-full"></span>
          </Link>
          <Link href="#societies" className="hover:text-emerald-700 transition-colors relative group">
            Societies
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-700 transition-all group-hover:w-full"></span>
          </Link>
          <Link href="#contact" className="hover:text-emerald-700 transition-colors relative group">
            Support
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-700 transition-all group-hover:w-full"></span>
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/login" className="hidden sm:block px-5 py-2 text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors">
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-2.5 bg-[#064e3b] hover:bg-emerald-950 text-white text-sm font-bold rounded-full transition-all shadow-md hover:shadow-emerald-900/30 hover:-translate-y-0.5 active:scale-95"
          >
            Join the Hub
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-6 overflow-hidden bg-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-40">
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-emerald-100 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[10%] left-[-5%] w-[35%] h-[35%] bg-teal-100 rounded-full blur-[90px]"></div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold mb-8 border border-emerald-100/50 uppercase tracking-widest">
              <ShieldCheck size={14} className="animate-pulse" />
              <span>Verified Home Service Network</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 text-slate-900 leading-[1.05]">
              Expert Support, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-500">
                For Every Corner of Home.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-xl leading-relaxed font-medium">
              From expert plumbing and electrical work to daily household help and specialized maintenance. We connect you with certified pros in your society.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <Link
                href="/login"
                className="w-full sm:w-auto px-10 py-4.5 bg-[#064e3b] hover:bg-emerald-950 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-emerald-900/25 flex items-center justify-center space-x-3 group hover:-translate-y-1 active:scale-95"
              >
                <span>Book a Pro</span>
                <ArrowRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
              </Link>
              <Link
                href="/register?role=servicer"
                className="w-full sm:w-auto px-10 py-4.5 bg-white border-2 border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 rounded-2xl font-bold text-lg transition-all flex items-center justify-center space-x-2 hover:-translate-y-1 active:scale-95"
              >
                <Handshake size={20} />
                <span>Join as Provider</span>
              </Link>
            </div>

            <div className="mt-12 flex items-center space-x-6">
              <div className="flex -space-x-3">
                {[
                  { initials: "AK", bg: "bg-emerald-700" },
                  { initials: "SR", bg: "bg-teal-600" },
                  { initials: "MJ", bg: "bg-emerald-500" },
                  { initials: "PD", bg: "bg-emerald-800" },
                  { initials: "LN", bg: "bg-teal-700" },
                ].map((u, i) => (
                  <div key={i} className={`w-11 h-11 rounded-full border-4 border-white ${u.bg} flex items-center justify-center shadow-sm`}>
                    <span className="text-white text-[10px] font-black">{u.initials}</span>
                  </div>
                ))}
              </div>
              <div className="text-sm font-bold text-slate-500">
                <div className="flex text-amber-400 gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <span>4.9/5 from 10k+ local services</span>
              </div>
            </div>
          </div>

          <div className="relative animate-in fade-in zoom-in-95 duration-1000">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-[3.5rem] blur-3xl translate-x-10 translate-y-10"></div>
            <div className="relative aspect-square w-full max-w-[540px] mx-auto group">
              <div className="absolute inset-0 bg-slate-200 rounded-[3.5rem] overflow-hidden shadow-2xl border-8 border-white">
                <img
                  src="/hero-maintenance.png"
                  alt="Homecare Hub Maintenance Services"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>

              {/* Floating Info Card */}
              <div className="absolute top-12 -right-10 hidden md:block glass bg-white/80 backdrop-blur-lg border border-white/50 p-5 rounded-3xl shadow-2xl w-56 animate-in slide-in-from-right-10 duration-1000 delay-300">
                <div className="flex items-center space-x-4 mb-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center">
                    <Wrench size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-tight">Expert Techs</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Certified</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">Every professional is background checked and skill-verified.</p>
              </div>

              {/* Tech Card */}
              <div className="absolute -bottom-6 -left-10 hidden md:block glass bg-white/80 backdrop-blur-lg border border-white/50 p-5 rounded-3xl shadow-2xl w-52 animate-in slide-in-from-left-10 duration-1000 delay-500">
                <div className="flex items-center space-x-4 mb-3">
                  <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-tight">Safe Solutions</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Verified IDs</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full border-2 border-white bg-green-100 flex items-center justify-center text-[10px] font-bold text-green-700">✓</div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600">ID Verification Complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 px-6 bg-[#f8fafc] relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 text-slate-900">Total Maintenance <br /> For Your Society</h2>
              <p className="text-slate-500 text-lg font-medium">From electrical repairs to daily household support, our hub connects you with the most trusted professionals in your community.</p>
            </div>
            <Link href="/dashboard/maintenance" className="inline-flex items-center space-x-2 font-bold text-emerald-700 hover:translate-x-1 transition-transform">
              <span>All Services</span>
              <ArrowRight size={20} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Wrench,
                title: "Home Maintenance",
                desc: "Certified electricians, plumbers, and carpenters ready to handle any repair or installation at home.",
                color: "text-emerald-700",
                bg: "bg-emerald-50/50",
                accent: "border-emerald-100"
              },
              {
                icon: CheckCircle,
                title: "Household Support",
                desc: "Daily help with cleaning, garden care, and deep maintenance to keep your home in perfect condition.",
                color: "text-teal-700",
                bg: "bg-teal-50/50",
                accent: "border-teal-100"
              },
              {
                icon: ShieldCheck,
                title: "Technical Audits",
                desc: "Regular safety checks for gas, electrical systems, and security to ensure a safe living environment.",
                color: "text-emerald-800",
                bg: "bg-emerald-50/50",
                accent: "border-emerald-200"
              }
            ].map((service, i) => (
              <div key={i} className={`bg-white border ${service.accent} p-12 rounded-[3.5rem] shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-emerald-900/10 transition-all group hover:-translate-y-2 duration-500 overflow-hidden relative`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
                <div className={`w-20 h-20 ${service.bg} ${service.color} rounded-[2rem] flex items-center justify-center mb-10 group-hover:rotate-6 transition-all duration-500 relative z-10`}>
                  <service.icon size={36} strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black mb-4 tracking-tight text-slate-900 relative z-10">{service.title}</h3>
                <p className="text-slate-500 font-bold mb-10 text-sm leading-relaxed relative z-10">{service.desc}</p>
                <Link href="/dashboard/bookings" className={`inline-flex items-center space-x-2 font-black ${service.color} group/btn relative z-10`}>
                  <span>Request Service</span>
                  <ArrowRight size={18} className="group-hover/btn:translate-x-1.5 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Society / Community Features */}
      <section id="societies" className="py-28 px-6 bg-white relative">
        <div className="max-w-7xl mx-auto bg-slate-900 text-white rounded-[3rem] md:rounded-[4rem] p-8 md:p-24 overflow-hidden relative shadow-2xl">
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center space-x-2 bg-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-white/10 mx-auto">
                <Building2 size={12} className="text-emerald-400" />
                <span>Exclusive Feature</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-[1.1]">
                Create Your own <br />
                <span className="text-emerald-400">Society Group.</span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl font-medium mb-12 leading-relaxed max-w-2xl mx-auto">
                Manage your building support network. Appoint secretaries, verify legal status, and ensure every neighbor has access to trusted home care.
              </p>
              <div className="flex flex-wrap justify-center gap-8 mb-12">
                <div className="flex items-center space-x-3">
                  <CheckCircle size={24} className="text-emerald-400" />
                  <span className="font-bold text-slate-200 text-sm md:text-base">Legal Verification</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle size={24} className="text-emerald-400" />
                  <span className="font-bold text-slate-200 text-sm md:text-base">Secretary Admin</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle size={24} className="text-emerald-400" />
                  <span className="font-bold text-slate-200 text-sm md:text-base">Member Priority</span>
                </div>
              </div>
              <Link
                href="/dashboard/societies"
                className="inline-flex items-center space-x-3 bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-5 rounded-3xl font-black text-lg transition-all shadow-xl shadow-emerald-500/20 hover:-translate-y-1 active:scale-95"
              >
                <span>Start a Society</span>
                <ArrowRight size={22} />
              </Link>
            </div>
          </div>
        </div>
      </section>      {/* CTA Section */}
      <section className="py-32 px-6 bg-white text-center">
        <div className="max-w-5xl mx-auto bg-slate-50 border border-slate-200 p-12 md:p-24 rounded-[4rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-teal-400/5 pointer-events-none group-hover:scale-105 transition-transform duration-1000"></div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-700 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-lg">
              <Handshake size={40} />
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-8 text-slate-900 tracking-tight leading-[1.1]">Join the local home <br /> support revolution.</h2>
            <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto font-medium">Whether you are looking for assistance or providing it, Homecare Hub is your verified neighborhood partner.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <Link
                href="/register"
                className="w-full sm:w-auto px-12 py-5 bg-[#064e3b] hover:bg-emerald-950 text-white rounded-2xl font-black text-xl transition-all shadow-2xl shadow-emerald-900/30 hover:-translate-y-1 active:scale-95"
              >
                <span>Get Started Now</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto text-slate-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 border-b border-slate-100 pb-20">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-3 mb-8">
                <div className="w-8 h-8 bg-[#064e3b] rounded-lg flex items-center justify-center text-white">
                  <Handshake size={18} />
                </div>
                <span className="font-extrabold text-xl tracking-tight text-slate-800">Homecare<span className="text-emerald-700">Hub</span></span>
              </div>
              <p className="text-sm font-medium leading-relaxed">The neighborhood hub for verified home services and community support.</p>
            </div>

            <div>
              <h4 className="font-black text-slate-900 mb-8 uppercase tracking-widest text-[10px]">Ecosystem</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><Link href="#services" className="hover:text-emerald-700 transition-colors">Services</Link></li>
                <li><Link href="#societies" className="hover:text-emerald-700 transition-colors">Societies</Link></li>
                <li><Link href="/register?role=servicer" className="hover:text-emerald-700 transition-colors">Become a Provider</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-slate-900 mb-8 uppercase tracking-widest text-[10px]">Governance</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><Link href="#" className="hover:text-emerald-700 transition-colors">Terms of Protocol</Link></li>
                <li><Link href="#" className="hover:text-emerald-700 transition-colors">Data Privacy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-slate-900 mb-8 uppercase tracking-widest text-[10px]">Newsletter</h4>
              <p className="text-xs font-bold mb-4">Subscribe for hub updates</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Email" className="bg-slate-100 border-none rounded-lg px-4 py-2 text-xs w-full focus:ring-2 focus:ring-emerald-600" />
                <button className="bg-[#064e3b] text-white rounded-lg px-4 py-2 text-xs font-bold">Join</button>
              </div>
            </div>
          </div>

          <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">© 2026 Homecare Hub. All rights reserved.</p>
            <div className="flex items-center space-x-8">
              <Link href="#" className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-700 transition-all"><Phone size={18} /></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


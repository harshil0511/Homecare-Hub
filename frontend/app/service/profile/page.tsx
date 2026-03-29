"use client";

import { useState, useEffect } from "react";
import { User, Briefcase, DollarSign, Clock, ShieldCheck, Upload, Save, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ServicerProfilePage() {
    const [profile, setProfile] = useState({
        company_name: "",
        owner_name: "",
        category: "Nursing",
        phone: "",
        email: "",
        hourly_rate: 0,
        availability: "Mon, Tue, Wed, Thu, Fri",
        qualification: "",
        certification_url: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await apiFetch("/user/me");
                if (data.provider_profile) {
                    setProfile(data.provider_profile);
                } else {
                    setProfile(prev => ({ ...prev, owner_name: data.username, email: data.email }));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSuccess(false);
        try {
            await apiFetch("/service/provider", {
                method: "POST",
                body: JSON.stringify(profile)
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            alert("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-[#000000] font-black uppercase tracking-widest animate-pulse">Loading Manifest...</div>;

    const categories = ["Nursing", "Physiotherapy", "Elderly Care", "Electrician", "Plumber", "HVAC Technician", "General Maintenance"];

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-[#000000] tracking-tighter uppercase">Provider Profile</h1>
                    <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-2">Credentials & Operational Parameters</p>
                </div>
                {success && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-200 animate-in fade-in zoom-in">
                        <CheckCircle2 size={14} />
                        Profile Synchronized
                    </div>
                )}
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Identity Block */}
                <div className="bg-white border border-slate-200 rounded-[3rem] p-10 space-y-8 shadow-sm">
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                        <div className="w-12 h-12 bg-emerald-50 text-[#064e3b] rounded-2xl flex items-center justify-center border border-emerald-50">
                            <User size={24} />
                        </div>
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-widest">Identity Manifest</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Company / Brand Name</label>
                            <input 
                                required 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all"
                                value={profile.company_name}
                                onChange={e => setProfile({...profile, company_name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Legal Owner Name</label>
                            <input 
                                required 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all"
                                value={profile.owner_name}
                                onChange={e => setProfile({...profile, owner_name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Operational Contact (Phone)</label>
                            <input 
                                required 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all"
                                value={profile.phone}
                                onChange={e => setProfile({...profile, phone: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Email</label>
                            <input 
                                required 
                                type="email"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all"
                                value={profile.email}
                                onChange={e => setProfile({...profile, email: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* Service Specs Block */}
                <div className="bg-white border border-slate-200 rounded-[3rem] p-10 space-y-8 shadow-sm">
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
                            <Briefcase size={24} />
                        </div>
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-widest">Service Specifications</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Specialty Category</label>
                            <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all appearance-none"
                                value={profile.category}
                                onChange={e => setProfile({...profile, category: e.target.value})}
                            >
                                {categories.map(c => <option key={c} value={c} className="bg-white text-[#000000]">{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hourly Yield (Rate in $)</label>
                            <div className="relative">
                                <DollarSign size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="number"
                                    required 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all"
                                    value={profile.hourly_rate}
                                    onChange={e => setProfile({...profile, hourly_rate: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Deployment Availability</label>
                            <div className="relative">
                                <Clock size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    required 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="e.g. Mon-Fri, 9am-5pm"
                                    value={profile.availability}
                                    onChange={e => setProfile({...profile, availability: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Credentials & Verification Block */}
                <div className="bg-white border border-slate-200 rounded-[3rem] p-10 space-y-8 shadow-sm">
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100">
                            <ShieldCheck size={24} />
                        </div>
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-widest">Verification & Credentials</h2>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qualification Degree / Certificate Title</label>
                            <input 
                                required 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all"
                                placeholder={profile.category.includes('Tech') || profile.category === 'Electrician' ? "e.g. Electrician Degree / Vocational Cert" : "e.g. Bachelor of Science in Nursing"}
                                value={profile.qualification}
                                onChange={e => setProfile({...profile, qualification: e.target.value})}
                            />
                        </div>
                        
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-4 group hover:border-emerald-500 transition-all cursor-pointer">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors">
                                <Upload size={32} />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-[#000000] uppercase tracking-tight">Upload Certification Manifest</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">PDF, JPG or PNG (MAX 5MB)</p>
                            </div>
                            <input type="file" className="hidden" />
                        </div>
                        
                        <div className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                            Pending Verification by Society Board
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-6 pt-6">
                    <button type="button" className="px-10 py-5 text-sm font-black text-slate-500 tracking-widest uppercase hover:text-[#000000] transition-colors">Abort Changes</button>
                    <button 
                        type="submit" 
                        disabled={saving}
                        className="bg-[#064e3b] hover:bg-emerald-600 disabled:opacity-50 text-white font-black px-12 py-5 rounded-3xl transition-all shadow-2xl shadow-emerald-600/30 flex items-center gap-3 uppercase tracking-widest text-sm active:scale-95"
                    >
                        {saving ? "Syncing..." : <><Save size={18} /> Commit Manifest</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { User, Shield, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

export default function AdminProfilePage() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        apiFetch("/user/me")
            .then((data) => {
                setUsername(data.username);
                setEmail(data.email);
                setRole(data.role);
            })
            .catch(() => {});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess(false);
        try {
            await apiFetch("/user/me", {
                method: "PATCH",
                body: JSON.stringify({ username }),
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                        <User className="w-5 h-5 text-purple-700" />
                    </div>
                    <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Admin Profile</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {success && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl flex items-center shadow-md shadow-emerald-900/5">
                            <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Profile Updated Successfully</span>
                        </div>
                    )}
                    {error && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-center">
                            <AlertCircle className="w-5 h-5 mr-3 text-rose-600" />
                            <span className="text-[11px] font-black uppercase tracking-widest">{error}</span>
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Display Name</label>
                        <div className="relative group">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                            <input
                                required
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01]"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 opacity-80">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Email Address</label>
                        <div className="relative">
                            <Shield className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                className="w-full bg-slate-100 border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-slate-500 cursor-not-allowed font-black tracking-tight"
                                value={email}
                                readOnly
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Role</label>
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-purple-50 text-purple-700 border-purple-200">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {role || "ADMIN"}
                        </span>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-950/10 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em] text-xs"
                        >
                            {loading ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

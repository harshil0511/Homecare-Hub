"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

function validatePassword(pw: string) {
    return {
        length: pw.length >= 6,
        uppercase: /[A-Z]/.test(pw),
        special: /[@#$!%*?&]/.test(pw),
    };
}

export default function ServicerPasswordPage() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const pwValidation = validatePassword(newPassword);
    const pwAllValid = pwValidation.length && pwValidation.uppercase && pwValidation.special && newPassword === confirmPassword && currentPassword.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pwAllValid) return;
        setLoading(true);
        setError("");
        setSuccess(false);
        try {
            await apiFetch("/user/me/change-password", {
                method: "POST",
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            });
            setSuccess(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to change password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                        <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Change Password</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {success && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl flex items-center shadow-md shadow-emerald-900/5">
                            <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Password Changed Successfully</span>
                        </div>
                    )}
                    {error && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-center">
                            <AlertCircle className="w-5 h-5 mr-3 text-rose-600" />
                            <span className="text-[11px] font-black uppercase tracking-widest">{error}</span>
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Current Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                            <input type={showCurrentPw ? "text" : "password"}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-14 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight"
                                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                            <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">New Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                            <input type={showNewPw ? "text" : "password"}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-14 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight"
                                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
                            <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {newPassword.length > 0 && (
                            <div className="flex flex-wrap gap-3 px-1 pt-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${pwValidation.length ? "text-emerald-600" : "text-slate-400"}`}>
                                    {pwValidation.length ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} 6+ chars
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${pwValidation.uppercase ? "text-emerald-600" : "text-slate-400"}`}>
                                    {pwValidation.uppercase ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} 1 uppercase
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${pwValidation.special ? "text-emerald-600" : "text-slate-400"}`}>
                                    {pwValidation.special ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} 1 special
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Confirm New Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                            <input type={showConfirmPw ? "text" : "password"}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-14 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight"
                                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                            <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {confirmPassword.length > 0 && (
                            <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 px-1 ${newPassword === confirmPassword ? "text-emerald-600" : "text-rose-500"}`}>
                                {newPassword === confirmPassword ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                {newPassword === confirmPassword ? "Passwords match" : "Passwords do not match"}
                            </span>
                        )}
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={!pwAllValid || loading}
                            className="w-full bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-950/10 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em] text-xs">
                            {loading ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

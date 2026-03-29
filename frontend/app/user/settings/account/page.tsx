"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { logout } from "@/lib/auth";
import { ShieldCheck, LogOut, AlertTriangle, Copy, Check } from "lucide-react";

export default function AccountPage() {
    const [isActive, setIsActive] = useState(true);
    const [userUuid, setUserUuid] = useState("");
    const [copied, setCopied] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const data = await apiFetch("/user/me");
                setIsActive(data.is_active);
                setUserUuid(data.user_uuid);
            } catch (err) {
                console.error("Failed to load account info");
            }
        };
        fetchUser();
    }, []);

    const copyUuid = () => {
        navigator.clipboard.writeText(userUuid);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-2xl mx-auto animate-fade-in py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200">
                        <ShieldCheck className="w-5 h-5 text-slate-600" />
                    </div>
                    <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Account & Security</h2>
                </div>

                <div className="space-y-5 mb-8">
                    <div className="flex items-center justify-between py-3 px-2 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Account Status</span>
                        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                            {isActive ? "Active" : "Inactive"}
                        </span>
                    </div>

                    <div className="flex items-center justify-between py-3 px-2 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Member ID</span>
                        <button onClick={copyUuid} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#064e3b] transition-colors">
                            <span className="font-mono">{userUuid ? `${userUuid.slice(0, 8)}...${userUuid.slice(-4)}` : "---"}</span>
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => logout()}
                    className="w-full border-2 border-[#064e3b] text-[#064e3b] hover:bg-[#064e3b] hover:text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>

                <div className="mt-8 pt-8 border-t-2 border-dashed border-rose-200">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Danger Zone</span>
                    </div>
                    <button
                        onClick={() => setShowDeactivateModal(true)}
                        className="w-full border border-rose-200 text-rose-600 hover:bg-rose-50 font-black py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs"
                    >
                        Deactivate Account
                    </button>
                </div>
            </div>

            {/* Deactivate Modal */}
            {showDeactivateModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md" onClick={() => setShowDeactivateModal(false)}>
                    <div className="bg-white border border-slate-200 rounded-3xl p-10 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-rose-50 rounded-xl">
                                <AlertTriangle className="w-6 h-6 text-rose-500" />
                            </div>
                            <h3 className="text-lg font-black text-[#000000] uppercase tracking-tight">Deactivate Account</h3>
                        </div>
                        <p className="text-slate-600 text-sm font-medium leading-relaxed mb-8">
                            To deactivate your account, please contact your society administrator. Account deactivation will revoke access to all services, bookings, and maintenance records.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeactivateModal(false)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-[#000000] font-black py-4 rounded-2xl transition-all uppercase tracking-[0.2em] text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { setShowDeactivateModal(false); logout(); }}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-[0.2em] text-xs"
                            >
                                Sign Out Instead
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { logout } from "@/lib/auth";
import { Building2, LogOut, Copy, Check } from "lucide-react";

export default function SecretaryAccountPage() {
    const [userUuid, setUserUuid] = useState("");
    const [email, setEmail] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        apiFetch("/user/me")
            .then((data) => {
                setUserUuid(data.user_uuid);
                setEmail(data.email);
            })
            .catch(() => {});
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
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                        <Building2 className="w-5 h-5 text-amber-700" />
                    </div>
                    <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Secretary Account</h2>
                </div>

                <div className="space-y-5 mb-8">
                    <div className="flex items-center justify-between py-3 px-2 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Role</span>
                        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-700">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Secretary
                        </span>
                    </div>
                    <div className="flex items-center justify-between py-3 px-2 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Email</span>
                        <span className="text-xs font-bold text-slate-500">{email || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 px-2 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Account ID</span>
                        <button onClick={copyUuid} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#064e3b] transition-colors">
                            <span className="font-mono">{userUuid ? `${userUuid.slice(0, 8)}...${userUuid.slice(-4)}` : "---"}</span>
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-3 px-2 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Account Status</span>
                        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Active
                        </span>
                    </div>
                </div>

                <button onClick={() => logout()}
                    className="w-full border-2 border-[#064e3b] text-[#064e3b] hover:bg-[#064e3b] hover:text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { CreditCard, Building2, Hash, MapPin, CheckCircle2, AlertCircle, Pencil } from "lucide-react";

interface PaymentProfile {
    id: string;
    account_holder_name: string;
    account_number_masked: string;
    ifsc_code: string;
    branch: string;
    created_at: string;
    updated_at: string;
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const UPI_RE = /^[\w.\-]+@[\w.\-]+$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const HOLDER_NAME_RE = /^[a-zA-Z\s]{3,100}$/;

export default function UserPaymentPage() {
    const [profile, setProfile] = useState<PaymentProfile | null>(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [ifscError, setIfscError] = useState("");
    const [confirmError, setConfirmError] = useState("");
    const [nameError, setNameError] = useState("");
    const [accountError, setAccountError] = useState("");

    const [name, setName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [confirmAccount, setConfirmAccount] = useState("");
    const [ifsc, setIfsc] = useState("");
    const [branch, setBranch] = useState("");

    useEffect(() => {
        apiFetch("/payment/user")
            .then((data) => {
                setProfile(data);
            })
            .catch(() => {
                setEditing(true);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIfscError("");
        setConfirmError("");
        setNameError("");
        setAccountError("");
        if (!HOLDER_NAME_RE.test(name.trim())) {
            setNameError("Account holder name must contain only letters (min 3 characters)");
            return;
        }
        if (!ACCOUNT_RE.test(accountNumber)) {
            setAccountError("Account number must be 9–18 digits");
            return;
        }
        if (accountNumber !== confirmAccount) {
            setConfirmError("Account numbers do not match");
            return;
        }
        if (!IFSC_RE.test(ifsc)) {
            setIfscError("Invalid IFSC code format");
            return;
        }
        setLoading(true);
        setError("");
        setSuccess(false);
        try {
            const data = await apiFetch("/payment/user", {
                method: "POST",
                body: JSON.stringify({
                    account_holder_name: name,
                    account_number: accountNumber,
                    ifsc_code: ifsc.toUpperCase(),
                    branch,
                }),
            });
            setProfile(data);
            setEditing(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError((err as Error).message || "Failed to save payment details");
        } finally {
            setLoading(false);
        }
    };

    const startEdit = () => {
        if (profile) {
            setName(profile.account_holder_name);
            setIfsc(profile.ifsc_code);
            setBranch(profile.branch);
        }
        setAccountNumber("");
        setConfirmAccount("");
        setIfscError("");
        setConfirmError("");
        setNameError("");
        setAccountError("");
        setError("");
        setEditing(true);
    };

    return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                            <CreditCard className="w-5 h-5 text-[#064e3b]" />
                        </div>
                        <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Payment Details</h2>
                    </div>
                    {profile && !editing && (
                        <button
                            onClick={startEdit}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#064e3b] bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                        </button>
                    )}
                </div>

                {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl flex items-center mb-6 shadow-md shadow-emerald-900/5">
                        <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Payment Details Saved</span>
                    </div>
                )}

                {!editing && profile ? (
                    <div className="space-y-4">
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Account Holder</span>
                                <span className="text-sm font-black text-slate-900">{profile.account_holder_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Account Number</span>
                                <span className="text-sm font-mono font-black text-slate-900">{profile.account_number_masked}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">IFSC Code</span>
                                <span className="text-sm font-mono font-black text-slate-900">{profile.ifsc_code}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Branch</span>
                                <span className="text-sm font-black text-slate-900">{profile.branch}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center font-medium">
                            Your bank details are encrypted and stored securely.
                        </p>
                    </div>
                ) : editing ? (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-center">
                                <AlertCircle className="w-5 h-5 mr-3 text-rose-600" />
                                <span className="text-[11px] font-black uppercase tracking-widest">{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Account Holder Name</label>
                            <div className="relative group">
                                <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input
                                    required
                                    className={`w-full bg-slate-50 border rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01] ${nameError ? "border-rose-300" : "border-slate-100"}`}
                                    placeholder="Full name as on bank account"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Account Number</label>
                            <div className="relative group">
                                <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input
                                    required
                                    type="password"
                                    className={`w-full bg-slate-50 border rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01] ${accountError ? "border-rose-300" : "border-slate-100"}`}
                                    placeholder="9–18 digits"
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                />
                            </div>
                            {accountError && <p className="text-red-500 text-xs mt-1">{accountError}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Confirm Account Number</label>
                            <div className="relative group">
                                <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input
                                    required
                                    type="password"
                                    className={`w-full bg-slate-50 border rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01] ${confirmError ? "border-rose-300" : "border-slate-100"}`}
                                    placeholder="Re-enter account number"
                                    value={confirmAccount}
                                    onChange={(e) => setConfirmAccount(e.target.value)}
                                />
                            </div>
                            {confirmError && <p className="text-[10px] text-rose-600 font-bold ml-1">{confirmError}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">IFSC Code</label>
                            <div className="relative group">
                                <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input
                                    required
                                    className={`w-full bg-slate-50 border rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight uppercase shadow-inner shadow-black/[0.01] ${ifscError ? "border-rose-300" : "border-slate-100"}`}
                                    placeholder="e.g. HDFC0001234"
                                    value={ifsc}
                                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                                    onBlur={() => {
                                        if (ifsc && !IFSC_RE.test(ifsc)) setIfscError("Invalid IFSC code format");
                                        else setIfscError("");
                                    }}
                                />
                            </div>
                            {ifscError && <p className="text-[10px] text-rose-600 font-bold ml-1">{ifscError}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Branch</label>
                            <div className="relative group">
                                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01]"
                                    placeholder="e.g. Andheri West"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            {profile && (
                                <button
                                    type="button"
                                    onClick={() => setEditing(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-all text-xs uppercase tracking-[0.2em]"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-950/10 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em] text-xs"
                            >
                                {loading ? "Saving..." : "Save Payment Details"}
                            </button>
                        </div>
                    </form>
                ) : null}
            </div>
        </div>
    );
}

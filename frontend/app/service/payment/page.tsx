"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { CreditCard, Building2, Hash, MapPin, CheckCircle2, AlertCircle, Pencil, Smartphone, QrCode } from "lucide-react";

interface PaymentProfile {
    id: string;
    account_holder_name: string;
    account_number_masked: string;
    ifsc_code: string;
    branch: string;
    upi_id: string | null;
    upi_qr_image_url: string | null;
    created_at: string;
    updated_at: string;
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

function Badge({ label, active }: { label: string; active: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
            <CheckCircle2 className={`w-3 h-3 ${active ? "text-emerald-500" : "text-slate-300"}`} />
            {label}
        </span>
    );
}

export default function ProviderPaymentPage() {
    const [profile, setProfile] = useState<PaymentProfile | null>(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [ifscError, setIfscError] = useState("");
    const [confirmError, setConfirmError] = useState("");

    const [name, setName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [confirmAccount, setConfirmAccount] = useState("");
    const [ifsc, setIfsc] = useState("");
    const [branch, setBranch] = useState("");
    const [upiId, setUpiId] = useState("");
    const [upiQr, setUpiQr] = useState("");

    useEffect(() => {
        apiFetch("/payment/provider")
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
            const data = await apiFetch("/payment/provider", {
                method: "POST",
                body: JSON.stringify({
                    account_holder_name: name,
                    account_number: accountNumber,
                    ifsc_code: ifsc.toUpperCase(),
                    branch,
                    upi_id: upiId.trim() || null,
                    upi_qr_image_url: upiQr.trim() || null,
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
            setUpiId(profile.upi_id ?? "");
            setUpiQr(profile.upi_qr_image_url ?? "");
        }
        setAccountNumber("");
        setConfirmAccount("");
        setIfscError("");
        setConfirmError("");
        setError("");
        setEditing(true);
    };

    const hasBank = !!(profile?.account_holder_name && profile?.account_number_masked && profile?.ifsc_code && profile?.branch);
    const hasUpi = !!profile?.upi_id;
    const hasQr = !!profile?.upi_qr_image_url;

    return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-3 mb-6">
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

                {profile && (
                    <div className="flex gap-2 mb-6">
                        <Badge label="Bank" active={hasBank} />
                        <Badge label="UPI" active={hasUpi} />
                        <Badge label="QR" active={hasQr} />
                    </div>
                )}

                {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl flex items-center mb-6 shadow-md shadow-emerald-900/5">
                        <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-600" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Payment Details Saved</span>
                    </div>
                )}

                {!editing && profile ? (
                    <div className="space-y-4">
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bank Account</p>
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
                        {(profile.upi_id || profile.upi_qr_image_url) && (
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">UPI</p>
                                {profile.upi_id && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">UPI ID</span>
                                        <span className="text-sm font-mono font-black text-slate-900">{profile.upi_id}</span>
                                    </div>
                                )}
                                {profile.upi_qr_image_url && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">QR Image</span>
                                        <span className="text-[11px] font-black text-emerald-700">Uploaded</span>
                                    </div>
                                )}
                            </div>
                        )}
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

                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Account</p>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Account Holder Name</label>
                            <div className="relative group">
                                <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01]" placeholder="Full name as on bank account" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Account Number</label>
                            <div className="relative group">
                                <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input required type="password" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01]" placeholder="9–18 digits" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Confirm Account Number</label>
                            <div className="relative group">
                                <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input required type="password" className={`w-full bg-slate-50 border rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01] ${confirmError ? "border-rose-300" : "border-slate-100"}`} placeholder="Re-enter account number" value={confirmAccount} onChange={(e) => setConfirmAccount(e.target.value)} />
                            </div>
                            {confirmError && <p className="text-[10px] text-rose-600 font-bold ml-1">{confirmError}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">IFSC Code</label>
                            <div className="relative group">
                                <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input required className={`w-full bg-slate-50 border rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight uppercase shadow-inner shadow-black/[0.01] ${ifscError ? "border-rose-300" : "border-slate-100"}`} placeholder="e.g. HDFC0001234" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} onBlur={() => { if (ifsc && !IFSC_RE.test(ifsc)) setIfscError("Invalid IFSC code format"); else setIfscError(""); }} />
                            </div>
                            {ifscError && <p className="text-[10px] text-rose-600 font-bold ml-1">{ifscError}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">Branch</label>
                            <div className="relative group">
                                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01]" placeholder="e.g. Andheri West" value={branch} onChange={(e) => setBranch(e.target.value)} />
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">UPI (Optional)</p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">UPI ID</label>
                                    <div className="relative group">
                                        <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01]" placeholder="e.g. name@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-1">UPI QR Image URL</label>
                                    <div className="relative group">
                                        <QrCode className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#064e3b] transition-colors" />
                                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-bold tracking-tight shadow-inner shadow-black/[0.01]" placeholder="https://..." value={upiQr} onChange={(e) => setUpiQr(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            {profile && (
                                <button type="button" onClick={() => setEditing(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-all text-xs uppercase tracking-[0.2em]">
                                    Cancel
                                </button>
                            )}
                            <button type="submit" disabled={loading} className="flex-1 bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-950/10 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em] text-xs">
                                {loading ? "Saving..." : "Save Payment Details"}
                            </button>
                        </div>
                    </form>
                ) : null}
            </div>
        </div>
    );
}

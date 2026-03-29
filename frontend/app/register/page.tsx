"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { User, Wrench, Mail, Lock, UserPlus, CheckCircle, X, AlertCircle, ChevronDown, Building2 } from "lucide-react";

const ROLES = [
    { value: "USER", label: "Home User", description: "Book and manage homecare services", icon: User },
    { value: "SERVICER", label: "Servicer", description: "Offer and manage homecare jobs", icon: Wrench },
    { value: "SECRETARY", label: "Secretary", description: "Manage a society and its members", icon: Building2 },
];

interface Society {
    id: number;
    name: string;
    address: string;
}

export default function RegisterPage() {
    const router = useRouter();
    const [role, setRole] = useState("USER");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [societyId, setSocietyId] = useState<number | null>(null);
    const [societies, setSocieties] = useState<Society[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Load societies when SECRETARY role is selected
    useEffect(() => {
        if (role === "SECRETARY" && societies.length === 0) {
            apiFetch("/services/societies")
                .then((data) => setSocieties(data || []))
                .catch(() => setSocieties([]));
        }
    }, [role]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const hasCapital = /[A-Z]/.test(password);
        const hasSpecial = /[@#$!%*?&]/.test(password);
        if (!hasCapital || !hasSpecial || password.length < 6) {
            const msg = "Password must be 6+ characters with at least 1 uppercase letter and 1 special character (@#$!%*?&).";
            setError(msg);
            showToast(msg, "error");
            return;
        }

        if (role === "SECRETARY" && !societyId) {
            const msg = "Please select a society to manage.";
            setError(msg);
            showToast(msg, "error");
            return;
        }

        setLoading(true);
        try {
            const body: Record<string, unknown> = { email, username, password, role };
            if (role === "SECRETARY") body.society_id = societyId;

            await apiFetch("/auth/signup", {
                method: "POST",
                body: JSON.stringify(body),
            });
            setSuccess(true);
            setTimeout(() => router.push("/login"), 2500);
        } catch (err: any) {
            const msg = err.message || "Registration failed. Please try again.";
            if (msg.toLowerCase().includes("already exists")) {
                const existsMsg = "An account with this email already exists. Please sign in.";
                setError(existsMsg);
                showToast(existsMsg, "error");
            } else {
                setError(msg);
                showToast(msg, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    const selectedRole = ROLES.find((r) => r.value === role);
    const RoleIcon = selectedRole?.icon ?? User;

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-full mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h2>
                    <p className="text-slate-500">Redirecting you to sign in...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-emerald-100 rounded-full blur-[120px] opacity-50"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-100 rounded-full blur-[100px] opacity-40"></div>
            </div>

            {toast && (
                <div className={`fixed top-6 right-6 z-[9999] max-w-sm w-full animate-in slide-in-from-top-3 fade-in duration-300 shadow-2xl rounded-2xl border p-4 flex items-start gap-3 ${toast.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"}`}>
                    {toast.type === "error" ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
                    <p className="text-sm font-semibold flex-1">{toast.message}</p>
                    <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 shrink-0"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl mb-5">
                        <UserPlus className="w-7 h-7 text-emerald-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
                    <p className="text-slate-500 text-sm mt-1">Join the Homecare Hub network</p>
                </div>

                {/* Role Selection Dropdown */}
                <div className="mb-7">
                    <label className="block text-sm font-semibold text-slate-700 mb-2.5">I am a...</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                            <RoleIcon className="w-5 h-5 text-emerald-700" />
                        </div>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full pl-12 pr-10 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-bold appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 transition-all cursor-pointer hover:border-slate-300 shadow-sm"
                        >
                            <option value="USER">Home User</option>
                            <option value="SERVICER">Servicer</option>
                            <option value="SECRETARY">Secretary</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </div>
                    </div>
                </div>

                {/* Society Selector — shown only for SECRETARY */}
                {role === "SECRETARY" && (
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-slate-700 mb-2.5">Select Society to Manage</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <Building2 className="w-4 h-4 text-emerald-700" />
                            </div>
                            <select
                                value={societyId ?? ""}
                                onChange={(e) => setSocietyId(Number(e.target.value) || null)}
                                className="w-full pl-10 pr-10 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-bold appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 transition-all cursor-pointer hover:border-slate-300 shadow-sm"
                            >
                                <option value="">-- Select a society --</option>
                                {societies.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name} — {s.address}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                        {societies.length === 0 && (
                            <p className="text-xs text-slate-400 mt-1.5 ml-1">No societies available. Ask an admin to create one first.</p>
                        )}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-start gap-3">
                            <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold">Registration Failed</p>
                                <p className="text-xs mt-1 opacity-90">{error}</p>
                                {error.toLowerCase().includes("already exists") && (
                                    <Link href="/login" className="inline-block mt-2 text-emerald-700 font-bold hover:underline text-xs">Sign in to your existing account instead →</Link>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                        <input required placeholder="Enter your name" value={username} onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition" />
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 ml-1">Must have 6+ chars, 1 uppercase &amp; 1 special character (@#$!%*?&amp;)</p>
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full bg-[#064e3b] hover:bg-emerald-950 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition mt-1">
                        {loading ? "Creating account..." : "Create Account"}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-500 mt-6">
                    Already have an account?{" "}
                    <Link href="/login" className="text-emerald-700 font-semibold hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}

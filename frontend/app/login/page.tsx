"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { saveAuthData } from "@/lib/auth";
import { HeartPulse, Mail, Lock, ArrowRight, Key, X, AlertCircle, CheckCircle } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Toast state
    const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Forgot password state
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [newPass, setNewPass] = useState("");
    const [forgotMsg, setForgotMsg] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);

    // Redirect if already logged in
    useEffect(() => {
        const token = localStorage.getItem("hc_token");
        if (token) router.push("/dashboard");
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            // Login returns: { access_token, role, username, user_uuid }
            const data = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });

            // Save all auth info to localStorage
            saveAuthData(data);

            // Route to different dashboards based on role
            if (data.role === "ADMIN") {
                router.push("/admin");
            } else if (data.role === "SERVICER") {
                router.push("/dashboard/servicer");
            } else {
                router.push("/dashboard");
            }
        } catch (err: any) {
            const msg = err.message || "Incorrect email or password.";
            setError(msg);
            showToast(msg, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotLoading(true);
        setForgotMsg("");
        try {
            await apiFetch("/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email: forgotEmail, new_password: newPass }),
            });
            setForgotMsg("success");
            showToast("Password updated! You can now sign in.", "success");
            setTimeout(() => setShowForgot(false), 2500);
        } catch (err: any) {
            const msg = err.message || "User not found.";
            setForgotMsg("error:" + msg);
            showToast(msg, "error");
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-emerald-100 rounded-full blur-[120px] opacity-50"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-100 rounded-full blur-[100px] opacity-40"></div>
            </div>
            {/* Toast Popup */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[9999] max-w-sm w-full animate-in slide-in-from-top-3 fade-in duration-300 shadow-2xl rounded-2xl border p-4 flex items-start gap-3 ${
                    toast.type === "error"
                        ? "bg-red-50 border-red-200 text-red-800"
                        : "bg-green-50 border-green-200 text-green-800"
                }`}>
                    {toast.type === "error"
                        ? <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        : <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    }
                    <p className="text-sm font-semibold flex-1">{toast.message}</p>
                    <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Login Card */}
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-10">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl mb-5">
                        <HeartPulse className="w-7 h-7 text-emerald-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
                    <p className="text-slate-500 text-sm mt-1">Sign in to your Homecare Hub account</p>
                </div>

                {/* Error Box */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <X className="w-4 h-4 text-red-500" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Sign In Failed</p>
                                <p className="text-xs mt-1 opacity-90">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                    {/* Email */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="email"
                                required
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Password</label>
                            <button
                                type="button"
                                onClick={() => { setShowForgot(true); setForgotMsg(""); }}
                                className="text-xs text-emerald-700 font-medium hover:underline"
                            >
                                Forgot password?
                            </button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-[#064e3b] hover:bg-emerald-950 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition text-sm mt-2"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>

                {/* Register Link */}
                <p className="text-center text-sm text-slate-500 mt-6">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="text-emerald-700 font-semibold hover:underline">
                        Create one
                    </Link>
                </p>
            </div>

            {/* Forgot Password Modal */}
            {showForgot && (
                <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">

                        {/* Close button */}
                        <button
                            onClick={() => setShowForgot(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-7">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-xl mb-4">
                                <Key className="w-6 h-6 text-emerald-700" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
                            <p className="text-slate-500 text-sm mt-1">Enter your email and a new password</p>
                        </div>

                        {/* Feedback */}
                        {forgotMsg === "success" && (
                            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5 font-medium text-center">
                                ✅ Password updated! You can now sign in.
                            </div>
                        )}
                        {forgotMsg.startsWith("error:") && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 font-medium text-center">
                                ❌ {forgotMsg.replace("error:", "")}
                            </div>
                        )}

                        <form onSubmit={handleReset} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Registered Email</label>
                                <input
                                    type="email" required placeholder="you@example.com"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                                <input
                                    type="password" required placeholder="••••••••"
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                                />
                                <p className="text-xs text-slate-400 mt-1.5 ml-1">Must have 1 uppercase letter + 1 special character</p>
                            </div>
                            <button
                                type="submit"
                                disabled={forgotLoading}
                                className="w-full bg-[#064e3b] hover:bg-emerald-950 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition mt-2"
                            >
                                {forgotLoading ? "Updating..." : "Update Password"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

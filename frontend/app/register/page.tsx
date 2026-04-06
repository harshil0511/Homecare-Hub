"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
    User, Wrench, Mail, Lock, UserPlus, CheckCircle, X, AlertCircle,
    ChevronDown, Building2, MapPin, Phone, Briefcase, GraduationCap,
    Camera, Upload, Shield, FileText, ChevronLeft, ChevronRight, CheckCircle2
} from "lucide-react";

const ROLES = [
    { value: "USER", label: "Home User", icon: User },
    { value: "SERVICER", label: "Servicer", icon: Wrench },
    { value: "SECRETARY", label: "Secretary", icon: Building2 },
];

const SERVICE_CATEGORIES = [
    "Plumbing", "Electrical", "Carpentry", "Painting", "Cleaning",
    "HVAC / AC Repair", "Gardening", "Security", "Pest Control", "Appliance Repair",
    "Masonry", "Waterproofing", "Interior Design", "Flooring", "General Maintenance"
];

const SERVICER_STEPS = [
    { label: "Account", icon: User },
    { label: "Personal", icon: User },
    { label: "Contact", icon: Phone },
    { label: "Professional", icon: Briefcase },
    { label: "Documents", icon: FileText },
];

export default function RegisterPage() {
    const router = useRouter();

    // Shared account fields
    const [role, setRole] = useState("USER");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

    // Secretary-only
    const [societyName, setSocietyName] = useState("");
    const [societyAddress, setSocietyAddress] = useState("");

    // Wizard step (0–4, only rendered when role === "SERVICER")
    const [step, setStep] = useState(0);

    // Step 1 — Personal
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [age, setAge] = useState("");
    const [gender, setGender] = useState("");

    // Step 2 — Contact
    const [phone, setPhone] = useState("");
    const [location, setLocation] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState("");
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Step 3 — Professional
    const [experience, setExperience] = useState("");
    const [education, setEducation] = useState("");
    const [bio, setBio] = useState("");
    const [categories, setCategories] = useState<string[]>([]);

    // Step 4 — Documents
    const [govId, setGovId] = useState("");
    const [certFile, setCertFile] = useState<File | null>(null);
    const [certName, setCertName] = useState("");
    const certInputRef = useRef<HTMLInputElement>(null);

    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Reset wizard step when switching away from SERVICER role
    useEffect(() => {
        if (role !== "SERVICER") setStep(0);
    }, [role]);

    const toggleCategory = (cat: string) => {
        setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleCertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCertFile(file);
        setCertName(file.name);
    };

    const validateStep = (): boolean => {
        setError("");
        if (step === 0) {
            if (!username.trim()) { setError("Please enter your name."); return false; }
            if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email."); return false; }
            const hasCapital = /[A-Z]/.test(password);
            const hasSpecial = /[@#$!%*?&]/.test(password);
            if (!hasCapital || !hasSpecial || password.length < 6) {
                setError("Password must be 6+ chars, 1 uppercase & 1 special character (@#$!%*?&).");
                return false;
            }
        }
        if (step === 1) {
            if (!age || Number(age) < 18 || Number(age) > 80) { setError("Please enter a valid age (18–80)."); return false; }
            if (!gender) { setError("Please select your gender."); return false; }
        }
        if (step === 2) {
            if (!phone.trim() || phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid phone number (min 10 digits)."); return false; }
            if (!location.trim()) { setError("Please enter your city / location."); return false; }
        }
        if (step === 3) {
            if (!experience || Number(experience) < 0) { setError("Please enter your years of experience."); return false; }
            if (!education.trim()) { setError("Please enter your education details."); return false; }
            if (categories.length === 0) { setError("Please select at least one service category."); return false; }
        }
        return true;
    };

    const next = () => { if (validateStep()) setStep(s => s + 1); };
    const back = () => { setError(""); setStep(s => s - 1); };

    // USER / SECRETARY registration — unchanged from original
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        const hasCapital = /[A-Z]/.test(password);
        const hasSpecial = /[@#$!%*?&]/.test(password);
        if (!hasCapital || !hasSpecial || password.length < 6) {
            const msg = "Password must be 6+ characters with at least 1 uppercase letter and 1 special character (@#$!%*?&).";
            setError(msg); showToast(msg, "error"); return;
        }
        if (role === "SECRETARY" && (!societyName.trim() || !societyAddress.trim())) {
            const msg = "Please enter your society name and location.";
            setError(msg); showToast(msg, "error"); return;
        }
        setLoading(true);
        try {
            const body: Record<string, unknown> = { email, username, password, role };
            if (role === "SECRETARY") { body.society_name = societyName.trim(); body.society_address = societyAddress.trim(); }
            await apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(body) });
            // Save credentials for login autofill
            const saved = JSON.parse(localStorage.getItem("hc_saved_accounts") || "[]");
            if (!saved.find((a: { email: string }) => a.email === email)) {
                saved.push({ email, password });
                localStorage.setItem("hc_saved_accounts", JSON.stringify(saved));
            }
            setSuccess(true);
            setTimeout(() => router.push("/login"), 2500);
        } catch (err: any) {
            const msg = err.message || "Registration failed. Please try again.";
            if (msg.toLowerCase().includes("already exists")) {
                const existsMsg = "An account with this email already exists. Please sign in.";
                setError(existsMsg); showToast(existsMsg, "error");
            } else { setError(msg); showToast(msg, "error"); }
        } finally { setLoading(false); }
    };

    // SERVICER 5-step submit
    const handleServicerRegister = async () => {
        setLoading(true);
        setError("");
        const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
        const API = `${API_BASE}/api/v1`;
        try {
            // 1. Create account
            const signupRes = await fetch(`${API}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, username, password, role: "SERVICER" })
            });
            if (!signupRes.ok) {
                const err = await signupRes.json();
                throw new Error(err.detail || "Account creation failed.");
            }

            // 2. Silent login — get JWT for provider setup (token stays in memory, never in localStorage)
            const loginRes = await fetch(`${API}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            if (!loginRes.ok) throw new Error("Authentication failed after registration.");
            const { access_token: token } = await loginRes.json();

            // Authenticated helper — uses in-memory token only
            const authFetch = async (path: string, opts: RequestInit = {}) => {
                const isFormData = opts.body instanceof FormData;
                const res = await fetch(`${API}${path}`, {
                    ...opts,
                    headers: {
                        Authorization: `Bearer ${token}`,
                        ...(!isFormData && { "Content-Type": "application/json" }),
                        ...(opts.headers as Record<string, string> || {}),
                    }
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error((err as any).detail || "Request failed.");
                }
                return res.json();
            };

            // 3. Upload profile photo (optional)
            let photoUrl = "";
            if (photoFile) {
                const fd = new FormData();
                fd.append("file", photoFile);
                const data = await authFetch("/services/providers/upload-photo", { method: "POST", body: fd });
                photoUrl = data.url || "";
            }

            // 4. Upload certification document (optional)
            let certUrl = "";
            if (certFile) {
                const fd = new FormData();
                fd.append("file", certFile);
                const data = await authFetch("/services/providers/upload-photo", { method: "POST", body: fd });
                certUrl = data.url || "";
            }

            // 5. Create provider profile — split full name into first/last
            const nameParts = username.trim().split(/\s+/);
            const derivedFirstName = nameParts[0];
            const derivedLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];

            const profilePayload: Record<string, unknown> = {
                first_name: derivedFirstName,
                last_name: derivedLastName,
                age: Number(age),
                gender,
                phone: phone.trim(),
                email: email.trim(),
                location: location.trim(),
                experience_years: Number(experience),
                education: education.trim(),
                categories,
            };
            if (bio.trim()) profilePayload.bio = bio.trim();
            if (govId.trim()) profilePayload.government_id = govId.trim();
            if (photoUrl) profilePayload.profile_photo_url = photoUrl;
            if (certUrl) profilePayload.certification_url = certUrl;

            await authFetch("/services/providers/setup", {
                method: "POST",
                body: JSON.stringify(profilePayload)
            });

            // Save credentials for login autofill
            const saved = JSON.parse(localStorage.getItem("hc_saved_accounts") || "[]");
            if (!saved.find((a: { email: string }) => a.email === email)) {
                saved.push({ email, password });
                localStorage.setItem("hc_saved_accounts", JSON.stringify(saved));
            }
            setSuccess(true);
            setTimeout(() => router.push("/login"), 2500);
        } catch (err: any) {
            const msg = err.message || "Registration failed. Please try again.";
            if (msg.toLowerCase().includes("already exists")) {
                const existsMsg = "An account with this email already exists. Please sign in.";
                setError(existsMsg); showToast(existsMsg, "error");
            } else { setError(msg); showToast(msg, "error"); }
        } finally { setLoading(false); }
    };

    const selectedRole = ROLES.find(r => r.value === role);
    const RoleIcon = selectedRole?.icon ?? User;
    const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#064e3b] focus:border-transparent transition";
    const labelCls = "block text-xs font-bold text-slate-600 mb-1.5";

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-full mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h2>
                    <p className="text-slate-500 text-sm">Redirecting you to sign in...</p>
                </div>
            </div>
        );
    }

    // ── SERVICER WIZARD ──
    if (role === "SERVICER") {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                {toast && (
                    <div className={`fixed top-6 right-6 z-[9999] max-w-sm w-full shadow-2xl rounded-2xl border p-4 flex items-start gap-3 ${toast.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"}`}>
                        {toast.type === "error" ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
                        <p className="text-sm font-semibold flex-1">{toast.message}</p>
                        <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
                    </div>
                )}
                <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                    {/* Step progress header */}
                    <div className="bg-[#064e3b] px-6 py-5">
                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-[0.3em] mb-3">Servicer Registration</p>
                        <div className="flex items-center gap-1">
                            {SERVICER_STEPS.map((s, i) => {
                                const Icon = s.icon;
                                return (
                                    <div key={i} className="flex items-center gap-1 flex-1">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${i < step ? "bg-emerald-400" : i === step ? "bg-white" : "bg-white/20"}`}>
                                            {i < step
                                                ? <CheckCircle2 className="w-4 h-4 text-[#064e3b]" />
                                                : <Icon className={`w-4 h-4 ${i === step ? "text-[#064e3b]" : "text-white/50"}`} />
                                            }
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest hidden sm:block ${i === step ? "text-white" : "text-white/40"}`}>{s.label}</span>
                                        {i < SERVICER_STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i < step ? "bg-emerald-400" : "bg-white/20"}`} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2">
                                <X className="w-4 h-4 text-rose-500 shrink-0" />
                                <p className="text-xs text-rose-700 font-semibold">{error}</p>
                            </div>
                        )}

                        {/* Step 0 — Account */}
                        {step === 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-black text-slate-900">Create Your Account</h2>
                                    <button type="button" onClick={() => setRole("USER")} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition">
                                        Not a servicer?
                                    </button>
                                </div>
                                <div>
                                    <label className={labelCls}>Full Name</label>
                                    <input className={inputCls} placeholder="Enter your name" value={username} onChange={e => setUsername(e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelCls}>Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="email" className={`${inputCls} pl-10`} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="password" className={`${inputCls} pl-10`} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1.5">6+ chars, 1 uppercase &amp; 1 special character (@#$!%*?&amp;)</p>
                                </div>
                            </div>
                        )}

                        {/* Step 1 — Personal */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <h2 className="text-base font-black text-slate-900">Personal Information</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Age</label>
                                        <input type="number" min={18} max={80} className={inputCls} placeholder="25" value={age} onChange={e => setAge(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Gender</label>
                                        <select className={inputCls} value={gender} onChange={e => setGender(e.target.value)}>
                                            <option value="">Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2 — Contact */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <h2 className="text-base font-black text-slate-900">Contact & Location</h2>
                                <div>
                                    <label className={labelCls}>Profile Photo <span className="text-slate-400 font-normal">(optional)</span></label>
                                    <div className="flex items-center gap-4">
                                        <div onClick={() => photoInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-[#064e3b] transition-colors overflow-hidden flex-shrink-0">
                                            {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-slate-300" />}
                                        </div>
                                        <button type="button" onClick={() => photoInputRef.current?.click()} className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline">
                                            {photoPreview ? "Change Photo" : "Upload Photo"}
                                        </button>
                                        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Mobile Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="tel" className={`${inputCls} pl-10`} placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Location / City</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input className={`${inputCls} pl-10`} placeholder="e.g. Ahmedabad, Gujarat" value={location} onChange={e => setLocation(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3 — Professional */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <h2 className="text-base font-black text-slate-900">Professional Details</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Experience (years)</label>
                                        <input type="number" min={0} className={inputCls} placeholder="3" value={experience} onChange={e => setExperience(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Education</label>
                                        <div className="relative">
                                            <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input className={`${inputCls} pl-10`} placeholder="e.g. ITI Electrician" value={education} onChange={e => setEducation(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Bio <span className="text-slate-400 font-normal">(optional)</span></label>
                                    <textarea rows={2} className={inputCls} placeholder="Tell customers about yourself..." value={bio} onChange={e => setBio(e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelCls}>Service Categories <span className="text-rose-500">*</span></label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {SERVICE_CATEGORIES.map(cat => (
                                            <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all ${categories.includes(cat) ? "bg-[#064e3b] text-white border-[#064e3b]" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                    {categories.length > 0 && <p className="text-[9px] text-emerald-700 mt-2 font-semibold">{categories.length} selected</p>}
                                </div>
                            </div>
                        )}

                        {/* Step 4 — Documents */}
                        {step === 4 && (
                            <div className="space-y-4">
                                <h2 className="text-base font-black text-slate-900">Identity & Documents <span className="text-slate-400 text-sm font-normal">(all optional)</span></h2>
                                <div>
                                    <label className={labelCls}>Government ID Number (Aadhar / PAN)</label>
                                    <div className="relative">
                                        <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input className={`${inputCls} pl-10`} placeholder="Enter ID number" value={govId} onChange={e => setGovId(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Certification / Work Document</label>
                                    <div onClick={() => certInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#064e3b] transition-colors">
                                        {certName
                                            ? <><CheckCircle2 className="w-6 h-6 text-emerald-500" /><p className="text-xs font-semibold text-slate-700">{certName}</p><p className="text-[9px] text-slate-400">Click to change</p></>
                                            : <><Upload className="w-6 h-6 text-slate-300" /><p className="text-xs font-semibold text-slate-500">Upload Certificate or ID Proof</p><p className="text-[9px] text-slate-400">PDF, JPG, PNG — Optional</p></>
                                        }
                                    </div>
                                    <input ref={certInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleCertChange} />
                                </div>
                                {/* Pre-submit summary */}
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1.5">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Summary</p>
                                    <p className="text-xs text-slate-700"><span className="font-black">Name:</span> {firstName} {lastName}</p>
                                    <p className="text-xs text-slate-700"><span className="font-black">Location:</span> {location}</p>
                                    <p className="text-xs text-slate-700"><span className="font-black">Experience:</span> {experience} yrs</p>
                                    <p className="text-xs text-slate-700"><span className="font-black">Services:</span> {categories.join(", ") || "—"}</p>
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            {step > 0
                                ? <button type="button" onClick={back} className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-colors">
                                    <ChevronLeft className="w-4 h-4" /> Back
                                  </button>
                                : <div />
                            }
                            {step < 4
                                ? <button type="button" onClick={next} className="flex items-center gap-2 bg-[#064e3b] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-900 transition-all active:scale-95">
                                    Next <ChevronRight className="w-4 h-4" />
                                  </button>
                                : <button type="button" onClick={handleServicerRegister} disabled={loading} className="flex items-center gap-2 bg-[#064e3b] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-900 transition-all active:scale-95 disabled:opacity-60">
                                    {loading ? "Creating Account..." : <><CheckCircle2 className="w-4 h-4" /> Create Account</>}
                                  </button>
                            }
                        </div>
                        <p className="text-center text-sm text-slate-500">
                            Already have an account?{" "}
                            <Link href="/login" className="text-emerald-700 font-semibold hover:underline">Sign in</Link>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── USER / SECRETARY FORM — unchanged ──
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
                <div className="mb-7">
                    <label className="block text-sm font-semibold text-slate-700 mb-2.5">I am a...</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <RoleIcon className="w-5 h-5 text-emerald-700" />
                        </div>
                        <select value={role} onChange={e => setRole(e.target.value)}
                            className="w-full pl-12 pr-10 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-bold appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 transition-all cursor-pointer hover:border-slate-300 shadow-sm">
                            <option value="USER">Home User</option>
                            <option value="SERVICER">Servicer</option>
                            <option value="SECRETARY">Secretary</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </div>
                    </div>
                </div>
                {role === "SECRETARY" && (
                    <div className="mb-6 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Society Name</label>
                            <div className="relative">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input required placeholder="e.g. Green Valley Society" value={societyName} onChange={e => setSocietyName(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Society Location</label>
                            <div className="relative">
                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input required placeholder="e.g. Sector 12, Ahmedabad" value={societyAddress} onChange={e => setSocietyAddress(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition" />
                            </div>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-xl shadow-sm">
                        <div className="flex items-start gap-3">
                            <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold">Registration Failed</p>
                                <p className="text-xs mt-1 opacity-90">{error}</p>
                                {error.toLowerCase().includes("already exists") && (
                                    <Link href="/login" className="inline-block mt-2 text-emerald-700 font-bold hover:underline text-xs">Sign in instead →</Link>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <form onSubmit={handleRegister} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                        <input required placeholder="Enter your name" value={username} onChange={e => setUsername(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
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

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
    User, Briefcase, GraduationCap,
    ChevronLeft, ArrowRight, ShieldCheck,
    MapPin, Phone, Mail, Camera, AlertCircle
} from "lucide-react";

export default function ServicerSetupPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        age: 0,
        gender: "Prefer not to say",
        phone: "",
        email: "",
        location: "",
        profile_photo_url: "",
        categories: [] as string[],
        bio: "",
        education: "",
        experience_years: 0,
        hourly_rate: 0
    });

    const roles = ["Plumbing", "Electrical", "Cleaning", "Mechanical", "Carpentry", "Painting", "Gardening", "HVAC", "Pest Control", "Appliance Repair"];

    const handleToggleRole = (role: string) => {
        setFormData(prev => ({
            ...prev,
            categories: prev.categories.includes(role)
                ? prev.categories.filter(r => r !== role)
                : [...prev.categories, role]
        }));
    };

    const validateStep = (currentStep: number): boolean => {
        setError("");
        if (currentStep === 1) {
            if (!formData.first_name.trim() || !formData.last_name.trim()) {
                setError("First name and last name are required.");
                return false;
            }
            if (!formData.phone.trim()) {
                setError("Phone number is required so users can contact you.");
                return false;
            }
            if (!formData.email.trim()) {
                setError("Email is required.");
                return false;
            }
            if (!formData.location.trim()) {
                setError("Location is required so users know your service area.");
                return false;
            }
        }
        if (currentStep === 2 && formData.categories.length === 0) {
            setError("Please select at least one service you offer.");
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(s => s + 1);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type)) {
            setError("Only JPEG, PNG, and WebP images are allowed.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError("File too large. Maximum size is 5MB.");
            return;
        }

        setError("");
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            let photoUrl = formData.profile_photo_url;

            // Upload photo file if selected
            if (photoFile) {
                const fd = new FormData();
                fd.append("file", photoFile);
                const uploadRes = await apiFetch("/services/providers/upload-photo", {
                    method: "POST",
                    body: fd,
                });
                photoUrl = uploadRes.url;
            }

            await apiFetch("/services/providers/setup", {
                method: "POST",
                body: JSON.stringify({ ...formData, profile_photo_url: photoUrl })
            });
            router.push("/dashboard/servicer");
        } catch (err: any) {
            setError(err?.message || "Failed to save your profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const totalSteps = 4;

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 bg-slate-50/30">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[3rem] shadow-[0_32px_80px_rgba(0,0,0,0.08)] overflow-hidden">
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-slate-100">
                    <div
                        className="h-full bg-[#064e3b] transition-all duration-500"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>

                <div className="p-12 md:p-16">
                    {/* Header */}
                    <div className="mb-10">
                        <span className="text-[10px] font-black text-[#064e3b] uppercase tracking-[0.3em] mb-3 block">Step 0{step} / 0{totalSteps}</span>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                            {step === 1 && "Your Identity"}
                            {step === 2 && "Your Services"}
                            {step === 3 && "Your Experience"}
                            {step === 4 && "Profile Photo"}
                        </h1>
                        <p className="text-slate-500 text-sm font-bold mt-2 uppercase tracking-widest opacity-60">
                            {step === 1 && "Personal details & contact information"}
                            {step === 2 && "What services do you offer?"}
                            {step === 3 && "Share your qualifications & experience"}
                            {step === 4 && "Add a profile photo so users can recognize you"}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3.5 rounded-2xl text-xs font-bold">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Step 1: Personal Info + Contact */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <User className="w-3 h-3" /> First Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.first_name}
                                        onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                        placeholder="John"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name *</label>
                                    <input
                                        type="text"
                                        value={formData.last_name}
                                        onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                                    <input
                                        type="number"
                                        value={formData.age || ""}
                                        onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                                    <select
                                        value={formData.gender}
                                        onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    >
                                        <option>Male</option>
                                        <option>Female</option>
                                        <option>Other</option>
                                        <option>Prefer not to say</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-6 mt-2">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-5">Contact & Location</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                        placeholder="john@email.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Location / Service Area *
                                </label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    placeholder="e.g. Mumbai, Maharashtra"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Roles */}
                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {roles.map(role => (
                                    <button
                                        key={role}
                                        onClick={() => handleToggleRole(role)}
                                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 text-center group ${formData.categories.includes(role)
                                            ? "border-[#064e3b] bg-emerald-50/50 shadow-lg shadow-emerald-900/5"
                                            : "border-slate-100 bg-slate-50 hover:border-slate-300"
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${formData.categories.includes(role) ? "bg-[#064e3b] text-white" : "bg-white text-slate-400"
                                            }`}>
                                            <Briefcase className="w-5 h-5" />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${formData.categories.includes(role) ? "text-[#064e3b]" : "text-slate-500"
                                            }`}>{role}</span>
                                    </button>
                                ))}
                            </div>
                            {formData.categories.length > 0 && (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3 text-xs font-bold text-[#064e3b]">
                                    Selected: {formData.categories.join(", ")}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Experience & Bio */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                    <GraduationCap className="w-3 h-3" /> Education / Qualifications
                                </label>
                                <input
                                    type="text"
                                    value={formData.education}
                                    placeholder="e.g. ITI, B.Tech, Master Plumber Certified"
                                    onChange={e => setFormData({ ...formData, education: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Years of Experience</label>
                                    <input
                                        type="number"
                                        value={formData.experience_years || ""}
                                        onChange={e => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hourly Rate ($)</label>
                                    <input
                                        type="number"
                                        value={formData.hourly_rate || ""}
                                        onChange={e => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Professional Bio</label>
                                <textarea
                                    rows={5}
                                    value={formData.bio}
                                    placeholder="Tell customers about your skills, experience, and what makes your service special..."
                                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-3xl px-6 py-4 text-slate-900 font-bold focus:ring-4 focus:ring-[#064e3b]/5 focus:border-[#064e3b] outline-none transition-all resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Profile Photo */}
                    {step === 4 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex flex-col items-center gap-6">
                                {/* Photo Preview */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-36 h-36 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:border-[#064e3b] hover:bg-emerald-50/30 transition-all group"
                                >
                                    {photoPreview ? (
                                        <img
                                            src={photoPreview}
                                            alt="Profile preview"
                                            className="w-full h-full object-cover rounded-[2rem]"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Camera className="w-10 h-10 text-slate-300 group-hover:text-[#064e3b] transition-colors" />
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest group-hover:text-[#064e3b] transition-colors">Tap to upload</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <p className="text-xs font-bold text-slate-400 text-center max-w-xs">
                                    {photoFile ? (
                                        <span className="text-[#064e3b]">{photoFile.name} selected</span>
                                    ) : (
                                        "Upload a photo from your device. This will be visible to users when they browse services."
                                    )}
                                </p>
                                {photoPreview && (
                                    <button
                                        onClick={() => { setPhotoFile(null); setPhotoPreview(""); setFormData({ ...formData, profile_photo_url: "" }); }}
                                        className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-700 transition-colors"
                                    >
                                        Remove Photo
                                    </button>
                                )}
                            </div>

                            {/* Summary Preview */}
                            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-5">Profile Summary</p>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Name</span>
                                        <p className="font-black text-slate-900">{formData.first_name} {formData.last_name}</p>
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Phone</span>
                                        <p className="font-black text-slate-900">{formData.phone || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Email</span>
                                        <p className="font-black text-slate-900">{formData.email || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Location</span>
                                        <p className="font-black text-slate-900">{formData.location || "—"}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-black text-slate-400 uppercase tracking-wider text-[9px]">Services</span>
                                        <p className="font-black text-slate-900">{formData.categories.join(", ") || "—"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer / Controls */}
                    <div className="mt-14 flex items-center justify-between">
                        {step > 1 ? (
                            <button
                                onClick={() => { setStep(s => s - 1); setError(""); }}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </button>
                        ) : <div />}

                        {step < totalSteps ? (
                            <button
                                onClick={handleNext}
                                className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-3"
                            >
                                Continue
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="bg-[#064e3b] text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-emerald-900/20 hover:bg-emerald-950 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-3"
                            >
                                {loading ? "Saving..." : "Complete Setup"}
                                <ShieldCheck className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <p className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Setup — Your identity matters</p>
        </div>
    );
}

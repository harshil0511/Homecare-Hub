"use client";

import { useState, useEffect, useRef } from "react";
import {
    User, Shield, CheckCircle2, AlertCircle, Briefcase,
    Upload, Trash2, FileText, Plus, X, Camera
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

const ALLOWED_CATEGORIES = [
    "AC Service",
    "Appliance Repair",
    "Home Cleaning",
    "Plumbing",
    "Electrical",
    "Pest Control",
    "Painting",
    "Carpentry",
    "General Maintenance",
];

const GENDER_OPTIONS = ["Male", "Female", "Other"];

const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5";
const inputCls = "w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-slate-900 outline-none focus:ring-2 focus:ring-[#064e3b] focus:bg-white transition-all font-semibold text-sm";
const readonlyCls = "w-full bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-slate-500 cursor-not-allowed font-semibold text-sm";

export default function ServicerProfilePage() {
    // Account state
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");

    // Provider profile state
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [bio, setBio] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [hourlyRate, setHourlyRate] = useState<number | "">("");
    const [experienceYears, setExperienceYears] = useState<number | "">("");
    const [education, setEducation] = useState("");
    const [location, setLocation] = useState("");
    const [age, setAge] = useState<number | "">("");
    const [gender, setGender] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState("");
    const [photoUrl, setPhotoUrl] = useState("");
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [profileError, setProfileError] = useState("");

    // Certificate state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [certificates, setCertificates] = useState<Record<string, any>[]>([]);
    const [showCertForm, setShowCertForm] = useState(false);
    const [certCategory, setCertCategory] = useState("");
    const [certTitle, setCertTitle] = useState("");
    const [certFile, setCertFile] = useState<File | null>(null);
    const [uploadingCert, setUploadingCert] = useState(false);
    const [certError, setCertError] = useState("");
    const certFileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiFetch("/user/me").catch(() => null),
            apiFetch("/services/providers/me").catch(async () => {
                // Profile doesn't exist yet — create a minimal one
                try {
                    return await apiFetch("/services/providers/setup", {
                        method: "POST",
                        body: JSON.stringify({}),
                    });
                } catch {
                    return null;
                }
            }),
        ]).then(([me, prov]) => {
            if (me) {
                setUsername(me.username || "");
                setEmail(me.email || "");
            }
            if (prov) {
                setFirstName(prov.first_name || "");
                setLastName(prov.last_name || "");
                setPhone(prov.phone || "");
                setBio(prov.bio || "");
                let cats: string[] = [];
                try {
                    cats = Array.isArray(prov.categories) ? prov.categories :
                        JSON.parse(prov.categories || "[]");
                } catch {
                    cats = [];
                }
                setSelectedCategories(cats);
                setHourlyRate(prov.hourly_rate || "");
                setExperienceYears(prov.experience_years || "");
                setEducation(prov.education || "");
                setLocation(prov.location || "");
                setAge(prov.age || "");
                setGender(prov.gender || "");
                setPhotoUrl(prov.profile_photo_url || "");
                setCertificates(prov.certificates || []);
            }
        }).finally(() => setLoading(false));
    }, []);

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setProfileError("Only JPEG, PNG, or WebP images are allowed for profile photo.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setProfileError("Profile photo must be under 5MB.");
            return;
        }
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setProfileError("");
    };

    const isProfileValid = username.trim() && firstName.trim() && lastName.trim() && phone.trim() && bio.trim() && selectedCategories.length > 0 && hourlyRate !== "" && Number(hourlyRate) > 0;

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isProfileValid) return;
        setSavingProfile(true); setProfileError(""); setProfileSuccess(false);
        try {
            await apiFetch("/user/me", { method: "PATCH", body: JSON.stringify({ username }) });
            let finalPhotoUrl = photoUrl;
            if (photoFile) {
                const fd = new FormData();
                fd.append("file", photoFile);
                const uploadRes = await apiFetch("/services/providers/upload-photo", { method: "POST", body: fd });
                finalPhotoUrl = uploadRes.url;
                setPhotoUrl(finalPhotoUrl);
                setPhotoFile(null);
                setPhotoPreview("");
            }
            await apiFetch("/services/providers/me", {
                method: "PATCH",
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    bio,
                    categories: selectedCategories,
                    hourly_rate: Number(hourlyRate),
                    experience_years: experienceYears !== "" ? Number(experienceYears) : undefined,
                    education: education || undefined,
                    location: location || undefined,
                    age: age !== "" ? Number(age) : undefined,
                    gender: gender || undefined,
                    profile_photo_url: finalPhotoUrl || undefined,
                }),
            });
            setProfileSuccess(true);
            setTimeout(() => setProfileSuccess(false), 3000);
        } catch (err) {
            setProfileError((err as Error).message || "Failed to update profile");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCertFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowed = ["application/pdf", "image/jpeg", "image/png"];
        if (!allowed.includes(file.type)) {
            setCertError("Only PDF, JPEG, or PNG files are allowed.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setCertError("Certificate file must be under 5MB.");
            return;
        }
        setCertFile(file);
        setCertError("");
    };

    const handleUploadCert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!certFile || !certCategory || !certTitle.trim()) return;
        setUploadingCert(true); setCertError("");
        try {
            const fd = new FormData();
            fd.append("file", certFile);
            fd.append("category", certCategory);
            fd.append("title", certTitle.trim());
            const newCert = await apiFetch("/services/providers/certificates/upload", { method: "POST", body: fd });
            setCertificates(prev => [...prev, newCert]);
            setShowCertForm(false);
            setCertCategory(""); setCertTitle(""); setCertFile(null);
            if (certFileInputRef.current) certFileInputRef.current.value = "";
        } catch (err) {
            setCertError((err as Error).message || "Failed to upload certificate");
        } finally {
            setUploadingCert(false);
        }
    };

    const handleDeleteCert = async (certId: number) => {
        if (!confirm("Delete this certificate?")) return;
        try {
            await apiFetch(`/services/providers/certificates/${certId}`, { method: "DELETE" });
            setCertificates(prev => prev.filter(c => c.id !== certId));
        } catch (err) {
            alert((err as Error).message || "Failed to delete certificate");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#064e3b] border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto py-8 space-y-6">

            {/* ── Account Details (read-only info) ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-emerald-50 rounded-xl"><User className="w-4 h-4 text-emerald-700" /></div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Account Details</h2>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className={labelCls}>Email Address</label>
                        <input className={readonlyCls} value={email} readOnly />
                    </div>
                    <div>
                        <label className={labelCls}>Role</label>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <Briefcase className="w-3 h-3" /> SERVICER
                        </span>
                    </div>
                </div>
            </div>

            {/* ── My Profile ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 rounded-xl"><Shield className="w-4 h-4 text-slate-600" /></div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">My Profile</h2>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-5">
                    {profileSuccess && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs font-black uppercase tracking-widest">Profile updated successfully</span>
                        </div>
                    )}
                    {profileError && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            <span className="text-xs font-semibold">{profileError}</span>
                        </div>
                    )}

                    {/* Display Name */}
                    <div>
                        <label className={labelCls}>Display Name <span className="text-rose-500">*</span></label>
                        <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. ravi_plumber" required />
                        <p className="text-[10px] text-slate-400 mt-1">Your app username — shown to other users</p>
                    </div>

                    {/* Photo */}
                    <div>
                        <label className={labelCls}>Profile Photo</label>
                        <div className="flex items-center gap-4">
                            <div
                                onClick={() => photoInputRef.current?.click()}
                                className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:border-[#064e3b] transition-all flex-shrink-0"
                            >
                                {photoPreview ? (
                                    <Image src={photoPreview} alt="Preview" width={64} height={64} className="w-full h-full object-cover" />
                                ) : photoUrl ? (
                                    <Image src={photoUrl.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${photoUrl}` : photoUrl} alt="Current" width={64} height={64} className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-5 h-5 text-slate-300" />
                                )}
                            </div>
                            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} className="hidden" />
                            <button type="button" onClick={() => photoInputRef.current?.click()} className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline">
                                {photoFile ? photoFile.name : "Choose Photo"}
                            </button>
                        </div>
                    </div>

                    {/* Name row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>First Name <span className="text-rose-500">*</span></label>
                            <input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ravi" required />
                        </div>
                        <div>
                            <label className={labelCls}>Last Name <span className="text-rose-500">*</span></label>
                            <input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Kumar" required />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className={labelCls}>Phone <span className="text-rose-500">*</span></label>
                        <input className={inputCls} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className={labelCls}>Bio <span className="text-rose-500">*</span></label>
                        <textarea
                            className={`${inputCls} resize-none`}
                            rows={3}
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="Tell customers about your skills and experience..."
                            required
                        />
                    </div>

                    {/* Categories */}
                    <div>
                        <label className={labelCls}>Service Categories <span className="text-rose-500">*</span></label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {ALLOWED_CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => toggleCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${
                                        selectedCategories.includes(cat)
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {selectedCategories.length === 0 && (
                            <p className="text-[10px] text-rose-500 mt-1 font-semibold">Select at least one category</p>
                        )}
                    </div>

                    {/* Rate */}
                    <div>
                        <label className={labelCls}>Hourly Rate (₹) <span className="text-rose-500">*</span></label>
                        <input className={inputCls} type="number" min="0" value={hourlyRate} onChange={e => setHourlyRate(e.target.value === "" ? "" : Number(e.target.value))} placeholder="500" required />
                    </div>

                    {/* Optional fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Experience (Years)</label>
                            <input className={inputCls} type="number" min="0" value={experienceYears} onChange={e => setExperienceYears(e.target.value === "" ? "" : Number(e.target.value))} placeholder="3" />
                        </div>
                        <div>
                            <label className={labelCls}>Age</label>
                            <input className={inputCls} type="number" min="18" max="80" value={age} onChange={e => setAge(e.target.value === "" ? "" : Number(e.target.value))} placeholder="28" />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Education / Qualification</label>
                        <input className={inputCls} value={education} onChange={e => setEducation(e.target.value)} placeholder="e.g. ITI Electrician, BE Mechatronics" />
                    </div>

                    <div>
                        <label className={labelCls}>Location</label>
                        <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai, Maharashtra" />
                    </div>

                    <div>
                        <label className={labelCls}>Gender</label>
                        <select className={inputCls} value={gender} onChange={e => setGender(e.target.value)}>
                            <option value="">Prefer not to say</option>
                            {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={savingProfile || !isProfileValid}
                        className="w-full bg-[#064e3b] hover:bg-emerald-950 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 uppercase tracking-widest text-xs"
                    >
                        {savingProfile ? "Saving..." : "Save Profile"}
                    </button>
                </form>
            </div>

            {/* ── Your Certificates ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl"><FileText className="w-4 h-4 text-blue-600" /></div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Your Certificates</h2>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Upload qualifications to get verified</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (showCertForm) {
                                setCertFile(null);
                                setCertTitle("");
                                setCertCategory("");
                                if (certFileInputRef.current) certFileInputRef.current.value = "";
                            }
                            setShowCertForm(v => !v);
                            setCertError("");
                        }}
                        className="flex items-center gap-1.5 bg-[#064e3b] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-emerald-950 transition-all"
                    >
                        {showCertForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {showCertForm ? "Cancel" : "Upload Certificate"}
                    </button>
                </div>

                {/* Upload form */}
                {showCertForm && (
                    <form onSubmit={handleUploadCert} className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-5 space-y-4">
                        {certError && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                <span className="text-xs font-semibold">{certError}</span>
                            </div>
                        )}
                        <div>
                            <label className={labelCls}>Category <span className="text-rose-500">*</span></label>
                            <select
                                className={inputCls}
                                value={certCategory}
                                onChange={e => setCertCategory(e.target.value)}
                                required
                            >
                                <option value="">Select a category</option>
                                {ALLOWED_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Certificate Title <span className="text-rose-500">*</span></label>
                            <input
                                className={inputCls}
                                value={certTitle}
                                onChange={e => setCertTitle(e.target.value)}
                                placeholder="e.g. Electrician Safety Certificate"
                                required
                            />
                        </div>
                        <div>
                            <label className={labelCls}>File (PDF, JPG, PNG — max 5MB) <span className="text-rose-500">*</span></label>
                            <div
                                onClick={() => certFileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#064e3b] transition-all"
                            >
                                {certFile ? (
                                    <p className="text-sm font-black text-slate-700">{certFile.name}</p>
                                ) : (
                                    <>
                                        <Upload className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Click to select file</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={certFileInputRef}
                                type="file"
                                accept="application/pdf,image/jpeg,image/png"
                                onChange={handleCertFileSelect}
                                className="hidden"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={uploadingCert || !certFile || !certCategory || !certTitle.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 uppercase tracking-widest text-xs"
                        >
                            {uploadingCert ? "Uploading..." : "Upload Certificate"}
                        </button>
                    </form>
                )}

                {/* Certificate list */}
                {certificates.length === 0 ? (
                    <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                            <FileText className="w-5 h-5 text-slate-300" />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No certificates uploaded yet</p>
                        <p className="text-[11px] text-slate-400 mt-1">Upload your qualifications to get verified</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {certificates.map((cert) => (
                            <div key={cert.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl group hover:border-blue-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{cert.title || "Certificate"}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase tracking-wide">{cert.category}</span>
                                            {cert.is_verified ? (
                                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">Verified</span>
                                            ) : (
                                                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Under Review</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {cert.certificate_url && (
                                        <a
                                            href={cert.certificate_url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${cert.certificate_url}` : cert.certificate_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                        >
                                            View
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleDeleteCert(cert.id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                        title="Delete certificate"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

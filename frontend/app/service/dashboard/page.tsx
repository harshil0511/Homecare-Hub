"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Clock, Star, TrendingUp, CheckCircle2, ChevronRight, MapPin, DollarSign, Calendar, GraduationCap, ShieldCheck, Upload, CircleDot, Pencil, Camera, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

import Link from "next/link";

export default function ServicerDashboard() {
    const router = useRouter();
    const [jobs, setJobs] = useState([]);
    const [profile, setProfile] = useState<any>(null);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [showEditBio, setShowEditBio] = useState(false);

    // Form states
    const [editBio, setEditBio] = useState("");
    const [editEdu, setEditEdu] = useState("");
    const [editExp, setEditExp] = useState(0);
    const [editRate, setEditRate] = useState(0);
    const [editPhone, setEditPhone] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [editPhoto, setEditPhoto] = useState("");
    const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState<string>("");
    const editFileInputRef = useRef<HTMLInputElement>(null);

    // Profile completeness check - mandatory fields
    const isProfileComplete = (p: any) => {
        return p && p.first_name && p.last_name && p.phone && p.phone !== "Not Provided" && p.email && p.location && p.categories?.length > 0;
    };

    // Setup completion helper
    const getSetupSteps = () => {
        return [
            { label: "Add your name and details", done: !!profile?.first_name },
            { label: "Add contact info", done: !!profile?.phone && profile?.phone !== "Not Provided" && !!profile?.email },
            { label: "Set your location", done: !!profile?.location },
            { label: "Choose your services", done: profile?.categories?.length > 0 },
            { label: "Write a short bio", done: !!profile?.bio },
            { label: "Get verified", done: !!profile?.is_verified },
        ];
    };

    const setupSteps = profile ? getSetupSteps() : [];
    const setupComplete = setupSteps.length > 0 && setupSteps.every(s => s.done);
    const completedCount = setupSteps.filter(s => s.done).length;

    const [filterStatus, setFilterStatus] = useState("ACTIVE"); // ACTIVE, COMPLETED, CANCELLED, ALL

    const fetchData = async () => {
        try {
            // First check if servicer has a profile at all
            let myProfile = null;
            try {
                myProfile = await apiFetch("/services/providers/me");
                if (typeof myProfile.categories === 'string') {
                    try {
                        myProfile.categories = JSON.parse(myProfile.categories);
                    } catch (e) {
                        myProfile.categories = [];
                    }
                }
            } catch {
                // No profile exists - redirect to mandatory setup
                router.push("/dashboard/servicer/setup");
                return;
            }

            // If profile exists but critical fields are missing, redirect to setup
            if (!isProfileComplete(myProfile)) {
                router.push("/dashboard/servicer/setup");
                return;
            }

            const jobsData = await apiFetch("/bookings/list");
            // Corrected recruitment endpoint
            const invitesData = await apiFetch("/services/societies/requests/me");
            setJobs(jobsData);
            setProfile(myProfile);
            setInvitations(invitesData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleInviteResponse = async (id: number, status: string) => {
        try {
            await apiFetch(`/services/societies/requests/${id}/action`, {
                method: "POST",
                body: JSON.stringify({ status })
            });
            alert(`Invitation ${status.toLowerCase()}ed!`);
            fetchData();
        } catch (err) {
            alert("Failed to respond to invitation");
        }
    };

    const filteredJobs = jobs.filter((j: any) => {
        if (filterStatus === "ALL") return true;
        if (filterStatus === "ACTIVE") return j.status !== "Completed" && j.status !== "Cancelled";
        return j.status === filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase();
    });

    const handleStatusChange = async (newStatus: string) => {
        setUpdatingStatus(true);
        try {
            await apiFetch("/services/providers/availability", {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });
            setProfile({ ...profile, availability_status: newStatus });
        } catch (err) {
            alert("Failed to update status");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type)) { alert("Only JPEG, PNG, and WebP images are allowed."); return; }
        if (file.size > 5 * 1024 * 1024) { alert("File too large. Maximum 5MB."); return; }
        setEditPhotoFile(file);
        setEditPhotoPreview(URL.createObjectURL(file));
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let photoUrl = editPhoto;

            if (editPhotoFile) {
                const fd = new FormData();
                fd.append("file", editPhotoFile);
                const uploadRes = await apiFetch("/services/providers/upload-photo", {
                    method: "POST",
                    body: fd,
                });
                photoUrl = uploadRes.url;
            }

            const updated = await apiFetch("/services/providers/me", {
                method: "PATCH",
                body: JSON.stringify({
                    bio: editBio,
                    education: editEdu,
                    experience_years: editExp,
                    hourly_rate: editRate,
                    phone: editPhone,
                    email: editEmail,
                    location: editLocation,
                    profile_photo_url: photoUrl
                })
            });
            setProfile(updated);
            setShowEditBio(false);
            setEditPhotoFile(null);
            setEditPhotoPreview("");
            alert("Profile updated!");
        } catch (err) {
            alert("Failed to update profile.");
        }
    };

    const handleApplyVerification = async () => {
        try {
            const result = await apiFetch("/services/providers/verify", {
                method: "POST"
            });
            alert(result.message);
            if (result.verified) {
                setProfile({ ...profile, is_verified: true });
            }
        } catch (err) {
            alert("Verification request failed. Please try again.");
        }
    };

    useEffect(() => {
        if (profile) {
            setEditBio(profile.bio || "");
            setEditEdu(profile.education || "");
            setEditExp(profile.experience_years || 0);
            setEditRate(profile.hourly_rate || 0);
            setEditPhone(profile.phone || "");
            setEditEmail(profile.email || "");
            setEditLocation(profile.location || "");
            setEditPhoto(profile.profile_photo_url || "");
        }
    }, [profile]);

    if (loading) return null;

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">My Dashboard</h1>
                    <p className="text-slate-600 text-xs font-black uppercase tracking-[0.2em] mt-1">
                        {profile?.first_name ? `Welcome back, ${profile.first_name}` : "Welcome to your dashboard"}
                    </p>
                </div>
                {/* Availability Status */}
                <select
                    value={profile?.availability_status || "AVAILABLE"}
                    disabled={updatingStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase border transition-all outline-none cursor-pointer tracking-[0.15em] ${profile?.availability_status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        profile?.availability_status === "WORKING" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            "bg-rose-50 text-rose-700 border-rose-100"
                        }`}
                >
                    <option value="AVAILABLE">🟢 Available</option>
                    <option value="WORKING">🟡 On a Job</option>
                    <option value="VACATION">🔴 Vacation</option>
                </select>
            </div>

            {/* Onboarding Banner - shows when profile is incomplete */}
            {profile && !setupComplete && (
                <div className="bg-white border-l-4 border-l-[#064e3b] border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                            <h2 className="text-lg font-black text-[#000000] tracking-tight">
                                Let&apos;s finish setting up your profile
                            </h2>
                            <p className="text-slate-500 text-xs font-bold mt-1">
                                Complete these steps so customers can find and book you.
                            </p>
                            <div className="mt-4 space-y-2">
                                {setupSteps.map((step, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        {step.done ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        ) : (
                                            <CircleDot className="w-5 h-5 text-slate-300 flex-shrink-0" />
                                        )}
                                        <span className={`text-sm font-bold ${step.done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
                                {completedCount} of {setupSteps.length} steps done
                            </p>
                        </div>
                        <div className="flex-shrink-0">
                            <Link
                                href="/dashboard/servicer/setup"
                                className="inline-flex items-center gap-3 bg-[#064e3b] text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.15em] hover:bg-emerald-950 transition-all shadow-lg shadow-emerald-900/10 active:scale-95"
                            >
                                Continue Setup
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Society Invitations */}
            {invitations.length > 0 && (
                <div className="bg-white border-l-4 border-l-[#064e3b] border border-slate-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-right-4">
                    <div className="flex items-center gap-3 mb-6">
                        <Building2 className="w-5 h-5 text-[#064e3b]" />
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Society Invitations</h2>
                        <span className="bg-emerald-50 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full">{invitations.length} New</span>
                    </div>

                    <div className="space-y-4">
                        {invitations.map((invite) => (
                            <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 gap-4">
                                <div>
                                    <h4 className="font-bold text-[#000000] text-sm">Join a Trusted Network</h4>
                                    <p className="text-[11px] text-slate-500 mt-1 italic">&quot;{invite.message}&quot;</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleInviteResponse(invite.id, "REJECTED")}
                                        className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-[10px] font-black uppercase transition-all"
                                    >
                                        Decline
                                    </button>
                                    <button
                                        onClick={() => handleInviteResponse(invite.id, "ACCEPTED")}
                                        className="px-4 py-2 bg-[#064e3b] text-white hover:bg-emerald-950 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg shadow-[#064e3b]/10"
                                    >
                                        Accept Invite
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-50 text-[#064e3b] rounded-2xl flex items-center justify-center">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">{jobs.length}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Active Jobs</p>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Week 12</span>
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">${jobs.filter((j: any) => j.status === "Completed").reduce((sum: number, j: any) => sum + (j.estimated_cost || 0), 0).toFixed(2)}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Total Earnings</p>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                            <Star className="w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Top Rated</p>
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">{profile?.rating?.toFixed(2) || "0.00"}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Your Rating</p>
                </div>
            </div>

            {/* Upcoming Jobs */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[40vh] flex flex-col">
                <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#064e3b]" />
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Job History</h2>
                    </div>
                    
                    <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                        {["ACTIVE", "COMPLETED", "CANCELLED", "ALL"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    filterStatus === status 
                                    ? "bg-[#064e3b] text-white shadow-lg shadow-emerald-900/10" 
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredJobs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-[#000000] tracking-tight">No Results</h3>
                        <p className="text-slate-600 text-xs font-bold uppercase tracking-widest mt-2">No jobs match the selected filter.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filteredJobs.map((job: any) => (
                            <div key={job.id} className="px-10 py-8 hover:bg-slate-50/80 transition-all cursor-pointer group flex items-center justify-between">
                                <div className="flex items-center gap-8">
                                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-[#064e3b] transition-colors">
                                        <Briefcase className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <h4 className="text-lg font-black text-[#000000] tracking-tight group-hover:text-[#064e3b] transition-colors uppercase">{job.service_type || job.title} Service</h4>
                                        <div className="flex items-center gap-5 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {job.property_details || "No location"}</span>
                                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : job.due_date || "No date"}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden md:block">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1 leading-none">Estimate</p>
                                        <p className="text-sm font-black text-[#000000] uppercase">${job.estimated_cost?.toFixed(2) || "0.00"}</p>
                                    </div>
                                    <ChevronRight className="w-6 h-6 text-slate-100 group-hover:text-slate-900 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* My Profile Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    {/* Profile Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-[#000000] uppercase tracking-tight">My Profile</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Your professional information</p>
                        </div>
                        {profile?.is_verified ? (
                            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-emerald-100 shadow-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                Verified
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-slate-50 text-slate-400 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-slate-100 italic">
                                Not Yet Verified
                            </div>
                        )}
                    </div>

                    {/* Two-column layout */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {/* Left: Bio + Availability */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">About You</p>
                                <p className="text-xl font-bold text-slate-800 leading-[1.6]">
                                    {profile?.bio || "No bio added yet. Tell customers about your skills and experience."}
                                </p>
                            </div>
                        </div>

                        {/* Right: Credentials */}
                        <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                        <GraduationCap className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Education</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{profile?.education || "N/A"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Experience</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{profile?.experience_years || 0} Years</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                        <Briefcase className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Services You Offer</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {profile?.categories && profile.categories.length > 0 ? (
                                                profile.categories.map((cat: string) => (
                                                    <span key={cat} className="bg-white border border-slate-100 text-[9px] font-black px-2 py-0.5 rounded text-slate-600 uppercase tracking-tighter">
                                                        {cat}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[9px] text-slate-400 italic">No services selected</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Rate</p>
                                <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter">${profile?.hourly_rate || 0}.00 <span className="text-[10px] text-slate-400">/ HR</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-8 mt-4 border-t border-slate-100">
                        <button
                            onClick={() => setShowEditBio(true)}
                            className="flex-1 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center justify-center gap-3"
                        >
                            <Pencil className="w-4 h-4" />
                            Edit Profile
                        </button>
                        {!profile?.is_verified && (
                            <button
                                onClick={handleApplyVerification}
                                className="flex-1 bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-blue-600/10 active:scale-95 flex items-center justify-center gap-3"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Get Verified
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Your Certificates */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-xl font-black text-[#000000] uppercase tracking-tight">Your Certificates</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Upload your qualifications to get verified</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {profile?.categories?.map((cat: string) => {
                        const hasCert = profile.certificates?.some((c: any) => c.category === cat);
                        const isVerified = profile.certificates?.find((c: any) => c.category === cat)?.is_verified;

                        return (
                            <div key={cat} className="bg-slate-50 border border-slate-100 p-5 rounded-xl flex flex-col justify-between group hover:border-blue-200 transition-all">
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm text-blue-600">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        {isVerified ? (
                                            <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Verified</span>
                                        ) : hasCert ? (
                                            <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Under Review</span>
                                        ) : (
                                            <span className="bg-slate-200 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Not Uploaded</span>
                                        )}
                                    </div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{cat}</h3>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Upload your certificate or degree</p>
                                </div>

                                <button
                                    onClick={() => {
                                        const url = prompt(`Paste the URL for your ${cat} certificate:`);
                                        if (url) {
                                            apiFetch("/services/providers/certificates", {
                                                method: "POST",
                                                body: JSON.stringify({ category: cat, certificate_url: url })
                                            }).then(() => {
                                                alert("Certificate uploaded! We'll review it shortly.");
                                                window.location.reload();
                                            });
                                        }
                                    }}
                                    className={`mt-8 w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 ${hasCert ? "bg-white text-slate-900 border border-slate-200" : "bg-blue-600 text-white shadow-lg shadow-blue-600/10 hover:bg-blue-700"
                                        }`}
                                >
                                    {hasCert ? "Update Document" : "Upload Certificate"}
                                    <Upload className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                    {(!profile?.categories || profile.categories.length === 0) && (
                        <div className="col-span-full py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl relative overflow-hidden">

                            {/* subtle background glow */}
                            <div className="absolute inset-0 opacity-30 pointer-events-none">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-100 rounded-full blur-3xl"></div>
                            </div>

                            <div className="relative z-10 flex flex-col items-center justify-center gap-4">

                                {/* icon */}
                                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                    <Briefcase className="w-6 h-6 text-blue-500" />
                                </div>

                                {/* main text */}
                                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                                    No services selected yet
                                </p>

                                {/* sub hint (new but clean) */}
                                <p className="text-slate-400 text-[11px] font-medium tracking-wide max-w-xs">
                                    Add your services to start receiving job requests from users
                                </p>

                                {/* CTA */}
                                <Link
                                    href="/dashboard/servicer/setup"
                                    className="text-blue-600 text-xs font-black uppercase tracking-widest hover:underline mt-2 inline-block"
                                >
                                    Set up your profile →
                                </Link>

                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Profile Modal */}
            {showEditBio && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-[#064e3b]/20 backdrop-blur-sm" onClick={() => setShowEditBio(false)} />
                    <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-10">
                            <h3 className="text-xl font-black text-[#000000] tracking-tight uppercase mb-8">Edit Your Profile</h3>
                            <form onSubmit={handleUpdateProfile} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
                                        <input
                                            type="tel"
                                            value={editPhone}
                                            onChange={e => setEditPhone(e.target.value)}
                                            placeholder="+91 98765 43210"
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-2 focus:ring-[#064e3b]/20 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                                        <input
                                            type="email"
                                            value={editEmail}
                                            onChange={e => setEditEmail(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-2 focus:ring-[#064e3b]/20 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                                    <input
                                        type="text"
                                        value={editLocation}
                                        onChange={e => setEditLocation(e.target.value)}
                                        placeholder="e.g. Mumbai, Maharashtra"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-2 focus:ring-[#064e3b]/20 outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Photo</label>
                                    <div className="flex items-center gap-4">
                                        <div
                                            onClick={() => editFileInputRef.current?.click()}
                                            className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:border-[#064e3b] transition-all flex-shrink-0"
                                        >
                                            {editPhotoPreview ? (
                                                <Image src={editPhotoPreview} alt="Preview" width={64} height={64} className="w-full h-full object-cover" />
                                            ) : editPhoto ? (
                                                <Image src={editPhoto.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${editPhoto}` : editPhoto} alt="Current" width={64} height={64} className="w-full h-full object-cover" />
                                            ) : (
                                                <Camera className="w-5 h-5 text-slate-300" />
                                            )}
                                        </div>
                                        <input
                                            ref={editFileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleEditFileSelect}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => editFileInputRef.current?.click()}
                                            className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline"
                                        >
                                            {editPhotoFile ? editPhotoFile.name : "Choose Photo"}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Education / Qualification</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ITI Electrician, BE Mechatronics"
                                        value={editEdu}
                                        onChange={e => setEditEdu(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-2 focus:ring-[#064e3b]/20 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Years of Experience</label>
                                        <input
                                            type="number"
                                            value={editExp}
                                            onChange={e => setEditExp(parseInt(e.target.value))}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#000000] outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Hourly Rate ($)</label>
                                        <input
                                            type="number"
                                            value={editRate}
                                            onChange={e => setEditRate(parseFloat(e.target.value))}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#000000] outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">About You</label>
                                    <textarea
                                        rows={3}
                                        value={editBio}
                                        onChange={e => setEditBio(e.target.value)}
                                        placeholder="Tell customers about your skills and experience..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#000000] placeholder:text-slate-300 focus:ring-2 focus:ring-[#064e3b]/20 outline-none resize-none"
                                    />
                                </div>
                                <button type="submit" className="w-full bg-[#064e3b] text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-950 transition-all active:scale-95">
                                    Save Changes
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

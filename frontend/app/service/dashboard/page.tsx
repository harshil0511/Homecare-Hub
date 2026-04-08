"use client";

import { useEffect, useState } from "react";
import {
    Briefcase, Clock, Star, TrendingUp, CheckCircle2,
    ChevronRight, MapPin, DollarSign, Calendar, GraduationCap,
    ShieldCheck, Building2, Phone, AlertTriangle, User
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

export default function ServicerDashboard() {
    const [jobs, setJobs] = useState([]);
    const [profile, setProfile] = useState<any>(null);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [filterStatus, setFilterStatus] = useState("ACTIVE");
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            let myProfile = await apiFetch("/services/providers/me").catch(() => null);
            if (myProfile && typeof myProfile.categories === "string") {
                try { myProfile.categories = JSON.parse(myProfile.categories); }
                catch { myProfile.categories = []; }
            }
            const jobsData = await apiFetch("/bookings/list").catch(() => []);
            const invitesData = await apiFetch("/services/societies/requests/me").catch(() => []);
            setProfile(myProfile);
            setJobs(jobsData || []);
            setInvitations(invitesData || []);
        } catch (err: any) {
            if ((err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) || err?.message?.toLowerCase().includes("timed out") || err?.message?.toLowerCase().includes("request timed out")) {
                setFetchError("Could not connect to the server. Please ensure the backend is running.");
            } else {
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleInviteResponse = async (id: number, status: string) => {
        try {
            await apiFetch(`/services/societies/requests/${id}/action`, {
                method: "POST",
                body: JSON.stringify({ status })
            });
            fetchData();
        } catch {
            alert("Failed to respond to invitation");
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        setUpdatingStatus(true);
        try {
            await apiFetch("/services/providers/availability", {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus })
            });
            setProfile({ ...profile, availability_status: newStatus });
        } catch {
            alert("Failed to update status");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const filteredJobs = jobs.filter((j: any) => {
        if (filterStatus === "ALL") return true;
        if (filterStatus === "ACTIVE") return j.status !== "Completed" && j.status !== "Cancelled";
        return j.status === filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase();
    });

    const isProfileIncomplete = !profile || !profile.first_name || !profile.categories?.length || !profile.hourly_rate;

    if (loading) return null;

    return (
        <div className="space-y-8 pb-12">

            {/* Fetch error */}
            {fetchError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#000000] tracking-tight uppercase">My Dashboard</h1>
                    <p className="text-slate-600 text-xs font-black uppercase tracking-[0.2em] mt-1">
                        {profile?.first_name ? `Welcome back, ${profile.first_name}` : "Welcome to your dashboard"}
                    </p>
                </div>
                <select
                    value={profile?.availability_status || "AVAILABLE"}
                    disabled={updatingStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase border transition-all outline-none cursor-pointer tracking-[0.15em] ${
                        profile?.availability_status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        profile?.availability_status === "WORKING"   ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                                        "bg-rose-50 text-rose-700 border-rose-100"
                    }`}
                >
                    <option value="AVAILABLE">🟢 Available</option>
                    <option value="WORKING">🟡 On a Job</option>
                    <option value="VACATION">🔴 Vacation</option>
                </select>
            </div>

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
                                    <button onClick={() => handleInviteResponse(invite.id, "REJECTED")} className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-[10px] font-black uppercase transition-all">Decline</button>
                                    <button onClick={() => handleInviteResponse(invite.id, "ACCEPTED")} className="px-4 py-2 bg-[#064e3b] text-white hover:bg-emerald-950 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg shadow-[#064e3b]/10">Accept Invite</button>
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
                        <div className="w-12 h-12 bg-emerald-50 text-[#064e3b] rounded-2xl flex items-center justify-center"><Briefcase className="w-6 h-6" /></div>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">{jobs.length}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Active Jobs</p>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><DollarSign className="w-6 h-6" /></div>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Week 12</span>
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">₹{jobs.filter((j: any) => j.status === "Completed").reduce((sum: number, j: any) => sum + (j.estimated_cost || 0), 0).toFixed(2)}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Total Earnings</p>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center"><Star className="w-6 h-6" /></div>
                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Top Rated</p>
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">{profile?.rating?.toFixed(2) || "0.00"}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Your Rating</p>
                </div>
            </div>

            {/* Read-Only Profile Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
                <div className="relative z-10">

                    {/* Incomplete profile banner */}
                    {isProfileIncomplete && (
                        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Your profile is incomplete — fill in your details to start receiving jobs.</p>
                            </div>
                            <Link href="/service/settings/profile" className="flex-shrink-0 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-amber-700 transition-all">
                                Complete Profile →
                            </Link>
                        </div>
                    )}

                    {/* Profile header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-[#000000] uppercase tracking-tight">My Profile</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Your professional information</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {profile?.is_verified ? (
                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-emerald-100 shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" /> Verified
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 bg-slate-50 text-slate-400 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-slate-100 italic">
                                    Not Yet Verified
                                </div>
                            )}
                            <Link href="/service/settings/profile" className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                                Edit Profile <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                    {/* Profile body — two columns */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {/* Left: photo + bio */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="flex items-start gap-5">
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100 flex items-center justify-center">
                                    {profile?.profile_photo_url ? (
                                        <Image
                                            src={profile.profile_photo_url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL}${profile.profile_photo_url}` : profile.profile_photo_url}
                                            alt="Profile"
                                            width={64}
                                            height={64}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-7 h-7 text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-lg font-black text-[#000000] uppercase tracking-tight">
                                        {profile?.first_name && profile?.last_name
                                            ? `${profile.first_name} ${profile.last_name}`
                                            : profile?.owner_name || "No name set"}
                                    </p>
                                    {profile?.location && (
                                        <p className="text-xs font-black text-slate-500 flex items-center gap-1 mt-1">
                                            <MapPin className="w-3 h-3" /> {profile.location}
                                        </p>
                                    )}
                                    {profile?.phone && (
                                        <p className="text-xs font-black text-slate-500 flex items-center gap-1 mt-1">
                                            <Phone className="w-3 h-3" /> {profile.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">About You</p>
                                <p className="text-base font-bold text-slate-800 leading-[1.6]">
                                    {profile?.bio || "No bio added yet. Tell customers about your skills and experience."}
                                </p>
                            </div>

                            {profile?.categories && profile.categories.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Services Offered</p>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.categories.map((cat: string) => (
                                            <span key={cat} className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide">{cat}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: credentials */}
                        <div className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
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
                                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Certificates</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{profile?.certificates?.length || 0} Uploaded</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Rate</p>
                                <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter">₹{profile?.hourly_rate || 0}.00 <span className="text-[10px] text-slate-400">/ HR</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Job History */}
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
                    <div className="flex-1 flex items-center justify-center p-20">
                        <EmptyState icon={CheckCircle2} title="No Results" description="No jobs match the selected filter." />
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
                                        <p className="text-sm font-black text-[#000000] uppercase">₹{job.estimated_cost?.toFixed(2) || "0.00"}</p>
                                    </div>
                                    <ChevronRight className="w-6 h-6 text-slate-100 group-hover:text-slate-900 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

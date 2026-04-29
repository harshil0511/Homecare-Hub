"use client";

import { useEffect, useState } from "react";
import {
    Briefcase, Clock, Star, TrendingUp, CheckCircle2,
    ChevronRight, MapPin, DollarSign, Calendar, GraduationCap,
    ShieldCheck, Building2, Phone, AlertTriangle, User, CreditCard,
    X, IndianRupee, FileText, MessageSquare, ShieldAlert,
} from "lucide-react";
import { apiFetch, emergencyApi } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

export default function ServicerDashboard() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [jobs, setJobs] = useState<Record<string, any>[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [profile, setProfile] = useState<Record<string, any> | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [invitations, setInvitations] = useState<Record<string, any>[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [filterStatus, setFilterStatus] = useState("ACTIVE");
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [hasPaymentProfile, setHasPaymentProfile] = useState<boolean | null>(null);
    const [incomingRequestCount, setIncomingRequestCount] = useState(0);
    const [incomingEmergencyCount, setIncomingEmergencyCount] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedJob, setSelectedJob] = useState<Record<string, any> | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [jobDetail, setJobDetail] = useState<Record<string, any> | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const fetchData = async () => {
        try {
            const myProfile = await apiFetch("/services/providers/me").catch(() => null);
            if (myProfile && typeof myProfile.categories === "string") {
                try { myProfile.categories = JSON.parse(myProfile.categories); }
                catch { myProfile.categories = []; }
            }
            const jobsData = await apiFetch("/bookings/list").catch(() => []);
            const invitesData = await apiFetch("/services/societies/requests/me").catch(() => []);
            setProfile(myProfile);
            setJobs(jobsData || []);
            setInvitations(invitesData || []);
            apiFetch("/payment/provider")
                .then(() => setHasPaymentProfile(true))
                .catch(() => setHasPaymentProfile(false));
            apiFetch("/requests/incoming")
                .then((reqs: unknown[]) => setIncomingRequestCount((reqs || []).length))
                .catch(() => {});
            emergencyApi.getIncoming()
                .then(ems => setIncomingEmergencyCount((ems || []).filter(e => !e.has_responded).length))
                .catch(() => {});
        } catch (err) {
            const errMsg = err instanceof Error ? err.message.toLowerCase() : "";
            if ((err instanceof TypeError && errMsg.includes("failed to fetch")) || errMsg.includes("timed out") || errMsg.includes("request timed out")) {
                setFetchError("Could not connect to the server. Please ensure the backend is running.");
            } else {
                setFetchError("Failed to load dashboard data. Please refresh the page.");
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchData();
        const id = setInterval(() => { void fetchData(); }, 15000);
        return () => clearInterval(id);
    }, []);

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

    const openJobDetail = async (job: Record<string, any>) => {
        setSelectedJob(job);
        setJobDetail(null);
        setDetailLoading(true);
        try {
            const detail = await apiFetch(`/bookings/${job.id}`);
            setJobDetail(detail);
        } catch {
            setJobDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeJobDetail = () => {
        setSelectedJob(null);
        setJobDetail(null);
    };

    const filteredJobs = jobs.filter((j) => {
        if (filterStatus === "ALL") return true;
        if (filterStatus === "ACTIVE") return j.status !== "Completed" && j.status !== "Cancelled";
        return j.status === filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase();
    });

    const isProfileIncomplete = !profile || !profile.first_name || !profile.categories?.length || !profile.hourly_rate;

    if (loading) return null;

    return (
        <div className="space-y-8 pb-12">

            {/* Missing Payment Profile Banner */}
            {hasPaymentProfile === false && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <CreditCard className="w-5 h-5 text-amber-700" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-amber-900">Add your bank details to start accepting jobs</p>
                            <p className="text-[11px] text-amber-700 font-medium mt-0.5">Residents cannot send you service requests until your payment details are set up.</p>
                        </div>
                    </div>
                    <a
                        href="/service/payment"
                        className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors"
                    >
                        Complete Setup
                    </a>
                </div>
            )}

            {/* Fetch error */}
            {fetchError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-black uppercase tracking-widest">{fetchError}</span>
                </div>
            )}

            {/* Active Jobs Banner */}
            {jobs.filter(j => j.status !== "Completed" && j.status !== "Cancelled").length > 0 && incomingRequestCount === 0 && (
                <Link
                    href="/service/jobs?tab=jobs"
                    className="flex items-center justify-between bg-blue-700 text-white rounded-2xl px-5 py-4 shadow-lg shadow-blue-700/25 hover:bg-blue-800 transition-all animate-in fade-in duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">
                                {jobs.filter(j => j.status !== "Completed" && j.status !== "Cancelled").length} Active Job{jobs.filter(j => j.status !== "Completed" && j.status !== "Cancelled").length > 1 ? "s" : ""} In Progress
                            </p>
                            <p className="text-[10px] text-blue-200 mt-0.5">Service ongoing · Tap to manage</p>
                        </div>
                    </div>
                    <Briefcase size={20} className="shrink-0" />
                </Link>
            )}

            {/* Incoming Job Requests Banner */}
            {incomingRequestCount > 0 && (
                <Link
                    href="/service/jobs?tab=requests"
                    className="flex items-center justify-between bg-blue-700 text-white rounded-2xl px-5 py-4 shadow-lg shadow-blue-700/25 hover:bg-blue-800 transition-all animate-in fade-in duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">
                                {incomingRequestCount} New Job Request{incomingRequestCount > 1 ? "s" : ""}
                            </p>
                            <p className="text-[10px] text-blue-200 mt-0.5">Residents need your service · Tap to view</p>
                        </div>
                    </div>
                    <Briefcase size={20} className="shrink-0" />
                </Link>
            )}

            {/* Emergency SOS Incoming Banner */}
            {incomingEmergencyCount > 0 && (
                <Link
                    href="/service/jobs?tab=emergency"
                    className="flex items-center justify-between bg-rose-600 text-white rounded-2xl px-5 py-4 shadow-lg shadow-rose-600/25 hover:bg-rose-700 transition-all animate-in fade-in duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">
                                {incomingEmergencyCount} Emergency SOS Request{incomingEmergencyCount > 1 ? "s" : ""} — Respond Now
                            </p>
                            <p className="text-[10px] text-rose-200 mt-0.5">Urgent · Tap to view and respond</p>
                        </div>
                    </div>
                    <ShieldAlert size={20} className="shrink-0" />
                </Link>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-50 text-[#064e3b] rounded-2xl flex items-center justify-center"><Briefcase className="w-6 h-6" /></div>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">{jobs.filter(j => j.status !== "Completed" && j.status !== "Cancelled").length}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Active Jobs</p>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><DollarSign className="w-6 h-6" /></div>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Week 12</span>
                    </div>
                    <p className="text-3xl font-black text-[#000000] tracking-tight">₹{jobs.filter((j) => j.status === "Completed").reduce((sum: number, j) => sum + (j.final_cost || j.estimated_cost || 0), 0).toFixed(2)}</p>
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
                                <div className="min-w-0">
                                    <p className="text-lg font-black text-[#000000] uppercase tracking-tight truncate">
                                        {profile?.first_name && profile?.last_name
                                            ? `${profile.first_name} ${profile.last_name}`
                                            : profile?.owner_name || "No name set"}
                                    </p>
                                    {profile?.location && (
                                        <p className="text-xs font-black text-slate-500 flex items-center gap-1 mt-1 min-w-0">
                                            <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{profile.location}</span>
                                        </p>
                                    )}
                                    {profile?.phone && (
                                        <p className="text-xs font-black text-slate-500 flex items-center gap-1 mt-1">
                                            <Phone className="w-3 h-3 shrink-0" /> {profile.phone}
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
                                            <span key={cat} className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide">{cat}</span>
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
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Education</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{profile?.education || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{profile?.experience_years || 0} Years</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Certificates</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">{profile?.certificates?.length || 0} Uploaded</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Rate</p>
                                <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter">₹{profile?.hourly_rate || 0}.00 <span className="text-[10px] text-slate-400">/ HR</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={closeJobDetail}>
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 bg-[#064e3b] rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Briefcase size={13} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-900 uppercase truncate">{selectedJob.service_type} Service</p>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                        selectedJob.status === "Completed"   ? "bg-emerald-100 text-emerald-700" :
                                        selectedJob.status === "Cancelled"   ? "bg-rose-100 text-rose-600" :
                                        selectedJob.status === "In Progress" ? "bg-blue-100 text-blue-700" :
                                        selectedJob.status === "Accepted"    ? "bg-violet-100 text-violet-700" :
                                        "bg-amber-100 text-amber-700"
                                    }`}>{selectedJob.status}</span>
                                </div>
                            </div>
                            <button onClick={closeJobDetail} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors flex-shrink-0">
                                <X size={14} />
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                            {detailLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin w-6 h-6 border-2 border-slate-200 border-t-[#064e3b] rounded-full" />
                                </div>
                            ) : (
                                <>
                                    {/* Info Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { icon: <Calendar size={8} />, label: "Date", value: selectedJob.scheduled_at ? new Date(selectedJob.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                                            { icon: <Clock size={8} />, label: "Time", value: selectedJob.scheduled_at ? new Date(selectedJob.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—" },
                                            { icon: <MapPin size={8} />, label: "Location", value: selectedJob.property_details || "—" },
                                            { icon: <User size={8} />, label: "Client Ref", value: `#${String(selectedJob.user_id || "").slice(0, 8).toUpperCase()}` },
                                        ].map(({ icon, label, value }) => (
                                            <div key={label} className="bg-slate-50 rounded-xl p-3">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">{icon} {label}</p>
                                                <p className="text-xs font-black text-slate-900 truncate">{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Earnings */}
                                    <div className="bg-[#064e3b] rounded-xl p-4 text-white flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1 flex items-center gap-1"><IndianRupee size={8} /> Earnings</p>
                                            <p className="text-2xl font-black">₹{(jobDetail?.final_cost ?? selectedJob.final_cost ?? selectedJob.estimated_cost ?? 0).toLocaleString("en-IN")}</p>
                                            <p className="text-[10px] text-emerald-400 mt-0.5">{jobDetail?.actual_hours ? `${jobDetail.actual_hours}h × ₹${selectedJob.estimated_cost?.toFixed(0)}/h` : "Estimated rate"}</p>
                                        </div>
                                        {jobDetail?.actual_hours && (
                                            <div className="text-right">
                                                <p className="text-[9px] text-emerald-400 uppercase">Hours</p>
                                                <p className="text-xl font-black">{jobDetail.actual_hours}h</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Notes */}
                                    {(jobDetail?.completion_notes || selectedJob.completion_notes) && (
                                        <div className="bg-slate-50 rounded-xl p-3">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1"><FileText size={8} /> Your Notes</p>
                                            <p className="text-xs text-slate-700 italic">&ldquo;{jobDetail?.completion_notes || selectedJob.completion_notes}&rdquo;</p>
                                        </div>
                                    )}

                                    {/* Review */}
                                    {jobDetail?.review && (
                                        <div className="border border-amber-100 bg-amber-50 rounded-xl p-3 space-y-2">
                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1"><Star size={8} /> Client Feedback</p>
                                            <div className="flex items-center gap-1">
                                                {[1,2,3,4,5].map(s => <Star key={s} size={12} className={jobDetail.review.rating >= s ? "text-amber-400 fill-amber-400" : "text-slate-200"} />)}
                                                <span className="text-xs font-black text-amber-700 ml-1">{jobDetail.review.rating}/5</span>
                                            </div>
                                            {jobDetail.review.review_text && <p className="text-xs text-slate-700">&ldquo;{jobDetail.review.review_text}&rdquo;</p>}
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {[
                                                    { label: "Quality", val: jobDetail.review.quality_rating },
                                                    { label: "Punctuality", val: jobDetail.review.punctuality_rating },
                                                    { label: "Professional", val: jobDetail.review.professionalism_rating },
                                                ].map(r => r.val != null && (
                                                    <div key={r.label} className="text-center bg-white rounded-lg p-1.5">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase">{r.label}</p>
                                                        <p className="text-xs font-black text-amber-600">{r.val}/5</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    {jobDetail?.status_history && jobDetail.status_history.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MessageSquare size={8} /> Timeline</p>
                                            {[...jobDetail.status_history].reverse().slice(0, 4).map((h: Record<string, string>, i: number) => (
                                                <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl px-3 py-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#064e3b] mt-1.5 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-black text-slate-900 uppercase">{h.status}</p>
                                                        {h.notes && <p className="text-[9px] text-slate-500 truncate">{h.notes}</p>}
                                                        {h.timestamp && <p className="text-[9px] text-slate-400">{new Date(h.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Job History */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[40vh] flex flex-col">
                <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#064e3b]" />
                        <h2 className="text-sm font-black text-[#000000] uppercase tracking-[0.2em]">Job History</h2>
                    </div>
                    <div className="flex flex-wrap bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                        {["ACTIVE", "COMPLETED", "CANCELLED", "ALL"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
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
                        {filteredJobs.map((job) => (
                            <div key={job.id} onClick={() => openJobDetail(job)} className="px-10 py-8 hover:bg-slate-50/80 transition-all cursor-pointer group flex items-center justify-between">
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

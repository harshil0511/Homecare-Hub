"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getUsername } from "@/lib/auth";
import Spinner from "@/components/ui/Spinner";
import {
    Building2, Users, Bell, Wrench, ChevronRight,
    MapPin, Hash, ShieldCheck, Edit2, Save, X,
    AlertTriangle, CheckCircle2, Clock, Circle,
    Star, Send, Zap
} from "lucide-react";
import Link from "next/link";

interface Society { id: number; name: string; address: string; registration_number?: string; secretary_name?: string; }
interface Member { id: number; username: string; email: string; is_active: boolean; home_number?: string | null; resident_name?: string | null; }
interface Alert { id: number; title: string; status: string; priority: string; created_at: string; user_id: number; }
interface Provider { id: number; company_name: string; category: string; rating: number; availability_status: string; phone: string; }
interface SecretaryComplaint {
    id: string;
    subject: string;
    description: string;
    status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
    admin_notes?: string;
    created_at: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    PENDING: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    IN_PROGRESS: <Circle className="w-3.5 h-3.5 text-blue-500" />,
    COMPLETED: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    CANCELLED: <X className="w-3.5 h-3.5 text-slate-400" />,
};

const STATUS_COLOR: Record<string, string> = {
    PENDING: "text-amber-700 bg-amber-50 border-amber-100",
    IN_PROGRESS: "text-blue-700 bg-blue-50 border-blue-100",
    COMPLETED: "text-emerald-700 bg-emerald-50 border-emerald-100",
    CANCELLED: "text-slate-500 bg-slate-50 border-slate-100",
};

const PRIORITY_COLOR: Record<string, string> = {
    HIGH: "text-rose-700 bg-rose-50",
    MEDIUM: "text-amber-700 bg-amber-50",
    LOW: "text-slate-500 bg-slate-100",
};

const AVAIL_DOT: Record<string, string> = {
    AVAILABLE: "bg-emerald-500",
    WORKING: "bg-blue-500",
    VACATION: "bg-slate-400",
};

export default function SecretaryDashboard() {
    const [society, setSociety] = useState<Society | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const username = getUsername();

    // Inline society edit
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editAddress, setEditAddress] = useState("");
    const [saving, setSaving] = useState(false);

    // Complaints state
    const [complaints, setComplaints] = useState<SecretaryComplaint[]>([]);
    const [reportModal, setReportModal] = useState(false);
    const [reportSubject, setReportSubject] = useState("");
    const [reportDescription, setReportDescription] = useState("");
    const [submittingReport, setSubmittingReport] = useState(false);

    useEffect(() => {
        Promise.all([
            apiFetch("/secretary/society").catch(() => null),
            apiFetch("/secretary/members").catch(() => []),
            apiFetch("/secretary/alerts").catch(() => []),
            apiFetch("/secretary/providers").catch(() => []),
        ]).then(([s, m, a, p]) => {
            setSociety(s);
            setEditName(s?.name ?? "");
            setEditAddress(s?.address ?? "");
            setMembers(m || []);
            setAlerts(a || []);
            setProviders(p || []);
        }).finally(() => setLoading(false));
        apiFetch("/secretary/complaints").then(d => setComplaints(Array.isArray(d) ? d : [])).catch(() => {});
    }, []);

    const handleSaveSociety = async () => {
        setSaving(true);
        try {
            const updated = await apiFetch("/secretary/society", {
                method: "PATCH",
                body: JSON.stringify({ name: editName, address: editAddress }),
            });
            setSociety(updated);
            setEditing(false);
        } catch {
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitReport = async () => {
        if (!reportSubject.trim() || !reportDescription.trim()) return;
        setSubmittingReport(true);
        try {
            const data = await apiFetch("/secretary/complaints", {
                method: "POST",
                body: JSON.stringify({ subject: reportSubject, description: reportDescription }),
            });
            setComplaints(prev => [data, ...prev]);
            setReportModal(false);
            setReportSubject("");
            setReportDescription("");
        } catch (err: any) {
            console.error("Failed to submit report:", err);
        } finally {
            setSubmittingReport(false);
        }
    };

    const memberMap = Object.fromEntries(members.map(m => [m.id, m]));
    const openAlerts = alerts.filter(a => a.status === "PENDING" || a.status === "IN_PROGRESS");
    const recentAlerts = [...alerts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6);
    const availableProviders = providers.filter(p => p.availability_status === "AVAILABLE");

    const stats = [
        { label: "Members", value: members.length, icon: Users, color: "bg-blue-50 text-blue-700", href: "/secretary/members" },
        { label: "Open Alerts", value: openAlerts.length, icon: Bell, color: "bg-amber-50 text-amber-700", href: "/secretary/alerts" },
        { label: "Available Now", value: availableProviders.length, icon: Zap, color: "bg-emerald-50 text-emerald-700", href: "/secretary/providers" },
        { label: "Total Providers", value: providers.length, icon: Wrench, color: "bg-purple-50 text-purple-700", href: "/secretary/providers" },
    ];

    if (loading) {
        return <Spinner size="lg" py="py-32" />;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Overview</h1>
                    <p className="text-slate-500 text-sm mt-1">Welcome back, {username}.</p>
                </div>
                <button
                    onClick={() => setReportModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                >
                    <AlertTriangle size={14} /> Report Issue
                </button>
            </div>

            {/* Society Card with inline edit */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                            <Building2 className="w-5 h-5 text-emerald-700" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Your Society</p>
                            {editing ? (
                                <input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="text-lg font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 outline-none focus:ring-2 focus:ring-emerald-600"
                                />
                            ) : (
                                <p className="text-lg font-black text-slate-900">{society?.name ?? "—"}</p>
                            )}
                        </div>
                    </div>
                    {!editing ? (
                        <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-[#064e3b] px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors uppercase tracking-widest"
                        >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => { setEditing(false); setEditName(society?.name ?? ""); setEditAddress(society?.address ?? ""); }} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleSaveSociety}
                                disabled={saving}
                                className="flex items-center gap-1.5 text-[10px] font-black bg-[#064e3b] text-white px-4 py-2 rounded-xl hover:bg-emerald-950 transition-colors disabled:opacity-60 uppercase tracking-widest"
                            >
                                <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-5">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        {editing ? (
                            <input
                                value={editAddress}
                                onChange={e => setEditAddress(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-600 font-medium min-w-[200px]"
                                placeholder="Address"
                            />
                        ) : (
                            <span className="font-medium">{society?.address ?? "—"}</span>
                        )}
                    </div>
                    {society?.registration_number && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Hash className="w-4 h-4 text-slate-400" />
                            <span className="font-mono font-bold">{society.registration_number}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">Secretary: {society?.secretary_name ?? username}</span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map(s => {
                    const Icon = s.icon;
                    return (
                        <Link key={s.label} href={s.href}
                            className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                            </div>
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${s.color}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Recent Alerts + Available Servicers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recent Alerts */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-black text-slate-900 uppercase tracking-wide">Recent Alerts</span>
                            {openAlerts.length > 0 && (
                                <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">{openAlerts.length} open</span>
                            )}
                        </div>
                        <Link href="/secretary/alerts" className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline flex items-center gap-1">
                            All <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    {recentAlerts.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-bold uppercase tracking-widest">No alerts</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {recentAlerts.map(a => (
                                <div key={a.id} className="px-6 py-3.5 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <span className="mt-0.5 shrink-0">
                                                {STATUS_ICON[a.status] ?? <Circle className="w-3.5 h-3.5 text-slate-400" />}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{a.title}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                    {memberMap[a.user_id]?.username ?? `Member #${a.user_id}`} · {new Date(a.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {a.priority && a.priority !== "LOW" && (
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${PRIORITY_COLOR[a.priority] ?? ""}`}>
                                                    {a.priority}
                                                </span>
                                            )}
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${STATUS_COLOR[a.status] ?? "text-slate-500 bg-slate-50 border-slate-100"}`}>
                                                {a.status.replace("_", " ")}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Available Servicers */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-black text-slate-900 uppercase tracking-wide">Available Now</span>
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">{availableProviders.length} online</span>
                        </div>
                        <Link href="/secretary/providers" className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline flex items-center gap-1">
                            All <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    {availableProviders.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-bold uppercase tracking-widest">None available right now</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {availableProviders.slice(0, 6).map(p => (
                                <div key={p.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="relative shrink-0">
                                            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                                                <Wrench className="w-4 h-4 text-emerald-700" />
                                            </div>
                                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{p.company_name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="flex items-center gap-1 text-xs text-amber-500 font-black">
                                            <Star className="w-3 h-3" />{p.rating?.toFixed(1) ?? "—"}
                                        </div>
                                        <Link href="/secretary/providers"
                                            className="flex items-center gap-1 text-[10px] font-black text-white bg-[#064e3b] px-3 py-1.5 rounded-xl hover:bg-emerald-950 transition-colors uppercase tracking-widest">
                                            <Send className="w-3 h-3" /> Book
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* My Reports */}
            {complaints.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-100">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">My Reports to Admin</p>
                            <p className="text-xs text-slate-500">{complaints.filter(c => c.status !== "RESOLVED").length} open</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {complaints.map(c => (
                            <div key={c.id} className={`p-4 rounded-xl border-l-4 ${
                                c.status === "OPEN" ? "bg-rose-50 border-l-rose-500" :
                                c.status === "UNDER_REVIEW" ? "bg-amber-50 border-l-amber-500" :
                                "bg-emerald-50 border-l-emerald-500"
                            }`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{c.subject}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        c.status === "OPEN" ? "bg-rose-100 text-rose-700" :
                                        c.status === "UNDER_REVIEW" ? "bg-amber-100 text-amber-700" :
                                        "bg-emerald-100 text-emerald-700"
                                    }`}>{c.status.replace("_", " ")}</span>
                                </div>
                                {c.admin_notes && (
                                    <p className="text-xs text-slate-600 italic mt-2 border-l-2 border-slate-300 pl-2">Admin: {c.admin_notes}</p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-1">{new Date(c.created_at).toLocaleDateString("en-IN")}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Report Issue Modal */}
            {reportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Report Issue</h2>
                                <p className="text-xs text-slate-500 mt-1">Send a report to the admin</p>
                            </div>
                            <button onClick={() => setReportModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Subject *</label>
                                <input
                                    value={reportSubject}
                                    onChange={e => setReportSubject(e.target.value)}
                                    placeholder="Brief summary of the issue"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Description *</label>
                                <textarea
                                    value={reportDescription}
                                    onChange={e => setReportDescription(e.target.value)}
                                    placeholder="Describe the issue in detail..."
                                    rows={4}
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setReportModal(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitReport}
                                disabled={submittingReport || !reportSubject.trim() || !reportDescription.trim()}
                                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black uppercase hover:bg-rose-700 disabled:opacity-50"
                            >
                                {submittingReport ? "Submitting..." : "Submit Report"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

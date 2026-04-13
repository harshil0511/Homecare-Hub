"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import {
    Users, CheckCircle, XCircle, Search, AlertTriangle,
    Home, Plus, Trash2, X, Phone, UserCheck, PhoneCall, Users2
} from "lucide-react";

interface AppMember {
    id: string;
    username: string;
    email: string;
    is_active: boolean;
    home_number?: string | null;
    resident_name?: string | null;
}

interface HomeMember {
    id: string;
    full_name: string;
    family_members: number;
    house_no: string;
    mobile: string;
    created_at: string;
}

interface Alert {
    id: number;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    user_id: string;
}

const EMPTY_FORM = { full_name: "", family_members: "", house_no: "", mobile: "" };

export default function SecretaryMembersPage() {
    const [tab, setTab] = useState<"app" | "home">("app");

    // App Members
    const [appMembers, setAppMembers] = useState<AppMember[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

    // Home Members
    const [homeMembers, setHomeMembers] = useState<HomeMember[]>([]);
    const [homeSearch, setHomeSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [viewMember, setViewMember] = useState<HomeMember | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiFetch("/secretary/members").catch(() => []),
            apiFetch("/secretary/alerts").catch(() => []),
            apiFetch("/secretary/home-members").catch(() => []),
        ]).then(([m, a, h]) => {
            setAppMembers(m || []);
            setAlerts(a || []);
            setHomeMembers(h || []);
        }).finally(() => setLoading(false));
    }, []);

    // ── App Members logic ────────────────────────────────────────────────────
    const filteredApp = appMembers.filter(m => {
        const matchSearch = !search ||
            m.username.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase());
        const matchFilter =
            filter === "all" ||
            (filter === "active" && m.is_active) ||
            (filter === "inactive" && !m.is_active);
        return matchSearch && matchFilter;
    });

    const getAlertCounts = (memberId: string) => {
        const memberAlerts = alerts.filter(a => a.user_id === memberId);
        return {
            total: memberAlerts.length,
            open: memberAlerts.filter(a => a.status === "PENDING" || a.status === "IN_PROGRESS").length,
        };
    };

    const activeCount = appMembers.filter(m => m.is_active).length;

    // ── Home Members logic ────────────────────────────────────────────────────
    const filteredHome = homeMembers.filter(m =>
        !homeSearch ||
        m.house_no.toLowerCase().includes(homeSearch.toLowerCase()) ||
        m.full_name.toLowerCase().includes(homeSearch.toLowerCase())
    );

    const formValid =
        form.full_name.trim() !== "" &&
        form.family_members !== "" &&
        parseInt(form.family_members) >= 1 &&
        form.house_no.trim() !== "" &&
        form.mobile.trim() !== "";

    const handleAddHomeMember = async () => {
        if (!formValid) { setFormError("All fields are required."); return; }
        setSaving(true);
        setFormError("");
        try {
            const created = await apiFetch("/secretary/home-members", {
                method: "POST",
                body: JSON.stringify({
                    full_name: form.full_name.trim(),
                    family_members: parseInt(form.family_members),
                    house_no: form.house_no.trim(),
                    mobile: form.mobile.trim(),
                }),
            });
            setHomeMembers(prev =>
                [...prev, created].sort((a, b) =>
                    a.house_no.localeCompare(b.house_no) || a.full_name.localeCompare(b.full_name)
                )
            );
            setShowModal(false);
            setForm(EMPTY_FORM);
        } catch {
            setFormError("Failed to add member. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remove this home member?")) return;
        setDeletingId(id);
        try {
            await apiFetch(`/secretary/home-members/${id}`, { method: "DELETE" });
            setHomeMembers(prev => prev.filter(m => m.id !== id));
        } catch {
            alert("Failed to delete. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) return <Spinner size="lg" py="py-32" />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Members</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage app users and registered home members.</p>
                </div>
                {tab === "home" && (
                    <button
                        onClick={() => { setShowModal(true); setFormError(""); setForm(EMPTY_FORM); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#064e3b] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-950 transition-all"
                    >
                        <Plus size={14} /> Add Home Member
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-0">
                {([
                    { key: "app", label: "App Users", count: appMembers.length },
                    { key: "home", label: "Home Members", count: homeMembers.length },
                ] as const).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-t-xl border-b-2 transition-all ${
                            tab === t.key
                                ? "border-[#064e3b] text-[#064e3b] bg-emerald-50"
                                : "border-transparent text-slate-400 hover:text-slate-700"
                        }`}
                    >
                        {t.label}
                        <span className="ml-2 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-black">
                            {t.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── APP USERS TAB ── */}
            {tab === "app" && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                            <p className="text-2xl font-black text-slate-900">{appMembers.length}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total</p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                            <p className="text-2xl font-black text-emerald-700">{activeCount}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Active</p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                            <p className="text-2xl font-black text-rose-600">{appMembers.length - activeCount}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Inactive</p>
                        </div>
                    </div>

                    {/* Search + Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name or email..."
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-2">
                            {(["all", "active", "inactive"] as const).map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                    className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        filter === f
                                            ? "bg-[#064e3b] text-white"
                                            : "bg-white border border-slate-200 text-slate-500 hover:border-[#064e3b] hover:text-[#064e3b]"
                                    }`}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Member list */}
                    {filteredApp.length === 0 ? (
                        <EmptyState icon={Users} title="No members found" />
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl">
                            <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
                                {filteredApp.map(m => {
                                    const counts = getAlertCounts(m.id);
                                    return (
                                        <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
                                                    <span className="text-sm font-black text-blue-700">{m.username.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-slate-900 text-sm">{m.username}</p>
                                                        {m.is_active
                                                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                            : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                                                    </div>
                                                    <p className="text-xs text-slate-400 font-medium mt-0.5">{m.email}</p>
                                                    {m.home_number && (
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                            <Home className="w-3 h-3" /> Flat {m.home_number}
                                                            {m.resident_name && ` · ${m.resident_name}`}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {counts.total > 0 && (
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-slate-700">{counts.total} task{counts.total !== 1 ? "s" : ""}</p>
                                                        {counts.open > 0 && (
                                                            <p className="text-[10px] font-black text-amber-600 flex items-center gap-1 justify-end">
                                                                <AlertTriangle className="w-3 h-3" /> {counts.open} open
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${
                                                    m.is_active
                                                        ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
                                                        : "text-slate-500 bg-slate-50 border border-slate-200"
                                                }`}>
                                                    {m.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── HOME MEMBERS TAB ── */}
            {tab === "home" && (
                <div className="space-y-5">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={homeSearch}
                            onChange={e => setHomeSearch(e.target.value)}
                            placeholder="Search by house no or name..."
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    {filteredHome.length === 0 ? (
                        <EmptyState icon={Home} title="No home members yet" />
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl">
                            <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
                                {filteredHome.map(m => (
                                    <div
                                        key={m.id}
                                        onClick={() => setViewMember(m)}
                                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shrink-0">
                                                <Home className="w-4 h-4 text-emerald-700" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-base font-black text-slate-900">Flat {m.house_no}</p>
                                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                        {m.family_members} member{m.family_members !== 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-700 mt-0.5">{m.full_name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                                                    <Phone className="w-3 h-3" /> {m.mobile}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); handleDelete(m.id); }}
                                            disabled={deletingId === m.id}
                                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── HOME MEMBER DETAIL MODAL ── */}
            {viewMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <Home className="w-4 h-4 text-emerald-700" />
                                <span className="text-sm font-black text-slate-900 uppercase tracking-wide">Flat {viewMember.house_no}</span>
                            </div>
                            <button onClick={() => setViewMember(null)}
                                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3 mb-5">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</p>
                                    <p className="text-sm font-bold text-slate-900">{viewMember.full_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <Users2 className="w-4 h-4 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Family Members</p>
                                    <p className="text-sm font-bold text-slate-900">{viewMember.family_members} {viewMember.family_members === 1 ? "person" : "people"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile</p>
                                    <p className="text-sm font-bold text-slate-900">{viewMember.mobile}</p>
                                </div>
                            </div>
                        </div>

                        <a
                            href={`tel:${viewMember.mobile}`}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                        >
                            <PhoneCall className="w-4 h-4" /> Call Now
                        </a>
                    </div>
                </div>
            )}

            {/* ── ADD HOME MEMBER MODAL ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-emerald-700" />
                                <span className="text-sm font-black text-slate-900 uppercase tracking-wide">Add Home Member</span>
                            </div>
                            <button onClick={() => setShowModal(false)}
                                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {[
                                { label: "Full Name", key: "full_name", type: "text", placeholder: "e.g. Ravi Sharma" },
                                { label: "House / Flat No", key: "house_no", type: "text", placeholder: "e.g. A-101" },
                                { label: "Family Members", key: "family_members", type: "number", placeholder: "e.g. 4" },
                                { label: "Mobile Number", key: "mobile", type: "tel", placeholder: "e.g. 9876543210" },
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                        {field.label} <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type={field.type}
                                        placeholder={field.placeholder}
                                        value={form[field.key as keyof typeof form]}
                                        min={field.type === "number" ? 1 : undefined}
                                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            ))}

                            {formError && (
                                <p className="text-xs text-rose-600 font-bold">{formError}</p>
                            )}
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddHomeMember}
                                disabled={saving || !formValid}
                                className="flex-1 py-2.5 rounded-xl bg-[#064e3b] text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-950 transition-colors disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Add Member"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

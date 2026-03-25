"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    Users,
    MapPin,
    CheckCircle2,
    Building2,
    Plus,
    ArrowRight,
    X,
    ShieldCheck,
    Loader2,
    Search,
    UserPlus,
    Clock,
    Check,
    Cpu,
    Zap,
    BadgeCheck,
    Pencil,
    Trash2
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Provider {
    id: number;
    company_name: string;
    owner_name: string;
    category: string;
    location: string;
    availability_status: "AVAILABLE" | "WORKING" | "VACATION";
    rating: number;
}

interface Society {
    id: number;
    name: string;
    address: string;
    registration_number?: string;
}

export default function SocietiesPage() {
    const [societies, setSocieties] = useState<Society[]>([]);
    const [userSocietyId, setUserSocietyId] = useState<number | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // UI States
    const [activeSociety, setActiveSociety] = useState<Society | null>(null);
    const [trustedProviders, setTrustedProviders] = useState<Provider[]>([]);
    const [nearbyProviders, setNearbyProviders] = useState<Provider[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [pendingInvites, setPendingInvites] = useState<any[]>([]);

    // New Society Form
    const [newName, setNewName] = useState("");
    const [newAddress, setNewAddress] = useState("");
    const [newRegNumber, setNewRegNumber] = useState("");
    const [creatorRole, setCreatorRole] = useState("OWNER");
    const [createdSocieties, setCreatedSocieties] = useState<any[]>([]);
    const [editingSocietyId, setEditingSocietyId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const fetchData = async () => {
        try {
            // Level 1: Core User and Total List (Concurrent)
            const [list, me] = await Promise.all([
                apiFetch("/services/societies"),
                apiFetch("/user/me")
            ]);

            setSocieties(list);
            setUserSocietyId(me.society_id);
            setUserRole(me.role);

            // Level 2: Linked Data (Only if joined or owner)
            const subFetches = [];

            if (me.society_id) {
                const societyDetails = list.find((s: any) => s.id === me.society_id);
                setActiveSociety(societyDetails || null);

                subFetches.push(
                    apiFetch(`/services/societies/${me.society_id}/trusted`).then(setTrustedProviders),
                    apiFetch(`/services/societies/${me.society_id}/find-nearest`).then(setNearbyProviders),
                    apiFetch(`/services/societies/${me.society_id}/requests`).then(setPendingInvites).catch(e => console.warn("Invites fetch failed", e))
                );
            }

            subFetches.push(
                apiFetch("/services/societies/me/created").then(setCreatedSocieties).catch(e => console.warn("Created societies fetch failed", e))
            );

            await Promise.all(subFetches);
        } catch (err) {
            console.error("Critical Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleJoin = async (id: number) => {
        try {
            await apiFetch(`/services/societies/join/${id}`, { method: "POST" });
            fetchData();
        } catch (err) {
            alert("Failed to join society");
        }
    };

    const handleRecruitRequest = async (providerId: number) => {
        if (!activeSociety) return;
        try {
            await apiFetch(`/services/societies/${activeSociety.id}/recruit/${providerId}`, {
                method: "POST",
                body: JSON.stringify({ message: "Infrastructure assignment request." })
            });
            alert("Invitation dispatched to professional.");
            fetchData();
        } catch (err: any) {
            alert(err.message || "Failed to dispatch request");
        }
    };

    const handleCreateSociety = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSocietyId) {
                await apiFetch(`/services/societies/${editingSocietyId}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        name: newName,
                        address: newAddress,
                        registration_number: newRegNumber
                    })
                });
            } else {
                await apiFetch("/services/societies", {
                    method: "POST",
                    body: JSON.stringify({
                        name: newName,
                        address: newAddress,
                        registration_number: newRegNumber,
                        creator_role: creatorRole
                    })
                });
            }
            setShowModal(false);
            setEditingSocietyId(null);
            setNewName("");
            setNewAddress("");
            setNewRegNumber("");
            fetchData();
        } catch (err: any) {
            alert(err.message || "Action failed");
        }
    };

    const handleDeleteSociety = async (id: number) => {
        try {
            await apiFetch(`/services/societies/${id}`, { method: "DELETE" });
            setDeletingId(null);
            setStatusMsg({ text: "Infrastructure hub successfully decommissioned.", type: 'success' });
            setTimeout(() => setStatusMsg(null), 3000);
            fetchData();
        } catch (err: any) {
            setStatusMsg({ text: err.message || "Deletion failed", type: 'error' });
            setTimeout(() => setStatusMsg(null), 3000);
        }
    };

    const handleEditClick = (s: any) => {
        setEditingSocietyId(s.id);
        setNewName(s.name);
        setNewAddress(s.address);
        setNewRegNumber(s.registration_number || "");
        setShowModal(true);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-12 h-12 text-[#064e3b] animate-spin" />
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-16 pb-24 animate-fade-in">
            {/* Clean Header Architecture */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-5xl font-black text-black tracking-tighter uppercase leading-[0.8]">Community & Societies</h1>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] ml-1">Management Hub & Expert Discovery</p>
                </div>
                
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-[#064e3b] text-white px-10 py-5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10 hover:bg-[#053e2f] transition-all active:scale-95 flex items-center gap-3"
                >
                    <Plus className="w-5 h-5" />
                    Create Society
                </button>
            </div>

            {statusMsg && (
                <div className={`fixed bottom-12 right-12 px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-right-10 duration-500 flex items-center gap-4 border ${statusMsg.type === 'success' ? 'bg-[#064e3b] text-white border-emerald-400' : 'bg-rose-600 text-white border-rose-400'}`}>
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                        {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <X className="w-5 h-5 text-rose-300" />}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest">{statusMsg.text}</p>
                </div>
            )}
            
            <div className="space-y-20">
                {/* Active Infrastructure Hub (SS1 Style) */}
                {activeSociety && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-[3rem] p-12 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-3 bg-[#064e3b]" />
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="space-y-10">
                                    <div className="flex items-center justify-between">
                                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center shadow-sm">
                                            <Building2 className="w-8 h-8 text-[#064e3b]" />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="px-5 py-2 bg-emerald-50 border border-emerald-100 rounded-full text-[8px] font-black uppercase tracking-[0.4em] text-emerald-600">
                                                Hub Active
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleEditClick(activeSociety)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setDeletingId(activeSociety.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-rose-600 hover:bg-rose-50 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {deletingId === activeSociety.id && (
                                        <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
                                                    <X onClick={() => setDeletingId(null)} className="w-5 h-5 cursor-pointer" />
                                                </div>
                                                <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">Confirm Decommission of this Hub?</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => setDeletingId(null)} className="px-6 py-2 bg-white border border-rose-200 text-rose-900 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-100 transition-colors">Abort</button>
                                                <button onClick={() => handleDeleteSociety(activeSociety.id)} className="px-6 py-2 bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-700 transition-shadow shadow-lg shadow-rose-900/20">Confirm</button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <BadgeCheck className="w-4 h-4 text-emerald-600" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em]">Operational Hub</span>
                                        </div>
                                        <h2 className="text-5xl font-black tracking-tighter leading-[0.8] uppercase text-black">{activeSociety.name}</h2>
                                        <div className="flex flex-wrap items-center gap-8 pt-4">
                                            <div className="flex items-center gap-3 text-slate-500 font-bold uppercase tracking-widest text-xs">
                                                <MapPin className="w-4 h-4 text-emerald-600" />
                                                {activeSociety.address}
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-300 font-mono text-xs font-black uppercase tracking-widest px-4 py-2 bg-slate-50 rounded-lg">
                                                ID: {activeSociety.registration_number || "PENDING"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-16 pt-12 border-t border-slate-50 grid grid-cols-2 gap-12">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Authority Link</p>
                                        <p className="text-sm font-black uppercase text-black tracking-widest">{userRole?.replace('SOCIETY_', '') || "ADMINISTRATOR"}</p>
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">System Grade</p>
                                        <p className="text-sm font-black uppercase text-[#064e3b] tracking-widest">Verified Infrastructure</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 text-white rounded-[3rem] p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                            <div className="relative z-10 space-y-10">
                                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">Network Density</h3>
                                <div className="space-y-2">
                                    <p className="text-sm font-black uppercase tracking-tighter">Professionals</p>
                                    <p className="text-5xl font-black text-emerald-400 leading-none">{trustedProviders.length}</p>
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Active Experts</p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard/societies/recruit"
                                className="relative z-10 w-full bg-[#064e3b] text-white py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] text-center block hover:bg-emerald-800 transition-all shadow-lg"
                            >
                                Add Expert
                            </Link>
                        </div>
                    </div>
                )}

                {/* Your Managed Organizations (Multi-Society Box Design SS1) */}
                <div className="space-y-12">
                    <div className="flex items-center gap-8">
                        <hr className="flex-1 border-slate-200" />
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.8em]">Your Managed Organizations</h3>
                        <hr className="flex-1 border-slate-200" />
                    </div>
                    {createdSocieties.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                            {createdSocieties.map((s) => (
                                <div key={s.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:border-[#064e3b] hover:shadow-2xl transition-all group text-center relative overflow-hidden">
                                    <div className="absolute top-0 w-full h-1.5 left-0 bg-[#064e3b]/10 group-hover:bg-[#064e3b] transition-colors" />
                                    
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                        <button onClick={() => handleEditClick(s)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-[#064e3b] transition-all">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteSociety(s.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-rose-600 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-[#064e3b]/10 transition-colors">
                                        <Building2 className={`w-8 h-8 ${userSocietyId === s.id ? 'text-[#064e3b]' : 'text-slate-200'}`} />
                                    </div>
                                    
                                    <div className="inline-block px-3 py-1 bg-emerald-50 text-[#064e3b] rounded-lg text-[8px] font-black uppercase tracking-widest mb-4">
                                        Admin Node
                                    </div>
                                    
                                    <h4 className="text-xl font-black text-black uppercase tracking-tighter mb-2 truncate">{s.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 line-clamp-1">{s.address}</p>
                                    
                                    <div className="flex flex-col gap-3">
                                        {deletingId === s.id ? (
                                            <div className="space-y-4 animate-in fade-in duration-300">
                                                <p className="text-[8px] font-black text-rose-600 uppercase tracking-[0.2em] text-center">Confirm Decommission?</p>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setDeletingId(null)} className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-xl text-[8px] font-black uppercase tracking-widest">No</button>
                                                    <button onClick={() => handleDeleteSociety(s.id)} className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/10">Yes</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {userSocietyId === s.id ? (
                                                    <div className="w-full py-4 bg-emerald-50 text-[#064e3b] rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100 flex items-center justify-center gap-2">
                                                        <Check className="w-3 h-3" /> HUB ACTIVE
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleJoin(s.id)}
                                                        className="w-full py-4 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10"
                                                    >
                                                        Switch to Hub
                                                    </button>
                                                )}
                                                <Link
                                                    href="/dashboard/societies/recruit"
                                                    className="w-full py-4 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                                                >
                                                    Find Servicers
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Managed Organizations</p>
                        </div>
                    )}
                </div>

                {/* All Societies Directory */}
                <div className="space-y-12">
                    <div className="flex items-center gap-8 px-6">
                        <hr className="flex-1 border-slate-200" />
                        <h3 className="text-[10px] font-black text-slate-200 uppercase tracking-[0.8em]">Operational Directory</h3>
                        <hr className="flex-1 border-slate-200" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                        {societies.filter(s => !createdSocieties.find(cs => cs.id === s.id)).map((s) => (
                            <div key={s.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-emerald-100 hover:shadow-xl transition-all group text-center">
                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-[#064e3b] transition-colors">
                                    <Building2 className="w-6 h-6 text-slate-200 group-hover:text-white" />
                                </div>
                                <h4 className="text-lg font-black text-black uppercase tracking-tighter mb-1 truncate">{s.name}</h4>
                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-8">{s.address}</p>
                                <button
                                    onClick={() => handleJoin(s.id)}
                                    className="w-full py-3 bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-[#064e3b] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                >
                                    Request Link
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Classic Initialization Modal */}
            {showModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => {
                        setShowModal(false);
                        setEditingSocietyId(null);
                        setNewName("");
                        setNewAddress("");
                        setNewRegNumber("");
                    }} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 sm:p-14 space-y-12">
                            <div className="flex items-start justify-between">
                                <div className="space-y-3">
                                    <h2 className="text-4xl sm:text-5xl font-black text-black tracking-tighter uppercase leading-none">
                                        {editingSocietyId ? "Update Hub" : "Register society"}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                                        {editingSocietyId ? "Global Resource Protocol Update" : "Initialize Society Infrastructure"}
                                    </p>
                                </div>
                                <button onClick={() => {
                                    setShowModal(false);
                                    setEditingSocietyId(null);
                                    setNewName("");
                                    setNewAddress("");
                                    setNewRegNumber("");
                                }} className="p-5 bg-slate-50 text-slate-300 rounded-[1.5rem] hover:text-black hover:bg-slate-100 transition-colors">
                                    <X className="w-7 h-7" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSociety} className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-[#8aa0be] uppercase tracking-[0.3em] ml-2">Name</label>
                                        <input
                                            placeholder="HUB_IDENTIFIER..."
                                            value={newName} onChange={e => setNewName(e.target.value)}
                                            className="w-full bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] p-6 text-sm font-black uppercase tracking-widest text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition-all"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-[#8aa0be] uppercase tracking-[0.3em] ml-2">Reg ID</label>
                                        <input
                                            placeholder="OPTIONAL_ID..."
                                            value={newRegNumber} onChange={e => setNewRegNumber(e.target.value)}
                                            className="w-full bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] p-6 text-sm font-black uppercase tracking-widest text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-[#8aa0be] uppercase tracking-[0.3em] ml-2">Location</label>
                                    <input
                                        placeholder="PHYSICAL_ADDRESS..."
                                        value={newAddress} onChange={e => setNewAddress(e.target.value)}
                                        className="w-full bg-[#f8fafc] border border-slate-100 rounded-[1.5rem] p-6 text-sm font-black uppercase tracking-widest text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 outline-none transition-all"
                                        required
                                    />
                                </div>

                                <div className="bg-white border border-slate-200 p-8 sm:p-10 rounded-[2.5rem] space-y-8">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-2">Authority Assignment</p>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {["OWNER", "SECRETARY"].map(role => (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setCreatorRole(role)}
                                                className={`flex-1 py-6 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.4em] transition-all duration-300 ${creatorRole === role ? 'bg-[#064e3b] text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-black text-white py-8 rounded-[2rem] text-xs font-black uppercase tracking-[0.5em] shadow-xl hover:bg-slate-900 transition-all active:scale-95 duration-300">
                                    Initialize Infrastructure
                                </button>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

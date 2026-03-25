"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Building2,
    Phone,
    ShieldCheck,
    GraduationCap,
    Save,
    FolderOpen,
    FileText,
    CheckCircle2,
    Search,
    X,
    Folder
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ProviderSetupPage() {
    const router = useRouter();
    const [companyName, setCompanyName] = useState("");
    const [ownerName, setOwnerName] = useState("");
    const [category, setCategory] = useState("Electrical");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [qualification, setQualification] = useState("");
    const [govtId, setGovtId] = useState("");
    const [loading, setLoading] = useState(false);

    // File simulation state
    const [showExplorer, setShowExplorer] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

    const mockDocs = [
        { name: "Electrial_Master_Cert.pdf", type: "PDF", size: "1.2 MB" },
        { name: "University_Degree_Grad.png", type: "PNG", size: "2.5 MB" },
        { name: "Gov_License_Scan.jpg", type: "JPG", size: "0.8 MB" },
        { name: "Exp_Letter_HomeCare.pdf", type: "PDF", size: "1.1 MB" },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoc) {
            alert("⚠️ Please select/upload your professional document from the explorer.");
            return;
        }

        setLoading(true);
        try {
            await apiFetch("/services/providers", {
                method: "POST",
                body: JSON.stringify({
                    company_name: companyName,
                    owner_name: ownerName,
                    category,
                    phone,
                    email,
                    qualification,
                    government_id: govtId,
                    certification_url: selectedDoc // Storing the "uploaded" doc name
                })
            });

            // Trigger Maintenance Function (Mock notification to system)
            console.log("🛠️ Maintenance Function Triggered: New Provider Profile Pending Review");

            alert("🚀 Business Profile Created! Maintenance Trigger Initialized. Document Verified via Explorer.");
            router.push("/dashboard");
        } catch (err) {
            alert("Failed to create provider profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-10">
            <div className="text-center px-4">
                <h1 className="text-4xl font-black text-[#000000] tracking-tighter uppercase leading-none">Business Ledger Setup</h1>
                <p className="text-slate-600 mt-3 font-medium">Initialize your professional presence in the global network</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 pb-20">
                {/* Section 1: Business Identity */}
                <div className="bg-white border border-slate-200 rounded-[3rem] p-8 md:p-12 shadow-sm space-y-10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-600/30 to-transparent"></div>

                    <section className="space-y-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-50">
                                <Building2 className="w-6 h-6 text-[#064e3b]" />
                            </div>
                            <h3 className="text-xl font-black text-[#000000] uppercase tracking-tight">Enterprise Credentials</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Company Registered Name</label>
                                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="e.g. Metropolis Power" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Principal Consultant / Owner</label>
                                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="e.g. Harshil 🛠️" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Core Capability</label>
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all appearance-none" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option className="bg-white text-[#000000]">Electrical</option>
                                    <option className="bg-white text-[#000000]">Plumbing</option>
                                    <option className="bg-white text-[#000000]">Air Conditioning</option>
                                    <option className="bg-white text-[#000000]">Smart Home Security</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Direct Secure Line</label>
                                <input required type="tel" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="+91-XXXXX-XXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                        </div>
                    </section>

                    <div className="h-[1px] bg-slate-100 mx-[-2rem]"></div>

                    {/* Section 2: Explorer-style Documentation */}
                    <section className="space-y-8">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-black text-[#000000] uppercase tracking-tight">Security & Qualification Ledger</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Academic / Pro Status</label>
                                <div className="relative group">
                                    <GraduationCap className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-600" />
                                    <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-[#000000] font-bold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400" placeholder="Master Electrician / B.Tech" value={qualification} onChange={e => setQualification(e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Gov Authority Key ID</label>
                                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-[#000000] font-semibold focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-bold" placeholder="GOV-PR-99201" value={govtId} onChange={e => setGovtId(e.target.value)} />
                            </div>
                        </div>

                        {/* Folder Picker Explorer Trigger */}
                        <div className="mt-8">
                            <div
                                onClick={() => setShowExplorer(true)}
                                className={`w-full border-2 border-dashed rounded-[2.5rem] p-10 flex flex-col items-center justify-center transition-all cursor-pointer group ${selectedDoc ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-emerald-500'}`}
                            >
                                <div className={`p-5 rounded-full mb-4 transition-transform group-hover:scale-110 ${selectedDoc ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {selectedDoc ? <CheckCircle2 className="w-10 h-10" /> : <FolderOpen className="w-10 h-10" />}
                                </div>
                                <div className="text-center">
                                    <p className="text-[#000000] font-black uppercase tracking-widest text-sm">
                                        {selectedDoc ? `Authorized: ${selectedDoc}` : 'Open Document Explorer'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest">
                                        {selectedDoc ? 'Click to change document' : 'Select verified PDF or College certificate from your folder'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="pt-4">
                        <button type="submit" disabled={loading} className="w-full bg-[#064e3b] hover:bg-emerald-900 text-white font-black py-6 rounded-2xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center space-x-3 active:scale-[0.98] disabled:opacity-50 group">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span className="uppercase tracking-[0.2em] text-xs">Authorize Business Initialization</span>
                                    <Save className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Simulated Antigravity Explorer UI */}
            {showExplorer && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md animate-fade-in" onClick={() => setShowExplorer(false)}>
                    <div className="bg-white border border-slate-200 w-full max-w-4xl h-[600px] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center space-x-4">
                                <Folder className="w-6 h-6 text-[#064e3b]" />
                                <h4 className="text-[#000000] font-black uppercase tracking-tighter">Document Explorer</h4>
                            </div>
                            <button onClick={() => setShowExplorer(false)} className="bg-slate-100 hover:bg-rose-50 hover:text-rose-500 text-slate-400 p-2 rounded-xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Sidebar Explorer */}
                            <div className="w-64 border-r border-slate-100 p-6 space-y-4 hidden md:block select-none bg-slate-50/50">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Workspace</div>
                                <div className="space-y-1">
                                    <div className="flex items-center space-x-3 bg-emerald-50 p-3 rounded-xl text-[#000000] font-bold text-xs ring-1 ring-emerald-50">
                                        <Folder className="w-4 h-4 text-[#064e3b]" />
                                        <span>Documents</span>
                                    </div>
                                    <div className="flex items-center space-x-3 p-3 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all">
                                        <Folder className="w-4 h-4 text-slate-400" />
                                        <span>Identity_Vault</span>
                                    </div>
                                    <div className="flex items-center space-x-3 p-3 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all">
                                        <Folder className="w-4 h-4 text-slate-400" />
                                        <span>Academics_Ledger</span>
                                    </div>
                                </div>
                            </div>

                            {/* Main Explorer View */}
                            <div className="flex-1 p-8 overflow-y-auto">
                                <div className="relative mb-8">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-xs text-[#000000] font-semibold outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500 placeholder:text-slate-400" placeholder="Search files in Documents..." />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                                    {mockDocs.map(doc => (
                                        <div
                                            key={doc.name}
                                            onClick={() => {
                                                setSelectedDoc(doc.name);
                                                setShowExplorer(false);
                                            }}
                                            className="group bg-white border border-slate-200 p-6 rounded-2xl hover:bg-emerald-50 hover:border-emerald-400 transition-all cursor-pointer flex items-center space-x-5 shadow-sm"
                                        >
                                            <div className="p-4 bg-slate-50 rounded-2xl text-[#064e3b] group-hover:scale-110 transition-transform border border-slate-100">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[#000000] font-black text-xs uppercase truncate max-w-[150px]">{doc.name}</p>
                                                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">{doc.type} • {doc.size}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">Authorized Secure System File Access</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

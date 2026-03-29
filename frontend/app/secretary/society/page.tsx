"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Building2, Save } from "lucide-react";

export default function SecretarySocietyPage() {
    const [society, setSociety] = useState<any>(null);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        apiFetch("/secretary/society").then((d) => {
            setSociety(d);
            setName(d?.name ?? "");
            setAddress(d?.address ?? "");
        }).catch(() => {});
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updated = await apiFetch("/secretary/society", {
                method: "PATCH",
                body: JSON.stringify({ name, address }),
            });
            setSociety(updated);
            setMsg("Society updated successfully.");
        } catch (err: any) {
            setMsg(err.message || "Failed to update.");
        } finally {
            setSaving(false);
            setTimeout(() => setMsg(""), 3000);
        }
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Details</h1>
                <p className="text-slate-500 text-sm mt-1">View and update your assigned society information.</p>
            </div>
            {society && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-emerald-700" />
                        </div>
                        <div>
                            <p className="font-black text-slate-900">{society.name}</p>
                            <p className="text-xs text-slate-400">{society.address}</p>
                        </div>
                    </div>
                    <form onSubmit={handleSave} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Society Name</label>
                            <input value={name} onChange={(e) => setName(e.target.value)} required
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 transition" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address</label>
                            <input value={address} onChange={(e) => setAddress(e.target.value)} required
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 transition" />
                        </div>
                        {msg && <p className="text-sm text-emerald-700 font-semibold">{msg}</p>}
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 bg-[#064e3b] hover:bg-emerald-950 text-white font-semibold px-6 py-3 rounded-xl text-sm transition disabled:opacity-60">
                            <Save className="w-4 h-4" />
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

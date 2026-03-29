"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Users, CheckCircle, XCircle } from "lucide-react";

interface Member { id: number; username: string; email: string; is_active: boolean; }

export default function SecretaryMembersPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch("/secretary/members")
            .then((d) => setMembers(d || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Society Members</h1>
                <p className="text-slate-500 text-sm mt-1">Home users registered in your society.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : members.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">No members yet</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-6 py-4 font-black text-slate-500 uppercase text-xs tracking-wider">Name</th>
                                <th className="text-left px-6 py-4 font-black text-slate-500 uppercase text-xs tracking-wider">Email</th>
                                <th className="text-left px-6 py-4 font-black text-slate-500 uppercase text-xs tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {members.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-slate-900">{m.username}</td>
                                    <td className="px-6 py-4 text-slate-500">{m.email}</td>
                                    <td className="px-6 py-4">
                                        {m.is_active
                                            ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" />Active</span>
                                            : <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" />Inactive</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { Bell, Building2, Users, AlertTriangle, Mail } from "lucide-react";

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={onToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-[#064e3b]" : "bg-slate-200"}`}
        >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
    );
}

const DEFAULT_PREFS = {
    societyAlerts: true,
    memberActivity: true,
    maintenanceAlerts: true,
    emailNotifications: false,
};

export default function SecretaryNotificationsPage() {
    const [prefs, setPrefs] = useState(() => {
        try {
            const saved = localStorage.getItem("hc_secretary_notification_prefs");
            return saved ? JSON.parse(saved) : DEFAULT_PREFS;
        } catch {
            return DEFAULT_PREFS;
        }
    });

    const togglePref = (key: keyof typeof prefs) => {
        const updated = { ...prefs, [key]: !prefs[key] };
        setPrefs(updated);
        localStorage.setItem("hc_secretary_notification_prefs", JSON.stringify(updated));
    };

    const items = [
        { key: "societyAlerts" as const, icon: Building2, label: "Society Alerts", desc: "Important society announcements" },
        { key: "memberActivity" as const, icon: Users, label: "Member Activity", desc: "New member joins and requests" },
        { key: "maintenanceAlerts" as const, icon: AlertTriangle, label: "Maintenance Alerts", desc: "Society maintenance task updates" },
        { key: "emailNotifications" as const, icon: Mail, label: "Email Notifications", desc: "Receive notifications via email" },
    ];

    return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                        <Bell className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-black text-[#000000] uppercase tracking-tight">Notification Preferences</h2>
                </div>

                <div className="space-y-1">
                    {items.map((item, idx) => (
                        <div key={item.key} className={`flex items-center justify-between py-5 px-2 ${idx < items.length - 1 ? "border-b border-slate-50" : ""}`}>
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <item.icon className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-[#000000] uppercase tracking-tight">{item.label}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                            <ToggleSwitch enabled={prefs[item.key]} onToggle={() => togglePref(item.key)} />
                        </div>
                    ))}
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6 px-2">Preferences are saved automatically and stored locally on this device.</p>
            </div>
        </div>
    );
}

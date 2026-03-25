"use client";

import { Wrench, Zap, Wind, Bug, Sparkles, ShieldCheck, Home, Droplets } from "lucide-react";

const CATEGORIES = [
    { id: "Plumbing", name: "Plumbing", icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10" },
    { id: "Electrical", name: "Electrical", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
    { id: "HVAC", name: "HVAC", icon: Wind, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { id: "Pest Control", name: "Pest Control", icon: Bug, color: "text-rose-500", bg: "bg-rose-500/10" },
    { id: "Cleaning", name: "Cleaning", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-500/10" },
    { id: "General", name: "General Help", icon: Wrench, color: "text-slate-500", bg: "bg-slate-500/10" },
    { id: "Security", name: "Security Systems", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { id: "Carpentry", name: "Carpentry", icon: Home, color: "text-orange-500", bg: "bg-orange-500/10" },
];

interface ServiceSelectorProps {
    onSelect: (category: string) => void;
    selectedCategory?: string;
}

export default function ServiceSelector({ onSelect, selectedCategory }: ServiceSelectorProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id;
                const Icon = category.icon;

                return (
                    <button
                        key={category.id}
                        onClick={() => onSelect(category.id)}
                        className={`p-8 rounded-[2rem] border transition-all duration-300 flex flex-col items-center text-center gap-4 group ${
                            isSelected
                                ? "bg-slate-900 border-emerald-500 shadow-2xl shadow-emerald-500/10"
                                : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-slate-200/50"
                        }`}
                    >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${isSelected ? "bg-emerald-500 text-white" : `${category.bg} ${category.color}`}`}>
                            <Icon size={32} />
                        </div>
                        <div>
                            <p className={`text-sm font-black uppercase tracking-widest ${isSelected ? "text-white" : "text-slate-900"}`}>{category.name}</p>
                            <p className={`text-[10px] font-bold uppercase tracking-tighter mt-1 ${isSelected ? "text-emerald-400" : "text-slate-400"}`}>
                                {isSelected ? "Selected" : "Available"}
                            </p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

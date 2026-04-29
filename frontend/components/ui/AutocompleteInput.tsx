"use client";

import { useEffect, useRef, useState } from "react";
import { getMemory } from "@/lib/formMemory";
import { Clock } from "lucide-react";

interface AutocompleteInputProps {
    memoryKey: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    type?: string;
}

export default function AutocompleteInput({
    memoryKey,
    value,
    onChange,
    placeholder,
    className = "",
    type = "text",
}: AutocompleteInputProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered = suggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase()) && s !== value
    );

    useEffect(() => {
        setSuggestions(getMemory(memoryKey));
    }, [memoryKey]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const pick = (val: string) => {
        onChange(val);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <input
                type={type}
                value={value}
                onChange={e => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className={className}
                autoComplete="off"
            />
            {open && filtered.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden">
                    {filtered.map((s, i) => (
                        <li
                            key={i}
                            onMouseDown={() => pick(s)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                        >
                            <Clock size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{s}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

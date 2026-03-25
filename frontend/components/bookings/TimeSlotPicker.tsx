"use client";

import { useState } from "react";
import { format, addDays, startOfToday, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

const SLOTS = [
    { id: "09:00", label: "09:00 AM", period: "Morning" },
    { id: "10:30", label: "10:30 AM", period: "Morning" },
    { id: "12:00", label: "12:00 PM", period: "Afternoon" },
    { id: "14:30", label: "02:30 PM", period: "Afternoon" },
    { id: "16:00", label: "04:00 PM", period: "Evening" },
    { id: "17:30", label: "05:30 PM", period: "Evening" },
];

interface TimeSlotPickerProps {
    onSelect: (date: Date, slot: string) => void;
    selectedDate?: Date;
    selectedSlot?: string;
}

export default function TimeSlotPicker({ onSelect, selectedDate, selectedSlot }: TimeSlotPickerProps) {
    const today = startOfToday();
    const [viewDate, setViewDate] = useState(today);

    // Generate week days
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

    return (
        <div className="space-y-10">
            {/* Horizontal Calendar */}
            <div className="flex items-center gap-4">
                <div className="flex-1 flex items-center justify-between bg-white border border-slate-200 p-3 rounded-[1.5rem] shadow-sm overflow-hidden">
                    {days.map((day) => {
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isToday = isSameDay(day, today);

                        return (
                            <button
                                key={day.toString()}
                                onClick={() => onSelect(day, selectedSlot || "")}
                                className={`flex flex-col items-center justify-center w-14 h-20 rounded-2xl transition-all duration-300 ${
                                    isSelected
                                        ? "bg-slate-900 text-white shadow-xl"
                                        : "hover:bg-slate-50 text-slate-600"
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{format(day, "eee")}</span>
                                <span className="text-lg font-black tracking-tighter">{format(day, "dd")}</span>
                                {isToday && !isSelected && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time Slots Grid */}
            <div className="space-y-8">
                {["Morning", "Afternoon", "Evening"].map((period) => (
                    <div key={period} className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 px-2">
                            <Clock size={12} className="text-emerald-500" />
                            {period} Sessions
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {SLOTS.filter(s => s.period === period).map((slot) => {
                                const isSelected = selectedSlot === slot.id;
                                return (
                                    <button
                                        key={slot.id}
                                        onClick={() => selectedDate && onSelect(selectedDate, slot.id)}
                                        className={`py-5 rounded-2xl border text-sm font-black transition-all duration-300 ${
                                            isSelected
                                                ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                                : "bg-white border-slate-100 text-slate-900 hover:border-emerald-300 hover:bg-emerald-50/30"
                                        }`}
                                    >
                                        {slot.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

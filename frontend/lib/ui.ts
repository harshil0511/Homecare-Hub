/**
 * Global UI design tokens — import from here instead of hardcoding classes.
 * All pages, cards, tables, modals, and buttons must use these constants.
 */

// ─── Page & Layout ───────────────────────────────────────────────────────────
export const page = {
    wrapper:   "space-y-5 max-w-7xl mx-auto pb-10",
    header:    "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
    title:     "text-xl font-black text-slate-900 tracking-tight uppercase",
    subtitle:  "text-[10px] font-semibold text-slate-400 uppercase tracking-widest",
    section:   "space-y-4",
} as const;

// ─── Cards ───────────────────────────────────────────────────────────────────
export const card = {
    base:      "bg-white border border-slate-200 rounded-2xl shadow-sm",
    pad:       "p-5",                  // default inner padding
    padSm:     "p-4",                  // compact inner padding
    title:     "text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]",
    row:       "flex items-center justify-between gap-3",
} as const;

// ─── Stat / Metric Tile ───────────────────────────────────────────────────────
export const stat = {
    tile:      "bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-all hover:shadow-md",
    tileActive:"ring-1 ring-[#064e3b] border-[#064e3b] shadow-md",
    icon:      "w-8 h-8 rounded-xl flex items-center justify-center",
    value:     "text-2xl font-black text-slate-900 tracking-tight",
    label:     "text-[9px] font-semibold text-slate-400 uppercase tracking-widest",
} as const;

// ─── Table / List Row ─────────────────────────────────────────────────────────
export const row = {
    wrap:      "rounded-xl border border-slate-100 overflow-hidden",
    btn:       "w-full flex items-center justify-between p-3.5 bg-slate-50/60 hover:bg-white transition-all text-left cursor-pointer",
    btnAlert:  "w-full flex items-center justify-between p-3.5 bg-rose-50/40 hover:bg-rose-50/70 transition-all text-left cursor-pointer",
    icon:      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
    title:     "text-sm font-black text-slate-800 tracking-tight leading-none",
    meta:      "text-[9px] text-slate-400 truncate",
    badge:     "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wide",
    expand:    "bg-white px-4 py-3 border-t border-slate-100 space-y-3",
    detail:    "bg-slate-50 border border-slate-100 rounded-lg p-2.5",
    detailLabel:"text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5",
    detailVal: "text-xs font-black text-slate-800",
} as const;

// ─── Buttons ─────────────────────────────────────────────────────────────────
export const btn = {
    primary:   "bg-[#064e3b] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#053e2f] transition-all active:scale-95 flex items-center gap-2",
    danger:    "bg-rose-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 flex items-center gap-2",
    ghost:     "bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all flex items-center gap-2",
    icon:      "p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-700 transition-colors",
    link:      "text-[9px] font-black text-[#064e3b] uppercase tracking-widest hover:underline inline-flex items-center gap-1.5",
} as const;

// ─── Form ────────────────────────────────────────────────────────────────────
export const form = {
    label:     "text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] ml-0.5",
    input:     "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-semibold focus:bg-white focus:border-[#064e3b] outline-none transition-all",
    select:    "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-[10px] font-black uppercase tracking-widest focus:bg-white focus:border-[#064e3b] outline-none transition-all appearance-none cursor-pointer",
    textarea:  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-semibold focus:bg-white focus:border-[#064e3b] outline-none transition-all resize-none",
    group:     "space-y-1.5",
} as const;

// ─── Modal ───────────────────────────────────────────────────────────────────
export const modal = {
    overlay:   "fixed inset-0 z-50 flex items-end sm:items-center sm:p-4",
    backdrop:  "absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300",
    box:       "relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto sm:max-h-none",
    pad:       "p-6 space-y-5",
    title:     "text-lg font-black text-slate-900 tracking-tight uppercase",
    subtitle:  "text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]",
} as const;

// ─── Badge / Status ──────────────────────────────────────────────────────────
export const badge = {
    neutral:   "bg-slate-100 text-slate-500",
    success:   "bg-emerald-50 text-emerald-700",
    warning:   "bg-amber-50 text-amber-600",
    danger:    "bg-rose-50 text-rose-600",
    info:      "bg-blue-50 text-blue-600",
} as const;

// ─── Icon containers (small coloured bg) ─────────────────────────────────────
export const iconBox = {
    neutral:   "bg-slate-100 text-slate-500",
    success:   "bg-emerald-50 text-emerald-700",
    warning:   "bg-amber-50 text-amber-600",
    danger:    "bg-rose-50 text-rose-600",
    dark:      "bg-slate-900 text-white",
} as const;

"use client";

import { useToast, Toast } from "@/lib/toast-context";
import { CheckCircle, XCircle, X, Bell, AlertTriangle, Info } from "lucide-react";

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  if (toast.type === "notification") {
    const dotColor =
      toast.notificationType === "URGENT" ? "bg-rose-500" :
      toast.notificationType === "WARNING" ? "bg-amber-500" :
      "bg-emerald-500";
    const borderColor =
      toast.notificationType === "URGENT" ? "border-rose-200" :
      toast.notificationType === "WARNING" ? "border-amber-200" :
      "border-emerald-200";

    return (
      <div className={`w-80 max-w-[calc(100vw-2rem)] bg-white border ${borderColor} rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 flex items-start gap-3 animate-slide-in`}>
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center mt-0.5">
          <Bell className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest truncate">{toast.title}</p>
          </div>
          <p className="text-[11px] font-medium text-slate-600 leading-snug">{toast.message}</p>
        </div>
        <button onClick={onDismiss} className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-700 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (toast.type === "success") {
    return (
      <div className="w-72 max-w-[calc(100vw-2rem)] bg-[#064e3b] text-white rounded-2xl shadow-[0_8px_32px_rgba(6,78,59,0.3)] px-4 py-3 flex items-center gap-3 animate-slide-in">
        <CheckCircle className="w-5 h-5 text-emerald-300 flex-shrink-0" />
        <p className="text-xs font-black uppercase tracking-wide flex-1">{toast.message}</p>
        <button onClick={onDismiss} className="flex-shrink-0 p-0.5 text-emerald-300 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // error
  return (
    <div className="w-72 max-w-[calc(100vw-2rem)] bg-white border border-rose-200 rounded-2xl shadow-[0_8px_32px_rgba(239,68,68,0.15)] px-4 py-3 flex items-center gap-3 animate-slide-in">
      <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
      <p className="text-xs font-black text-rose-700 uppercase tracking-wide flex-1">{toast.message}</p>
      <button onClick={onDismiss} className="flex-shrink-0 p-0.5 text-rose-400 hover:text-rose-700 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[2000] flex flex-col gap-2 items-end sm:items-end pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={() => dismiss(toast.id)} />
        </div>
      ))}
    </div>
  );
}

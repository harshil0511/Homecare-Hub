"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  ArrowLeft,
  FileText,
  User,
  Wrench,
  CalendarDays,
  IndianRupee,
  Timer,
  Printer,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import Spinner from "@/components/ui/Spinner";

interface Receipt {
  booking_id: string;
  service_type: string;
  servicer_name: string;
  base_price: number;
  extra_hours: number;
  hourly_rate: number;
  extra_charge: number;
  final_amount: number;
  completed_at: string | null;
  negotiated: boolean;
  flow_type: string;
  provider_id: string | null;
  actual_hours?: number;
}

export default function ReceiptPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const toast = useToast();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [complaintModal, setComplaintModal] = useState(false);
  const [complaintReason, setComplaintReason] = useState("");
  const [filingComplaint, setFilingComplaint] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/bookings/${id}/receipt`)
      .then(data => setReceipt(data))
      .catch(() => toast.error("Failed to load receipt"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFileComplaint = async () => {
    if (!complaintReason.trim()) return;
    setFilingComplaint(true);
    try {
      await apiFetch(`/bookings/${id}/complaint`, {
        method: "POST",
        body: JSON.stringify({ reason: complaintReason }),
      });
      setComplaintModal(false);
      setComplaintReason("");
      toast.success("Complaint submitted to admin");
    } catch (err) {
      toast.error((err as Error).message || "Failed to file complaint");
    } finally {
      setFilingComplaint(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner />
    </div>
  );

  if (!receipt) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Receipt not found.</p>
    </div>
  );

  const shortId = String(receipt.booking_id).slice(0, 8).toUpperCase();
  const hourlyRate = receipt.hourly_rate ?? 0;
  const actualHours = receipt.actual_hours ?? (receipt.extra_hours > 0 ? receipt.extra_hours : null);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <style>{`
          @media print {
              body > * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible; }
              .print-area { position: fixed; top: 0; left: 0; width: 100%; }
          }
      `}</style>
      <div className="max-w-lg mx-auto print-area">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 mb-6 font-black uppercase tracking-widest print:hidden"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Booking
        </button>

        {/* Receipt Card */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">

          {/* Header strip */}
          <div className="bg-slate-900 px-8 py-7 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Payment Receipt</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">{receipt.service_type}</h1>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">
                Booking #{shortId}
              </p>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl px-4 py-2">
              <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest text-center">Completed</p>
            </div>
          </div>

          <div className="px-8 py-7 space-y-6">

            {/* Provider & Date row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Service Provider</p>
                </div>
                <p className="text-sm font-black text-slate-900 leading-tight">{receipt.servicer_name}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Completed On</p>
                </div>
                <p className="text-sm font-black text-slate-900 leading-tight">
                  {receipt.completed_at
                    ? new Date(receipt.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>
            </div>

            {/* Negotiated badge */}
            {receipt.negotiated && (
              <div className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg inline-block">
                Negotiated Price
              </div>
            )}

            {/* Charge breakdown */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-500" /> Charge Breakdown
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                {hourlyRate > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-slate-400" /> Hourly rate
                    </span>
                    <span className="font-black text-slate-700">₹{hourlyRate.toLocaleString("en-IN")}/hr</span>
                  </div>
                )}
                {actualHours != null && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-slate-400" /> Hours worked
                    </span>
                    <span className="font-black text-slate-700">{actualHours}h</span>
                  </div>
                )}
                {receipt.extra_hours > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Extra charge ({receipt.extra_hours}h)</span>
                    <span className="font-black text-slate-700">₹{Number(receipt.extra_charge).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Base amount</span>
                  <span className="font-black text-slate-700">₹{Number(receipt.base_price).toLocaleString("en-IN")}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">No surcharges</span>
                  <span className="text-xs font-black text-slate-400">₹0</span>
                </div>
              </div>
            </div>

            {/* Final amount */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Final Amount Paid</p>
                {receipt.completed_at && (
                  <p className="text-[10px] text-emerald-500/70 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(receipt.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <p className="text-4xl font-black text-emerald-700 tracking-tighter">
                ₹{Number(receipt.final_amount).toLocaleString("en-IN")}
              </p>
            </div>

            {/* Dispute */}
            <button
              onClick={() => setComplaintModal(true)}
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-2xl hover:bg-rose-50 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Dispute Charge
            </button>
            <button
              onClick={() => window.print()}
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 text-xs font-black uppercase rounded-2xl hover:bg-slate-50 transition-colors print:hidden"
            >
              <Printer className="w-4 h-4" />
              Download / Print Receipt
            </button>
            <p className="text-center text-[10px] text-slate-400 font-medium print:hidden">
              Select &quot;Save as PDF&quot; in the print dialog to download
            </p>
          </div>
        </div>
      </div>

      {/* Complaint Modal */}
      {complaintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-widest">File Complaint</h2>
              <button onClick={() => setComplaintModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Your complaint will be reviewed by the admin team.
            </p>
            <textarea
              value={complaintReason}
              onChange={e => setComplaintReason(e.target.value)}
              placeholder="Describe the issue with the charge or service quality..."
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setComplaintModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFileComplaint}
                disabled={filingComplaint || !complaintReason.trim()}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase rounded-xl disabled:opacity-50"
              >
                {filingComplaint ? "Submitting..." : "Submit Complaint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

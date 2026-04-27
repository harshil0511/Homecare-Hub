"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Clock, AlertTriangle, X, ArrowLeft, CreditCard } from "lucide-react";
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
  const [payDetails, setPayDetails] = useState<{
    account_holder_name: string;
    account_number_masked: string;
    account_number_last4: string;
    ifsc_code: string;
    upi_id: string | null;
    upi_qr_image_url: string | null;
    has_upi: boolean;
    has_qr: boolean;
  } | null>(null);
  const [payTab, setPayTab] = useState<"bank" | "upi" | "qr">("bank");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/bookings/${id}/receipt`)
      .then(data => {
        setReceipt(data);
        if (data.flow_type === "systematic" && data.provider_id) {
          apiFetch(`/payment/provider/${data.provider_id}/pay-details`)
            .then(setPayDetails)
            .catch(() => {});
        }
      })
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 mb-6 font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-base">{receipt.service_type}</p>
              <p className="text-xs text-slate-500">{receipt.servicer_name}</p>
            </div>
          </div>

          {receipt.negotiated && (
            <div className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg mb-4 inline-block">
              Negotiated Price
            </div>
          )}

          {receipt.flow_type === "systematic" && payDetails && (
            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                        <CreditCard className="w-5 h-5 text-[#064e3b]" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Pay Your Provider</h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Choose how you&apos;d like to transfer payment</p>
                    </div>
                </div>

                <div className="flex gap-2 mb-6">
                    {(["bank", "upi", "qr"] as const).map((tab) => {
                        const isDisabled = (tab === "upi" && !payDetails.has_upi) || (tab === "qr" && !payDetails.has_qr);
                        const labels = { bank: "Bank Transfer", upi: "UPI", qr: "QR Scanner" };
                        return (
                            <button
                                key={tab}
                                onClick={() => !isDisabled && setPayTab(tab)}
                                disabled={isDisabled}
                                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    payTab === tab
                                        ? "bg-[#064e3b] text-white shadow-md"
                                        : isDisabled
                                        ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
                                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                                }`}
                            >
                                {labels[tab]}
                            </button>
                        );
                    })}
                </div>

                {payTab === "bank" && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Account Holder</span>
                            <span className="text-sm font-black text-slate-900">{payDetails.account_holder_name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Account Number</span>
                            <button
                                onClick={() => setRevealed(!revealed)}
                                className="text-sm font-mono font-black text-slate-900 hover:text-[#064e3b] transition-colors"
                            >
                                {revealed ? payDetails.account_number_masked : "XXXXXX••••"}
                            </button>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">IFSC Code</span>
                            <span className="text-sm font-mono font-black text-slate-900">{payDetails.ifsc_code}</span>
                        </div>
                        {!revealed && (
                            <p className="text-[10px] text-slate-400 font-medium text-center pt-1">Tap account number to reveal last 4 digits</p>
                        )}
                    </div>
                )}

                {payTab === "upi" && payDetails.has_upi && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">UPI ID</span>
                            <span className="text-sm font-mono font-black text-slate-900">{payDetails.upi_id}</span>
                        </div>
                    </div>
                )}

                {payTab === "qr" && payDetails.has_qr && payDetails.upi_qr_image_url && (
                    <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-2xl p-6">
                        <img src={payDetails.upi_qr_image_url} alt="UPI QR Code" className="w-48 h-48 object-contain rounded-xl" />
                        <p className="text-[10px] text-slate-500 font-medium mt-3">Scan with any UPI app to pay</p>
                    </div>
                )}
            </div>
          )}

          {/* Price breakdown */}
          <div className="space-y-3 mb-6">
            {receipt.extra_hours > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>{receipt.extra_hours}h × ₹{receipt.hourly_rate.toFixed(0)}/h</span>
                <span className="font-bold">₹{receipt.extra_charge.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3 flex justify-between font-black text-slate-900">
              <span>Total</span>
              <span className="text-emerald-700">₹{receipt.final_amount.toLocaleString()}</span>
            </div>
          </div>

          {receipt.completed_at && (
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
              <Clock className="w-3.5 h-3.5" />
              Completed {new Date(receipt.completed_at).toLocaleString()}
            </div>
          )}

          <button
            onClick={() => setComplaintModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Dispute Extra Charges
          </button>
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
              placeholder="Describe the issue with extra charges or service quality..."
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

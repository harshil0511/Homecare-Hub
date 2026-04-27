"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList, Clock, CheckCircle, XCircle, MessageSquare,
  Calendar, IndianRupee, Users, ChevronRight, AlertTriangle,
  X, MapPin, Star
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";

interface ServiceRequest {
  id: number;
  contact_name: string;
  location: string;
  device_or_issue: string;
  description?: string;
  urgency: "Normal" | "High" | "Emergency";
  preferred_dates?: string[];
  status: "OPEN" | "ACCEPTED" | "CANCELLED" | "EXPIRED";
  expires_at: string;
  created_at: string;
  resulting_booking_id?: number;
  recipients?: { provider_id: number }[];
  responses?: ServiceRequestResponse[];
}

interface NegotiationOffer {
  id: string;
  offered_by: "USER" | "SERVICER";
  round_number: number;
  proposed_date: string;
  proposed_time: string;
  proposed_price: number;
  message?: string;
  is_final_offer: boolean;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  created_at: string;
}

interface ServiceRequestResponse {
  id: number;
  request_id: number;
  provider_id: number;
  proposed_date: string;
  proposed_price: number;
  estimated_hours?: number;
  message?: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  is_final_offer: boolean;
  negotiation_status: "NONE" | "NEGOTIATING" | "AGREED" | "CLOSED";
  agreed_price?: number;
  agreed_date?: string;
  current_round: number;
  created_at: string;
  provider?: {
    id: number;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    owner_name?: string;
    rating?: number;
  };
  negotiation_offers?: NegotiationOffer[];
}

interface ActiveBooking {
  id: number;
  service_type: string;
  status: string;
  priority?: string;
  scheduled_at?: string;
  estimated_cost?: number;
  final_cost?: number;
  actual_hours?: number | null;
  completion_notes?: string | null;
  is_flagged?: boolean;
  source_type?: string | null;
  provider?: {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
}

interface Receipt {
  booking_id: string;
  service_type: string;
  servicer_name: string;
  is_emergency: boolean;
  callout_fee: number;
  base_price: number;
  extra_hours: number;
  hourly_rate: number;
  extra_charge: number;
  final_amount: number;
  completed_at: string | null;
  negotiated: boolean;
}

type Tab = "active" | "responses" | "contracts" | "history";

interface HistoryBooking {
  id: number;
  service_type: string;
  status: string;
  scheduled_at?: string;
  estimated_cost?: number;
  final_cost?: number;
  provider?: { first_name?: string; last_name?: string; company_name?: string };
}

export default function UserBookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>(tabParam || "active");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<ActiveBooking[]>([]);
  const [history, setHistory] = useState<HistoryBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAccept, setConfirmAccept] = useState<{
    requestId: number;
    responseId: number;
    servicerName: string;
    price: number;
    date: string;
  } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [confirmReject, setConfirmReject] = useState<{
    requestId: number;
    responseId: number;
    servicerName: string;
  } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [counterOffer, setCounterOffer] = useState<{
    requestId: string;
    responseId: string;
    servicerName: string;
    currentPrice: number;
    currentDate: string;
    currentRound: number;
  } | null>(null);
  const [counterPrice, setCounterPrice] = useState<number | "">("");
  const [counterDate, setCounterDate] = useState("");
  const [counterTime, setCounterTime] = useState("morning");
  const [counterMessage, setCounterMessage] = useState("");
  const [sendingCounter, setSendingCounter] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [receiptModal, setReceiptModal] = useState<{ booking: ActiveBooking; receipt: Receipt } | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [disputeMode, setDisputeMode] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [filingDispute, setFilingDispute] = useState(false);
  const [rejectingCharge, setRejectingCharge] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqData, bookData] = await Promise.all([
        apiFetch("/requests?status_filter=OPEN").catch(() => []),
        apiFetch("/bookings/list").catch(() => []),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      setBookings(Array.isArray(bookData) ? bookData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === "history" && history.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void apiFetch("/bookings/list?status=Completed").then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [activeTab, history.length]);

  // Sync URL param to tab state
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const openRequests = requests.filter(r => r.status === "OPEN");
  const allResponses = requests
    .filter(r => r.status === "OPEN" && r.responses && r.responses.length > 0)
    .flatMap(r => (r.responses || []).filter(resp => resp.status === "PENDING").map(resp => ({ ...resp, request: r })));
  const activeContracts = bookings.filter(b =>
    b.status === "Accepted" || b.status === "In Progress" || b.status === "Pending Confirmation"
  );

  const handleAccept = async () => {
    if (!confirmAccept) return;
    setAccepting(true);
    try {
      await apiFetch(`/requests/${confirmAccept.requestId}/responses/${confirmAccept.responseId}/accept`, { method: "POST" });
      setConfirmAccept(null);
      toast.success(`Contract created with ${confirmAccept.servicerName}`);
      await loadData();
      setActiveTab("contracts");
    } catch (err) {
      toast.error((err as Error).message || "Failed to accept offer — please try again");
    } finally {
      setAccepting(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm("Cancel this request? All providers will be notified.")) return;
    setCancelling(requestId);
    try {
      await apiFetch(`/requests/${requestId}`, { method: "DELETE" });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success("Request cancelled — providers notified");
    } catch (err) {
      toast.error((err as Error).message || "Failed to cancel request");
    } finally {
      setCancelling(null);
    }
  };

  const handleOpenReceipt = async (booking: ActiveBooking) => {
    try {
      const receipt = await apiFetch(`/bookings/${booking.id}/receipt`);
      setReceiptModal({ booking, receipt });
      setDisputeMode(false);
      setDisputeReason("");
    } catch {
      toast.error("Failed to load receipt");
    }
  };

  const handleConfirmPayment = async () => {
    if (!receiptModal) return;
    setConfirmingPayment(true);
    try {
      await apiFetch(`/bookings/${receiptModal.booking.id}/confirm`, { method: "POST" });
      setReceiptModal(null);
      toast.success("Payment confirmed — job complete!");
      await loadData();
    } catch (err) {
      toast.error((err as Error).message || "Failed to confirm payment");
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleFileDispute = async () => {
    if (!receiptModal || !disputeReason.trim()) return;
    setFilingDispute(true);
    try {
      await apiFetch(`/bookings/${receiptModal.booking.id}/flag`, {
        method: "POST",
        body: JSON.stringify({ flag_reason: disputeReason.trim() }),
      });
      toast.success("Booking flagged. Admin has been notified.");
      setDisputeMode(false);
      setDisputeReason("");
      setReceiptModal(null);
      await loadData();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to flag booking");
    } finally {
      setFilingDispute(false);
    }
  };

  const handleRejectCharge = async () => {
    if (!receiptModal) return;
    setRejectingCharge(true);
    try {
      await apiFetch(`/bookings/${receiptModal.booking.id}/reject-charge`, { method: "POST" });
      toast.success("Charge rejected. Booking closed.");
      setReceiptModal(null);
      await loadData();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to reject charge");
    } finally {
      setRejectingCharge(false);
    }
  };

  const handleReject = async () => {
    if (!confirmReject) return;
    setRejecting(true);
    try {
      await apiFetch(`/requests/${confirmReject.requestId}/responses/${confirmReject.responseId}/reject`, { method: "POST" });
      setConfirmReject(null);
      toast.success(`Offer from ${confirmReject.servicerName} declined`);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message || "Failed to reject offer");
    } finally {
      setRejecting(false);
    }
  };

  const handleSendCounter = async () => {
    if (!counterOffer || counterPrice === "" || !counterDate) return;
    setSendingCounter(true);
    try {
      await apiFetch(
        `/requests/${counterOffer.requestId}/responses/${counterOffer.responseId}/counter`,
        {
          method: "POST",
          body: JSON.stringify({
            proposed_date: new Date(counterDate).toISOString(),
            proposed_time: counterTime,
            proposed_price: Number(counterPrice),
            message: counterMessage || undefined,
          }),
        }
      );
      setCounterOffer(null);
      setCounterPrice("");
      setCounterDate("");
      setCounterMessage("");
      toast.success("Counter offer sent — waiting for servicer response");
      await loadData();
    } catch (err) {
      toast.error((err as Error).message || "Failed to send counter offer");
    } finally {
      setSendingCounter(false);
    }
  };

  const getProviderName = (provider?: { first_name?: string; last_name?: string; company_name?: string; owner_name?: string }) => {
    if (!provider) return "Unknown Provider";
    if (provider.first_name || provider.last_name) return `${provider.first_name || ""} ${provider.last_name || ""}`.trim();
    return provider.company_name || provider.owner_name || "Unknown Provider";
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "active", label: "Active Requests", count: openRequests.length },
    { key: "responses", label: "Incoming Responses", count: allResponses.length },
    { key: "contracts", label: "Active Contracts", count: activeContracts.length },
    { key: "history", label: "History" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-widest">My Requests</h1>
        <p className="text-xs text-slate-400 mt-1">Manage your service requests, review offers, and track contracts</p>
      </div>

      {/* Tab Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex gap-1 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); router.replace(`/user/bookings?tab=${tab.key}`, { scroll: false }); }}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.key
                ? "bg-[#064e3b] text-white shadow-lg"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === tab.key
                  ? "bg-white/20 text-white"
                  : tab.key === "responses"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Tab 1: Active Requests */}
          {activeTab === "active" && (
            <div className="space-y-4">
              {openRequests.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No bookings yet" action={{ label: "Find Providers", href: "/user/providers" }} />
              ) : (
                openRequests.map(req => {
                  const urgencyColor = req.urgency === "Emergency" ? "border-l-rose-500"
                    : req.urgency === "High" ? "border-l-amber-500"
                    : "border-l-emerald-500";
                  const urgencyBadge = req.urgency === "Emergency" ? "bg-rose-100 text-rose-700"
                    : req.urgency === "High" ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700";
                  const responseCount = (req.responses || []).filter(r => r.status === "PENDING").length;

                  return (
                    <div key={req.id} className={`bg-white border border-slate-200 border-l-4 ${urgencyColor} rounded-2xl p-6`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-black text-slate-900 text-base">{req.device_or_issue}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />{req.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${urgencyBadge}`}>{req.urgency}</span>
                          {responseCount > 0 && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black">
                              {responseCount} offer{responseCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      {req.description && <p className="text-xs text-slate-500 italic mb-3 border-l-2 border-slate-200 pl-3">{req.description}</p>}
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />Sent to {(req.recipients || []).length} provider{(req.recipients || []).length !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {responseCount > 0 && (
                          <button onClick={() => { setActiveTab("responses"); router.replace("/user/bookings?tab=responses", { scroll: false }); }} className="px-4 py-2 bg-[#064e3b] text-white text-xs font-black uppercase rounded-xl hover:bg-emerald-800 transition-colors">
                            View {responseCount} Offer{responseCount !== 1 ? "s" : ""}
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelRequest(req.id)}
                          disabled={cancelling === req.id}
                          className="px-4 py-2 border border-slate-200 text-slate-500 text-xs font-black uppercase rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                          {cancelling === req.id ? "Cancelling..." : "Cancel"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Incoming Responses */}
          {activeTab === "responses" && (
            <div className="space-y-4">
              {allResponses.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No responses yet" description="Providers will submit their offers here" />
              ) : (
                allResponses.map(({ request: req, ...resp }) => {
                  const urgencyColor = req.urgency === "Emergency" ? "border-l-rose-500"
                    : req.urgency === "High" ? "border-l-amber-500"
                    : "border-l-emerald-500";
                  const servicerName = getProviderName(resp.provider);
                  const initials = servicerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

                  // Determine if this is a servicer's final offer (initial or counter)
                  const latestOffer = resp.negotiation_offers && resp.negotiation_offers.length > 0
                    ? resp.negotiation_offers[resp.negotiation_offers.length - 1]
                    : null;
                  const isServicerFinalOffer =
                    (resp.current_round === 0 && resp.is_final_offer) ||
                    (latestOffer && latestOffer.offered_by === "SERVICER" && latestOffer.is_final_offer);
                  // User's own pending counter — waiting for servicer
                  const waitingForServicer =
                    resp.negotiation_status === "NEGOTIATING" &&
                    latestOffer !== null &&
                    latestOffer.offered_by === "USER";
                  // Counter button visible when non-Emergency, not closed/agreed, not waiting, not final, rounds remain
                  const canCounter =
                    req.urgency !== "Emergency" &&
                    resp.status === "PENDING" &&
                    resp.negotiation_status !== "CLOSED" &&
                    resp.negotiation_status !== "AGREED" &&
                    !waitingForServicer &&
                    !isServicerFinalOffer &&
                    resp.current_round < 1;

                  return (
                    <div key={`${req.id}-${resp.id}`} className={`bg-white border border-slate-200 border-l-4 ${isServicerFinalOffer ? "border-l-rose-500 border-rose-200" : urgencyColor} rounded-2xl p-6`}>
                      {/* Final Offer Banner */}
                      {isServicerFinalOffer && (
                        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
                          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Final Best Offer</p>
                            <p className="text-[10px] text-rose-500">Servicer will not negotiate further — accept or reject only</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-sm font-black text-slate-600 flex-shrink-0">
                          {initials || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 text-sm">{servicerName}</p>
                          <p className="text-xs text-slate-500">Response to: <span className="font-bold">{req.device_or_issue}</span></p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <button
                            onClick={() => setConfirmAccept({
                              requestId: req.id,
                              responseId: resp.id,
                              servicerName,
                              price: latestOffer?.proposed_price ?? resp.proposed_price,
                              date: latestOffer?.proposed_date ?? resp.proposed_date,
                            })}
                            className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-black uppercase rounded-xl transition-colors ${
                              isServicerFinalOffer
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-[#064e3b] hover:bg-emerald-800"
                            }`}
                          >
                            <CheckCircle className="w-4 h-4" />
                            {isServicerFinalOffer ? "Accept Final Offer" : "Accept"}
                          </button>
                          {/* Counter Offer — hidden when it's a final offer, max rounds reached, or waiting */}
                          {canCounter && (
                            <button
                              onClick={() => setCounterOffer({
                                requestId: String(resp.request_id),
                                responseId: String(resp.id),
                                servicerName,
                                currentPrice: resp.agreed_price ?? resp.proposed_price,
                                currentDate: resp.agreed_date ?? resp.proposed_date,
                                currentRound: resp.current_round,
                              })}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-xl transition-colors"
                            >
                              Counter Offer
                            </button>
                          )}
                          {waitingForServicer && (
                            <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase rounded-full">
                              Waiting for servicer...
                            </span>
                          )}
                          <button
                            onClick={() => setConfirmReject({ requestId: req.id, responseId: resp.id, servicerName })}
                            className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 text-rose-600 text-xs font-black uppercase rounded-xl hover:bg-rose-50 transition-colors"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(resp.proposed_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 font-bold">
                          <IndianRupee className="w-4 h-4 text-slate-400" />
                          ₹{resp.proposed_price.toLocaleString("en-IN")}
                        </div>
                        {resp.estimated_hours && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock className="w-4 h-4 text-slate-400" />
                            ~{resp.estimated_hours}h estimated
                          </div>
                        )}
                        {resp.provider?.rating && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Star className="w-4 h-4 text-amber-400" />
                            {resp.provider.rating.toFixed(1)} rating
                          </div>
                        )}
                      </div>
                      {resp.message && (
                        <p className="mt-3 text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3">&ldquo;{resp.message}&rdquo;</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 3: Active Contracts */}
          {activeTab === "contracts" && (
            <div className="space-y-4">
              {activeContracts.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No active contracts" description="Accept a servicer offer to create a contract" />
              ) : (
                activeContracts.map(b => (
                  <div key={b.id} className={`bg-white border rounded-2xl p-6 flex items-center gap-4 ${
                    b.status === "Pending Confirmation" ? "border-amber-300 border-l-4 border-l-amber-500" : "border-slate-200"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm">{b.service_type}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{getProviderName(b.provider)}</p>
                      {b.scheduled_at && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(b.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {(b.final_cost || b.estimated_cost) && (
                        <span className="text-sm font-black text-slate-700">
                          ₹{(b.final_cost || b.estimated_cost || 0).toLocaleString("en-IN")}
                        </span>
                      )}
                      {b.status === "Pending Confirmation" ? (
                        <button
                          onClick={() => handleOpenReceipt(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 transition-colors animate-pulse"
                        >
                          <IndianRupee className="w-3 h-3" /> Confirm Receipt
                        </button>
                      ) : (
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                          b.status === "Accepted" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                        }`}>{b.status}</span>
                      )}
                      <button onClick={() => router.push(`/user/bookings/${b.id}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: History */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {history.length === 0 ? (
                <EmptyState icon={Clock} title="No completed bookings" />
              ) : (
                history.map(b => (
                  <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm">{b.service_type}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{getProviderName(b.provider)}</p>
                      {b.scheduled_at && (
                        <p className="text-xs text-slate-400 mt-1">{new Date(b.scheduled_at).toLocaleDateString("en-IN")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {(b.final_cost || b.estimated_cost) && (
                        <span className="text-sm font-black text-slate-700">₹{(b.final_cost || b.estimated_cost || 0).toLocaleString("en-IN")}</span>
                      )}
                      <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase">{b.status}</span>
                      <button onClick={() => router.push(`/user/bookings/${b.id}`)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Receipt Confirmation Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Confirm Receipt</h2>
                <p className="text-xs text-slate-500 mt-1">{receiptModal.receipt.servicer_name} · {receiptModal.receipt.service_type}</p>
              </div>
              <button onClick={() => { setReceiptModal(null); setDisputeMode(false); setDisputeReason(""); setRejectingCharge(false); }} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {receiptModal.receipt.is_emergency ? (
                /* Emergency billing: callout_fee (first hour) + extra_hours × hourly_rate */
                <>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Callout fee (first hour)</span>
                    <span className="font-bold">₹{receiptModal.receipt.callout_fee.toLocaleString("en-IN")}</span>
                  </div>
                  {receiptModal.receipt.extra_hours > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Extra time ({receiptModal.receipt.extra_hours.toFixed(1)}h × ₹{receiptModal.receipt.hourly_rate.toFixed(0)}/h)</span>
                      <span className="font-bold">₹{receiptModal.receipt.extra_charge.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </>
              ) : (
                /* Regular billing: hours × rate = total */
                <>
                  {receiptModal.receipt.extra_hours > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>{receiptModal.receipt.extra_hours}h × ₹{receiptModal.receipt.hourly_rate.toFixed(0)}/h</span>
                      <span className="font-bold">₹{receiptModal.receipt.extra_charge.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {receiptModal.booking.completion_notes && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span className="text-slate-400 italic">&ldquo;{receiptModal.booking.completion_notes}&rdquo;</span>
                    </div>
                  )}
                </>
              )}
              <div className="border-t border-slate-200 pt-3 flex justify-between font-black text-slate-900 text-base">
                <span>Total</span>
                <span className="text-emerald-700">₹{receiptModal.receipt.final_amount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {!disputeMode ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  {!receiptModal.receipt.is_emergency && (
                    <button
                      onClick={handleRejectCharge}
                      disabled={rejectingCharge}
                      className="flex-1 py-3 border border-rose-200 text-rose-600 rounded-2xl text-sm font-black uppercase hover:bg-rose-50 disabled:opacity-50"
                    >
                      {rejectingCharge ? "Rejecting..." : "Reject Charge"}
                    </button>
                  )}
                  <button
                    onClick={handleConfirmPayment}
                    disabled={confirmingPayment}
                    className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {confirmingPayment ? "Confirming..." : "Accept Charge"}
                  </button>
                </div>
                <button
                  onClick={() => setDisputeMode(true)}
                  className="w-full py-2 text-slate-400 text-xs font-black uppercase hover:text-rose-500 transition-colors"
                >
                  {receiptModal.receipt.is_emergency ? "Report to Admin" : "Flag to Admin"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">Describe the issue — admin will be notified:</p>
                <textarea
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder="e.g. Charged 5 hours but job took 1 hour"
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                />
                <div className="flex gap-3">
                  <button onClick={() => setDisputeMode(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                    Back
                  </button>
                  <button
                    onClick={handleFileDispute}
                    disabled={filingDispute || !disputeReason.trim()}
                    className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-black uppercase disabled:opacity-50 hover:bg-rose-700"
                  >
                    {filingDispute ? "Flagging..." : "Flag to Admin"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {confirmReject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-2">Decline This Offer?</h2>
            <p className="text-sm text-slate-600 mb-6">
              You are about to decline <span className="font-bold">{confirmReject.servicerName}</span>&apos;s offer.
              They will be notified that you chose someone else.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReject(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                Back
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rejecting ? "Declining..." : <><XCircle className="w-4 h-4" /> Decline</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Confirmation Dialog */}
      {confirmAccept && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-2">Confirm Acceptance</h2>
            <p className="text-sm text-slate-600 mb-6">
              Accept <span className="font-bold">{confirmAccept.servicerName}</span>&apos;s offer for{" "}
              <span className="font-bold text-[#064e3b]">₹{confirmAccept.price.toLocaleString("en-IN")}</span>{" "}
              on <span className="font-bold">{new Date(confirmAccept.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>?
            </p>
            <p className="text-xs text-slate-400 mb-6">This will create a service contract. Other providers will be notified that you selected someone else.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAccept(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="flex-1 py-3 bg-[#064e3b] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {accepting ? "Creating..." : <><CheckCircle className="w-4 h-4" /> Confirm</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter Offer Modal */}
      {counterOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-widest">
                Counter Offer
              </h2>
              <button onClick={() => setCounterOffer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-1">
              To: <span className="font-bold text-slate-700">{counterOffer.servicerName}</span>
            </p>
            <p className="text-[10px] text-slate-400 mb-4 uppercase tracking-widest">
              One counter offer allowed — servicer will accept or reject
            </p>

            {/* Their current offer */}
            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-xs text-slate-600 space-y-1">
              <p className="font-black text-slate-700 text-[10px] uppercase tracking-widest mb-2">Their Offer</p>
              <p>Date: {new Date(counterOffer.currentDate).toLocaleDateString()}</p>
              <p>Price: ₹{counterOffer.currentPrice.toLocaleString()}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">
                  Your Preferred Date
                </label>
                <input
                  type="date"
                  value={counterDate}
                  min={today}
                  onChange={e => setCounterDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">
                  Preferred Time
                </label>
                <select
                  value={counterTime}
                  onChange={e => setCounterTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="morning">Morning (8am–12pm)</option>
                  <option value="afternoon">Afternoon (12pm–5pm)</option>
                  <option value="evening">Evening (5pm–8pm)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">
                  Your Budget (₹)
                </label>
                <input
                  type="number"
                  min={1}
                  value={counterPrice}
                  onChange={e => setCounterPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 900"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">
                  Message (optional)
                </label>
                <textarea
                  value={counterMessage}
                  onChange={e => setCounterMessage(e.target.value)}
                  placeholder="Explain your counter offer..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setCounterOffer(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendCounter}
                disabled={sendingCounter || counterPrice === "" || !counterDate}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase rounded-xl disabled:opacity-50"
              >
                {sendingCounter ? "Sending..." : "Send Counter Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { ArrowLeftRight, CheckCircle2, XCircle, Package, Calendar, User, FileText, Loader2, Plus, X, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";

import { API_BASE_URL } from "@/lib/api";

export default function MaterialRequests({ token, role }: { token: string; role: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // General Request Modal States
  const [showModal, setShowModal] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [formRequest, setFormRequest] = useState({
    inventory_id: "",
    quantity: 1,
    notes: ""
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const isManager = ["admin", "manager"].includes(role);
  const isStore = ["admin", "store"].includes(role);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setRequests(await response.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    setLoadingInventory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setInventory(await response.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInventory(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const handleUpdateStatus = async (reqId: string, newStatus: string) => {
    setActionLoading(reqId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/requests/${reqId}/status?status=${newStatus}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to update status");
      }
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePartialApprove = async (reqId: string, approvedQty: number) => {
    setActionLoading(reqId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/requests/${reqId}/partial`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ approved_quantity: approvedQty })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to partially approve request");
      }
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateGeneralRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRequest.inventory_id) {
      alert("Please select a material");
      return;
    }
    if (formRequest.quantity <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }
    setSubmittingRequest(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/requests`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project_id: null,
          inventory_id: formRequest.inventory_id,
          quantity: parseFloat(formRequest.quantity as any),
          notes: formRequest.notes || null
        })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to submit request");
      }
      alert("General material request submitted successfully!");
      setShowModal(false);
      setFormRequest({ inventory_id: "", quantity: 1, notes: "" });
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400";
      case "approved": return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400";
      case "rejected": return "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400";
      case "issued": return "bg-emerald-50 text-emerald-600 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400";
      default: return "bg-slate-50 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Material Approvals</h2>
          <p className="text-slate-500 mt-1">Approve requested raw stock and authorize warehouse material releases.</p>
        </div>
        <div>
          <button 
            onClick={() => {
              setShowModal(true);
              fetchInventory();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-150 text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New General Request
          </button>
        </div>
      </header>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.length > 0 ? (
          requests.map((req) => (
            <div 
              key={req.id} 
              className="glass rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-shadow"
            >
              <div className="space-y-3 flex-1">
                {/* Meta details */}
                <div className="flex items-center gap-3">
                  <span className={cn("px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase", getStatusBadge(req.status))}>
                    {req.status}
                  </span>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Main description */}
                <div>
                  <h4 className="font-extrabold text-slate-850 dark:text-white text-base">
                    Request for {req.inventory?.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    Project: <span className="text-indigo-650 dark:text-indigo-400">{req.project?.name || "General Store Request (No Project)"}</span>
                  </p>
                </div>

                {/* Additional notes & author */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Requested by: {req.requester?.full_name || "Project Manager"}</span>
                  </div>
                  {req.notes && (
                    <div className="flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                      <span className="truncate italic">Notes: "{req.notes}"</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity Stat & Controls */}
              <div className="flex flex-row md:flex-col items-center justify-between md:text-right gap-4 md:border-l md:border-slate-205/65 md:pl-6 min-w-[150px]">
                <div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white block">
                    {req.quantity}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">{req.inventory?.unit} needed</span>
                  <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold block mt-1">
                    Stock: {req.inventory ? `${req.inventory.quantity} ${req.inventory.unit}` : "0"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {actionLoading === req.id ? (
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  ) : (
                    <>
                      {/* Manager Controls */}
                      {req.status === "pending" && isManager && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(req.id, "rejected")}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-955/20 dark:text-rose-400 rounded-xl transition-all border border-rose-200/30 dark:border-rose-900/30 cursor-pointer"
                            title="Reject Request"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const qtyStr = prompt(`Enter quantity to approve partially (Max: ${req.quantity}):`, String(req.quantity));
                              if (qtyStr) {
                                const approvedQty = parseFloat(qtyStr);
                                if (isNaN(approvedQty) || approvedQty <= 0 || approvedQty > req.quantity) {
                                  alert(`Invalid quantity. Must be a number between 0 and ${req.quantity}.`);
                                  return;
                                }
                                handlePartialApprove(req.id, approvedQty);
                              }
                            }}
                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-955/20 dark:text-amber-400 rounded-xl transition-all border border-amber-200/30 dark:border-amber-900/30 cursor-pointer"
                            title="Partial Approval"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req.id, "approved")}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer"
                            title="Approve Request"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Store Controls */}
                      {req.status === "approved" && isStore && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, "issued")}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          <Package className="w-3.5 h-3.5" />
                          Issue Stock
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 glass rounded-3xl text-slate-400">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 text-slate-350" />
            <p className="font-semibold text-slate-500">No Material Requests Logged</p>
            <p className="text-xs text-slate-400 mt-1">Pending items requested by Project Managers will appear here.</p>
          </div>
        )}
      </div>

      {/* NEW GENERAL REQUEST DIALOG MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" />
                New General Material Request
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGeneralRequest} className="space-y-4">
              {/* Material Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Select Raw Material*</label>
                {loadingInventory ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading materials...
                  </div>
                ) : (
                  <select
                    value={formRequest.inventory_id}
                    onChange={(e) => setFormRequest({ ...formRequest, inventory_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    <option value="">-- Choose Material Item --</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku}) - Stock: {item.quantity} {item.unit}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Quantity Required*</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={formRequest.quantity}
                  onChange={(e) => setFormRequest({ ...formRequest, quantity: parseFloat(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Internal Request Notes (Optional)</label>
                <textarea
                  placeholder="Specify purpose of usage, general department requirements..."
                  value={formRequest.notes}
                  onChange={(e) => setFormRequest({ ...formRequest, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-5 py-2.5 text-sm border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submittingRequest}
                  className="px-5 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingRequest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

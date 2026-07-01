"use client";

import React, { useState, useEffect } from "react";
import { Trash2, RotateCcw, Search, Archive as ArchiveIcon, AlertTriangle, Loader2, CheckSquare, Square, X } from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { useToast } from "./Toast";

interface ArchiveProps {
  token: string;
  role: string;
}

export default function Archive({ token, role }: ArchiveProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"projects" | "inventory" | "categories" | "staff" | "clients" | "users">("projects");
  const [archiveData, setArchiveData] = useState<Record<string, any[]>>({
    projects: [],
    inventory: [],
    categories: [],
    staff: [],
    clients: [],
    users: []
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"restore" | "delete_permanent">("restore");
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isAdmin = role === "admin";

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/archive");
      setArchiveData({
        projects: data.projects || [],
        inventory: data.inventory || [],
        categories: data.categories || [],
        staff: data.staff || [],
        clients: data.clients || [],
        users: data.users || []
      });
    } catch (err: any) {
      showToast(err.message || "Failed to load archived items", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const handleRestore = async (entityId: string, type: string) => {
    let url = "";
    if (type === "projects") url = `/api/projects/${entityId}/restore`;
    else if (type === "inventory") url = `/api/inventory/${entityId}/restore`;
    else if (type === "categories") url = `/api/archive/category/${entityId}/restore`;
    else if (type === "staff") url = `/api/staff/${entityId}/restore`;
    else if (type === "clients") url = `/api/clients/${entityId}/restore`;
    else if (type === "suppliers") url = `/api/suppliers/${entityId}/restore`;
    else if (type === "users") url = `/api/archive/user/${entityId}/restore`;

    if (!window.confirm("Are you sure you want to restore this record? It will immediately return to active use.")) {
      return;
    }

    try {
      const data = await apiRequest(url, { method: "POST" });
      showToast(data.message || "Record restored successfully", "success");
      setSelectedIds(prev => prev.filter(id => id !== entityId));
      fetchArchive();
      
      // Dispatch client side events to notify all active views to refresh instantly
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "project_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "inventory_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "attendance_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "request_change" } }));
    } catch (err: any) {
      showToast(err.message || "Failed to restore record", "error");
    }
  };

  const handlePermanentDelete = async (entityId: string, type: string) => {
    // 1. Initial Confirmation
    if (!window.confirm("WARNING: Permanent deletion cannot be undone. Are you sure you want to proceed?")) {
      return;
    }
    
    // 2. Reason Prompt
    const reason = window.prompt("Reason Required: Please state the formal reason for permanent deletion audit trail:");
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      showToast("Reason is required for permanent deletion audit trail.", "error");
      return;
    }
    
    // 3. Double Confirmation
    if (!window.confirm(`FINAL CONFIRMATION: Are you absolutely certain you want to permanently delete this ${type} record? This will perform dependency validation.`)) {
      return;
    }

    // Map frontend tab types to backend entity types
    let backendType = type;
    if (type === "projects") backendType = "project";
    else if (type === "categories") backendType = "category";
    else if (type === "inventory") backendType = "inventory";
    else if (type === "staff") backendType = "staff";
    else if (type === "clients") backendType = "client";
    else if (type === "suppliers") backendType = "supplier";
    else if (type === "users") backendType = "user";

    try {
      const data = await apiRequest(`/api/archive/${backendType}/${entityId}/permanent?reason=${encodeURIComponent(reason)}`, {
        method: "DELETE"
      });
      showToast(data.message || "Record permanently deleted", "success");
      setSelectedIds(prev => prev.filter(id => id !== entityId));
      fetchArchive();
      
      // Dispatch local custom events to notify views
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "project_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "inventory_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "attendance_change" } }));
    } catch (err: any) {
      showToast(err.message || "Failed to permanently delete record", "error");
    }
  };

  const handleToggleSelectAll = (filteredItems: any[]) => {
    const allSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.includes(item.id));
    if (allSelected) {
      const filteredIds = filteredItems.map(item => item.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredItems.map(item => item.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const triggerBulkAction = (action: "restore" | "delete_permanent") => {
    setBulkAction(action);
    setBulkPassword("");
    setBulkReason("");
    setSubmitError("");
    setShowBulkConfirmModal(true);
  };

  const handleExecuteBulkAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setSubmitLoading(true);
    setSubmitError("");
    try {
      let backendType: string = activeTab;
      if (activeTab === "projects") backendType = "project";
      else if (activeTab === "inventory") backendType = "inventory";
      else if (activeTab === "staff") backendType = "employee";
      else if (activeTab === "clients") backendType = "client";

      await apiRequest("/api/archive/bulk", {
        method: "POST",
        body: JSON.stringify({
          entity_type: backendType,
          action: bulkAction,
          ids: selectedIds,
          reason: bulkReason,
          password: bulkPassword
        })
      });

      showToast(`Successfully performed bulk ${bulkAction} on ${selectedIds.length} records`, "success");
      setSelectedIds([]);
      setShowBulkConfirmModal(false);
      fetchArchive();

      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "project_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "inventory_change" } }));
    } catch (err: any) {
      setSubmitError(err.message || "Bulk operation failed");
      showToast(err.message || "Bulk operation failed", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const getFilteredItems = () => {
    const items = archiveData[activeTab] || [];
    if (!Array.isArray(items)) return [];
    const query = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      if (!item) return false;
      const name = (item.name || item.full_name || item.email || "").toLowerCase();
      const sku = (item.sku || "").toLowerCase();
      const barcode = (item.barcode || "").toLowerCase();
      if (!query) return true;
      return name.includes(query) || sku.includes(query) || barcode.includes(query);
    });
  };

  const filteredItems = getFilteredItems();

  const tabLabels = {
    projects: "Projects",
    inventory: "Materials",
    categories: "Categories",
    staff: "Employees",
    clients: "Clients",
    users: "Users"
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ArchiveIcon className="w-8 h-8 text-indigo-650" />
            Archive Registry
          </h2>
          <p className="text-slate-500 mt-1">Review soft-deleted records, safely restore them, or perform audited permanent deletion.</p>
        </div>
      </header>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {(Object.keys(tabLabels) as Array<keyof typeof tabLabels>).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => {
                setActiveTab(tabKey);
                setSearchQuery("");
                setSelectedIds([]);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tabKey
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-150"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-650 hover:bg-slate-50"
              }`}
            >
              {tabLabels[tabKey]} ({archiveData[tabKey]?.length || 0})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search archived registry..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold"
          />
        </div>
      </div>

      {/* Bulk operations display */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border animate-in slide-in-from-top-3 duration-250">
          <span className="text-xs font-bold text-indigo-650">{selectedIds.length} Records Selected</span>
          <button
            onClick={() => triggerBulkAction("restore")}
            className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold rounded-xl border border-emerald-200 cursor-pointer"
          >
            Restore Selected
          </button>
          {isAdmin && (
            <button
              onClick={() => triggerBulkAction("delete_permanent")}
              className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl border border-rose-200 cursor-pointer"
            >
              Permanently Delete Selected
            </button>
          )}
        </div>
      )}

      {/* Table Section */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-24 text-center text-slate-400 font-medium text-xs">
            Loading archived records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4 w-12">
                    <button onClick={() => handleToggleSelectAll(filteredItems)} className="text-slate-400" title="Select All">
                      {filteredItems.length > 0 && filteredItems.every(item => selectedIds.includes(item.id)) ? (
                        <CheckSquare className="w-4 h-4 text-indigo-650" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">Name / Detail</th>
                  <th className="p-4">Deleted At</th>
                  <th className="p-4">Deleted By</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredItems.length > 0 ? (
                  filteredItems.filter(item => item !== null && item !== undefined).map(item => {
                    const deleteTime = item.deleted_at 
                      ? new Date(item.deleted_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })
                      : "—";

                    // Determine label name and detail
                    let title = item.name || item.full_name || item.email || "Unnamed Entity";
                    let detail = "";
                    if (activeTab === "inventory") detail = `SKU: ${item.sku} | Qty: ${item.quantity} ${item.unit}`;
                    else if (activeTab === "staff") detail = `Role: ${item.role} | Phone: ${item.phone || "—"}`;
                    else if (activeTab === "users") detail = `Role: ${item.role}`;
                    else if (activeTab === "projects") detail = `Status: ${item.status}`;
                    else if (item.contact_person) detail = `Contact: ${item.contact_person}`;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/10">
                        <td className="p-4 w-12">
                          <button onClick={() => handleToggleSelect(item.id)} className="text-slate-400" title={selectedIds.includes(item.id) ? "Deselect item" : "Select item"}>
                            {selectedIds.includes(item.id) ? (
                              <CheckSquare className="w-4 h-4 text-indigo-650" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="p-4">
                          <p className="font-extrabold text-slate-850 dark:text-white text-xs">{title}</p>
                          {detail && <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{detail}</p>}
                        </td>
                        <td className="p-4 text-slate-500 font-semibold">{deleteTime}</td>
                        <td className="p-4 text-slate-500 font-semibold">{item.deleted_by || "System / Admin"}</td>
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => handleRestore(item.id, activeTab)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/10 text-slate-650 hover:text-emerald-600 dark:hover:text-emerald-450 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                              title="Restore"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restore
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handlePermanentDelete(item.id, activeTab)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:border-rose-500 hover:bg-rose-50/10 text-slate-650 hover:text-rose-600 dark:hover:text-rose-450 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                title="Permanently Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Permanently
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">
                      No archived records found in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Instructions alert banner */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900 rounded-2xl flex gap-3 text-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-amber-800 dark:text-amber-400">Archival Registry Rules & Constraints</h4>
          <p className="text-amber-700/80 dark:text-amber-500/80 leading-relaxed font-semibold">
            Records linked to transactions, material histories, assignments, or logs cannot be permanently deleted to protect relational integrity and history. Only Admins can permanently delete records. A formal reason is required for the audit trail.
          </p>
        </div>
      </div>
      {/* BULK ACTION CONFIRMATION MODAL */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold capitalize text-slate-900 dark:text-white">Bulk {bulkAction.replace("_", " ")}</h3>
              <button title="Close" type="button" onClick={() => setShowBulkConfirmModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleExecuteBulkAction} className="space-y-4">
              <div className="text-xs text-slate-650 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100/50">
                You are about to perform bulk <strong className="text-indigo-650">{bulkAction.replace("_", " ")}</strong> on <strong className="text-indigo-600">{selectedIds.length}</strong> items in tab <strong className="text-indigo-600">{activeTab}</strong>.
              </div>

              {bulkAction === "delete_permanent" && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Reason / Notes*</label>
                  <input 
                    type="text" 
                    required 
                    value={bulkReason} 
                    onChange={e => setBulkReason(e.target.value)} 
                    placeholder="Reason for permanent deletion audit log" 
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl outline-none" 
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Administrator Password Verification*</label>
                <input 
                  type="password" 
                  required 
                  value={bulkPassword} 
                  onChange={e => setBulkPassword(e.target.value)} 
                  placeholder="Enter your login password" 
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none" 
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button title="Close" type="button" onClick={() => setShowBulkConfirmModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold font-sans">Cancel</button>
                <button type="submit" disabled={submitLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1 font-sans">
                  {submitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Bulk Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

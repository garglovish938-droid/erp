"use client";

import React, { useState, useEffect } from "react";
import { Trash2, RotateCcw, Search, Archive as ArchiveIcon, AlertTriangle } from "lucide-react";
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
      fetchArchive();
      
      // Dispatch local custom events to notify views
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "project_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "inventory_change" } }));
      window.dispatchEvent(new CustomEvent("erp_websocket_event", { detail: { event: "attendance_change" } }));
    } catch (err: any) {
      showToast(err.message || "Failed to permanently delete record", "error");
    }
  };

  const getFilteredItems = () => {
    const items = archiveData[activeTab] || [];
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      const name = (item.name || item.full_name || item.email || "").toLowerCase();
      const sku = (item.sku || "").toLowerCase();
      const barcode = (item.barcode || "").toLowerCase();
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
                  <th className="p-4">Name / Detail</th>
                  <th className="p-4">Deleted At</th>
                  <th className="p-4">Deleted By</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => {
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
                    <td colSpan={4} className="p-12 text-center text-slate-400 font-medium">
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
    </div>
  );
}

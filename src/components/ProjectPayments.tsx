"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IndianRupee, Calendar, Tag, FileText, Upload, Plus, RefreshCw, 
  ExternalLink, Paperclip, ChevronLeft, ChevronRight,
  User, Briefcase, Landmark, ShieldCheck, X, Search, Edit2, Trash2, RotateCcw, Eye, History, AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "./Toast";

interface ProjectPaymentsProps {
  token: string;
  role: string;
}

export default function ProjectPayments({ token, role }: ProjectPaymentsProps) {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [deletedPayments, setDeletedPayments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");

  // Filters
  const [filterProject, setFilterProject] = useState("");
  const [filterReceiptType, setFilterReceiptType] = useState("");

  // Add Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    client_id: "",
    invoice_number: "",
    invoice_amount: "0",
    received_amount: "",
    payment_method: "Cash",
    reference_number: "",
    bank_name: "",
    received_date: new Date().toISOString().split("T")[0],
    remarks: "",
    receipt_type: "Project Payment"
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editConfirm, setEditConfirm] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);

  // Delete Action State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<"soft" | "permanent">("soft");

  // Restore Action State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  // History Drawer State
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyTargetId, setHistoryTargetId] = useState("");
  const [historyVersions, setHistoryVersions] = useState<any[]>([]);

  // Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const getAuthToken = useCallback(() => {
    const savedUser = localStorage.getItem("allure_erp_user");
    return savedUser ? JSON.parse(savedUser).token : token;
  }, [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProject) params.set("project_id", filterProject);
      
      const userToken = getAuthToken();
      const [list, archivedList, projList, clientList] = await Promise.all([
        apiRequest(`/api/project-payments?${params}`),
        apiRequest("/api/project-payments/deleted"),
        apiRequest("/api/projects"),
        apiRequest("/api/clients")
      ]);
      
      let filteredPayments = list || [];
      let filteredArchived = archivedList || [];

      if (filterReceiptType) {
        filteredPayments = filteredPayments.filter((p: any) => p.receipt_type === filterReceiptType);
        filteredArchived = filteredArchived.filter((p: any) => p.receipt_type === filterReceiptType);
      }
      if (search) {
        const query = search.toLowerCase();
        const matchRow = (p: any) =>
          p.payment_id.toLowerCase().includes(query) ||
          p.invoice_number?.toLowerCase().includes(query) ||
          p.reference_number?.toLowerCase().includes(query) ||
          p.remarks?.toLowerCase().includes(query) ||
          p.client?.name?.toLowerCase().includes(query);

        filteredPayments = filteredPayments.filter(matchRow);
        filteredArchived = filteredArchived.filter(matchRow);
      }
      
      setPayments(filteredPayments);
      setDeletedPayments(filteredArchived);
      setProjects(projList?.filter((p: any) => !p.is_deleted) || []);
      setClients(clientList || []);
    } catch (e) {
      console.error("Failed to load project payments:", e);
      showToast("Error loading client payments.", "error");
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterReceiptType, search, showToast, getAuthToken]);

  useEffect(() => {
    loadData();

    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.event === "financial_change") {
        loadData();
      }
    };
    window.addEventListener("erp_websocket_event", handleSync);
    return () => window.removeEventListener("erp_websocket_event", handleSync);
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    if (e.target.files && e.target.files[0]) {
      if (isEdit) {
        setEditFile(e.target.files[0]);
      } else {
        setSelectedFile(e.target.files[0]);
      }
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) {
      showToast("Please select a client.", "error");
      return;
    }
    if (!form.received_amount || parseFloat(form.received_amount) <= 0) {
      showToast("Please enter a valid received amount.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      if (form.project_id) fd.append("project_id", form.project_id);
      fd.append("client_id", form.client_id);
      fd.append("invoice_amount", form.invoice_amount || "0");
      fd.append("received_amount", form.received_amount);
      fd.append("payment_method", form.payment_method);
      fd.append("receipt_type", form.receipt_type);
      if (form.invoice_number) fd.append("invoice_number", form.invoice_number);
      if (form.reference_number) fd.append("reference_number", form.reference_number);
      if (form.bank_name) fd.append("bank_name", form.bank_name);
      fd.append("received_date", form.received_date);
      if (form.remarks) fd.append("remarks", form.remarks);
      if (selectedFile) fd.append("file", selectedFile);

      const userToken = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/project-payments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to log client payment");
      }

      showToast("Payment receipt logged successfully!", "success");
      setShowAddModal(false);
      setForm({
        project_id: "",
        client_id: "",
        invoice_number: "",
        invoice_amount: "0",
        received_amount: "",
        payment_method: "Cash",
        reference_number: "",
        bank_name: "",
        received_date: new Date().toISOString().split("T")[0],
        remarks: "",
        receipt_type: "Project Payment"
      });
      setSelectedFile(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to log client receipt.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    if (!editConfirm) {
      showToast("Please check the confirmation box.", "error");
      return;
    }
    if (!editPassword) {
      showToast("Please enter your verification password.", "error");
      return;
    }
    if (!editReason) {
      showToast("Please specify the reason for this edit.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("password", editPassword);
      fd.append("reason", editReason);
      if (editForm.project_id) fd.append("project_id", editForm.project_id);
      fd.append("client_id", editForm.client_id);
      fd.append("invoice_amount", String(editForm.invoice_amount));
      fd.append("received_amount", String(editForm.received_amount));
      fd.append("payment_method", editForm.payment_method);
      fd.append("receipt_type", editForm.receipt_type);
      if (editForm.invoice_number) fd.append("invoice_number", editForm.invoice_number);
      if (editForm.reference_number) fd.append("reference_number", editForm.reference_number);
      if (editForm.bank_name) fd.append("bank_name", editForm.bank_name);
      fd.append("received_date", editForm.received_date);
      if (editForm.remarks) fd.append("remarks", editForm.remarks);
      if (editFile) fd.append("file", editFile);

      const userToken = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/project-payments/${editForm.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to edit receipt");
      }

      showToast("Payment receipt updated successfully!", "success");
      setShowEditModal(false);
      setEditForm(null);
      setEditPassword("");
      setEditReason("");
      setEditConfirm(false);
      setEditFile(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update receipt.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    if (!deleteConfirm) {
      showToast("Please check the confirmation box.", "error");
      return;
    }
    if (!deletePassword) {
      showToast("Please enter your verification password.", "error");
      return;
    }
    if (!deleteReason) {
      showToast("Please specify the reason for this deletion.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const userToken = getAuthToken();
      const endpoint = deleteType === "soft" 
        ? `/api/project-payments/${deleteTarget.id}/soft?password=${encodeURIComponent(deletePassword)}&reason=${encodeURIComponent(deleteReason)}`
        : `/api/project-payments/${deleteTarget.id}/permanent?password=${encodeURIComponent(deletePassword)}&reason=${encodeURIComponent(deleteReason)}`;

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to delete record");
      }

      showToast(`Payment receipt ${deleteType === "soft" ? "soft-deleted" : "permanently deleted"} successfully!`, "success");
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setDeletePassword("");
      setDeleteReason("");
      setDeleteConfirm(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete payment receipt.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreTarget) return;
    if (!restoreConfirm) {
      showToast("Please check the confirmation box.", "error");
      return;
    }
    if (!restorePassword) {
      showToast("Please enter your verification password.", "error");
      return;
    }
    if (!restoreReason) {
      showToast("Please specify the reason for this restoration.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const userToken = getAuthToken();
      const fd = new FormData();
      fd.append("password", restorePassword);
      fd.append("reason", restoreReason);

      const res = await fetch(`${API_BASE_URL}/api/project-payments/${restoreTarget.id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to restore record");
      }

      showToast("Payment receipt restored successfully!", "success");
      setShowRestoreModal(false);
      setRestoreTarget(null);
      setRestorePassword("");
      setRestoreReason("");
      setRestoreConfirm(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to restore payment receipt.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHistoryDrawer = async (payment: any) => {
    setHistoryTargetId(payment.payment_id);
    setShowHistoryDrawer(true);
    try {
      const versions = await apiRequest(`/api/project-payments/${payment.id}/versions`);
      setHistoryVersions(versions || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load audit versions.", "error");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <IndianRupee className="h-7 w-7 text-emerald-500" />
            Client Receipts & Revenue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Log, edit, restore, audit, and preview client payments and receivables milestones.
          </p>
        </div>
        <div className="flex gap-2">
          {["admin", "super_admin"].includes(role) && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-md transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Log Receipt
            </button>
          )}
          <button
            onClick={loadData}
            className="border border-slate-200 dark:border-slate-800 p-2 rounded-lg text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex border-b dark:border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab("active")}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "active" 
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Active Receipts ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "archived" 
              ? "border-rose-500 text-rose-600 dark:text-rose-400" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Archived / Deleted ({deletedPayments.length})
        </button>
      </div>

      {/* Stats Summary cards */}
      {activeTab === "active" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Revenue Received</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {formatCurrency(payments.reduce((sum, p) => sum + p.received_amount, 0))}
            </span>
            <span className="text-[10px] text-slate-400 mt-2 block">Sum of all filtered milestones & advances</span>
          </div>

          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Invoiced Amount</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
              {formatCurrency(payments.reduce((sum, p) => sum + p.invoice_amount, 0))}
            </span>
            <span className="text-[10px] text-slate-400 mt-2 block">Face value of client receipts registered</span>
          </div>

          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Outstanding Balance</span>
            <span className="text-2xl font-bold text-rose-500 mt-1 block">
              {formatCurrency(payments.reduce((sum, p) => sum + p.pending_amount, 0))}
            </span>
            <span className="text-[10px] text-slate-400 mt-2 block">Pending receivable balance</span>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900 grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Project Selector */}
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Receipt Type */}
        <select
          value={filterReceiptType}
          onChange={(e) => setFilterReceiptType(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
        >
          <option value="">All Receipt Types</option>
          <option value="Advance Payment">Advance Payment</option>
          <option value="Project Payment">Project Payment</option>
          <option value="Direct Payment">Direct Payment</option>
          <option value="Partial Payment">Partial Payment</option>
          <option value="Misc Client Payment">Misc Client Payment</option>
        </select>

        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
            placeholder="Search invoice number, client name, reference..."
          />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b dark:border-slate-950">
                <th className="p-4">Receipt ID</th>
                <th className="p-4">Date</th>
                <th className="p-4">Client</th>
                <th className="p-4">Receipt Type</th>
                <th className="p-4">Linked Project</th>
                <th className="p-4">Invoice No.</th>
                <th className="p-4 text-right">Invoiced</th>
                <th className="p-4 text-right">Received</th>
                <th className="p-4 text-right">Receivable</th>
                <th className="p-4 text-center">Attachment</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
                    Loading client receipt records...
                  </td>
                </tr>
              ) : (activeTab === "active" ? payments : deletedPayments).length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    No client receipts found.
                  </td>
                </tr>
              ) : (
                (activeTab === "active" ? payments : deletedPayments).map((p) => (
                  <tr key={p.id} className="border-b dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                    <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">{p.payment_id}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{p.received_date}</td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                      {p.client?.name || "Unknown Client"}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.receipt_type === "Advance Payment"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
                          : p.receipt_type === "Direct Payment"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                          : p.receipt_type === "Partial Payment"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                          : p.receipt_type === "Misc Client Payment"
                          ? "bg-slate-50 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      }`}>
                        {p.receipt_type || "Project Payment"}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-600 dark:text-slate-400">
                      {p.project ? p.project.name : <span className="text-slate-400 italic">Independent</span>}
                    </td>
                    <td className="p-4 font-medium text-slate-500 dark:text-slate-400">{p.invoice_number || "Direct"}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(p.invoice_amount)}</td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      {formatCurrency(p.received_amount)}
                    </td>
                    <td className={`p-4 text-right font-semibold ${p.pending_amount > 0 ? "text-rose-500" : "text-slate-400"}`}>
                      {formatCurrency(p.pending_amount)}
                    </td>
                    <td className="p-4 text-center">
                      {p.attachment_url ? (
                        <div className="flex justify-center gap-1.5">
                          <button
                            title="Preview Attachment"
                            onClick={() => setPreviewUrl(p.attachment_url)}
                            className="text-indigo-500 hover:text-indigo-600 p-1 border rounded-md dark:border-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={p.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-500 hover:text-emerald-600 inline-flex items-center justify-center p-1 border rounded-md dark:border-slate-800"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-800">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          title="Audit Versions"
                          onClick={() => handleOpenHistoryDrawer(p)}
                          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 border rounded-md dark:border-slate-800"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        {activeTab === "active" ? (
                          <>
                            {["admin", "super_admin"].includes(role) && (
                              <button
                                title="Edit Receipt"
                                onClick={() => {
                                  setEditForm({ ...p });
                                  setEditConfirm(false);
                                  setEditPassword("");
                                  setEditReason("");
                                  setShowEditModal(true);
                                }}
                                className="text-blue-500 hover:text-blue-600 p-1 border rounded-md dark:border-slate-800"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {["admin", "super_admin"].includes(role) && (
                              <button
                                title="Soft Delete"
                                onClick={() => {
                                  setDeleteTarget(p);
                                  setDeleteType("soft");
                                  setDeleteConfirm(false);
                                  setDeletePassword("");
                                  setDeleteReason("");
                                  setShowDeleteModal(true);
                                }}
                                className="text-rose-500 hover:text-rose-600 p-1 border rounded-md dark:border-slate-800"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {["admin", "super_admin"].includes(role) && (
                              <button
                                title="Restore Receipt"
                                onClick={() => {
                                  setRestoreTarget(p);
                                  setRestoreConfirm(false);
                                  setRestorePassword("");
                                  setRestoreReason("");
                                  setShowRestoreModal(true);
                                }}
                                className="text-emerald-500 hover:text-emerald-600 p-1 border rounded-md dark:border-slate-800"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {["admin", "super_admin"].includes(role) && (
                              <button
                                title="Permanent Delete"
                                onClick={() => {
                                  setDeleteTarget(p);
                                  setDeleteType("permanent");
                                  setDeleteConfirm(false);
                                  setDeletePassword("");
                                  setDeleteReason("");
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-600 hover:text-red-700 p-1 border rounded-md dark:border-slate-800"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Receipt Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-xl rounded-2xl shadow-xl border dark:border-slate-800 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Log Client Payment Receipt</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Receipt Type</label>
                  <select
                    value={form.receipt_type}
                    onChange={(e) => setForm({ ...form, receipt_type: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="Project Payment">Project Payment</option>
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Direct Payment">Direct Payment</option>
                    <option value="Partial Payment">Partial Payment</option>
                    <option value="Misc Client Payment">Misc Client Payment</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Client *</label>
                  <select
                    required
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="">Select Client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Linked Project (Optional)</label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="">Select Project (None / Direct)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Date Received</label>
                  <input
                    type="date"
                    required
                    value={form.received_date}
                    onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Invoiced Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.invoice_amount}
                    onChange={(e) => setForm({ ...form, invoice_amount: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Received Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.received_amount}
                    onChange={(e) => setForm({ ...form, received_amount: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="NEFT">NEFT / Bank</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Invoice Reference</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">TXN / Cheque Ref.</label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              {form.payment_method !== "Cash" && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Receiving Bank Name</label>
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Attachment file</label>
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? "Logging..." : "Log Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-xl rounded-2xl shadow-xl border dark:border-slate-800 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Edit Client Receipt
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditPaymentSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Receipt Type</label>
                  <select
                    value={editForm.receipt_type}
                    onChange={(e) => setEditForm({ ...editForm, receipt_type: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="Project Payment">Project Payment</option>
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Direct Payment">Direct Payment</option>
                    <option value="Partial Payment">Partial Payment</option>
                    <option value="Misc Client Payment">Misc Client Payment</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Client *</label>
                  <select
                    required
                    value={editForm.client_id}
                    onChange={(e) => setEditForm({ ...editForm, client_id: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Linked Project (Optional)</label>
                  <select
                    value={editForm.project_id || ""}
                    onChange={(e) => setEditForm({ ...editForm, project_id: e.target.value || null })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="">Select Project (None / Direct)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Date Received</label>
                  <input
                    type="date"
                    required
                    value={editForm.received_date}
                    onChange={(e) => setEditForm({ ...editForm, received_date: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Invoiced Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.invoice_amount}
                    onChange={(e) => setEditForm({ ...editForm, invoice_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Received Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editForm.received_amount}
                    onChange={(e) => setEditForm({ ...editForm, received_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={editForm.payment_method}
                    onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="NEFT">NEFT / Bank</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Invoice Reference</label>
                  <input
                    type="text"
                    value={editForm.invoice_number || ""}
                    onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">TXN / Cheque Ref.</label>
                  <input
                    type="text"
                    value={editForm.reference_number || ""}
                    onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              {editForm.payment_method !== "Cash" && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Receiving Bank Name</label>
                  <input
                    type="text"
                    value={editForm.bank_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Remarks</label>
                <textarea
                  value={editForm.remarks || ""}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Update Attachment Slip (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => handleFileChange(e, true)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold"
                />
              </div>

              {/* Edit Specific Confirmation fields */}
              <div className="border-t pt-4 space-y-3">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border dark:border-slate-800 space-y-2">
                  <div className="flex gap-2 items-start">
                    <input
                      type="checkbox"
                      id="editConfirmCheck"
                      checked={editConfirm}
                      onChange={(e) => setEditConfirm(e.target.checked)}
                      className="mt-1"
                    />
                    <label htmlFor="editConfirmCheck" className="text-xs text-slate-600 dark:text-slate-400 font-semibold select-none cursor-pointer">
                      Double Confirmation: I verify that editing this client revenue record is necessary and accurate.
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-rose-500 block mb-1">Password Confirmation *</label>
                    <input
                      type="password"
                      required
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full text-sm border border-rose-300 dark:border-rose-950/50 rounded-lg p-2 focus:outline-none dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Reason for Edit *</label>
                    <input
                      type="text"
                      required
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="e.g. correct keystroke error"
                      className="w-full text-sm border rounded-lg p-2 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 shadow-md"
                >
                  {submitting ? "Updating..." : "Save Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-xl border border-rose-100 dark:border-rose-950/30 overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b dark:border-slate-800 bg-rose-500/10 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-base font-bold">
                {deleteType === "soft" ? "Archive Client Receipt" : "PERMANENT DELETE Receipt (CAUTION)"}
              </h2>
            </div>
            <form onSubmit={handleDeleteSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                You are about to {deleteType === "soft" ? "archive/soft-delete" : "permanently drop"} the receipt 
                <strong className="text-slate-800 dark:text-slate-200"> {deleteTarget.payment_id}</strong> for 
                <strong> {deleteTarget.client?.name}</strong>. 
                {deleteType === "permanent" && " This action CANNOT be undone and will purge this receipt from all database logs."}
              </p>

              <div className="space-y-3">
                <div className="flex gap-2 items-start">
                  <input
                    type="checkbox"
                    id="delConfirm"
                    checked={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="delConfirm" className="text-xs text-slate-600 dark:text-slate-400 font-semibold cursor-pointer">
                    Double Confirmation: I explicitly confirm that I wish to delete this transaction.
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold text-rose-500 block mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full text-sm border border-rose-300 dark:border-rose-900 rounded-lg p-2.5 focus:outline-none dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Reason for Deletion *</label>
                  <input
                    type="text"
                    required
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Specify justification"
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && restoreTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-xl border dark:border-slate-800 overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b dark:border-slate-800 bg-emerald-500/10 text-emerald-600">
              <RotateCcw className="h-5 w-5" />
              <h2 className="text-base font-bold">Restore Client Receipt</h2>
            </div>
            <form onSubmit={handleRestoreSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                Restore the archived client payment receipt <strong className="text-slate-800 dark:text-slate-200">{restoreTarget.payment_id}</strong>.
              </p>

              <div className="space-y-3">
                <div className="flex gap-2 items-start">
                  <input
                    type="checkbox"
                    id="restoreConfirm"
                    checked={restoreConfirm}
                    onChange={(e) => setRestoreConfirm(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="restoreConfirm" className="text-xs text-slate-600 dark:text-slate-400 font-semibold cursor-pointer">
                    Double Confirmation: I confirm this restored receipt should be active and sync back to ledger.
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold text-rose-500 block mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full text-sm border border-emerald-300 dark:border-emerald-900 rounded-lg p-2.5 focus:outline-none dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Reason for Restore *</label>
                  <input
                    type="text"
                    required
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                    placeholder="e.g. user error restoration"
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? "Restoring..." : "Restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Audit Drawer */}
      {showHistoryDrawer && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-950 shadow-2xl z-50 border-l dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <History className="w-5 h-5 text-indigo-500" />
              Receipt Audit History ({historyTargetId})
            </h3>
            <button onClick={() => setShowHistoryDrawer(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {historyVersions.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">No edits logged for this receipt.</p>
            ) : (
              historyVersions.map((v: any) => {
                let oldObj: any = {};
                let newObj: any = {};
                try {
                  oldObj = JSON.parse(v.old_values || "{}");
                  newObj = JSON.parse(v.new_values || "{}");
                } catch(e) {}
                
                return (
                  <div key={v.id} className="border dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30 text-xs">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {v.user?.full_name || "System"}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(v.updated_at).toLocaleString()}</span>
                    </div>
                    <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded mb-2 font-medium">
                      Reason: {v.reason || "No reason specified"}
                    </div>
                    <div className="space-y-1 mt-2">
                      {Object.keys(newObj).map((key) => {
                        if (oldObj[key] !== newObj[key]) {
                          return (
                            <div key={key} className="grid grid-cols-3 gap-1 border-t py-1">
                              <span className="font-mono text-slate-400">{key}</span>
                              <span className="text-rose-500 line-through truncate">{String(oldObj[key] || "N/A")}</span>
                              <span className="text-emerald-500 font-semibold truncate">{String(newObj[key] || "N/A")}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl border dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                Invoice Attachment Preview
              </h3>
              <button onClick={() => setPreviewUrl(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 p-2">
              {previewUrl.toLowerCase().endsWith(".pdf") ? (
                <iframe src={previewUrl} className="w-full h-full rounded-lg" />
              ) : (
                <div className="w-full h-full flex items-center justify-center overflow-auto">
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

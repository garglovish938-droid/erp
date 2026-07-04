"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IndianRupee, Calendar, Tag, FileText, Upload, Plus, RefreshCw, 
  ExternalLink, Paperclip, ChevronLeft, ChevronRight,
  User, Briefcase, Landmark, ShieldCheck, X, Search
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
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  
  // Filters
  const [filterProject, setFilterProject] = useState("");
  const [filterReceiptType, setFilterReceiptType] = useState("");

  // Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    project_id: "", // optional now!
    client_id: "",
    invoice_number: "",
    invoice_amount: "0",
    received_amount: "",
    payment_method: "Cash",
    reference_number: "",
    bank_name: "",
    received_date: new Date().toISOString().split("T")[0],
    remarks: "",
    receipt_type: "Project Payment" // Advance, Direct, Project Payment
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProject) params.set("project_id", filterProject);
      
      const [list, projList, clientList] = await Promise.all([
        apiRequest(`/api/project-payments?${params}`),
        apiRequest("/api/projects"),
        apiRequest("/api/clients")
      ]);
      
      let filteredPayments = list || [];
      if (filterReceiptType) {
        filteredPayments = filteredPayments.filter((p: any) => p.receipt_type === filterReceiptType);
      }
      if (search) {
        const query = search.toLowerCase();
        filteredPayments = filteredPayments.filter((p: any) => 
          p.payment_id.toLowerCase().includes(query) ||
          p.invoice_number?.toLowerCase().includes(query) ||
          p.reference_number?.toLowerCase().includes(query) ||
          p.remarks?.toLowerCase().includes(query) ||
          p.client?.name?.toLowerCase().includes(query)
        );
      }
      
      setPayments(filteredPayments);
      setProjects(projList?.filter((p: any) => !p.is_deleted) || []);
      setClients(clientList || []);
    } catch (e) {
      console.error("Failed to load project payments:", e);
      showToast("Error loading client payments.", "error");
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterReceiptType, search, showToast]);

  useEffect(() => {
    loadData();

    // WS Auto Sync
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.event === "financial_change") {
        loadData();
      }
    };
    window.addEventListener("erp_websocket_event", handleSync);
    return () => window.removeEventListener("erp_websocket_event", handleSync);
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) {
      showToast("Please select a client.", "error");
      return;
    }
    if (form.receipt_type === "Project Payment" && !form.project_id) {
      showToast("A project must be selected for Project Payment types.", "error");
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
      fd.append("invoice_amount", form.invoice_amount || form.received_amount);
      fd.append("received_amount", form.received_amount);
      fd.append("payment_method", form.payment_method);
      fd.append("receipt_type", form.receipt_type);
      if (form.invoice_number) fd.append("invoice_number", form.invoice_number);
      if (form.reference_number) fd.append("reference_number", form.reference_number);
      if (form.bank_name) fd.append("bank_name", form.bank_name);
      fd.append("received_date", form.received_date);
      if (form.remarks) fd.append("remarks", form.remarks);
      if (selectedFile) fd.append("file", selectedFile);

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

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
      // Reset form
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
            Log client payments, advances, direct invoices, and link milestones dynamically.
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

      {/* Stats Summary cards */}
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
          <option value="Project Payment">Project Payment</option>
          <option value="Advance">Advance</option>
          <option value="Direct">Direct Sale / Payment</option>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
                    Loading client receipt records...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No client receipts matching filters found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                    <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">{p.payment_id}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{p.received_date}</td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                      {p.client?.name || "Unknown Client"}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.receipt_type === "Advance"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
                          : p.receipt_type === "Direct"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
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
                        <a
                          href={p.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-500 hover:text-emerald-600 inline-flex items-center justify-center p-1 border rounded-md dark:border-slate-900"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-800">-</span>
                      )}
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">Log Client Payment Receipt</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Receipt Type */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Receipt Type</label>
                  <select
                    value={form.receipt_type}
                    onChange={(e) => setForm({ ...form, receipt_type: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="Project Payment">Project Payment (linked to Milestone)</option>
                    <option value="Advance">Client Advance (Project pre-funding)</option>
                    <option value="Direct">Direct Payment (Retail or Direct Sale)</option>
                  </select>
                </div>

                {/* Client Selection */}
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
                {/* Project Selection (Optional for Advance/Direct) */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Linked Project {form.receipt_type === "Project Payment" ? "*" : "(Optional)"}
                  </label>
                  <select
                    required={form.receipt_type === "Project Payment"}
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

                {/* Received Date */}
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
                {/* Invoiced Amount */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Invoiced Face Amount (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.invoice_amount}
                    onChange={(e) => setForm({ ...form, invoice_amount: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="Defaults to received amount"
                  />
                </div>

                {/* Received Amount */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Received Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.received_amount}
                    onChange={(e) => setForm({ ...form, received_amount: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="Amount received"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Payment Method */}
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

                {/* Invoice Number */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Invoice Reference</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="INV-XXX"
                  />
                </div>

                {/* Reference Number */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">TXN / Cheque Ref.</label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="Ref. No."
                  />
                </div>
              </div>

              {/* Bank Name */}
              {form.payment_method !== "Cash" && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Receiving Bank Name</label>
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="e.g. HDFC Bank, SBI"
                  />
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Narrative / Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  placeholder="Details about client milestone status, advance terms, etc."
                />
              </div>

              {/* Attachment File */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Attach Receipt Slip / Bank Statement File</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300 hover:file:bg-slate-100"
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 shadow-md"
                >
                  {submitting ? "Logging..." : "Log Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

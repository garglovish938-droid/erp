"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, Calendar, Tag, FileText, Upload, Plus, RefreshCw, 
  ExternalLink, Image as ImageIcon, ChevronLeft, ChevronRight,
  User, Briefcase, Landmark
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
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [filterProject, setFilterProject] = useState("");

  // Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    client_id: "",
    invoice_number: "",
    invoice_amount: "",
    received_amount: "",
    payment_method: "Cash",
    reference_number: "",
    bank_name: "",
    received_date: new Date().toISOString().split("T")[0],
    remarks: ""
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
      setPayments(list || []);
      setProjects(projList?.filter((p: any) => !p.is_deleted) || []);
      setClients(clientList || []);
    } catch (e) {
      console.error("Failed to load project payments:", e);
    }
    setLoading(false);
  }, [filterProject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.client_id) {
      alert("Please select a project and a client.");
      return;
    }
    if (!form.invoice_amount || parseFloat(form.invoice_amount) < 0) {
      alert("Please enter a valid invoice amount.");
      return;
    }
    if (!form.received_amount || parseFloat(form.received_amount) < 0) {
      alert("Please enter a valid received amount.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("project_id", form.project_id);
      fd.append("client_id", form.client_id);
      fd.append("invoice_amount", form.invoice_amount);
      fd.append("received_amount", form.received_amount);
      fd.append("payment_method", form.payment_method);
      fd.append("received_date", form.received_date);
      if (form.invoice_number) fd.append("invoice_number", form.invoice_number);
      if (form.reference_number) fd.append("reference_number", form.reference_number);
      if (form.bank_name) fd.append("bank_name", form.bank_name);
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
        throw new Error(errData.detail || "Failed to log project payment");
      }

      setForm({
        project_id: "",
        client_id: "",
        invoice_number: "",
        invoice_amount: "",
        received_amount: "",
        payment_method: "Cash",
        reference_number: "",
        bank_name: "",
        received_date: new Date().toISOString().split("T")[0],
        remarks: ""
      });
      setSelectedFile(null);
      setShowAddModal(false);
      showToast("Client payment milestone successfully logged", "success");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to log client payment");
    }
    setSubmitting(false);
  };

  const filteredPayments = payments.filter(pay => {
    const q = search.toLowerCase();
    const payId = pay.payment_id?.toLowerCase() || "";
    const method = pay.payment_method?.toLowerCase() || "";
    const projName = pay.project?.name?.toLowerCase() || "";
    const clientName = pay.client?.name?.toLowerCase() || "";
    const refNum = pay.reference_number?.toLowerCase() || "";
    const invNum = pay.invoice_number?.toLowerCase() || "";
    return payId.includes(q) || method.includes(q) || projName.includes(q) || clientName.includes(q) || refNum.includes(q) || invNum.includes(q);
  });

  const totalRevenue = payments.reduce((acc, p) => acc + (p.received_amount || 0), 0);
  const totalPending = payments.reduce((acc, p) => acc + (p.pending_amount || 0), 0);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-650">
            Client Payments Receiving
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track client invoicing milestones, payments received, and pending project balances</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md">
              <Plus className="w-4 h-4" /> Receive Project Payment
            </button>
          )}
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Revenue card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Client Revenue Received</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-450 mt-1 block">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <div className="p-3 bg-blue-500 text-white rounded-2xl">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* Total Pending Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pending Invoice Balance</span>
            <span className="text-2xl font-black text-rose-500 dark:text-rose-455 mt-1 block">
              {formatCurrency(totalPending)}
            </span>
          </div>
          <div className="p-3 bg-rose-500 text-white rounded-2xl">
            <Landmark className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Search</label>
            <input 
              type="text"
              placeholder="Search payments, invoice, client..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 w-60 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Filter Project</label>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 w-44 outline-none">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPayments.length > 0 ? (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase">
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Payment ID</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Project</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Client</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Invoice Info</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Received Amt</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Pending Amt</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Method</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Reference / Bank</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Date</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/25">
                    <td className="py-3 px-4 font-mono font-bold text-slate-650 dark:text-slate-350">{pay.payment_id}</td>
                    <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200">{pay.project?.name || "—"}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">{pay.client?.name || "—"}</td>
                    <td className="py-3 px-4 font-semibold">
                      <div>No: {pay.invoice_number || "—"}</div>
                      <div className="text-[10px] text-slate-450">Amt: {formatCurrency(pay.invoice_amount)}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-450">{formatCurrency(pay.received_amount)}</td>
                    <td className="py-3 px-4 font-bold text-rose-500 dark:text-rose-455">{formatCurrency(pay.pending_amount)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                        {pay.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-550">
                      <div>Ref: {pay.reference_number || "—"}</div>
                      {pay.bank_name && <div className="text-[10px] text-slate-400">Bank: {pay.bank_name}</div>}
                    </td>
                    <td className="py-3 px-4 font-semibold">{pay.received_date}</td>
                    <td className="py-3 px-4 text-center">
                      {pay.attachment_url ? (
                        <a href={`${API_BASE_URL}${pay.attachment_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-650 hover:underline">
                          <ImageIcon className="w-3.5 h-3.5" /> View <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-12 text-slate-400">No project client payment milestones found matching filters.</p>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/85 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10 -mx-5 -mb-5">
            <span className="text-xs text-slate-450 font-semibold">
              Page {currentPage} of {totalPages} ({filteredPayments.length} total entries)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-30 font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-30 font-bold"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Log Client Milestone Payment</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleAddPayment} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Project Link *</label>
                <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                  <option value="">— Select Target Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Client Link *</label>
                <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                  <option value="">— Select Payer Client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Invoice Number (Optional)</label>
                  <input type="text" placeholder="e.g. INV-98124" value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-955 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Invoice Value Amount (₹) *</label>
                  <input type="number" step="0.01" min="0" placeholder="e.g. 1500000.00" value={form.invoice_amount} onChange={e => setForm({...form, invoice_amount: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-955 outline-none" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Received Amount (₹) *</label>
                  <input type="number" step="0.01" min="0" placeholder="e.g. 500000.00" value={form.received_amount} onChange={e => setForm({...form, received_amount: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-955 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Payment Method *</label>
                  <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="NEFT">UPI/NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Transaction ID / Ref No</label>
                  <input type="text" placeholder="e.g. UTR82736410" value={form.reference_number} onChange={e => setForm({...form, reference_number: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-955 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Bank Name</label>
                  <input type="text" placeholder="e.g. HDFC Bank" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-955 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Date Received *</label>
                  <input type="date" value={form.received_date} onChange={e => setForm({...form, received_date: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-955 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Remarks / Notes</label>
                  <input type="text" placeholder="e.g. Phase 2 milestone" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-955 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase block mb-1">Receipt / Invoice Document</label>
                <label htmlFor="payment-receipt" className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-350 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-4 cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-450" />
                  <span className="text-slate-500 text-xs">{selectedFile ? selectedFile.name : "Upload invoice/receipt copy"}</span>
                </label>
                <input id="payment-receipt" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-blue-650 to-indigo-650 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all">
                {submitting ? "Logging..." : "Confirm Payment Inflow"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, Calendar, Tag, FileText, Upload, Plus, RefreshCw, 
  ExternalLink, Image as ImageIcon, ChevronLeft, ChevronRight,
  TrendingUp, Award, Layers
} from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "./Toast";

interface FactoryFundProps {
  token: string;
  role: string;
}

export default function FactoryFund({ token, role }: FactoryFundProps) {
  const { showToast } = useToast();
  const [funds, setFunds] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    today_fund: 0,
    monthly_fund: 0,
    total_fund: 0,
    total_expenses: 0,
    available_balance: 0
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    payment_method: "Cash",
    date: new Date().toISOString().split("T")[0],
    reference_number: "",
    remarks: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, statsData] = await Promise.all([
        apiRequest("/api/factory-funds"),
        apiRequest("/api/factory-funds/stats")
      ]);
      setFunds(list || []);
      setStats(statsData || { today_fund: 0, monthly_fund: 0, total_fund: 0, total_expenses: 0, available_balance: 0 });
    } catch (e) {
      console.error("Failed to load factory funds:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("amount", form.amount);
      fd.append("payment_method", form.payment_method);
      fd.append("date", form.date);
      if (form.reference_number) fd.append("reference_number", form.reference_number);
      if (form.remarks) fd.append("remarks", form.remarks);
      if (selectedFile) fd.append("file", selectedFile);

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/factory-funds`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to log funding");
      }

      setForm({
        amount: "",
        payment_method: "Cash",
        date: new Date().toISOString().split("T")[0],
        reference_number: "",
        remarks: ""
      });
      setSelectedFile(null);
      setShowAddModal(false);
      showToast("Factory fund entry logged successfully", "success");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to log funding");
    }
    setSubmitting(false);
  };

  const filteredFunds = funds.filter(fund => {
    const q = search.toLowerCase();
    const fundId = fund.fund_id?.toLowerCase() || "";
    const method = fund.payment_method?.toLowerCase() || "";
    const refNum = fund.reference_number?.toLowerCase() || "";
    const remarks = fund.remarks?.toLowerCase() || "";
    return fundId.includes(q) || method.includes(q) || refNum.includes(q) || remarks.includes(q);
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredFunds.length / itemsPerPage);
  const paginatedFunds = filteredFunds.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-indigo-650">
            Factory Fund Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track capital injections by the Owner and compute factory liquidity balance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-indigo-700 shadow-md">
              <Plus className="w-4 h-4" /> Add Factory Fund
            </button>
          )}
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Available Balance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between xl:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Factory Balance</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-450 mt-1 block">
              {formatCurrency(stats.available_balance)}
            </span>
          </div>
          <div className="p-3 bg-emerald-500 text-white rounded-2xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Today's Funds */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Received Fund</span>
            <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block">
              {formatCurrency(stats.today_fund)}
            </span>
          </div>
          <div className="p-3 bg-indigo-500 text-white rounded-2xl">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Monthly Funds */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly Received Fund</span>
            <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block">
              {formatCurrency(stats.monthly_fund)}
            </span>
          </div>
          <div className="p-3 bg-amber-500 text-white rounded-2xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Total Funds Received */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fund Received</span>
            <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block">
              {formatCurrency(stats.total_fund)}
            </span>
          </div>
          <div className="p-3 bg-blue-500 text-white rounded-2xl">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Card 5: Total Expenses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Factory Expenses</span>
            <span className="text-xl font-black text-rose-500 dark:text-rose-455 mt-1 block">
              {formatCurrency(stats.total_expenses)}
            </span>
          </div>
          <div className="p-3 bg-rose-500 text-white rounded-2xl">
            <FileText className="w-5 h-5" />
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
              placeholder="Search fund entries..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 w-60 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredFunds.length > 0 ? (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase">
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Fund ID</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Date</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Amount</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Method</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Reference No</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Logged By</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 font-medium">Remarks</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedFunds.map((fund) => (
                  <tr key={fund.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/25">
                    <td className="py-3 px-4 font-mono font-bold text-slate-650 dark:text-slate-350">{fund.fund_id}</td>
                    <td className="py-3 px-4 font-semibold">{fund.date}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-450">{formatCurrency(fund.amount)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                        {fund.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">{fund.reference_number || "—"}</td>
                    <td className="py-3 px-4">{fund.user?.full_name || "—"}</td>
                    <td className="py-3 px-4 font-semibold text-slate-550 max-w-xs truncate">{fund.remarks || "—"}</td>
                    <td className="py-3 px-4 text-center">
                      {fund.attachment_url ? (
                        <a href={`${API_BASE_URL}${fund.attachment_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-650 hover:underline">
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
          <p className="text-center py-12 text-slate-400">No factory funding records found matching search filters.</p>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/85 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10 -mx-5 -mb-5">
            <span className="text-xs text-slate-450 font-semibold">
              Page {currentPage} of {totalPages} ({filteredFunds.length} total entries)
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
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Log Factory Fund Injection</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleAddFund} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Received Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Payment Method</label>
                  <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Amount Received (₹)</label>
                  <input type="number" step="0.01" min="0.01" placeholder="e.g. 500000.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Reference / Transaction ID</label>
                  <input type="text" placeholder="e.g. TXN982347102" value={form.reference_number} onChange={e => setForm({...form, reference_number: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Remarks / Notes</label>
                <textarea placeholder="Specify source or purpose of funding..." value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})}
                  rows={3} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50 dark:bg-slate-955 outline-none resize-none" />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase block mb-1">Receipt / Attachment Copy</label>
                <label htmlFor="receipt-upload" className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-350 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-4 cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-450" />
                  <span className="text-slate-500 text-xs">{selectedFile ? selectedFile.name : "Upload invoice/receipt image"}</span>
                </label>
                <input id="receipt-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white rounded-xl font-bold hover:from-emerald-755 hover:to-indigo-755 shadow-md transition-all">
                {submitting ? "Logging..." : "Confirm Fund Entry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, Calendar, Tag, FileText, Upload, Plus, Trash2, 
  Download, RefreshCw, Layers, ExternalLink, Image as ImageIcon,
  ChevronLeft, ChevronRight, Edit2, ShieldCheck, History, X, Paperclip, Search
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "./Toast";

interface DailyExpensesProps {
  token: string;
  role: string;
}

const COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16", "#EC4899", "#14B8A6"];

export default function DailyExpenses({ token, role }: DailyExpensesProps) {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ today_total: 0, weekly_total: 0, monthly_total: 0, category_breakdown: [] });
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  
  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // all, approved, pending, rejected
  
  // Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    expense_category: "Miscellaneous",
    amount: "0",
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
    vendor: "",
    project_id: "",
    payment_mode: "Cash",
    remarks: "",
    cash_received: "",
    returned_cash: "",
    wallet_id: "",
    wallet_linked: false
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState("excel");
  const [wallets, setWallets] = useState<any[]>([]);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    expense_category: "Miscellaneous",
    amount: "",
    expense_date: "",
    description: "",
    vendor: "",
    project_id: "",
    payment_mode: "Cash",
    remarks: "",
    cash_received: "",
    returned_cash: "",
    reason: "",
    wallet_id: "",
    wallet_linked: false
  });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Approval Modal State
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [approvalComment, setApprovalComment] = useState("");

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTargetId, setHistoryTargetId] = useState("");

  const categories = [
    "Fuel", "Petrol", "Food", "Transport", "Courier", "Loading", "Labour", 
    "Maintenance", "Electricity", "Internet", "Miscellaneous", "Material Purchase", 
    "Office Expense", "Salary", "Misc Expense", "Cash Returned", "Daily Expenses", "Other"
  ];

  // Load initial cached expenses if any
  useEffect(() => {
    try {
      const cached = localStorage.getItem("allure_expenses_cache");
      if (cached) {
        setExpenses(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Failed to load cached expenses:", e);
    }
  }, []);

  const loadData = useCallback(async (retryCount = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterProject) params.set("project_id", filterProject);
      if (filterStartDate) params.set("start_date", filterStartDate);
      if (filterEndDate) params.set("end_date", filterEndDate);
      
      const [list, statsData, projList] = await Promise.all([
        apiRequest(`/api/expenses?${params}`),
        apiRequest("/api/expenses/dashboard"),
        apiRequest("/api/projects")
      ]);
      const activeExpenses = list || [];
      setExpenses(activeExpenses);
      setStats(statsData || { today_total: 0, weekly_total: 0, monthly_total: 0, category_breakdown: [] });
      setProjects(projList?.filter((p: any) => !p.is_deleted) || []);
      
      try {
        localStorage.setItem("allure_expenses_cache", JSON.stringify(activeExpenses));
      } catch (cacheErr) {
        console.warn("Failed to write daily expenses cache:", cacheErr);
      }
    } catch (e) {
      console.error("Failed to load expenses:", e);
      if (retryCount < 2) {
        console.log(`Retrying to fetch expenses... Attempt ${retryCount + 1}`);
        setTimeout(() => loadData(retryCount + 1), 1000);
      } else {
        showToast("Error loading expenses records. Displaying cached/offline view.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterProject, filterStartDate, filterEndDate, showToast]);

  useEffect(() => {
    loadData();

    const fetchWallets = async () => {
      try {
        const list = await apiRequest("/api/factory-wallet");
        setWallets(list || []);
        if (list && list.length > 0) {
          setForm(prev => ({ ...prev, wallet_id: list[0].id }));
        }
      } catch (err) {
        console.error("Failed to load wallets:", err);
      }
    };
    fetchWallets();

    // WS Sync
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.event === "expense_change") {
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

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEditFile(e.target.files[0]);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("expense_category", form.expense_category);
      
      // Compute amount dynamically if cash advance is used
      let calculatedAmt = parseFloat(form.amount);
      const cashRec = parseFloat(form.cash_received || "0");
      const cashRet = parseFloat(form.returned_cash || "0");
      if (cashRec > 0) {
        calculatedAmt = cashRec - cashRet;
        if (calculatedAmt < 0) calculatedAmt = 0;
      }
      fd.append("amount", calculatedAmt.toString());
      fd.append("expense_date", form.expense_date);
      if (form.description) fd.append("description", form.description);
      if (form.vendor) fd.append("vendor", form.vendor);
      if (form.project_id) fd.append("project_id", form.project_id);
      fd.append("payment_mode", form.payment_mode);
      if (form.remarks) fd.append("remarks", form.remarks);
      fd.append("cash_received", cashRec.toString());
      fd.append("returned_cash", cashRet.toString());
      if (selectedFile) fd.append("file", selectedFile);
      if (form.wallet_id) fd.append("wallet_id", form.wallet_id);
      fd.append("wallet_linked", form.wallet_linked ? "true" : "false");

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to log expense");
      }

      showToast("Expense request logged successfully!", "success");
      setShowAddModal(false);
      setForm({
        expense_category: "Miscellaneous",
        amount: "0",
        expense_date: new Date().toISOString().split("T")[0],
        description: "",
        vendor: "",
        project_id: "",
        payment_mode: "Cash",
        remarks: "",
        cash_received: "",
        returned_cash: "",
        wallet_id: wallets.length > 0 ? wallets[0].id : "",
        wallet_linked: false
      });
      setSelectedFile(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to log expense.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (exp: any) => {
    setEditForm({
      id: exp.id,
      expense_category: exp.expense_category,
      amount: exp.amount.toString(),
      expense_date: exp.expense_date,
      description: exp.description || "",
      vendor: exp.vendor || "",
      project_id: exp.project_id || "",
      payment_mode: exp.payment_mode || "Cash",
      remarks: exp.remarks || "",
      cash_received: exp.cash_received ? exp.cash_received.toString() : "",
      returned_cash: exp.returned_cash ? exp.returned_cash.toString() : "",
      reason: "",
      wallet_id: exp.wallet_id || "",
      wallet_linked: exp.wallet_linked || false
    });
    setEditFile(null);
    setShowEditModal(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.reason) {
      showToast("Please provide a reason for editing this expense record (Auditing requirement).", "error");
      return;
    }

    setEditSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("reason", editForm.reason);
      fd.append("expense_category", editForm.expense_category);
      
      let calculatedAmt = parseFloat(editForm.amount || "0");
      const cashRec = parseFloat(editForm.cash_received || "0");
      const cashRet = parseFloat(editForm.returned_cash || "0");
      if (cashRec > 0) {
        calculatedAmt = cashRec - cashRet;
        if (calculatedAmt < 0) calculatedAmt = 0;
      }
      fd.append("amount", calculatedAmt.toString());
      fd.append("expense_date", editForm.expense_date);
      fd.append("description", editForm.description);
      fd.append("vendor", editForm.vendor);
      if (editForm.project_id) fd.append("project_id", editForm.project_id);
      fd.append("payment_mode", editForm.payment_mode);
      fd.append("remarks", editForm.remarks);
      fd.append("cash_received", cashRec.toString());
      fd.append("returned_cash", cashRet.toString());
      if (editFile) fd.append("file", editFile);
      if (editForm.wallet_id) fd.append("wallet_id", editForm.wallet_id);
      fd.append("wallet_linked", editForm.wallet_linked ? "true" : "false");

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/expenses/${editForm.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update expense");
      }

      showToast("Expense updated and audited successfully!", "success");
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update expense.", "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to archive/delete this expense record?")) return;
    const oldExpenses = [...expenses];
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      await apiRequest(`/api/expenses/${id}`, { method: "DELETE" });
      showToast("Expense record archived successfully.", "success");
      loadData();
    } catch (e: any) {
      setExpenses(oldExpenses);
      showToast(e.message || "Failed to delete expense record.", "error");
    }
  };

  const handleApprovalClick = (exp: any) => {
    setSelectedExpense(exp);
    setApprovalComment("");
    setShowApprovalModal(true);
  };

  const handleApproveReject = async (status: "approved" | "rejected") => {
    if (!selectedExpense) return;
    try {
      const query = new URLSearchParams({
        status: status,
        comment: approvalComment
      });

      const res = await apiRequest(`/api/expenses/${selectedExpense.id}/approve?${query.toString()}`, {
        method: "POST"
      });

      showToast(`Expense request ${status} successfully!`, "success");
      setShowApprovalModal(false);
      loadData();
    } catch (e: any) {
      showToast(e.message || "Failed to transition approval state.", "error");
    }
  };

  const handleHistoryClick = async (exp: any) => {
    setHistoryTargetId(exp.expense_id);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    setHistoryRecords([]);
    try {
      const data = await apiRequest(`/api/expenses/${exp.id}/history`);
      setHistoryRecords(data || []);
    } catch (err) {
      console.error(err);
      showToast("Failed to retrieve version history.", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportExpenses = async () => {
    const params = new URLSearchParams({ format: exportFormat });
    if (filterStartDate) params.set("start_date", filterStartDate);
    if (filterEndDate) params.set("end_date", filterEndDate);
    if (filterCategory) params.set("category", filterCategory);

    try {
      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/expenses/export?${params}`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const ext = exportFormat === "excel" ? "xlsx" : (exportFormat === "csv" ? "csv" : "pdf");
      link.setAttribute("download", `expenses_report.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      showToast("Failed to download report. Please check filters.", "error");
    }
  };

  // Local filtering by search & approval status
  const filteredExpenses = expenses.filter(exp => {
    // 1. Search Query
    const q = search.toLowerCase();
    const category = exp.expense_category?.toLowerCase() || "";
    const vendor = exp.vendor?.toLowerCase() || "";
    const desc = exp.description?.toLowerCase() || "";
    const projName = exp.project?.name?.toLowerCase() || "";
    const searchMatch = category.includes(q) || vendor.includes(q) || desc.includes(q) || projName.includes(q) || exp.expense_id.toLowerCase().includes(q);

    // 2. Status filter
    if (filterStatus) {
      return searchMatch && exp.approval_status === filterStatus;
    }
    return searchMatch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-7 w-7 text-indigo-500" />
            Daily Cash Reconciliation & Expenses
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Log raw material purchases, fuel, food, and reconcile supervisor cash advances.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Record Expense
          </button>
          <button
            onClick={() => loadData()}
            className="border border-slate-200 dark:border-slate-800 p-2 rounded-lg text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Today's Total Expenses</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
            {formatCurrency(stats.today_total || 0)}
          </span>
          <span className="text-[10px] text-slate-400 mt-2 block">Logged within the last 24 hours</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">This Week's Expenses</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
            {formatCurrency(stats.weekly_total || 0)}
          </span>
          <span className="text-[10px] text-slate-400 mt-2 block">Rolling last 7 days net spent</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">This Month's Expenses</span>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
            {formatCurrency(stats.monthly_total || 0)}
          </span>
          <span className="text-[10px] text-slate-400 mt-2 block font-medium">Monthly budgeted cash flow out</span>
        </div>

        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Pending Approval Requests</span>
          <span className="text-2xl font-bold text-amber-500 mt-1 block">
            {expenses.filter(e => e.approval_status === "pending").length}
          </span>
          <span className="text-[10px] text-slate-400 mt-2 block font-medium">Awaiting supervisor confirmation</span>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900 grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Category */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

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

        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending Approval</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
            placeholder="Search description, vendor, project name, ID..."
          />
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b dark:border-slate-950">
                <th className="p-4">Expense ID</th>
                <th className="p-4">Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Project</th>
                <th className="p-4 text-right">Opening Cash</th>
                <th className="p-4 text-right">Actual Spent</th>
                <th className="p-4 text-right">Returned Cash</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Receipt</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
                    Loading daily expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="border-b dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                    <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">{e.expense_id}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{e.expense_date}</td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                      <div>{e.expense_category}</div>
                      {e.wallet_linked && (
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 inline-flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.2 rounded">
                          Wallet Linked
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {e.project ? e.project.name : <span className="text-slate-400 italic">Office Expense</span>}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {e.cash_received > 0 ? formatCurrency(e.cash_received) : "-"}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {e.returned_cash > 0 ? formatCurrency(e.returned_cash) : "-"}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        e.approval_status === "approved"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-400"
                          : e.approval_status === "rejected"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-400"
                      }`}>
                        {e.approval_status?.toUpperCase() || "PENDING"}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {e.attachment_url ? (
                        <a
                          href={e.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-500 hover:text-emerald-600 inline-flex p-1 border rounded-md dark:border-slate-900"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-850">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleHistoryClick(e)}
                          className="p-1 text-slate-400 hover:text-indigo-500 rounded-md"
                          title="View Version History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        
                        {e.approval_status === "pending" && ["admin", "super_admin", "manager", "project_manager", "factory_manager"].includes(role) && (
                          <button
                            onClick={() => handleApprovalClick(e)}
                            className="p-1 text-slate-400 hover:text-emerald-500 rounded-md"
                            title="Approve / Reject"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        )}
                        
                        {["admin", "super_admin"].includes(role) && (
                          <>
                            <button
                              onClick={() => handleEditClick(e)}
                              className="p-1 text-slate-400 hover:text-blue-500 rounded-md"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(e.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-md"
                              title="Delete/Archive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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

      {/* Export Panel Options */}
      <div className="flex justify-end gap-2 items-center text-xs">
        <span className="text-slate-400">Export Report Format:</span>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value)}
          className="border rounded-md px-2 py-1 dark:bg-slate-900 dark:border-slate-800"
        >
          <option value="excel">Excel Sheet</option>
          <option value="pdf">PDF File</option>
          <option value="csv">CSV Ledger</option>
        </select>
        <button
          onClick={exportExpenses}
          className="bg-indigo-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-1"
        >
          <Download className="h-3 w-3" /> Download
        </button>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl border dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record Daily Expense</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-650">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Category</label>
                  <select
                    value={form.expense_category}
                    onChange={(e) => setForm({ ...form, expense_category: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-l-4 border-indigo-500 pl-3 bg-indigo-50/20 dark:bg-indigo-950/10 py-2 rounded-md">
                {/* Cash Received (Supervisor Advance) */}
                <div>
                  <label className="text-xs font-semibold text-indigo-650 dark:text-indigo-400 block mb-1">Cash Received (Advance)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.cash_received}
                    onChange={(e) => setForm({ ...form, cash_received: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="₹ Received Cash"
                  />
                </div>

                {/* Cash Returned */}
                <div>
                  <label className="text-xs font-semibold text-indigo-650 dark:text-indigo-400 block mb-1">Returned Cash</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.returned_cash}
                    onChange={(e) => setForm({ ...form, returned_cash: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="₹ Returned Cash"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Direct Amount (if cash_received is empty) */}
                {!(parseFloat(form.cash_received) > 0) && (
                  <div>
                    <label className="text-xs font-semibold text-slate-450 block mb-1">Expense Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                      placeholder="₹ Amount spent"
                    />
                  </div>
                )}

                {/* Project */}
                <div>
                  <label className="text-xs font-semibold text-slate-455 block mb-1">Link to Project</label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="">Office / Non-Project Expense</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Vendor */}
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Vendor / Payee</label>
                  <input
                    type="text"
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="e.g. Shell Petrol, Local Vendor"
                  />
                </div>

                {/* Mode */}
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Payment Mode</label>
                  <select
                    value={form.payment_mode}
                    onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Wallet Integration */}
              <div className="grid grid-cols-2 gap-4 border border-emerald-100 dark:border-emerald-950 bg-emerald-50/10 dark:bg-emerald-950/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="wallet_linked"
                    checked={form.wallet_linked}
                    onChange={(e) => setForm({ ...form, wallet_linked: e.target.checked })}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-800"
                  />
                  <label htmlFor="wallet_linked" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Link to Factory Wallet
                  </label>
                </div>

                {form.wallet_linked && (
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Select Wallet</label>
                    <select
                      value={form.wallet_id}
                      onChange={(e) => setForm({ ...form, wallet_id: e.target.value })}
                      className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    >
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name || w.id} (Bal: ₹{w.balance})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Description / Purpose</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  placeholder="Detail the expense purpose..."
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Supervisor Remarks</label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  placeholder="Internal notes..."
                />
              </div>

              {/* Attachment */}
              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Upload Invoice Attachment</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300 hover:file:bg-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? "Logging..." : "Log Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl border dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Expense Record</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-650">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateExpense} className="p-6 space-y-4">
              {/* Reason for Editing */}
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-250 dark:border-amber-900/40">
                <label className="text-xs font-semibold text-amber-800 dark:text-amber-400 block mb-1">Reason for Editing (Required for Audit Log) *</label>
                <input
                  type="text"
                  required
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  className="w-full text-sm border border-amber-300 rounded-lg p-2 focus:outline-none dark:bg-slate-900 dark:border-slate-850"
                  placeholder="Explain why you are correcting this record..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={editForm.expense_date}
                    onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Category</label>
                  <select
                    value={editForm.expense_category}
                    onChange={(e) => setEditForm({ ...editForm, expense_category: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-l-4 border-indigo-500 pl-3 bg-indigo-50/20 dark:bg-indigo-950/10 py-2 rounded-md">
                {/* Cash Received (Supervisor Advance) */}
                <div>
                  <label className="text-xs font-semibold text-indigo-650 dark:text-indigo-400 block mb-1">Cash Received (Advance)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.cash_received}
                    onChange={(e) => setEditForm({ ...editForm, cash_received: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                {/* Cash Returned */}
                <div>
                  <label className="text-xs font-semibold text-indigo-650 dark:text-indigo-400 block mb-1">Returned Cash</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.returned_cash}
                    onChange={(e) => setEditForm({ ...editForm, returned_cash: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Direct Amount (if cash_received is empty) */}
                {!(parseFloat(editForm.cash_received) > 0) && (
                  <div>
                    <label className="text-xs font-semibold text-slate-450 block mb-1">Expense Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    />
                  </div>
                )}

                {/* Project */}
                <div>
                  <label className="text-xs font-semibold text-slate-455 block mb-1">Link to Project</label>
                  <select
                    value={editForm.project_id}
                    onChange={(e) => setEditForm({ ...editForm, project_id: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="">Office / Non-Project Expense</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Vendor */}
                <div>
                  <label className="text-xs font-semibold text-slate-455 block mb-1">Vendor</label>
                  <input
                    type="text"
                    value={editForm.vendor}
                    onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                {/* Mode */}
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Payment Mode</label>
                  <select
                    value={editForm.payment_mode}
                    onChange={(e) => setEditForm({ ...editForm, payment_mode: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Wallet Integration */}
              <div className="grid grid-cols-2 gap-4 border border-emerald-100 dark:border-emerald-950 bg-emerald-50/10 dark:bg-emerald-950/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="edit_wallet_linked"
                    checked={editForm.wallet_linked}
                    onChange={(e) => setEditForm({ ...editForm, wallet_linked: e.target.checked })}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-800"
                  />
                  <label htmlFor="edit_wallet_linked" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Link to Factory Wallet
                  </label>
                </div>

                {editForm.wallet_linked && (
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Select Wallet</label>
                    <select
                      value={editForm.wallet_id}
                      onChange={(e) => setEditForm({ ...editForm, wallet_id: e.target.value })}
                      className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    >
                      <option value="">No Wallet Selected</option>
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name || w.id} (Bal: ₹{w.balance})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Description / Purpose</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Supervisor Remarks</label>
                <input
                  type="text"
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                />
              </div>

              {/* Attachment */}
              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Replace Attachment Slip File</label>
                <input
                  type="file"
                  onChange={handleEditFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300 hover:file:bg-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 shadow-md"
                >
                  {editSubmitting ? "Saving changes..." : "Save Corrections"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl border dark:border-slate-800 shadow-xl overflow-hidden p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Review Expense Request</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Expense ID: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedExpense?.expense_id}</span> | Amount: <span className="font-semibold text-indigo-600">{formatCurrency(selectedExpense?.amount)}</span>
            </p>
            
            <div className="space-y-4">
              {/* Approval Comment */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Review Comment / Reason</label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  placeholder="Enter supervisor notes, comments, or reason for rejection..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApproveReject("rejected")}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Reject Request
                </button>
                <button
                  onClick={() => handleApproveReject("approved")}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Approve Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-2xl rounded-2xl border dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-500" />
                Audit Logs & Edit History: {historyTargetId}
              </h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {historyLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-350" />
                  Loading edit versions...
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic">
                  This record is on its initial version (Version 1). No subsequent edits have been logged.
                </div>
              ) : (
                <div className="space-y-4">
                  {historyRecords.map((r, idx) => {
                    const parsed = JSON.parse(r.serialized_data);
                    return (
                      <div key={r.id} className="border dark:border-slate-900 p-4 rounded-xl space-y-2 bg-slate-50/50 dark:bg-slate-950/20">
                        <div className="flex justify-between text-xs font-semibold text-slate-500 border-b dark:border-slate-900 pb-1">
                          <span>Version {r.version_num} ({idx === 0 ? "Latest State" : `Revision`})</span>
                          <span>Timestamp: {new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">Category</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{parsed.expense_category}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Amount Spent</span>
                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(parsed.amount)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Reconciled Cash</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              In: {formatCurrency(parsed.cash_received || 0)} | Ret: {formatCurrency(parsed.returned_cash || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Approval Status</span>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              parsed.approval_status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {parsed.approval_status?.toUpperCase() || "PENDING"}
                            </span>
                          </div>
                        </div>
                        {parsed.supervisor_comment && (
                          <div className="text-xs bg-white dark:bg-slate-950 p-2 rounded border dark:border-slate-900 text-slate-500">
                            <span className="font-semibold block text-slate-600 dark:text-slate-400">Supervisor comment:</span>
                            {parsed.supervisor_comment}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

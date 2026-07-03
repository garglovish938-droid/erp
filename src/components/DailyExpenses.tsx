"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, Calendar, Tag, FileText, Upload, Plus, Trash2, 
  Download, RefreshCw, Layers, ExternalLink, Image as ImageIcon,
  ChevronLeft, ChevronRight, Edit2
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";

interface DailyExpensesProps {
  token: string;
  role: string;
}

const COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16", "#EC4899", "#14B8A6"];

export default function DailyExpenses({ token, role }: DailyExpensesProps) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ today_total: 0, weekly_total: 0, monthly_total: 0, category_breakdown: [] });
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  
  // Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    expense_category: "Miscellaneous",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
    vendor: "",
    project_id: "",
    payment_mode: "Cash",
    remarks: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState("excel");

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
    reason: ""
  });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const categories = ["Fuel", "Food", "Transport", "Courier", "Loading", "Labour", "Maintenance", "Electricity", "Internet", "Miscellaneous"];

  const loadData = useCallback(async () => {
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
      setExpenses(list || []);
      setStats(statsData || { today_total: 0, weekly_total: 0, monthly_total: 0, category_breakdown: [] });
      setProjects(projList?.filter((p: any) => !p.is_deleted) || []);
    } catch (e) {
      console.error("Failed to load expenses:", e);
    }
    setLoading(false);
  }, [filterCategory, filterProject, filterStartDate, filterEndDate]);

  useEffect(() => {
    loadData();
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
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("expense_category", form.expense_category);
      fd.append("amount", form.amount);
      fd.append("expense_date", form.expense_date);
      if (form.description) fd.append("description", form.description);
      if (form.vendor) fd.append("vendor", form.vendor);
      if (form.project_id) fd.append("project_id", form.project_id);
      if (form.payment_mode) fd.append("payment_mode", form.payment_mode);
      if (form.remarks) fd.append("remarks", form.remarks);
      if (selectedFile) fd.append("file", selectedFile);

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create expense");
      }

      setForm({
        expense_category: "Miscellaneous",
        amount: "",
        expense_date: new Date().toISOString().split("T")[0],
        description: "",
        vendor: "",
        project_id: "",
        payment_mode: "Cash",
        remarks: ""
      });
      setSelectedFile(null);
      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to submit expense");
    }
    setSubmitting(false);
  };

  const handleEditExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.amount || parseFloat(editForm.amount) <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    if (!editForm.reason.trim()) {
      alert("Please specify a reason for modification.");
      return;
    }

    setEditSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("reason", editForm.reason);
      fd.append("expense_category", editForm.expense_category);
      fd.append("amount", editForm.amount);
      fd.append("expense_date", editForm.expense_date);
      fd.append("description", editForm.description || "");
      fd.append("vendor", editForm.vendor || "");
      fd.append("project_id", editForm.project_id || "");
      fd.append("payment_mode", editForm.payment_mode || "Cash");
      fd.append("remarks", editForm.remarks || "");
      if (editFile) fd.append("file", editFile);

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/expenses/${editForm.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to edit expense");
      }

      setEditFile(null);
      setShowEditModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to edit expense");
    }
    setEditSubmitting(false);
  };

  const openEditModal = (exp: any) => {
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
      reason: ""
    });
    setEditFile(null);
    setShowEditModal(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await apiRequest(`/api/expenses/${id}`, { method: "DELETE" });
      await loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete expense record");
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
      alert("Failed to download report. Please check filters.");
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const q = search.toLowerCase();
    const category = exp.expense_category?.toLowerCase() || "";
    const vendor = exp.vendor?.toLowerCase() || "";
    const desc = exp.description?.toLowerCase() || "";
    const projName = exp.project?.name?.toLowerCase() || "";
    return category.includes(q) || vendor.includes(q) || desc.includes(q) || projName.includes(q);
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-600 to-amber-600">
            Daily Expenses
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track fuel, loading, food, utilities, and minor operating costs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-xl text-sm font-semibold hover:from-rose-700 hover:to-amber-700 shadow-md">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-4 lg:col-span-2">
          {/* Card 1: Today */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Expense</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                ₹{stats.today_total?.toLocaleString("en-IN") ?? "0"}
              </span>
            </div>
            <div className="p-3 bg-rose-500 text-white rounded-2xl">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Weekly */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Expense</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                ₹{stats.weekly_total?.toLocaleString("en-IN") ?? "0"}
              </span>
            </div>
            <div className="p-3 bg-amber-500 text-white rounded-2xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Monthly */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Expense</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                ₹{stats.monthly_total?.toLocaleString("en-IN") ?? "0"}
              </span>
            </div>
            <div className="p-3 bg-indigo-500 text-white rounded-2xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Chart Column */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">Category Wise Distribution</h3>
          {stats.category_breakdown && stats.category_breakdown.length > 0 ? (
            <div className="h-44 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.category_breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {stats.category_breakdown.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `₹${v}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-400 max-h-36 overflow-y-auto w-1/2">
                {stats.category_breakdown.map((item: any, idx: number) => (
                  <div key={item.category} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate">{item.category}: ₹{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-10">No expense records found</p>
          )}
        </div>
      </div>

      {/* Filters & Export Options */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Search</label>
            <input 
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 w-44 outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Category</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 w-36 outline-none">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Project Link</label>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 w-36 outline-none">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Start Date</label>
            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">End Date</label>
            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 outline-none" />
          </div>
          
          <div className="flex gap-2 ml-auto items-center">
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-900 outline-none">
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button onClick={exportExpenses} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm">
              <Download className="w-3.5 h-3.5" /> Export Report
            </button>
          </div>
        </div>
      </div>

      {/* History Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm overflow-hidden">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Expenses Log</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredExpenses.length > 0 ? (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase">
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Expense ID</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Date</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Category</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Amount</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Vendor</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Project</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Uploaded By</th>
                  <th className="py-3 px-4 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Bill</th>
                  <th className="py-3 px-4 text-center sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/25">
                    <td className="py-3 px-4 font-mono font-bold text-slate-650 dark:text-slate-350">{exp.expense_id}</td>
                    <td className="py-3 px-4 font-semibold">{exp.expense_date}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                        {exp.expense_category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-455">₹{exp.amount?.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">{exp.vendor || "—"}</td>
                    <td className="py-3 px-4 text-indigo-600 font-bold">{exp.project?.name || "—"}</td>
                    <td className="py-3 px-4">{exp.creator?.full_name || "—"}</td>
                    <td className="py-3 px-4">
                      {exp.attachment_url ? (
                        <a href={`${API_BASE_URL}${exp.attachment_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-650 hover:underline">
                          <ImageIcon className="w-3.5 h-3.5" /> Bill <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        {role === "admin" && (
                          <button onClick={() => openEditModal(exp)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg" title="Edit Expense">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-12 text-slate-400">No expense records found matching filters.</p>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/85 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10 -mx-5 -mb-5">
            <span className="text-xs text-slate-450 font-semibold">
              Page {currentPage} of {totalPages} ({filteredExpenses.length} total expenses)
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Log Daily Operating Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleAddExpense} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Expense Date</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Expense Category</label>
                  <select value={form.expense_category} onChange={e => setForm({...form, expense_category: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Amount (₹)</label>
                  <input type="number" step="0.01" min="0.01" placeholder="e.g. 450.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Vendor/Payee</label>
                  <input type="text" placeholder="e.g. Shell Petrol Pump" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Project Link (Optional)</label>
                <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none">
                  <option value="">— Select Associated Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Payment Mode</label>
                  <select value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Remarks (Optional)</label>
                  <input type="text" placeholder="e.g. Paid by cashier" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Description / Details</label>
                <textarea placeholder="Specify reasons for the expense..." value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  rows={3} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50 dark:bg-slate-950 outline-none resize-none" />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase block mb-1">Attachment / Bill Copy</label>
                <label htmlFor="bill-upload" className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-350 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-4 cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-450" />
                  <span className="text-slate-500 text-xs">{selectedFile ? selectedFile.name : "Upload invoice/receipt image"}</span>
                </label>
                <input id="bill-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-xl font-bold hover:from-rose-750 hover:to-amber-750 shadow-md transition-all">
                {submitting ? "Saving..." : "Submit Expense Record"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Edit Operating Expense</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleEditExpenseSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Expense Date</label>
                  <input type="date" value={editForm.expense_date} onChange={e => setEditForm({...editForm, expense_date: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Expense Category</label>
                  <select value={editForm.expense_category} onChange={e => setEditForm({...editForm, expense_category: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Amount (₹)</label>
                  <input type="number" step="0.01" min="0.01" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Vendor/Payee</label>
                  <input type="text" value={editForm.vendor} onChange={e => setEditForm({...editForm, vendor: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Project Link (Optional)</label>
                <select value={editForm.project_id} onChange={e => setEditForm({...editForm, project_id: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none">
                  <option value="">— Select Associated Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Payment Mode</label>
                  <select value={editForm.payment_mode} onChange={e => setEditForm({...editForm, payment_mode: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" required>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Remarks (Optional)</label>
                  <input type="text" value={editForm.remarks} onChange={e => setEditForm({...editForm, remarks: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Description / Details</label>
                <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                  rows={3} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50 dark:bg-slate-950 outline-none resize-none" />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase block mb-1">Attachment / Bill Copy</label>
                <label htmlFor="edit-bill-upload" className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-350 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-4 cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-450" />
                  <span className="text-slate-500 text-xs">{editFile ? editFile.name : "Replace invoice/receipt image (optional)"}</span>
                </label>
                <input id="edit-bill-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleEditFileChange} />
              </div>

              <div className="space-y-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
                <label className="text-amber-800 dark:text-amber-300 uppercase block mb-1">Reason for Modification *</label>
                <input type="text" placeholder="Specify why you are editing this expense..." value={editForm.reason} onChange={e => setEditForm({...editForm, reason: e.target.value})}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 outline-none" required />
              </div>

              <button type="submit" disabled={editSubmitting}
                className="w-full py-3 bg-gradient-to-r from-indigo-650 to-indigo-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-indigo-700 shadow-md transition-all">
                {editSubmitting ? "Saving..." : "Update Expense Record"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

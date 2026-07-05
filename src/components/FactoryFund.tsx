"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Landmark, ArrowUpRight, ArrowDownRight, Search, Calendar,
  SlidersHorizontal, Download, Plus, Trash2, Edit3, X,
  FileSpreadsheet, FileText, FileDown, RefreshCw, Paperclip
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
  const [entries, setEntries] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"cashbook" | "wallet">("cashbook");
  const [walletHistory, setWalletHistory] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [stats, setStats] = useState<any>({
    available_balance: 0,
    opening_balance: 0,
    period_in: 0,
    period_out: 0,
    closing_balance: 0,
    monthly_in: 0,
    monthly_out: 0,
    yearly_in: 0,
    yearly_out: 0
  });

  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("all");
  const [formWalletId, setFormWalletId] = useState<string>("");
  
  // Wallet Creation Modal states
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [newWalletForm, setNewWalletForm] = useState({
    name: "",
    opening_balance: "",
    activation_date: new Date().toISOString().split("T")[0]
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [search, setSearch] = useState("");
  const [txnType, setTxnType] = useState("");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    transaction_type: "IN",
    category: "Owner Investment",
    amount: "",
    payment_method: "Cash",
    reference_number: "",
    remarks: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const wList = await apiRequest("/api/factory-wallet").catch(() => []);
      setWallets(wList || []);
      
      if (wList && wList.length > 0 && !formWalletId) {
        setFormWalletId(wList[0].id);
      }

      if (activeSubTab === "wallet") {
        const [wHistory, wBal] = await Promise.all([
          apiRequest(`/api/factory-wallet/history?wallet_id=${selectedWalletId}`),
          apiRequest(`/api/factory-wallet/balance?wallet_id=${selectedWalletId}`)
        ]);
        setWalletHistory(wHistory || []);
        setWalletBalance(wBal?.balance || 0);
      } else {
        // Build filter query parameters
        const params = new URLSearchParams();
        if (startDate) params.append("start_date", startDate);
        if (endDate) params.append("end_date", endDate);
        if (category) params.append("category", category);
        if (paymentMethod) params.append("payment_method", paymentMethod);
        if (search) params.append("search", search);
        if (txnType) params.append("transaction_type", txnType);

        const [list, statsData] = await Promise.all([
          apiRequest(`/api/cash-book?${params.toString()}`),
          apiRequest(`/api/cash-book/stats?${startDate ? `start_date=${startDate}` : ""}${endDate ? `&end_date=${endDate}` : ""}`)
        ]);

        // Calculate running balance locally for display
        let currentBal = statsData?.opening_balance || 0;
        const enrichedEntries = (list || []).map((t: any) => {
          if (t.transaction_type === "IN") {
            currentBal += t.amount;
          } else {
            currentBal -= t.amount;
          }
          return { ...t, running_balance: currentBal };
        });

        setEntries(enrichedEntries);
        setStats(statsData || {
          available_balance: 0,
          opening_balance: 0,
          period_in: 0,
          period_out: 0,
          closing_balance: 0,
          monthly_in: 0,
          monthly_out: 0,
          yearly_in: 0,
          yearly_out: 0
        });
      }
    } catch (e) {
      console.error("Failed to load records:", e);
      showToast("Error loading records.", "error");
    } finally {
      setLoading(false);
    }
  }, [activeSubTab, startDate, endDate, category, paymentMethod, search, txnType, selectedWalletId, formWalletId, showToast]);

  useEffect(() => {
    loadData();

    // Listen to live updates
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && (detail.event === "financial_change" || detail.event === "expense_change")) {
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

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().split("T")[0],
      transaction_type: "IN",
      category: "Owner Investment",
      amount: "",
      payment_method: "Cash",
      reference_number: "",
      remarks: ""
    });
    setSelectedFile(null);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast("Please enter a valid amount.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("transaction_type", form.transaction_type);
      fd.append("category", form.category);
      fd.append("amount", form.amount);
      fd.append("date", form.date);
      fd.append("payment_method", form.payment_method);
      if (form.reference_number) fd.append("reference_number", form.reference_number);
      if (form.remarks) fd.append("remarks", form.remarks);
      if (selectedFile) fd.append("file", selectedFile);
      if (formWalletId) fd.append("wallet_id", formWalletId);

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/cash-book`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to log transaction");
      }

      showToast("Transaction logged successfully!", "success");
      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to log transaction.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletForm.name) {
      showToast("Please enter a wallet name.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;
      
      const res = await fetch(`${API_BASE_URL}/api/factory-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          name: newWalletForm.name,
          opening_balance: parseFloat(newWalletForm.opening_balance || "0"),
          activation_date: newWalletForm.activation_date
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create wallet");
      }
      
      showToast("Wallet created successfully!", "success");
      setShowCreateWalletModal(false);
      setNewWalletForm({
        name: "",
        opening_balance: "",
        activation_date: new Date().toISOString().split("T")[0]
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to create wallet.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (txn: any) => {
    setSelectedTxn(txn);
    setForm({
      date: txn.date,
      transaction_type: txn.transaction_type,
      category: txn.category,
      amount: txn.amount.toString(),
      payment_method: txn.payment_method,
      reference_number: txn.reference_number || "",
      remarks: txn.remarks || ""
    });
    setShowEditModal(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast("Please enter a valid amount.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("category", form.category);
      fd.append("amount", form.amount);
      fd.append("date", form.date);
      fd.append("payment_method", form.payment_method);
      if (form.reference_number) fd.append("reference_number", form.reference_number);
      if (form.remarks) fd.append("remarks", form.remarks);
      if (selectedFile) fd.append("file", selectedFile);

      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/cash-book/${selectedTxn.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${userToken}` },
        body: fd
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update transaction");
      }

      showToast("Transaction updated successfully!", "success");
      setShowEditModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update transaction.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this manual transaction entry?")) return;
    try {
      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;

      const res = await fetch(`${API_BASE_URL}/api/cash-book/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}` }
      });

      if (!res.ok) throw new Error("Failed to delete transaction");

      showToast("Transaction deleted successfully.", "success");
      loadData();
    } catch (err: any) {
      showToast("Failed to delete transaction.", "error");
    }
  };

  const handleExport = (format: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (category) params.append("category", category);
    if (paymentMethod) params.append("payment_method", paymentMethod);
    if (txnType) params.append("transaction_type", txnType);
    params.append("format", format);

    const savedUser = localStorage.getItem("allure_erp_user");
    const userToken = savedUser ? JSON.parse(savedUser).token : token;

    window.open(`${API_BASE_URL}/api/cash-book/export?${params.toString()}&token=${userToken}`, "_blank");
  };

  const formatTxnId = (id: string, type: string) => {
    if (type === "daily_expense") return "Daily Expense";
    if (type === "daily_expense_advance") return "Advance Issued";
    if (type === "daily_expense_return") return "Returned Advance";
    if (type === "project_payment") return "Milestone Receipt";
    if (type === "factory_fund") return "Funding Injection";
    return "Direct Entry";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="h-7 w-7 text-emerald-500" />
            Cash Book & Capital Ledger
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor capital IN/OUT ledger, opening & closing daily balances, and manual injections.
          </p>
        </div>
        <div className="flex gap-2">
          {["admin", "super_admin"].includes(role) && (
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-md transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Add Transaction
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

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setActiveSubTab("cashbook")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeSubTab === "cashbook"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Company Cash Book
        </button>
        <button
          onClick={() => setActiveSubTab("wallet")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeSubTab === "wallet"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Factory Expense Wallet Ledger
        </button>
      </div>

      {activeSubTab === "wallet" && (
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">Active Wallet:</span>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-950 dark:border-slate-800"
            >
              <option value="all">All Wallets combined</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.name || w.id} (Bal: ₹{w.balance})</option>
              ))}
            </select>
          </div>
          {["admin", "super_admin"].includes(role) && (
            <button
              onClick={() => setShowCreateWalletModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            >
              Create New Wallet
            </button>
          )}
        </div>
      )}

      {activeSubTab === "wallet" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Available Wallet Balance */}
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Wallet Balance</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(walletBalance)}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5 text-emerald-500" /> Current funds held by Factory Manager
            </span>
          </div>
          
          {/* Total Funding Injected */}
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Total Funding Injected</span>
            <div className="mt-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(walletHistory.reduce((acc, t) => acc + (t.money_added || 0), 0))}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2">Cumulative owner investments</span>
          </div>

          {/* Total Expenses Deducted */}
          <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Total Expenses Deducted</span>
            <div className="mt-2">
              <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(walletHistory.reduce((acc, t) => acc + (t.expense_deducted || 0), 0))}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2">Cumulative wallet withdrawals</span>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Available Balance */}
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Balance</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.available_balance)}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">Combined net of all active transactions</span>
            </div>

            {/* Opening Balance */}
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Opening Balance</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.opening_balance)}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">Balance before selected start date</span>
            </div>

            {/* Period Money IN */}
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Money IN
              </span>
              <div className="mt-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(stats.period_in)}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">Total inflows during period</span>
            </div>

            {/* Period Money OUT */}
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3" /> Money OUT
              </span>
              <div className="mt-2">
                <span className="text-2xl font-bold text-rose-600">-{formatCurrency(stats.period_out)}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">Total outflows during period</span>
            </div>

            {/* Closing Balance */}
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Closing Balance</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.closing_balance)}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">Net balance at end of selected period</span>
            </div>
          </div>

          {/* Monthly/Yearly In-Out Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-950 flex justify-between items-center text-sm">
              <div>
                <span className="text-slate-400 block font-medium">This Month’s Flow</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                  In: <span className="text-emerald-500">+{formatCurrency(stats.monthly_in)}</span> | Out: <span className="text-rose-500">-{formatCurrency(stats.monthly_out)}</span>
                </span>
              </div>
              <div className="text-right text-xs text-slate-400">
                Net: <span className={stats.monthly_in - stats.monthly_out >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                  {formatCurrency(stats.monthly_in - stats.monthly_out)}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-950 flex justify-between items-center text-sm">
              <div>
                <span className="text-slate-400 block font-medium">This Year’s Flow</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                  In: <span className="text-emerald-500">+{formatCurrency(stats.yearly_in)}</span> | Out: <span className="text-rose-500">-{formatCurrency(stats.yearly_out)}</span>
                </span>
              </div>
              <div className="text-right text-xs text-slate-400">
                Net: <span className={stats.yearly_in - stats.yearly_out >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                  {formatCurrency(stats.yearly_in - stats.yearly_out)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSubTab === "cashbook" && (
        /* Filters & Export Control Panel */
        <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            {/* Start Date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-3 py-2 w-full text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                placeholder="Start Date"
              />
            </div>

            {/* End Date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-3 py-2 w-full text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                placeholder="End Date"
              />
            </div>

            {/* Transaction Type */}
            <select
              value={txnType}
              onChange={(e) => setTxnType(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
            >
              <option value="">All Types (IN & OUT)</option>
              <option value="IN">Money IN</option>
              <option value="OUT">Money OUT</option>
            </select>

            {/* Category */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
            >
              <option value="">All Categories</option>
              <option value="Owner Investment">Owner Investment</option>
              <option value="Direct Sales">Direct Sales</option>
              <option value="Client Payment">Client Payment</option>
              <option value="Advance Payment">Advance Payment</option>
              <option value="Fuel">Fuel / Petrol</option>
              <option value="Food">Food / Meals</option>
              <option value="Transport">Transport / Logistics</option>
              <option value="Office Expense">Office Expense</option>
              <option value="Material Purchase">Material Purchase</option>
              <option value="Salary">Salary Payouts</option>
              <option value="Cash Returned">Cash Returned</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>

            {/* Payment Method */}
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
            >
              <option value="">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI / GPay</option>
              <option value="Bank">Bank Transfer / NEFT</option>
              <option value="Cheque">Cheque</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 w-full text-sm border rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                placeholder="Search reference/remarks..."
              />
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-900 pt-3">
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setCategory("");
                setPaymentMethod("");
                setSearch("");
                setTxnType("");
              }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium"
            >
              Clear Filters
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport("excel")}
                className="border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-emerald-600"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-rose-600"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
              >
                <FileDown className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Grid Table */}
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            {activeSubTab === "wallet" ? (
              <>
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b dark:border-slate-950">
                    <th className="p-4">Transaction ID</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Remarks</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Approved By</th>
                    <th className="p-4 text-right">Money Added</th>
                    <th className="p-4 text-right">Expense Deducted</th>
                    <th className="p-4 text-right">Running Balance</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
                        Loading wallet transaction ledger...
                      </td>
                    </tr>
                  ) : walletHistory.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No wallet transactions found.
                      </td>
                    </tr>
                  ) : (
                    walletHistory.map((t) => (
                      <tr key={t.id} className="border-b dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                        <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">{t.transaction_id}</td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{t.date}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            t.transaction_type === "FUND_ADDED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : t.transaction_type === "EXPENSE_DEDUCTED"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                              : t.transaction_type === "EXPENSE_REVERTED"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          }`}>
                            {t.transaction_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={t.remarks}>
                          {t.remarks}
                        </td>
                        <td className="p-4 text-xs text-slate-500 font-mono">
                          {t.reference_type ? `${t.reference_type}: ${t.reference_id?.slice(0, 8)}...` : "N/A"}
                        </td>
                        <td className="p-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {t.user?.name || "System"}
                        </td>
                        <td className="p-4 text-xs text-slate-500">
                          {t.approver?.name || "-"}
                        </td>
                        <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                          {t.money_added > 0 ? `+${formatCurrency(t.money_added)}` : "-"}
                        </td>
                        <td className="p-4 text-right text-rose-600 dark:text-rose-400 font-semibold">
                          {t.expense_deducted > 0 ? `-${formatCurrency(t.expense_deducted)}` : "-"}
                        </td>
                        <td className="p-4 text-right text-slate-900 dark:text-white font-bold">
                          {formatCurrency(t.running_balance)}
                        </td>
                        <td className="p-4 text-xs text-slate-400 font-mono">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-semibold border-b dark:border-slate-950">
                    <th className="p-4">Transaction ID</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Flow Type</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Origin / Reference</th>
                    <th className="p-4">Method</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-right">Running Balance</th>
                    <th className="p-4 text-center">Receipt</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-300" />
                        Loading capital ledger records...
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No transactions found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    entries.map((t) => (
                      <tr key={t.id} className="border-b dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                        <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">{t.transaction_id}</td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{t.date}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            t.transaction_type === "IN" 
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                          }`}>
                            {t.transaction_type === "IN" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{t.category}</td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                          <div className="font-semibold">{formatTxnId(t.transaction_id, t.reference_type)}</div>
                          <div className="opacity-75">{t.reference_number || "Direct"}</div>
                        </td>
                        <td className="p-4 font-medium">{t.payment_method}</td>
                        <td className={`p-4 text-right font-bold ${t.transaction_type === "IN" ? "text-emerald-600" : "text-rose-600"}`}>
                          {t.transaction_type === "IN" ? "+" : "-"}{formatCurrency(t.amount)}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900 dark:text-white">
                          {formatCurrency(t.running_balance)}
                        </td>
                        <td className="p-4 text-center">
                          {t.attachment_url ? (
                            <a
                              href={t.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-600 inline-flex items-center justify-center p-1 border border-slate-100 rounded-md shadow-sm dark:border-slate-900"
                              title="View receipt attachment"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-800 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {t.reference_type === "direct_txn" && ["admin", "super_admin"].includes(role) ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleEditClick(t)}
                                className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-md transition-colors"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-md transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">Synced</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      {/* Manual Transaction Log Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-xl border dark:border-slate-800 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Log Manual Capital Transaction</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Transaction Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Transaction Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                {/* Flow Type */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Capital Flow Type</label>
                  <select
                    value={form.transaction_type}
                    onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="IN">Capital IN (Receipt/Injection)</option>
                    <option value="OUT">Capital OUT (Direct Expense)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    {form.transaction_type === "IN" ? (
                      <>
                        <option value="Owner Investment">Owner Investment</option>
                        <option value="Cash Returned">Cash Returned (Refund to Wallet)</option>
                        <option value="Direct Sales">Direct Sales</option>
                        <option value="Advance Payment">Advance Payment</option>
                        <option value="Other">Other Inflow</option>
                      </>
                    ) : (
                      <>
                        <option value="Fuel">Fuel / Petrol</option>
                        <option value="Food">Food / Meals</option>
                        <option value="Transport">Transport / Logistics</option>
                        <option value="Office Expense">Office Expense</option>
                        <option value="Material Purchase">Material Purchase</option>
                        <option value="Salary">Salary Payouts</option>
                        <option value="Miscellaneous">Miscellaneous</option>
                        <option value="Other">Other Outflow</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              {/* Target Wallet (conditional) */}
              {(form.transaction_type === "IN" && ["Owner Investment", "Cash Returned"].includes(form.category)) && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Target Factory Wallet</label>
                  <select
                    value={formWalletId}
                    onChange={(e) => setFormWalletId(e.target.value)}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name || w.id} (Bal: ₹{w.balance})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
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
                    <option value="Bank">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Reference ID / No.</label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="e.g. UPI ID, Cheque No."
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Remarks / Narrative</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  placeholder="Details of the manual inflow or outflow..."
                />
              </div>

              {/* Attachment File */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Attach Receipt / Invoice (Optional)</label>
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Transaction Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-xl border dark:border-slate-800 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Manual capital Transaction</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Transaction Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Transaction Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>

                {/* Flow Type (Disabled on Edit to keep Ledger history safe) */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Capital Flow Type</label>
                  <input
                    type="text"
                    disabled
                    value={form.transaction_type}
                    className="w-full text-sm border rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900 opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    {form.transaction_type === "IN" ? (
                      <>
                        <option value="Owner Investment">Owner Investment</option>
                        <option value="Direct Sales">Direct Sales</option>
                        <option value="Advance Payment">Advance Payment</option>
                        <option value="Other">Other Inflow</option>
                      </>
                    ) : (
                      <>
                        <option value="Fuel">Fuel / Petrol</option>
                        <option value="Food">Food / Meals</option>
                        <option value="Transport">Transport / Logistics</option>
                        <option value="Office Expense">Office Expense</option>
                        <option value="Material Purchase">Material Purchase</option>
                        <option value="Salary">Salary Payouts</option>
                        <option value="Miscellaneous">Miscellaneous</option>
                        <option value="Other">Other Outflow</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    <option value="Bank">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Reference ID / No.</label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="e.g. UPI ID, Cheque No."
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Remarks / Narrative</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  rows={2}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  placeholder="Details of the transaction..."
                />
              </div>

              {/* Attachment File */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Replace Receipt / Invoice File (Optional)</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 dark:file:bg-slate-900 dark:file:text-slate-300 hover:file:bg-slate-100"
                />
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Update Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateWalletModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-2xl shadow-xl border dark:border-slate-800 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Factory Wallet</h2>
              <button onClick={() => setShowCreateWalletModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWallet} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Wallet Name</label>
                <input
                  type="text"
                  required
                  value={newWalletForm.name}
                  onChange={(e) => setNewWalletForm({ ...newWalletForm, name: e.target.value })}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  placeholder="e.g. Factory Wallet 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Opening Balance (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newWalletForm.opening_balance}
                    onChange={(e) => setNewWalletForm({ ...newWalletForm, opening_balance: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Activation Date</label>
                  <input
                    type="date"
                    required
                    value={newWalletForm.activation_date}
                    onChange={(e) => setNewWalletForm({ ...newWalletForm, activation_date: e.target.value })}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none dark:bg-slate-900 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateWalletModal(false)}
                  className="border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Wallet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

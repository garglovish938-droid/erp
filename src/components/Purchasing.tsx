"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Plus, ShoppingCart, Truck, Calendar, FileText, User, Loader2, X, 
  DollarSign, Edit, CheckCircle, Clock, FileDown, TrendingUp, BarChart3, 
  Search, Eye, ShieldAlert, Award, FileSpreadsheet, FileArchive, Check,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

const CHART_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16"];

interface PurchasingProps {
  token: string;
  role: string;
}

export default function Purchasing({ token, role }: PurchasingProps) {
  // Tabs: "dashboard", "list", "reports"
  const [activeSubTab, setActiveSubTab] = useState("dashboard");
  
  // Data lists
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<any>({
    purchase_today: 0,
    purchase_month: 0,
    pending_pos: 0,
    partially_received: 0,
    overdue_pos: 0,
    vendor_wise: [],
    category_wise: [],
    monthly_trend: [],
    top_materials: []
  });

  // Report state
  const [reportType, setReportType] = useState("daily");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportVendor, setReportVendor] = useState("");
  const [reportCategory, setReportCategory] = useState("");
  const [reportResults, setReportResults] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");

  // Filters for PO list
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal controls
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  
  // Form states
  const [formError, setFormError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const [form, setForm] = useState({
    supplier_id: "",
    inventory_id: "",
    quantity: 1,
    unit_cost: 0,
    category: "Raw Material",
    po_date: new Date().toISOString().split("T")[0],
    vendor_name: "",
    vendor_contact: "",
    vendor_gst: "",
    vendor_address: "",
    material_name: "",
    sku: "",
    unit: "Pcs",
    expected_delivery_date: "",
    received_quantity: 0,
    pending_quantity: 1,
    invoice_number: "",
    invoice_date: "",
    payment_status: "Pending",
    remarks: ""
  });

  const categories = ["Hettich", "Hafele", "Ebco", "Ozone", "Board", "Hardware", "Misc", "Raw Material"];
  const paymentStatuses = ["Pending", "Partial", "Paid"];
  
  const isAccountant = ["admin", "manager", "accountant", "accounts_manager", "purchase_manager"].includes(role);
  const isStore = ["admin", "manager", "store", "store_assistant", "inventory_manager"].includes(role);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [poRes, supRes, invRes, dashRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/purchasing`, { headers }),
        fetch(`${API_BASE_URL}/api/suppliers`, { headers }),
        fetch(`${API_BASE_URL}/api/inventory`, { headers }),
        fetch(`${API_BASE_URL}/api/purchases/dashboard`, { headers })
      ]);

      if (poRes.ok) setPurchaseOrders(await poRes.ok ? await poRes.json() : []);
      if (supRes.ok) {
        const supsData = await supRes.json();
        setSuppliers(supsData);
        const defaultSup = supsData.find((s: any) => s.name.toLowerCase().includes("general") || s.name.toLowerCase().includes("cash"));
        if (defaultSup) {
          setForm(prev => ({ ...prev, supplier_id: defaultSup.id }));
        } else if (supsData.length > 0) {
          setForm(prev => ({ ...prev, supplier_id: supsData[0].id }));
        }
      }
      if (invRes.ok) setInventory(await invRes.json());
      if (dashRes.ok) setDashboardStats(await dashRes.json());
    } catch (e) {
      console.error("Error loading purchasing module data:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load report results
  const loadReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ report_type: reportType });
      if (reportDate) params.set("target_date", reportDate);
      if (reportVendor) params.set("vendor", reportVendor);
      if (reportCategory) params.set("category", reportCategory);
      
      const response = await fetch(`${API_BASE_URL}/api/reports/purchases?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setReportResults(await response.json());
      } else {
        setReportResults([]);
      }
    } catch (e) {
      console.error(e);
      setReportResults([]);
    }
    setReportLoading(false);
  };

  useEffect(() => {
    if (activeSubTab === "reports") {
      loadReport();
    }
  }, [activeSubTab, reportType, reportDate, reportVendor, reportCategory]);

  // Autocomplete handlers
  const handleSupplierSelect = (supplierId: string) => {
    const sup = suppliers.find(s => s.id === supplierId);
    if (sup) {
      setForm(prev => ({
        ...prev,
        supplier_id: supplierId,
        vendor_name: sup.name,
        vendor_contact: sup.phone || sup.contact_person || "",
        vendor_gst: sup.gst_number || "",
        vendor_address: sup.address || ""
      }));
    } else {
      setForm(prev => ({
        ...prev,
        supplier_id: supplierId
      }));
    }
  };

  const handleInventorySelect = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (item) {
      setForm(prev => ({
        ...prev,
        inventory_id: itemId,
        material_name: item.name,
        sku: item.sku,
        unit: item.unit || "Pcs",
        unit_cost: item.unit_cost || 0
      }));
    } else {
      setForm(prev => ({
        ...prev,
        inventory_id: itemId
      }));
    }
  };

  // Submit new Purchase Order
  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitLoading(true);

    if (!form.supplier_id || !form.inventory_id) {
      setFormError("Supplier and Inventory Item are required.");
      setSubmitLoading(false);
      return;
    }

    try {
      const payload = {
        ...form,
        quantity: parseFloat(form.quantity.toString()),
        unit_cost: parseFloat(form.unit_cost.toString()),
        received_quantity: parseFloat(form.received_quantity.toString()),
        pending_quantity: Math.max(0, parseFloat(form.quantity.toString()) - parseFloat(form.received_quantity.toString())),
        po_date: form.po_date || new Date().toISOString().split("T")[0]
      };

      const response = await fetch(`${API_BASE_URL}/api/purchasing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create PO");
      }

      setShowAddModal(false);
      // Reset form
      setForm({
        supplier_id: "",
        inventory_id: "",
        quantity: 1,
        unit_cost: 0,
        category: "Raw Material",
        po_date: new Date().toISOString().split("T")[0],
        vendor_name: "",
        vendor_contact: "",
        vendor_gst: "",
        vendor_address: "",
        material_name: "",
        sku: "",
        unit: "Pcs",
        expected_delivery_date: "",
        received_quantity: 0,
        pending_quantity: 1,
        invoice_number: "",
        invoice_date: "",
        payment_status: "Pending",
        remarks: ""
      });
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create purchase order.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Edit fields updates
  const handleEditPOFields = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    setFormError("");
    setSubmitLoading(true);

    try {
      const payload = {
        ...form,
        quantity: parseFloat(form.quantity.toString()),
        unit_cost: parseFloat(form.unit_cost.toString()),
        received_quantity: parseFloat(form.received_quantity.toString()),
        pending_quantity: Math.max(0, parseFloat(form.quantity.toString()) - parseFloat(form.received_quantity.toString())),
      };

      const response = await fetch(`${API_BASE_URL}/api/purchasing/${selectedPO.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to edit PO fields");
      }

      setShowDetailModal(false);
      setSelectedPO(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || "Failed to update PO fields.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Transition status workflow
  const handleUpdateStatus = async (poId: string, newStatus: string) => {
    setActionLoading(poId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchasing/${poId}/status?status=${newStatus}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to update status workflow");
      }
      
      const updated = await response.json();
      if (selectedPO && selectedPO.id === poId) {
        setSelectedPO(updated);
      }
      
      fetchData();
      if (activeSubTab === "reports") {
        loadReport();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Authenticated exports triggers
  const handleExport = async () => {
    const params = new URLSearchParams({ format: exportFormat });
    if (reportType === "daily" && reportDate) params.set("start_date", reportDate);
    if (reportType === "daily" && reportDate) params.set("end_date", reportDate);
    if (reportCategory) params.set("category", reportCategory);

    try {
      const res = await fetch(`${API_BASE_URL}/api/purchases/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const ext = exportFormat === "excel" ? "xlsx" : (exportFormat === "csv" ? "csv" : "pdf");
      link.setAttribute("download", `purchases_report_${reportType}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      alert("Failed to export report.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "draft": return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
      case "approved": return "bg-indigo-55 text-indigo-600 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400";
      case "ordered": return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400";
      case "partially_received": return "bg-purple-50 text-purple-650 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400";
      case "fully_received": return "bg-emerald-50 text-emerald-600 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400";
      case "closed": return "bg-teal-50 text-teal-650 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400";
      default: return "bg-slate-50 border-slate-200";
    }
  };

  // Filtered orders list
  const filteredOrders = purchaseOrders.filter(po => {
    const query = searchTerm.toLowerCase();
    const poNum = po.po_number?.toLowerCase() || "";
    const vendor = (po.vendor_name || po.supplier?.name || "").toLowerCase();
    const mat = (po.material_name || po.inventory?.name || "").toLowerCase();
    const sku = (po.sku || po.inventory?.sku || "").toLowerCase();
    
    const matchesSearch = poNum.includes(query) || vendor.includes(query) || mat.includes(query) || sku.includes(query);
    const matchesStatus = !statusFilter || po.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const triggerViewDetails = (po: any) => {
    setSelectedPO(po);
    setForm({
      supplier_id: po.supplier_id || "",
      inventory_id: po.inventory_id || "",
      quantity: po.quantity || 0,
      unit_cost: po.unit_cost || 0,
      category: po.category || "Raw Material",
      po_date: po.po_date || "",
      vendor_name: po.vendor_name || "",
      vendor_contact: po.vendor_contact || "",
      vendor_gst: po.vendor_gst || "",
      vendor_address: po.vendor_address || "",
      material_name: po.material_name || "",
      sku: po.sku || "",
      unit: po.unit || "Pcs",
      expected_delivery_date: po.expected_delivery_date || "",
      received_quantity: po.received_quantity || 0,
      pending_quantity: po.pending_quantity || 0,
      invoice_number: po.invoice_number || "",
      invoice_date: po.invoice_date || "",
      payment_status: po.payment_status || "Pending",
      remarks: po.remarks || ""
    });
    setFormError("");
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Navigation */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Purchase Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">Submit Restocks, Check Deliveries, Track Vendors, Export Reports.</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800 self-start md:self-auto shadow-inner">
          <button onClick={() => setActiveSubTab("dashboard")} className={cn("px-4 py-2 text-xs font-bold rounded-xl transition-all", activeSubTab === "dashboard" ? "bg-white dark:bg-slate-800 text-indigo-650 shadow" : "text-slate-500")}>
            Dashboard
          </button>
          <button onClick={() => setActiveSubTab("list")} className={cn("px-4 py-2 text-xs font-bold rounded-xl transition-all", activeSubTab === "list" ? "bg-white dark:bg-slate-800 text-indigo-650 shadow" : "text-slate-500")}>
            Purchase Orders ({purchaseOrders.length})
          </button>
          <button onClick={() => setActiveSubTab("reports")} className={cn("px-4 py-2 text-xs font-bold rounded-xl transition-all", activeSubTab === "reports" ? "bg-white dark:bg-slate-800 text-indigo-650 shadow" : "text-slate-500")}>
            Purchase Reports
          </button>
        </div>
      </header>

      {/* DASHBOARD SUB-TAB */}
      {activeSubTab === "dashboard" && (
        <div className="space-y-6">
          
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">Purchase Today</div>
              <div className="text-xl md:text-2xl font-black text-indigo-650 mt-1 block">₹{dashboardStats.purchase_today?.toLocaleString("en-IN") || 0}</div>
              <div className="absolute right-3 bottom-3 text-indigo-100 dark:text-indigo-950/40"><DollarSign className="w-8 h-8" /></div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">Purchase This Month</div>
              <div className="text-xl md:text-2xl font-black text-emerald-600 mt-1 block">₹{dashboardStats.purchase_month?.toLocaleString("en-IN") || 0}</div>
              <div className="absolute right-3 bottom-3 text-emerald-100 dark:text-emerald-950/40"><TrendingUp className="w-8 h-8" /></div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">Pending Orders</div>
              <div className="text-xl md:text-2xl font-black text-amber-500 mt-1 block">{dashboardStats.pending_pos || 0}</div>
              <div className="absolute right-3 bottom-3 text-amber-100 dark:text-amber-950/40"><Clock className="w-8 h-8" /></div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">Partially Received</div>
              <div className="text-xl md:text-2xl font-black text-purple-600 mt-1 block">{dashboardStats.partially_received || 0}</div>
              <div className="absolute right-3 bottom-3 text-purple-100 dark:text-purple-950/40"><Truck className="w-8 h-8" /></div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden col-span-2 lg:col-span-1 group hover:scale-[1.02] transition-transform">
              <div className="text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">Overdue Orders</div>
              <div className="text-xl md:text-2xl font-black text-rose-500 mt-1 block">{dashboardStats.overdue_pos || 0}</div>
              <div className="absolute right-3 bottom-3 text-rose-100 dark:text-rose-950/40"><ShieldAlert className="w-8 h-8" /></div>
            </div>

          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Monthly Trend Area Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-indigo-650" /> Monthly Purchase Trend</h3>
              {dashboardStats.monthly_trend && dashboardStats.monthly_trend.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardStats.monthly_trend}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="month" tick={{fontSize: 9}} stroke="#94A3B8" />
                      <YAxis tick={{fontSize: 9}} stroke="#94A3B8" />
                      <Tooltip formatter={(v: any) => [`₹${v}`, "Total Purchases"]} />
                      <Area type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-20">No monthly trends data available</p>
              )}
            </div>

            {/* Vendor Wise Bar Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-emerald-500" /> Vendor-Wise Purchase</h3>
              {dashboardStats.vendor_wise && dashboardStats.vendor_wise.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardStats.vendor_wise.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="vendor" tick={{fontSize: 9}} stroke="#94A3B8" />
                      <YAxis tick={{fontSize: 9}} stroke="#94A3B8" />
                      <Tooltip formatter={(v: any) => [`₹${v}`, "Total Budget"]} />
                      <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-20">No vendor purchase records</p>
              )}
            </div>

            {/* Category Wise Pie Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category Wise purchases</h3>
              {dashboardStats.category_wise && dashboardStats.category_wise.length > 0 ? (
                <div className="flex-1 flex items-center justify-between gap-2">
                  <div className="w-1/2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardStats.category_wise}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={3}
                          dataKey="amount"
                          nameKey="category"
                        >
                          {dashboardStats.category_wise.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => `₹${v}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 flex flex-col gap-1 text-[10px] font-bold text-slate-400 max-h-40 overflow-y-auto">
                    {dashboardStats.category_wise.map((item: any, idx: number) => (
                      <div key={item.category} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span className="truncate w-full">{item.category}: ₹{item.amount?.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-20">No category statistics available</p>
              )}
            </div>

          </div>

          {/* Top Materials & Recent Purchases Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top Purchased Materials */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3 lg:col-span-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Award className="w-4 h-4 text-amber-500" /> Top Purchased Materials</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {dashboardStats.top_materials && dashboardStats.top_materials.length > 0 ? (
                  dashboardStats.top_materials.map((mat: any, i: number) => (
                    <div key={mat.material} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 flex items-center justify-center font-bold text-xs">{i+1}</span>
                        <span className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate max-w-[120px]">{mat.material}</span>
                      </div>
                      <span className="text-xs font-black text-indigo-650">₹{mat.amount?.toLocaleString("en-IN")}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-10">No top materials logged</p>
                )}
              </div>
            </div>

            {/* Recent Purchases List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3 lg:col-span-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Activity Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800/80 pb-2">
                      <th className="pb-2">PO Number</th>
                      <th className="pb-2">Vendor</th>
                      <th className="pb-2">Material</th>
                      <th className="pb-2">Budget</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {purchaseOrders.slice(0, 5).map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-2.5 font-mono font-bold text-slate-800 dark:text-white">{po.po_number}</td>
                        <td className="py-2.5 truncate max-w-[100px]">{po.vendor_name || po.supplier?.name}</td>
                        <td className="py-2.5 truncate max-w-[100px]">{po.material_name || po.inventory?.name}</td>
                        <td className="py-2.5 font-bold">₹{po.total_cost?.toLocaleString("en-IN")}</td>
                        <td className="py-2.5">
                          <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase", getStatusColor(po.status))}>
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* LIST VIEW SUB-TAB */}
      {activeSubTab === "list" && (
        <div className="space-y-4">
          
          {/* Action Header & Search */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="relative flex-1 max-w-md w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search PO #, Vendor, SKU or Material name..." 
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 outline-none focus:border-indigo-500 transition-colors font-medium"
              />
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <select 
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 outline-none font-bold"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="ordered">Ordered</option>
                <option value="partially_received">Partially Received</option>
                <option value="fully_received">Fully Received</option>
                <option value="closed">Closed</option>
              </select>

              {isAccountant && (
                <button 
                  onClick={() => {
                    setForm({
                      supplier_id: "",
                      inventory_id: "",
                      quantity: 1,
                      unit_cost: 0,
                      category: "Raw Material",
                      po_date: new Date().toISOString().split("T")[0],
                      vendor_name: "",
                      vendor_contact: "",
                      vendor_gst: "",
                      vendor_address: "",
                      material_name: "",
                      sku: "",
                      unit: "Pcs",
                      expected_delivery_date: "",
                      received_quantity: 0,
                      pending_quantity: 1,
                      invoice_number: "",
                      invoice_date: "",
                      payment_status: "Pending",
                      remarks: ""
                    });
                    setFormError("");
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-200 dark:shadow-none"
                >
                  <Plus className="w-4 h-4" /> Add Purchase Order
                </button>
              )}
            </div>

          </div>

          {/* Table / Cards Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm">
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-55 dark:bg-slate-800">
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 text-slate-400 font-bold uppercase">
                    <th className="p-4 sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">PO Number</th>
                    <th className="p-4 sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">PO Date</th>
                    <th className="p-4 sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">Vendor</th>
                    <th className="p-4 sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">Material Details</th>
                    <th className="p-4 text-center sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">Qty (Ord / Rec)</th>
                    <th className="p-4 sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">Total Amount</th>
                    <th className="p-4 sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">Payment</th>
                    <th className="p-4 sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">Status</th>
                    <th className="p-4 text-right sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-350">
                  {paginatedOrders.length > 0 ? (
                    paginatedOrders.map((po) => {
                      const v_name = po.vendor_name || po.supplier?.name || "N/A";
                      const m_name = po.material_name || po.inventory?.name || "N/A";
                      const m_sku = po.sku || po.inventory?.sku || "N/A";
                      const m_unit = po.unit || po.inventory?.unit || "Pcs";
                      
                      return (
                        <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-950 dark:text-white">{po.po_number}</td>
                          <td className="p-4 font-semibold">{po.po_date || po.created_at?.split("T")[0] || "N/A"}</td>
                          <td className="p-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{v_name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{po.vendor_gst || "No GST"}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-indigo-650">{m_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m_sku}</div>
                          </td>
                          <td className="p-4 text-center font-bold">
                            <div>{po.quantity} {m_unit}</div>
                            <div className="text-[10px] text-emerald-500 mt-0.5">Rec: {po.received_quantity || 0}</div>
                          </td>
                          <td className="p-4 font-black text-slate-900 dark:text-white">₹{po.total_cost?.toLocaleString("en-IN")}</td>
                          <td className="p-4">
                            <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold", 
                              po.payment_status === "Paid" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                              po.payment_status === "Partial" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-rose-50 text-rose-500 border-rose-200"
                            )}>
                              {po.payment_status}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase", getStatusColor(po.status))}>
                              {po.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button onClick={() => triggerViewDetails(po)} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center p-12 text-slate-400">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="font-semibold text-slate-500">No Purchase Orders matching filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Fallback */}
            <div className="md:hidden p-4 space-y-4 divide-y divide-slate-100 dark:divide-slate-800/80">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((po) => (
                  <div key={po.id} className="pt-4 first:pt-0 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{po.po_number}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{po.po_date || "No Date"}</span>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase", getStatusColor(po.status))}>
                        {po.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Vendor</span>
                        <span>{po.vendor_name || po.supplier?.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Material</span>
                        <span className="text-indigo-600">{po.material_name || po.inventory?.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Qty Ordered/Received</span>
                        <span>{po.quantity} / {po.received_quantity || 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Total Cost</span>
                        <span className="font-bold">₹{po.total_cost?.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold", 
                        po.payment_status === "Paid" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        po.payment_status === "Partial" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-rose-50 text-rose-500 border-rose-200"
                      )}>
                        Payment: {po.payment_status}
                      </span>

                      <button onClick={() => triggerViewDetails(po)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-xl border border-indigo-100/50">
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-slate-400 text-xs">No PO records found</p>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
                <span className="text-xs text-slate-450 font-semibold">
                  Page {currentPage} of {totalPages} ({filteredOrders.length} total POs)
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

        </div>
      )}

      {/* REPORTS SUB-TAB */}
      {activeSubTab === "reports" && (
        <div className="space-y-4">
          
          {/* Reports Config Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
            
            <div className="flex flex-wrap gap-4 items-end">
              
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-400 uppercase">Report Type</label>
                <select 
                  value={reportType} 
                  onChange={e => setReportType(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 outline-none font-bold"
                >
                  <option value="daily">Daily Purchase Report</option>
                  <option value="monthly">Monthly Purchase Report</option>
                  <option value="vendor">Vendor Wise Report</option>
                  <option value="category">Category Wise Report</option>
                  <option value="pending_delivery">Pending Delivery Report</option>
                  <option value="pending_payment">Pending Payment Report</option>
                </select>
              </div>

              {reportType === "daily" && (
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-400 uppercase">Date</label>
                  <input 
                    type="date" 
                    value={reportDate}
                    onChange={e => setReportDate(e.target.value)}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 outline-none font-semibold"
                  />
                </div>
              )}

              {reportType === "monthly" && (
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-400 uppercase">Target Month</label>
                  <input 
                    type="month" 
                    value={reportDate.substring(0, 7)}
                    onChange={e => setReportDate(e.target.value + "-01")}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 outline-none font-semibold"
                  />
                </div>
              )}

              {reportType === "vendor" && (
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-400 uppercase">Vendor Filter</label>
                  <input 
                    type="text" 
                    placeholder="Enter vendor name..."
                    value={reportVendor}
                    onChange={e => setReportVendor(e.target.value)}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 outline-none font-semibold"
                  />
                </div>
              )}

              {reportType === "category" && (
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-400 uppercase">Category Filter</label>
                  <select 
                    value={reportCategory}
                    onChange={e => setReportCategory(e.target.value)}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 outline-none font-semibold"
                  >
                    <option value="">— Select Category —</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-2 ml-auto items-center">
                <select 
                  value={exportFormat}
                  onChange={e => setExportFormat(e.target.value)}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-slate-55 dark:bg-slate-950 outline-none"
                >
                  <option value="excel">Excel</option>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </select>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  <FileDown className="w-4 h-4" /> Export Report
                </button>
              </div>

            </div>

          </div>

          {/* Report Results Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-250 mb-4 capitalize">{reportType.replace("_", " ")} Purchase Log</h3>
            {reportLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : reportResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800/80 pb-2">
                      <th className="pb-3 px-2">PO Number</th>
                      <th className="pb-3 px-2">Date</th>
                      <th className="pb-3 px-2">Vendor Name</th>
                      <th className="pb-3 px-2">GST</th>
                      <th className="pb-3 px-2">Material SKU</th>
                      <th className="pb-3 px-2">Qty (Ord/Rec)</th>
                      <th className="pb-3 px-2">Total Budget</th>
                      <th className="pb-3 px-2">Payment</th>
                      <th className="pb-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-800/50">
                    {reportResults.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="py-3 px-2 font-mono font-bold text-slate-900 dark:text-white">{po.po_number}</td>
                        <td className="py-3 px-2">{po.po_date || po.created_at?.split("T")[0]}</td>
                        <td className="py-3 px-2 font-semibold">{po.vendor_name || po.supplier?.name}</td>
                        <td className="py-3 px-2 font-mono text-[10px] text-slate-400">{po.vendor_gst || "N/A"}</td>
                        <td className="py-3 px-2">
                          <span className="font-bold">{po.material_name || po.inventory?.name}</span>
                          <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{po.sku || po.inventory?.sku || "N/A"}</span>
                        </td>
                        <td className="py-3 px-2 font-bold">{po.quantity} / {po.received_quantity || 0}</td>
                        <td className="py-3 px-2 font-black text-indigo-650">₹{po.total_cost?.toLocaleString("en-IN")}</td>
                        <td className="py-3 px-2">
                          <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold", 
                            po.payment_status === "Paid" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                            po.payment_status === "Partial" ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-rose-50 text-rose-500 border-rose-200"
                          )}>
                            {po.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase", getStatusColor(po.status))}>
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-12 text-slate-400 text-xs">No records matching the report filters</p>
            )}
          </div>

        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Submit Restock Purchase Request</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">✕</button>
            </div>

            {formError && <div className="bg-rose-500/10 text-rose-500 border border-rose-500/20 p-3 rounded-xl text-xs font-semibold">{formError}</div>}

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs font-semibold">
              
              {/* Core selection items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 hidden">
                  <label className="text-slate-400 uppercase">Select Supplier</label>
                  <select 
                    required 
                    value={form.supplier_id} 
                    onChange={e => handleSupplierSelect(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none"
                  >
                    <option value="">— Choose Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.material_categories || "General"})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Select Inventory Item</label>
                  <select 
                    required 
                    value={form.inventory_id} 
                    onChange={e => handleInventorySelect(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none"
                  >
                    <option value="">— Choose Inventory Item —</option>
                    {inventory.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                  </select>
                </div>
              </div>

              {/* Vendor Information Overrides */}
              <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <h4 className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">Vendor Overrides (Auto-filled)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500">Vendor Name</label>
                    <input type="text" value={form.vendor_name} onChange={e => setForm({...form, vendor_name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Vendor Contact</label>
                    <input type="text" value={form.vendor_contact} onChange={e => setForm({...form, vendor_contact: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Vendor GST</label>
                    <input type="text" value={form.vendor_gst} onChange={e => setForm({...form, vendor_gst: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none font-mono" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500">Vendor Address</label>
                  <textarea rows={1.5} value={form.vendor_address} onChange={e => setForm({...form, vendor_address: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950 outline-none resize-none" />
                </div>
              </div>

              {/* Material Details Overrides */}
              <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <h4 className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">Material Details Overrides (Auto-filled)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-slate-500">Material Name Override</label>
                    <input type="text" value={form.material_name} onChange={e => setForm({...form, material_name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">SKU Override</label>
                    <input type="text" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Unit of Measurement</label>
                    <input type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                </div>
              </div>

              {/* Cost & Scheduling */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Category</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Quantity Ordered</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={form.quantity} 
                    onChange={e => setForm({...form, quantity: parseFloat(e.target.value) || 0})} 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none" 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Rate (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={form.unit_cost} 
                    onChange={e => setForm({...form, unit_cost: parseFloat(e.target.value) || 0})} 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none" 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Expected Delivery</label>
                  <input 
                    type="date" 
                    value={form.expected_delivery_date} 
                    onChange={e => setForm({...form, expected_delivery_date: e.target.value})} 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none" 
                  />
                </div>
              </div>

              {/* Total calculations display */}
              <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-150/10 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase block">Estimated cost:</span>
                  <span className="text-sm font-semibold text-slate-500">₹{form.unit_cost} × {form.quantity} {form.unit}</span>
                </div>
                <span className="text-2xl font-black text-indigo-650">₹{(form.quantity * form.unit_cost).toLocaleString("en-IN", {minimumFractionDigits: 2})}</span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase">Remarks</label>
                <textarea rows={2.5} placeholder="Include reasons for purchase, shipping conditions, etc..." value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-950 outline-none resize-none" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-55 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitLoading} className="px-5 py-2.5 text-xs bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md">
                  {submitLoading ? "Submitting..." : "Submit PO Request"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PO VIEW DETAILS / STEPPER MODAL */}
      {showDetailModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-150 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details View</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                  Purchase Order: <span className="font-mono text-indigo-650">{selectedPO.po_number}</span>
                </h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">✕</button>
            </div>

            {formError && <div className="bg-rose-500/10 text-rose-500 border border-rose-500/20 p-3 rounded-xl text-xs font-semibold">{formError}</div>}

            {/* Stepper Status workflow */}
            <div className="border border-slate-100 dark:border-slate-850 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/30">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold mb-3.5 block">Status workflow tracker</span>
              
              <div className="flex justify-between items-center relative z-10 w-full overflow-x-auto pb-2 scrollbar-none">
                {["draft", "approved", "ordered", "partially_received", "fully_received", "closed"].map((st, i) => {
                  const statusesList = ["draft", "approved", "ordered", "partially_received", "fully_received", "closed"];
                  const currentIdx = statusesList.indexOf(selectedPO.status?.toLowerCase() || "draft");
                  const myIdx = i;
                  
                  const isDone = myIdx < currentIdx;
                  const isActive = myIdx === currentIdx;
                  
                  return (
                    <div key={st} className="flex flex-col items-center flex-1 min-w-[70px]">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] z-10 border transition-all", 
                        isDone ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : 
                        isActive ? "bg-indigo-650 text-white border-indigo-650 shadow" : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                      )}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={cn("text-[9px] font-bold mt-1.5 capitalize", isActive ? "text-indigo-650 dark:text-indigo-400" : "text-slate-400")}>
                        {st.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons for status shifts */}
            <div className="flex gap-2 flex-wrap items-center bg-indigo-50/10 dark:bg-indigo-950/10 border border-indigo-150/10 rounded-2xl p-4">
              <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1"><Award className="w-4 h-4 text-indigo-600" /> Actions:</span>
              
              {actionLoading === selectedPO.id ? (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {selectedPO.status?.toLowerCase() === "draft" && isAccountant && (
                    <button onClick={() => handleUpdateStatus(selectedPO.id, "approved")} className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl shadow">
                      Approve PO Request
                    </button>
                  )}
                  {selectedPO.status?.toLowerCase() === "approved" && isAccountant && (
                    <button onClick={() => handleUpdateStatus(selectedPO.id, "ordered")} className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-xl shadow">
                      Mark Ordered (Placed)
                    </button>
                  )}
                  {selectedPO.status?.toLowerCase() === "ordered" && isStore && (
                    <>
                      <button onClick={() => handleUpdateStatus(selectedPO.id, "partially_received")} className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-xl shadow">
                        Log Partially Received
                      </button>
                      <button onClick={() => handleUpdateStatus(selectedPO.id, "fully_received")} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-xl shadow">
                        Log Fully Received
                      </button>
                    </>
                  )}
                  {selectedPO.status?.toLowerCase() === "partially_received" && isStore && (
                    <button onClick={() => handleUpdateStatus(selectedPO.id, "fully_received")} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-xl shadow">
                      Log Fully Received
                    </button>
                  )}
                  {["partially_received", "fully_received"].includes(selectedPO.status?.toLowerCase()) && isAccountant && (
                    <button onClick={() => handleUpdateStatus(selectedPO.id, "closed")} className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl shadow">
                      Close Purchase Order
                    </button>
                  )}
                  {selectedPO.status?.toLowerCase() === "closed" && (
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-3 py-1.5 rounded-xl border border-slate-200">
                      Closed PO
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Editing detailed fields Form */}
            <form onSubmit={handleEditPOFields} className="space-y-4 text-xs font-semibold">
              
              {/* Row 1: vendor overrides */}
              <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <h4 className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">Vendor Overrides & Address</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500">Vendor Name</label>
                    <input type="text" value={form.vendor_name} onChange={e => setForm({...form, vendor_name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Vendor Contact</label>
                    <input type="text" value={form.vendor_contact} onChange={e => setForm({...form, vendor_contact: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Vendor GST</label>
                    <input type="text" value={form.vendor_gst} onChange={e => setForm({...form, vendor_gst: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none font-mono" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500">Address</label>
                  <textarea rows={1.5} value={form.vendor_address} onChange={e => setForm({...form, vendor_address: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950 outline-none resize-none" />
                </div>
              </div>

              {/* Row 2: material overrides */}
              <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <h4 className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">Material Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-slate-500">Material Name</label>
                    <input type="text" value={form.material_name} onChange={e => setForm({...form, material_name: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">SKU</label>
                    <input type="text" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Unit</label>
                    <input type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                </div>
              </div>

              {/* Cost & Scheduling */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-450 uppercase">Quantity Ordered</label>
                  <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: parseFloat(e.target.value) || 0})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 uppercase">Rate (₹)</label>
                  <input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({...form, unit_cost: parseFloat(e.target.value) || 0})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 uppercase">Expected Delivery</label>
                  <input type="date" value={form.expected_delivery_date} onChange={e => setForm({...form, expected_delivery_date: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-450 uppercase">Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Receiving Quantity & Invoice info */}
              <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <h4 className="text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">Warehouse Delivery & Invoicing</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500">Received Quantity</label>
                    <input type="number" step="0.1" value={form.received_quantity} onChange={e => setForm({...form, received_quantity: parseFloat(e.target.value) || 0})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Pending Quantity</label>
                    <input type="number" value={Math.max(0, form.quantity - form.received_quantity)} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-900 outline-none font-bold text-slate-500" disabled />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Invoice Number</label>
                    <input type="text" value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500">Invoice Date</label>
                    <input type="date" value={form.invoice_date} onChange={e => setForm({...form, invoice_date: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 outline-none" />
                  </div>
                </div>
              </div>

              {/* Payment and Remarks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase">Payment Status</label>
                  <select value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none">
                    {paymentStatuses.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-400 uppercase">Remarks</label>
                  <input type="text" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 outline-none" />
                </div>
              </div>

              {/* Actions submit details */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowDetailModal(false)} className="px-5 py-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-55 transition-colors">
                  Close
                </button>
                <button type="submit" disabled={submitLoading} className="px-5 py-2.5 text-xs bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md">
                  {submitLoading ? "Saving..." : "Update Detailed Fields"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

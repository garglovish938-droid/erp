"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Plus, Search, ScanLine, X, Loader2, ArrowUpRight, Trash2, Edit2, 
  RotateCcw, CheckSquare, Square, AlertTriangle, ChevronLeft, ChevronRight, FileText, Barcode,
  History, Eye, Paperclip, Download, Calendar, Upload, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { inventoryService } from "@/services/inventoryService";
import { supplierService } from "@/services/supplierService";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import CategoryModal from "./CategoryModal";

export default function Inventory({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const [selectedCat, setSelectedCat] = useState("All");
  const [statusFilter, setStatusFilter] = useState("active");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);

  // Receiving History modal
  const [showReceivingModal, setShowReceivingModal] = useState(false);
  const [receivingHistory, setReceivingHistory] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recFilters, setRecFilters] = useState({
    start_date: "",
    end_date: "",
    supplier_id: "",
    warehouse: "",
    project_id: "",
    grn_number: ""
  });

  // Stock Timeline modal
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineTypeFilter, setTimelineTypeFilter] = useState("");

  // File upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");

  // Forms state
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: "", sku: "", barcode: "", category_id: "", supplier_id: "", 
    brand: "", size_variant: "", quantity: 0, unit: "Sheets", 
    minimum_stock_level: 5, unit_cost: 0
  });
  const [formCustomValues, setFormCustomValues] = useState<Record<string, string>>({});
  
  // Custom manual stock adjustment fields
  const [adjustment, setAdjustment] = useState<any>({
    quantity: 0,
    transaction_type: "adjustment",
    notes: "",
    grn_number: "",
    supplier_id: "",
    purchase_order_id: "",
    warehouse: "",
    unit_cost: 0,
    invoice_number: "",
    attachment_url: ""
  });
  const [adjustmentFile, setAdjustmentFile] = useState<File | null>(null);
  const [adjustUploading, setAdjustUploading] = useState(false);

  const [scanResult, setScanResult] = useState<any>(null);
  const [scanBarcode, setScanBarcode] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Barcode Stock movement states
  const [movementType, setMovementType] = useState<string>("issue");
  const [movementQty, setMovementQty] = useState<number>(0);
  const [movementProjectId, setMovementProjectId] = useState<string>("");
  const [movementSupplierId, setMovementSupplierId] = useState<string>("");
  const [movementWarehouse, setMovementWarehouse] = useState<string>("");
  const [movementNotes, setMovementNotes] = useState<string>("");
  const [movementCost, setMovementCost] = useState<number>(0);
  const [movementSubmitting, setMovementSubmitting] = useState<boolean>(false);

  // Confirmation Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState("");

  // Bulk confirmation modal states
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"archive" | "restore" | "delete_permanent">("archive");
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "ALL">(25);
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isStoreOrHigher = ["admin", "manager", "store"].includes(role);
  const isAdmin = role === "admin";

  const getAuthToken = () => {
    const savedUser = localStorage.getItem("allure_erp_user");
    return savedUser ? JSON.parse(savedUser).token : token;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const includeDeleted = statusFilter === "archived";
      const [itemsData, catData, supData, projData, fieldsData] = await Promise.all([
        inventoryService.getInventory(includeDeleted),
        inventoryService.getCategories(),
        supplierService.getSuppliers(),
        apiRequest("/api/projects").catch(() => []),
        inventoryService.getCustomFields("InventoryItem").catch(() => [])
      ]);

      setItems(Array.isArray(itemsData) ? itemsData : []);
      setCategories(Array.isArray(catData) ? catData : []);
      setSuppliers(Array.isArray(supData) ? supData : []);
      setProjects(Array.isArray(projData) ? projData : []);
      setCustomFields(Array.isArray(fieldsData) ? fieldsData : []);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Error retrieving inventory items list", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.event === "inventory_change") {
        fetchData();
      }
    };
    window.addEventListener("erp_websocket_event", handleSync);
    return () => window.removeEventListener("erp_websocket_event", handleSync);
  }, [statusFilter]);

  const handleOpenReceivingHistory = async (item: any) => {
    setCurrentItem(item);
    setShowReceivingModal(true);
    await loadReceivingHistory(item.id, recFilters);
  };

  const loadReceivingHistory = async (itemId: string, filters: any) => {
    setRecLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.start_date) q.set("start_date", filters.start_date);
      if (filters.end_date) q.set("end_date", filters.end_date);
      if (filters.supplier_id) q.set("supplier_id", filters.supplier_id);
      if (filters.warehouse) q.set("warehouse", filters.warehouse);
      if (filters.project_id) q.set("project_id", filters.project_id);
      if (filters.grn_number) q.set("grn_number", filters.grn_number);

      const data = await apiRequest(`/api/inventory/${itemId}/receiving-history?${q}`);
      setReceivingHistory(data || []);
    } catch (e) {
      showToast("Error loading receiving history logs.", "error");
    } finally {
      setRecLoading(false);
    }
  };

  const handleOpenTimeline = async (item: any) => {
    setCurrentItem(item);
    setShowTimelineModal(true);
    await loadTimeline(item.id, timelineTypeFilter);
  };

  const loadTimeline = async (itemId: string, typeFilter: string) => {
    setTimelineLoading(true);
    try {
      const q = new URLSearchParams();
      if (typeFilter) q.set("transaction_type", typeFilter);
      const data = await apiRequest(`/api/inventory/${itemId}/timeline?${q}`);
      setTimelineData(data || []);
    } catch (e) {
      showToast("Error loading stock timeline.", "error");
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleExportReceiving = async (format: "csv" | "excel" | "pdf") => {
    if (!currentItem) return;
    try {
      const q = new URLSearchParams();
      q.set("format", format);
      if (recFilters.start_date) q.set("start_date", recFilters.start_date);
      if (recFilters.end_date) q.set("end_date", recFilters.end_date);
      if (recFilters.supplier_id) q.set("supplier_id", recFilters.supplier_id);
      if (recFilters.warehouse) q.set("warehouse", recFilters.warehouse);
      if (recFilters.project_id) q.set("project_id", recFilters.project_id);
      if (recFilters.grn_number) q.set("grn_number", recFilters.grn_number);

      const userToken = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/inventory/${currentItem.id}/receiving-history/export?${q}`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const ext = format === "excel" ? "xlsx" : format;
      const filename = `receiving_history_${currentItem.sku}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Receiving history exported successfully.", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to export receiving history.", "error");
    }
  };

  const handleExportTimeline = async (format: "csv" | "excel" | "pdf") => {
    if (!currentItem) return;
    try {
      const q = new URLSearchParams();
      q.set("format", format);
      if (timelineTypeFilter) q.set("transaction_type", timelineTypeFilter);

      const userToken = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/inventory/${currentItem.id}/timeline/export?${q}`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const ext = format === "excel" ? "xlsx" : format;
      const filename = `timeline_${currentItem.sku}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Timeline exported successfully.", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to export timeline.", "error");
    }
  };

  const handleAdjustFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAdjustmentFile(e.target.files[0]);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setAdjustUploading(true);

    try {
      let attachmentUrl = adjustment.attachment_url;
      if (adjustmentFile) {
        const userToken = getAuthToken();
        const fd = new FormData();
        fd.append("file", adjustmentFile);

        const res = await fetch(`${API_BASE_URL}/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${userToken}` },
          body: fd
        });

        if (!res.ok) {
          throw new Error("Failed to upload adjustment attachment slip");
        }
        const data = await res.json();
        attachmentUrl = data.url;
      }

      const payload = {
        ...adjustment,
        attachment_url: attachmentUrl,
        unit_cost: parseFloat(adjustment.unit_cost) || 0
      };

      await apiRequest(`/api/inventory/${currentItem.id}/adjust`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showToast("Stock movement adjustment saved successfully", "success");
      setShowAdjustModal(false);
      setAdjustment({
        quantity: 0,
        transaction_type: "adjustment",
        notes: "",
        grn_number: "",
        supplier_id: "",
        purchase_order_id: "",
        warehouse: "",
        unit_cost: 0,
        invoice_number: "",
        attachment_url: ""
      });
      setAdjustmentFile(null);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Stock adjustment error");
    } finally {
      setAdjustUploading(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setSubmitError("Please select a valid CSV file.");
      return;
    }
    setSubmitError("");
    setImportLoading(true);
    try {
      const res = await inventoryService.importCSV(csvFile);
      setImportSuccess(res.message);
      setImportLogs(res.logs || []);
      showToast("CSV materials import completed", "success");
      setCsvFile(null);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "CSV Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleBarcodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    try {
      const res = await apiRequest(`/api/inventory/lookup/${scanBarcode}`);
      setScanResult(res);
      showToast("Barcode resolved successfully", "success");
      
      // Auto-set default IDs if available
      if (res.item?.supplier_id) setMovementSupplierId(res.item.supplier_id);
    } catch (err: any) {
      setSubmitError(err.message || "Barcode not found");
      setScanResult(null);
    }
  };

  const handleStockMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setMovementSubmitting(true);
    try {
      const res = await apiRequest("/api/inventory/movement", {
        method: "POST",
        body: JSON.stringify({
          barcode: scanBarcode,
          transaction_type: movementType,
          quantity: movementQty,
          project_id: movementType === "issue" ? movementProjectId : undefined,
          supplier_id: movementType === "receive" ? movementSupplierId : undefined,
          warehouse: movementType === "transfer" ? movementWarehouse : undefined,
          notes: movementNotes || undefined,
          unit_cost: (movementType === "receive" && movementCost > 0) ? movementCost : undefined,
        })
      });
      showToast(res.message || "Stock movement processed", "success");
      setMovementQty(0);
      setMovementNotes("");
      setMovementCost(0);
      fetchData();
      
      // Refresh current lookup values
      const updatedRes = await apiRequest(`/api/inventory/lookup/${scanBarcode}`);
      setScanResult(updatedRes);
    } catch (err: any) {
      setSubmitError(err.message || "Stock movement failed");
    } finally {
      setMovementSubmitting(false);
    }
  };

  const handleOpenAdd = () => {
    setEditMode(false);
    setCurrentItem(null);
    setFormData({
      name: "", sku: "", barcode: "", category_id: "", supplier_id: "", 
      brand: "", size_variant: "", quantity: 0, unit: "Sheets", 
      minimum_stock_level: 5, unit_cost: 0
    });
    setFormCustomValues({});
    setSubmitError("");
    setShowFormModal(true);
  };

  const handleOpenEdit = async (item: any) => {
    setEditMode(true);
    setCurrentItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      category_id: item.category_id || "",
      supplier_id: item.supplier_id || "",
      brand: item.brand || "",
      size_variant: item.size_variant || "",
      quantity: item.quantity,
      unit: item.unit,
      minimum_stock_level: item.minimum_stock_level,
      unit_cost: item.unit_cost
    });

    const valMap: Record<string, string> = {};
    if (Array.isArray(item.custom_field_values)) {
      item.custom_field_values.forEach((v: any) => {
        valMap[v.field_definition_id] = v.value;
      });
    }
    setFormCustomValues(valMap);
    setSubmitError("");
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    try {
      const pData = {
        ...formData,
        quantity: parseFloat(formData.quantity) || 0,
        unit_cost: parseFloat(formData.unit_cost) || 0,
        minimum_stock_level: parseFloat(formData.minimum_stock_level) || 0
      };

      let savedItem: any;
      if (editMode && currentItem) {
        savedItem = await inventoryService.updateInventoryItem(currentItem.id, pData);
        showToast("Material specs updated successfully", "success");
      } else {
        savedItem = await inventoryService.createInventoryItem(pData);
        showToast("New material added to master inventory", "success");
      }

      const customArray = Object.entries(formCustomValues).map(([fid, val]) => ({
        field_definition_id: fid,
        value: val
      }));

      if (customArray.length > 0) {
        await apiRequest(`/api/custom-fields/values/InventoryItem/${savedItem.id}`, {
          method: "POST",
          body: JSON.stringify(customArray)
        });
      }

      setShowFormModal(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Form submission failed");
    }
  };

  const handleArchiveItem = (item: any) => {
    setConfirmMessage(`Are you sure you want to archive "${item.name}"?`);
    setConfirmAction(() => async () => {
      try {
        await apiRequest(`/api/inventory/${item.id}`, { method: "DELETE" });
        showToast("Material item archived successfully", "success");
        setShowConfirmModal(false);
        fetchData();
      } catch (err: any) {
        showToast(err.message || "Failed to archive item", "error");
      }
    });
    setShowConfirmModal(true);
  };

  const handleRestoreItem = (item: any) => {
    setConfirmMessage(`Are you sure you want to restore "${item.name}" to active stock?`);
    setConfirmAction(() => async () => {
      try {
        await apiRequest(`/api/inventory/${item.id}/restore`, { method: "POST" });
        showToast("Material item restored successfully", "success");
        setShowConfirmModal(false);
        fetchData();
      } catch (err: any) {
        showToast(err.message || "Failed to restore item", "error");
      }
    });
    setShowConfirmModal(true);
  };

  const handleOpenBulkAction = (actionType: "archive" | "restore" | "delete_permanent") => {
    if (selectedIds.length === 0) {
      showToast("Please select at least one material row first.", "error");
      return;
    }
    setBulkAction(actionType);
    setBulkPassword("");
    setBulkReason("");
    setSubmitError("");
    setShowBulkConfirmModal(true);
  };

  const handleExecuteBulkAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkPassword) return;

    setSubmitLoading(true);
    setSubmitError("");
    try {
      await apiRequest("/api/archive/bulk", {
        method: "POST",
        body: JSON.stringify({
          entity_type: "inventory",
          action: bulkAction,
          ids: selectedIds,
          reason: bulkReason,
          password: bulkPassword
        })
      });

      showToast(`Bulk ${bulkAction} action completed successfully!`, "success");
      setShowBulkConfirmModal(false);
      setSelectedIds([]);
      fetchData();
    } catch (e: any) {
      setSubmitError(e.message || "Bulk operation error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(x => x.id));
    }
  };

  // Filter & Sort
  const processedItems = items
    .filter(x => selectedCat === "All" || x.category_id === selectedCat)
    .filter(x => {
      if (!search) return true;
      const query = search.toLowerCase();
      return x.name.toLowerCase().includes(query) || 
             x.sku.toLowerCase().includes(query) || 
             x.barcode.toLowerCase().includes(query) ||
             x.brand?.toLowerCase().includes(query);
    })
    .sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === "category") {
        valA = a.category?.name || "";
        valB = b.category?.name || "";
      }
      if (typeof valA === "string") {
        return sortOrder === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

  const paginatedItems = itemsPerPage === "ALL" 
    ? processedItems 
    : processedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPages = itemsPerPage === "ALL" ? 1 : Math.ceil(processedItems.length / itemsPerPage);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-7 w-7 text-indigo-500" />
            Materials & Master Inventory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor raw material stock levels, inward receiving transactions history, and chronological stock timeline.
          </p>
        </div>
        <div className="flex gap-2">
          {isStoreOrHigher && (
            <button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold shadow transition-all duration-200 animate-in fade-in"
            >
              <Plus className="h-4 w-4" />
              Add Material Specs
            </button>
          )}
          <button
            onClick={() => setShowScanModal(true)}
            className="border dark:border-slate-800 p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            title="Scan code resolver"
          >
            <ScanLine className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="border dark:border-slate-800 p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            title="Import Excel data file"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            onClick={fetchData}
            className="border dark:border-slate-800 p-2.5 rounded-xl text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <RefreshCw className="h-4 w-4 animate-spin-hover" />
          </button>
        </div>
      </div>

      {/* Tabs / Bulk Actions Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b dark:border-slate-800 pb-2">
        <div className="flex gap-4">
          <button
            onClick={() => { setStatusFilter("active"); setCurrentPage(1); }}
            className={cn(
              "pb-2 text-sm font-semibold border-b-2 transition-all",
              statusFilter === "active" ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-400"
            )}
          >
            Active Stock ({items.filter(x => !x.is_deleted).length})
          </button>
          <button
            onClick={() => { setStatusFilter("archived"); setCurrentPage(1); }}
            className={cn(
              "pb-2 text-sm font-semibold border-b-2 transition-all",
              statusFilter === "archived" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "border-transparent text-slate-400"
            )}
          >
            Archived Stock ({items.filter(x => x.is_deleted).length})
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex gap-2 bg-indigo-50 dark:bg-indigo-950/20 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 animate-in fade-in">
            <span className="text-xs text-indigo-700 dark:text-indigo-300 font-bold self-center mr-2">{selectedIds.length} items selected</span>
            {statusFilter === "active" ? (
              <button
                onClick={() => handleOpenBulkAction("archive")}
                className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold shadow"
              >
                Archive Selected
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleOpenBulkAction("restore")}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold shadow"
                >
                  Restore Selected
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleOpenBulkAction("delete_permanent")}
                    className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold shadow"
                  >
                    Purge Selected
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Panels */}
      <div className="bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-100 dark:border-slate-900 grid grid-cols-1 md:grid-cols-4 gap-3 shadow-sm">
        {/* Category Filter */}
        <select
          value={selectedCat}
          onChange={(e) => { setSelectedCat(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 text-sm border dark:border-slate-800 rounded-xl focus:outline-none dark:bg-slate-900"
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Search Input */}
        <div className="relative md:col-span-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border dark:border-slate-800 rounded-xl focus:outline-none dark:bg-slate-900"
            placeholder="Search material description name, brand spec or SKU barcode..."
          />
        </div>
      </div>

      {/* Master Inventory Grid */}
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-3xl shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold border-b dark:border-slate-950">
                <th className="p-5 text-center w-12">
                  <button onClick={handleSelectAll} className="p-1 text-slate-400 hover:text-slate-600">
                    {selectedIds.length === items.length && items.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-5">Material Item Specs</th>
                <th className="p-5">Category</th>
                <th className="p-5">Barcode</th>
                <th className="p-5">Current Qty</th>
                <th className="p-5">Unit Cost</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-b dark:border-slate-800 skeleton-pulse">
                    <td className="p-5 text-center">
                      <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                    </td>
                    <td className="p-5">
                      <div className="w-48 h-4 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
                      <div className="w-28 h-3 bg-slate-100/60 dark:bg-slate-800/40 rounded" />
                    </td>
                    <td className="p-5">
                      <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="p-5">
                      <div className="w-16 h-3.5 bg-slate-150/40 dark:bg-slate-800/40 rounded" />
                    </td>
                    <td className="p-5">
                      <div className="w-14 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="p-5">
                      <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="p-5 text-right">
                      <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    No material stock specifications resolved for this filter.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isOut = item.quantity <= 0;
                  const isLow = item.quantity <= item.minimum_stock_level && !isOut;
                  return (
                    <tr key={item.id} className="border-b dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                      <td className="p-5 text-center">
                        <button onClick={() => handleSelectRow(item.id)} className="p-1 text-slate-400 hover:text-indigo-500">
                          {selectedIds.includes(item.id) ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-5">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{item.sku} {item.brand ? `• ${item.brand}` : ""}</div>
                      </td>
                      <td className="p-5 text-slate-650 dark:text-slate-350">{item.category?.name || "Uncategorized"}</td>
                      <td className="p-5 text-slate-500 font-mono text-xs">{item.barcode}</td>
                      <td className="p-5">
                        <span className={cn(
                          "font-bold",
                          isOut ? "text-rose-600" : isLow ? "text-amber-500" : "text-slate-800 dark:text-slate-200"
                        )}>
                          {item.quantity} {item.unit}
                        </span>
                        {isOut && <span className="text-[10px] text-rose-500 font-bold block mt-0.5">Out of stock</span>}
                        {isLow && <span className="text-[10px] text-amber-500 font-bold block mt-0.5">Low level alert</span>}
                      </td>
                      <td className="p-5 text-slate-700 dark:text-slate-350 font-bold">{formatCurrency(item.unit_cost)}</td>
                      <td className="p-5 text-right">
                        <div className="flex gap-1.5 justify-end items-center">
                          {statusFilter === "active" ? (
                            <>
                              {isStoreOrHigher && (
                                <button
                                  onClick={() => { 
                                    setCurrentItem(item); 
                                    setAdjustment({ 
                                      quantity: 0, 
                                      transaction_type: "adjustment", 
                                      notes: "",
                                      grn_number: "",
                                      supplier_id: "",
                                      purchase_order_id: "",
                                      warehouse: "",
                                      unit_cost: item.unit_cost,
                                      invoice_number: "",
                                      attachment_url: ""
                                    }); 
                                    setSubmitError(""); 
                                    setShowAdjustModal(true); 
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-sm"
                                  title="Adjust stock flow / record transactions"
                                >
                                  Stock Flow
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenReceivingHistory(item)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 rounded-lg text-xs font-bold shadow-sm"
                                title="View Inward Goods Receiving History"
                              >
                                Receiving History
                              </button>
                              <button
                                onClick={() => handleOpenTimeline(item)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 rounded-lg text-xs font-bold shadow-sm animate-in fade-in"
                                title="View Chronological Movement Timeline"
                              >
                                Timeline
                              </button>
                              <a
                                href={`${API_BASE_URL}/api/inventory/${item.id}/barcode/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                title="Download PDF Barcode label"
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                              >
                                <Barcode className="w-4 h-4" />
                              </a>
                              <button 
                                onClick={() => handleOpenEdit(item)} 
                                className="text-slate-400 hover:text-indigo-600 p-1.5"
                                title="Edit material specs"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button 
                                  onClick={() => handleArchiveItem(item)} 
                                  className="text-slate-400 hover:text-rose-600 p-1.5"
                                  title="Archive material"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleRestoreItem(item)} 
                                className="text-slate-400 hover:text-emerald-600 p-1.5"
                                title="Restore archived material"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setConfirmMessage(`Are you sure you want to permanently delete "${item.name}"? This action is irreversible.`);
                                    setConfirmAction(() => async () => {
                                      try {
                                        await apiRequest(`/api/inventory/${item.id}/permanent`, { method: "DELETE" });
                                        showToast("Material item purged successfully", "success");
                                        setShowConfirmModal(false);
                                        fetchData();
                                      } catch (err: any) {
                                        showToast(err.message || "Failed to purge item", "error");
                                      }
                                    });
                                    setShowConfirmModal(true);
                                  }}
                                  className="text-slate-400 hover:text-rose-600 p-1.5"
                                  title="Permanently delete from database"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {processedItems.length > 0 && (
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-xs font-semibold">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Page {currentPage} of {totalPages} ({processedItems.length} total materials)</span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemsPerPage(val === "ALL" ? "ALL" : parseInt(val));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-0.5 font-bold outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value="ALL">ALL</option>
              </select>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="border p-1.5 rounded-lg disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="border p-1.5 rounded-lg disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ADD/EDIT FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editMode ? `Edit Specifications: ${currentItem?.name}` : "Create Master Material Specs"}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-3 border rounded-xl text-xs mb-4">{submitError}</div>}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Material Name*</label>
                  <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">SKU Code*</label>
                  <input type="text" required value={formData.sku} onChange={e=>setFormData({...formData, sku: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Category*</label>
                  <select required value={formData.category_id} onChange={e=>setFormData({...formData, category_id: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <option value="">Select</option>
                    {categories.map(c=>(
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Supplier (Optional)</label>
                  <select value={formData.supplier_id} onChange={e=>setFormData({...formData, supplier_id: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <option value="">Select Supplier</option>
                    {suppliers.map(s=>(
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Stock Unit*</label>
                  <input type="text" required value={formData.unit} onChange={e=>setFormData({...formData, unit: e.target.value})} placeholder="e.g. Sheets, Kgs" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Barcode Value*</label>
                  <input type="text" required value={formData.barcode} onChange={e=>setFormData({...formData, barcode: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Brand Name</label>
                  <input type="text" value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Size / Variant</label>
                  <input type="text" value={formData.size_variant} onChange={e=>setFormData({...formData, size_variant: e.target.value})} placeholder="e.g. 8x4, 12mm" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Initial Qty</label>
                  <input type="number" disabled={editMode} value={formData.quantity} onChange={e=>setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Minimum Alert Qty*</label>
                  <input type="number" required value={formData.minimum_stock_level} onChange={e=>setFormData({...formData, minimum_stock_level: parseFloat(e.target.value) || 0})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Standard Purchase Unit Cost (INR)*</label>
                <input type="number" step="0.01" required value={formData.unit_cost} onChange={e=>setFormData({...formData, unit_cost: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              {/* Dynamic Custom Fields */}
              {customFields.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400">Custom Attributes</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {customFields.map((f) => (
                      <div key={f.id}>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">{f.field_name}</label>
                        <input
                          type="text"
                          value={formCustomValues[f.id] || ""}
                          onChange={(e) => setFormCustomValues({ ...formCustomValues, [f.id]: e.target.value })}
                          className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow">
                  {editMode ? "Update specs" : "Register Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK / LOG STOCK FLOW MODAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Log Stock Flow Movement</h3>
              <button title="Close" onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Adjustment Type*</label>
                  <select value={adjustment.transaction_type} onChange={e=>setAdjustment({...adjustment, transaction_type: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl">
                    <option value="adjustment">Manual Adjustment (+/-)</option>
                    <option value="receive">Stock Receive (+)</option>
                    <option value="issue">Stock Issue (-)</option>
                    <option value="transfer">Stock Transfer (-)</option>
                    <option value="return">Stock Return (+)</option>
                    <option value="damaged">Damage Deduction (-)</option>
                    <option value="purchase">Purchase Inward (+)</option>
                    <option value="csv_import">CSV Import Inward (+)</option>
                    <option value="manual_entry">Manual Entry (+/-)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Quantity*</label>
                  <input type="number" required min="0.001" step="any" value={adjustment.quantity || ""} onChange={e=>setAdjustment({...adjustment, quantity: parseFloat(e.target.value) || 0})} placeholder="Quantity value" className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl" />
                </div>
              </div>

              {/* Conditional Inward Goods details */}
              {["receive", "purchase", "return", "in", "manual_entry", "adjustment"].includes(adjustment.transaction_type) && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Inward Goods Receiving Details</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">GRN Number (Optional)</label>
                      <input type="text" value={adjustment.grn_number} onChange={e=>setAdjustment({...adjustment, grn_number: e.target.value})} placeholder="e.g. GRN-XXXX" className="w-full p-2 text-xs bg-slate-50 border rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Supplier</label>
                      <select value={adjustment.supplier_id} onChange={e=>setAdjustment({...adjustment, supplier_id: e.target.value})} className="w-full p-2 text-xs bg-slate-50 border rounded-lg">
                        <option value="">Select Supplier</option>
                        {suppliers.map(s=>(
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Warehouse/Storage</label>
                      <input type="text" value={adjustment.warehouse} onChange={e=>setAdjustment({...adjustment, warehouse: e.target.value})} placeholder="e.g. Aisle 4, Bin B" className="w-full p-2 text-xs bg-slate-50 border rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">PO Link Reference</label>
                      <input type="text" value={adjustment.purchase_order_id} onChange={e=>setAdjustment({...adjustment, purchase_order_id: e.target.value})} placeholder="e.g. PO-XXXX" className="w-full p-2 text-xs bg-slate-50 border rounded-lg" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Actual Unit Cost (INR)</label>
                      <input type="number" step="0.01" value={adjustment.unit_cost} onChange={e=>setAdjustment({...adjustment, unit_cost: e.target.value})} className="w-full p-2 text-xs bg-slate-50 border rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Invoice Reference</label>
                      <input type="text" value={adjustment.invoice_number} onChange={e=>setAdjustment({...adjustment, invoice_number: e.target.value})} placeholder="e.g. INV-XXXX" className="w-full p-2 text-xs bg-slate-50 border rounded-lg" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Upload Receipt Slip Slip Attachment File</label>
                    <input type="file" onChange={handleAdjustFileChange} className="w-full text-xs text-slate-400" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Internal Notes / Reason*</label>
                <input type="text" required value={adjustment.notes} onChange={e=>setAdjustment({...adjustment, notes: e.target.value})} placeholder="Reason for this stock adjustment" className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t mt-6">
                <button title="Close" type="button" onClick={() => setShowAdjustModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={adjustUploading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5">
                  {adjustUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Apply Stock Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCAN BARCODE LOOKUP MODAL */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in zoom-in-95 duration-200">
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full ${scanResult ? 'max-w-3xl' : 'max-w-sm'} p-6 shadow-2xl transition-all duration-300 my-8`}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Barcode className="w-5 h-5 text-indigo-500" />
                Barcode Scanner & Material Hub
              </h3>
              <button title="Close" onClick={() => { setShowScanModal(false); setScanResult(null); }} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-xl"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-3 border border-rose-200/20 rounded-xl text-xs mb-4">{submitError}</div>}

            <form onSubmit={handleBarcodeLookup} className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">Simulate Scan / Input Value</label>
                  <input type="text" required value={scanBarcode} onChange={e=>setScanBarcode(e.target.value)} placeholder="Type barcode, SKU or scan..." className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <button type="submit" className="self-end px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-md">Lookup</button>
              </div>
            </form>

            {scanResult && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                {/* LEFT COLUMN: Deep Context Info Panels */}
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                  {/* Material Info Card */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <h5 className="font-bold text-slate-900 dark:text-white text-sm">{scanResult.item.name}</h5>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">SKU: <span className="font-mono">{scanResult.item.sku}</span> • Barcode: <span className="font-mono">{scanResult.item.barcode}</span></p>
                    
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Physical Rack</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{scanResult.item.rack || "Not Assigned"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Available Stock</span>
                        <span className="font-bold text-slate-950 dark:text-white">{scanResult.item.available_quantity} {scanResult.item.unit} <span className="text-[10px] font-normal text-slate-400">(Total: {scanResult.item.quantity})</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Card */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
                    <h6 className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-2">Supplier Context</h6>
                    {scanResult.supplier ? (
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{scanResult.supplier.name}</p>
                        <p className="text-slate-500 mt-0.5">Contact: {scanResult.supplier.contact_person || "N/A"} • Phone: {scanResult.supplier.phone || "N/A"}</p>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">No supplier linked to this inventory item.</p>
                    )}
                  </div>

                  {/* Last Purchase Card */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
                    <h6 className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-2">Last Procurement Inward Log</h6>
                    {scanResult.last_purchase ? (
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Unit Cost:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(scanResult.last_purchase.unit_cost)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Date:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{scanResult.last_purchase.date || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Quantity Inward:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{scanResult.last_purchase.quantity}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">PO Number:</span>
                          <span className="font-mono text-indigo-500 font-bold">{scanResult.last_purchase.po_number || "Direct Inward"}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">No previous purchase records found for this material.</p>
                    )}
                  </div>

                  {/* Project Usage Card */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
                    <h6 className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-2">Active Project Allocations</h6>
                    {scanResult.project_usage && scanResult.project_usage.length > 0 ? (
                      <div className="space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
                        {scanResult.project_usage.map((proj: any, idx: number) => (
                          <div key={idx} className="pt-2 first:pt-0 flex justify-between items-center text-[11px]">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{proj.project_name}</span>
                            <span className="text-slate-500">Used: <strong className="text-slate-900 dark:text-white font-mono">{proj.total_used}</strong> • Consumed: <strong className="text-slate-950 dark:text-white font-mono">{proj.total_consumed}</strong></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">This material has not been used in any active projects.</p>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Realtime Action Movements Form */}
                <div className="p-5 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex flex-col justify-between">
                  <form onSubmit={handleStockMovementSubmit} className="space-y-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2">Execute Stock Transaction</span>
                      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border dark:border-slate-800 rounded-xl text-center text-xs font-semibold">
                        {["issue", "receive", "transfer", "adjust"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setMovementType(t); setSubmitError(""); }}
                            className={`py-1.5 rounded-lg capitalize transition-all ${
                              movementType === t
                                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-slate-700"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic Form Inputs based on selected Movement Type */}
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-500 block mb-1">
                          {movementType === "issue" ? "Quantity to Issue*" :
                           movementType === "receive" ? "Quantity to Receive*" :
                           movementType === "transfer" ? "Quantity to Transfer*" :
                           "Adjusted Quantity Value*"}
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={movementQty || ""}
                          onChange={(e) => setMovementQty(parseFloat(e.target.value))}
                          placeholder="e.g. 15.5"
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        />
                      </div>

                      {movementType === "issue" && (
                        <div>
                          <label className="font-bold text-slate-500 block mb-1">Destination Project*</label>
                          <select
                            required
                            value={movementProjectId}
                            onChange={(e) => setMovementProjectId(e.target.value)}
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                          >
                            <option value="">-- Choose Project --</option>
                            {projects.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {movementType === "receive" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-500 block mb-1">Unit Cost (INR)</label>
                            <input
                              type="number"
                              step="any"
                              value={movementCost || ""}
                              onChange={(e) => setMovementCost(parseFloat(e.target.value))}
                              placeholder="e.g. 350"
                              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-500 block mb-1">Supplier</label>
                            <select
                              value={movementSupplierId}
                              onChange={(e) => setMovementSupplierId(e.target.value)}
                              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                            >
                              <option value="">-- Direct Inward --</option>
                              {suppliers.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {movementType === "transfer" && (
                        <div>
                          <label className="font-bold text-slate-500 block mb-1">Destination Rack/Location Name*</label>
                          <input
                            type="text"
                            required
                            value={movementWarehouse}
                            onChange={(e) => setMovementWarehouse(e.target.value)}
                            placeholder="e.g. Rack C-4"
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                          />
                        </div>
                      )}

                      <div>
                        <label className="font-bold text-slate-500 block mb-1">Remarks / Audit Note</label>
                        <input
                          type="text"
                          value={movementNotes}
                          onChange={(e) => setMovementNotes(e.target.value)}
                          placeholder="Audit description details..."
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex gap-2 justify-end">
                      <button
                        type="submit"
                        disabled={movementSubmitting || movementQty <= 0}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        {movementSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Apply Movement
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GOODS INWARD RECEIVING HISTORY MODAL */}
      {showReceivingModal && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl p-6 shadow-2xl my-8 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-500" />
                  Goods Inward Receiving History
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{currentItem.name} ({currentItem.sku})</p>
              </div>
              <button onClick={() => setShowReceivingModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {/* Inward history filters */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Start Date</label>
                <input type="date" value={recFilters.start_date} onChange={e=>setRecFilters({...recFilters, start_date: e.target.value})} className="w-full text-xs p-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">End Date</label>
                <input type="date" value={recFilters.end_date} onChange={e=>setRecFilters({...recFilters, end_date: e.target.value})} className="w-full text-xs p-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Supplier</label>
                <select value={recFilters.supplier_id} onChange={e=>setRecFilters({...recFilters, supplier_id: e.target.value})} className="w-full text-xs p-1.5 border rounded-lg">
                  <option value="">All</option>
                  {suppliers.map(s=>(
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Warehouse</label>
                <input type="text" value={recFilters.warehouse} onChange={e=>setRecFilters({...recFilters, warehouse: e.target.value})} placeholder="Search..." className="w-full text-xs p-1.5 border rounded-lg" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Project</label>
                <select value={recFilters.project_id} onChange={e=>setRecFilters({...recFilters, project_id: e.target.value})} className="w-full text-xs p-1.5 border rounded-lg">
                  <option value="">All</option>
                  {projects.map(p=>(
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => loadReceivingHistory(currentItem.id, recFilters)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1.5 px-3 rounded-lg font-bold shadow"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Export actions */}
            <div className="flex gap-2 justify-end mb-3">
              <span className="text-xs text-slate-400 self-center font-semibold">Export:</span>
              <button onClick={() => handleExportReceiving("excel")} className="flex items-center gap-1 text-[10px] px-2.5 py-1 border rounded-lg hover:bg-slate-50 font-bold">
                <Download className="w-3 h-3 text-emerald-500" /> Excel
              </button>
              <button onClick={() => handleExportReceiving("csv")} className="flex items-center gap-1 text-[10px] px-2.5 py-1 border rounded-lg hover:bg-slate-50 font-bold">
                <Download className="w-3 h-3 text-indigo-500" /> CSV
              </button>
              <button onClick={() => handleExportReceiving("pdf")} className="flex items-center gap-1 text-[10px] px-2.5 py-1 border rounded-lg hover:bg-slate-50 font-bold">
                <Download className="w-3 h-3 text-rose-500" /> PDF
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800 text-slate-400 font-bold">
                    <th className="p-3">Received Date</th>
                    <th className="p-3">GRN Number</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Warehouse</th>
                    <th className="p-3 text-right">Qty Received</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3">Invoice Ref</th>
                    <th className="p-3 text-center">Attachment</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3">Received By</th>
                  </tr>
                </thead>
                <tbody>
                  {recLoading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Loading Receiving Logs...
                      </td>
                    </tr>
                  ) : receivingHistory.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">No inward receiving history records found for this material.</td>
                    </tr>
                  ) : (
                    receivingHistory.map((h: any) => (
                      <tr key={h.id} className="border-b dark:border-slate-900 hover:bg-slate-50/50">
                        <td className="p-3">{new Date(h.created_at).toLocaleDateString()}</td>
                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{h.grn_number || "N/A"}</td>
                        <td className="p-3 font-semibold">{h.supplier?.name || "N/A"}</td>
                        <td className="p-3">{h.warehouse || "N/A"}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{h.quantity}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(h.unit_cost || 0)}</td>
                        <td className="p-3 font-mono">{h.invoice_number || "N/A"}</td>
                        <td className="p-3 text-center">
                          {h.attachment_url ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => setPreviewUrl(h.attachment_url)} className="text-indigo-500 hover:text-indigo-700 p-0.5 border rounded">
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-3 italic text-slate-500">{h.notes || "-"}</td>
                        <td className="p-3 font-medium text-slate-600">{h.user?.full_name || "N/A"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STOCK CHRONOLOGICAL TIMELINE MODAL */}
      {showTimelineModal && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl p-6 shadow-2xl my-8 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  Material Stock Movement Timeline
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{currentItem.name} ({currentItem.sku})</p>
              </div>
              <button onClick={() => setShowTimelineModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {/* Timeline Filter controls */}
            <div className="flex justify-between items-center gap-3 mb-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl">
              <div className="flex gap-2">
                <select
                  value={timelineTypeFilter}
                  onChange={e=>setTimelineTypeFilter(e.target.value)}
                  className="text-xs p-1.5 border rounded-lg dark:bg-slate-900"
                >
                  <option value="">All Movement Types</option>
                  <option value="in">Stock Inward (+)</option>
                  <option value="out">Stock Deduction (-)</option>
                  <option value="damaged">Damage Deduction (-)</option>
                  <option value="transfer">Stock Transfer (-)</option>
                  <option value="return">Stock Return (+)</option>
                  <option value="receive">Goods Receipt (+)</option>
                  <option value="issue">Goods Issued (-)</option>
                  <option value="adjustment">Manual Adjustment (+/-)</option>
                  <option value="purchase">PO Purchase (+)</option>
                </select>
                <button
                  onClick={() => loadTimeline(currentItem.id, timelineTypeFilter)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold"
                >
                  Filter
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleExportTimeline("excel")} className="flex items-center gap-1 text-[10px] px-2 py-1 border rounded-lg hover:bg-slate-50 font-bold">
                  <Download className="w-3 h-3 text-emerald-500" /> Excel
                </button>
                <button onClick={() => handleExportTimeline("csv")} className="flex items-center gap-1 text-[10px] px-2 py-1 border rounded-lg hover:bg-slate-50 font-bold">
                  <Download className="w-3 h-3 text-indigo-500" /> CSV
                </button>
                <button onClick={() => handleExportTimeline("pdf")} className="flex items-center gap-1 text-[10px] px-2 py-1 border rounded-lg hover:bg-slate-50 font-bold">
                  <Download className="w-3 h-3 text-rose-500" /> PDF
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-2">
              {timelineLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Loading Movement Timeline...
                </div>
              ) : timelineData.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No timeline stock movements recorded.</div>
              ) : (
                timelineData.map((t: any) => {
                  const isInward = ["in", "return", "receive", "purchase", "csv_import"].includes(t.transaction_type);
                  return (
                    <div key={t.id} className="border dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full font-bold uppercase text-[9px]",
                            isInward 
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                          )}>
                            {t.transaction_type}
                          </span>
                          <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleString()}</span>
                        </div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Notes: {t.notes || "No remarks"}</p>
                        {t.project && <p className="text-[10px] text-slate-500">Project: {t.project.name}</p>}
                        {t.grn_number && <p className="text-[10px] text-indigo-500 font-mono">GRN: {t.grn_number}</p>}
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "font-bold text-sm",
                          isInward ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {isInward ? "+" : "-"}{t.quantity} {currentItem.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">Logged by: {t.user?.full_name || "System"}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSV BULK IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-101 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Bulk CSV Master Import</h3>
              <button title="Close" onClick={() => { setShowImportModal(false); setImportLogs([]); setImportSuccess(""); }} className="text-slate-400 hover:bg-slate-150 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}
            {importSuccess && <div className="bg-emerald-500/10 text-emerald-600 p-2.5 border rounded-lg text-xs mb-3">{importSuccess}</div>}

            {importLogs.length > 0 ? (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-450 block mb-1">Import Log Details:</div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 max-h-60 overflow-y-auto font-mono text-[10px] space-y-1">
                  {importLogs.map((log, idx) => (
                    <div key={idx} className={log.includes("skipped") || log.includes("error") ? "text-rose-500" : log.includes("Warning") ? "text-amber-500" : "text-slate-600 dark:text-slate-400"}>
                      {log}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={() => { setShowImportModal(false); setImportLogs([]); setImportSuccess(""); }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleImportCSV} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Select Excel / CSV Data File*</label>
                  <input type="file" required accept=".csv" onChange={e=>setCsvFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100" />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t mt-6">
                  <button title="Close" type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                  <button type="submit" disabled={importLoading} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow">
                    {importLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Import Data
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION POPUP MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Confirm Deletion</h4>
            <p className="text-xs text-slate-500 mt-2">{confirmMessage}</p>
            <div className="flex gap-3 justify-center mt-6">
              <button title="Close"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-xs font-bold"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmAction}
                className="px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTION CONFIRMATION MODAL */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-101 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold capitalize text-slate-900 dark:text-white">Bulk {bulkAction.replace("_", " ")}</h3>
              <button title="Close" type="button" onClick={() => setShowBulkConfirmModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleExecuteBulkAction} className="space-y-4">
              <div className="text-xs text-slate-650 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100/50">
                You are about to perform bulk <strong className="text-indigo-600">{bulkAction.replace("_", " ")}</strong> on <strong className="text-indigo-600">{selectedIds.length}</strong> items.
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Reason / Notes*</label>
                <input 
                  type="text" 
                  required 
                  value={bulkReason} 
                  onChange={e => setBulkReason(e.target.value)} 
                  placeholder="e.g. Obsolete materials / project canceled" 
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none" 
                />
              </div>

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
                <button title="Close" type="button" onClick={() => setShowBulkConfirmModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={submitLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1">
                  {submitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Bulk Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl border dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                Attachment preview
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

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        items={items}
        onRefresh={fetchData}
      />
    </div>
  );
}

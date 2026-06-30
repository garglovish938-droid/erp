"use client";

import { useState, useEffect } from "react";
import { 
  Plus, Search, ScanLine, X, Loader2, ArrowUpRight, Trash2, Edit2, 
  RotateCcw, CheckSquare, Square, AlertTriangle, ChevronLeft, ChevronRight, FileText, Barcode 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { inventoryService } from "@/services/inventoryService";
import { supplierService } from "@/services/supplierService";
import { API_BASE_URL } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";

export default function Inventory({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");
  const [statusFilter, setStatusFilter] = useState("active"); // active, archived

  // Selection checkbox
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  
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
  const [adjustment, setAdjustment] = useState({ quantity: 0, transaction_type: "adjustment", notes: "" });
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanBarcode, setScanBarcode] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Confirmation Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState("");

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const isStoreOrHigher = ["admin", "manager", "store"].includes(role);
  const isAdmin = role === "admin";

  const fetchData = async () => {
    try {
      const includeDeleted = statusFilter === "archived";
      const [itemsData, catData, supData, fieldsData] = await Promise.all([
        inventoryService.getInventory(includeDeleted),
        inventoryService.getCategories(),
        supplierService.getSuppliers(),       // Bug Fix #1: was calling getCustomFields twice
        inventoryService.getCustomFields("InventoryItem").catch(() => [])
      ]);

      setItems(itemsData);
      setCategories(catData);
      setSuppliers(supData);
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

    const handleWebsocketEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.event === "inventory_change") {
        fetchData();
      }
    };

    window.addEventListener("erp_websocket_event", handleWebsocketEvent);

    // Fallback polling (every 30 seconds)
    const pollInterval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => {
      window.removeEventListener("erp_websocket_event", handleWebsocketEvent);
      clearInterval(pollInterval);
    };
  }, [token, statusFilter]);

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

    setSubmitError("");
    try {
      const vals = await inventoryService.getEntityFieldValues(item.id);
      const valMap: Record<string, string> = {};
      vals.forEach((v: any) => {
        valMap[v.field_definition_id] = v.value_text;
      });
      setFormCustomValues(valMap);
    } catch (e) {
      setFormCustomValues({});
    }

    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    // Validate quantities
    if (formData.quantity < 0 || formData.minimum_stock_level < 0 || formData.unit_cost < 0) {
      setSubmitError("Material quantity, valuation unit cost, and alert levels must be non-negative values.");
      return;
    }

    // Required Custom fields check
    for (const field of customFields) {
      if (field.is_required && !formCustomValues[field.id]) {
        setSubmitError(`Custom field '${field.label}' is required.`);
        return;
      }
    }

    try {
      let savedItem;
      if (editMode && currentItem) {
        savedItem = await inventoryService.updateInventoryItem(currentItem.id, formData);
        showToast("Material parameters updated", "success");
      } else {
        savedItem = await inventoryService.createInventoryItem(formData);
        showToast("New material stock added successfully", "success");
      }

      // Save custom fields
      await Promise.all(
        Object.entries(formCustomValues).map(([defId, val]) =>
          inventoryService.saveFieldValue({
            field_definition_id: defId,
            entity_id: savedItem.id,
            value_text: val
          })
        )
      );

      setShowFormModal(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save item details");
      showToast(err.message || "Error saving material record", "error");
    }
  };

  const handleConfirmDelete = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to delete Material item: "${name}"? This record can be restored later from the Archive panel.`);
    setConfirmAction(() => async () => {
      try {
        await inventoryService.deleteInventoryItem(id);
        showToast("Material item soft deleted successfully", "success");
        fetchData();
        setSelectedIds(prev => prev.filter(item => item !== id));
      } catch (e: any) {
        showToast(e.message || "Error deleting item", "error");
      }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleConfirmRestore = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to restore Material item: "${name}" back to active inventory valuation lists?`);
    setConfirmAction(() => async () => {
      try {
        await inventoryService.restoreInventoryItem(id);
        showToast("Material restored successfully", "success");
        fetchData();
      } catch (e: any) {
        showToast(e.message || "Failed to restore material item", "error");
      }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleBulkArchive = () => {
    if (selectedIds.length === 0) return;
    setConfirmMessage(`Are you sure you want to archive all ${selectedIds.length} selected materials?`);
    setConfirmAction(() => async () => {
      let successCount = 0;
      let failedMessages: string[] = [];
      
      for (const id of selectedIds) {
        try {
          await inventoryService.deleteInventoryItem(id);
          successCount++;
        } catch (e: any) {
          failedMessages.push(e.message || `Failed to archive material ID ${id}`);
        }
      }
      
      if (failedMessages.length > 0) {
        showToast(failedMessages.join(" | "), "error");
      } else if (successCount > 0) {
        showToast(`Successfully archived ${successCount} material items`, "success");
      }
      
      setSelectedIds([]);
      fetchData();
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    try {
      await inventoryService.adjustStock(currentItem.id, adjustment);
      showToast("Stock level adjusted successfully", "success");
      setShowAdjustModal(false);
      setAdjustment({ quantity: 0, transaction_type: "adjustment", notes: "" });
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Stock adjustment error");
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
      showToast("CSV materials import completed", "success");
      setCsvFile(null);
      fetchData();
      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess("");
      }, 3000);
    } catch (err: any) {
      setSubmitError(err.message || "CSV Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleBarcodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setScanResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/lookup/${scanBarcode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Barcode not registered");
      const item = await response.json();
      setScanResult(item);
      setCurrentItem(item);
    } catch (err: any) {
      setSubmitError(err.message || "Material lookup failed");
    }
  };

  // Checkbox selection helpers
  const handleToggleSelectAll = (filteredItems: any[]) => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(item => item.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const processedItems = items
    .filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode.includes(search);
      const matchesCat = selectedCat === "All" || item.category?.name === selectedCat;
      return matchesSearch && matchesCat;
    })
    .sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(processedItems.length / itemsPerPage);
  const paginatedItems = processedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Warehouse Inventory</h2>
          <p className="text-slate-500 mt-1">Configure custom parameters and monitor stock balances and valuations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-750 shadow-sm"
          >
            <option value="active">Active valuation</option>
            <option value="archived">Archived registry</option>
          </select>
          <button 
            onClick={() => { setShowScanModal(true); setScanResult(null); setScanBarcode(""); setSubmitError(""); }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg text-sm font-semibold"
          >
            <ScanLine className="w-4 h-4" />
            Lookup Barcode
          </button>
          
          {isStoreOrHigher && statusFilter === "active" && (
            <>
              <button 
                onClick={() => { setShowImportModal(true); setSubmitError(""); setImportSuccess(""); setCsvFile(null); }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-sm text-sm font-semibold border"
              >
                <ArrowUpRight className="w-4 h-4" />
                Import CSV
              </button>
              
              <button 
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-150 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Material
              </button>
            </>
          )}
        </div>
      </header>

      {/* Filter and Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search material SKU, name, barcode..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold shadow-sm"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto py-1 w-full lg:w-auto">
          {["All", "Boards", "Hardware", "Decorative Surfaces", "Edge Bands", "Consumables"].map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCat(cat); setCurrentPage(1); }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all",
                selectedCat === cat
                  ? "bg-indigo-600 border-indigo-600 text-white shadow"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk operations display */}
      {selectedIds.length > 0 && isStoreOrHigher && (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border animate-in slide-in-from-top-3 duration-250">
          <span className="text-xs font-bold text-indigo-600">{selectedIds.length} Materials Selected</span>
          <button
            onClick={handleBulkArchive}
            className="px-4.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl border border-rose-200"
          >
            Archive Selected
          </button>
        </div>
      )}

      {/* Materials Table */}
      <div className="glass rounded-3xl overflow-hidden border border-slate-202 dark:border-slate-800 shadow-xl">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-55 dark:bg-slate-900">
              <tr className="border-b border-slate-200 dark:border-slate-800/80">
                {isStoreOrHigher && (
                  <th className="p-5 w-12 sticky top-0 bg-slate-55 dark:bg-slate-900 z-10">
                    <button onClick={() => handleToggleSelectAll(paginatedItems)} className="text-slate-400">
                      {selectedIds.length === paginatedItems.length && paginatedItems.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer sticky top-0 bg-slate-55 dark:bg-slate-900 z-10" onClick={() => handleSort("name")}>Material SKU & Details</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 sticky top-0 bg-slate-55 dark:bg-slate-900 z-10">Category</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 sticky top-0 bg-slate-55 dark:bg-slate-900 z-10">Barcode</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer sticky top-0 bg-slate-55 dark:bg-slate-900 z-10" onClick={() => handleSort("quantity")}>Stock Qty</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer sticky top-0 bg-slate-55 dark:bg-slate-900 z-10" onClick={() => handleSort("unit_cost")}>Unit Cost</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 text-right sticky top-0 bg-slate-55 dark:bg-slate-900 z-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => {
                  const isLow = item.quantity <= item.minimum_stock_level && item.quantity > 0;
                  const isOut = item.quantity === 0;
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      {isStoreOrHigher && (
                        <td className="p-5">
                          <button onClick={() => handleToggleSelect(item.id)} className="text-slate-400">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                      )}
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
                                  onClick={() => { setCurrentItem(item); setAdjustment({ quantity: 0, transaction_type: "adjustment", notes: "" }); setSubmitError(""); setShowAdjustModal(true); }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shadow-sm"
                                >
                                  Stock Flow
                                </button>
                              )}
                              <a
                                href={`${API_BASE_URL}/api/inventory/${item.id}/barcode/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                title="Download PDF Barcode label"
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                              >
                                <Barcode className="w-4 h-4" />
                              </a>
                              <button onClick={() => handleOpenEdit(item)} className="text-slate-400 hover:text-indigo-600 p-1.5"><Edit2 className="w-4 h-4" /></button>
                              {isAdmin && (
                                <button onClick={() => handleConfirmDelete(item.id, item.name)} className="text-slate-400 hover:text-rose-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </>
                          ) : (
                            isAdmin && (
                              <button onClick={() => handleConfirmRestore(item.id, item.name)} className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-bold">
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold text-slate-500">No Materials Registered</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bounds */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50">
            <span className="text-xs text-slate-400 font-semibold">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 border rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 border rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold">{editMode ? "Edit Material Specs" : "Add Material Item"}</h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 border border-rose-500/25 p-3 rounded-xl text-xs mb-4">{submitError}</div>}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Material Name*</label>
                <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Plywood Board 18mm" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">SKU Code*</label>
                  <input type="text" required disabled={editMode} value={formData.sku} onChange={e=>setFormData({...formData, sku: e.target.value.toUpperCase()})} placeholder="PLY-18-B" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Barcode Value*</label>
                  <input type="text" required value={formData.barcode} onChange={e=>setFormData({...formData, barcode: e.target.value})} placeholder="789012" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Quantity*</label>
                  <input type="number" required min="0" value={formData.quantity || ""} onChange={e=>setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} placeholder="10" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Unit Type*</label>
                  <input type="text" required value={formData.unit} onChange={e=>setFormData({...formData, unit: e.target.value})} placeholder="Sheets" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Alert Level*</label>
                  <input type="number" required min="0" value={formData.minimum_stock_level || ""} onChange={e=>setFormData({...formData, minimum_stock_level: parseFloat(e.target.value) || 0})} placeholder="5" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Unit Cost (₹)*</label>
                  <input type="number" required min="0" step="any" value={formData.unit_cost || ""} onChange={e=>setFormData({...formData, unit_cost: parseFloat(e.target.value) || 0})} placeholder="45" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div className="hidden">
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Supplier mapping</label>
                  <select value={formData.supplier_id} onChange={e=>setFormData({...formData, supplier_id: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Brand Name</label>
                  <input type="text" value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} placeholder="Century Plywood" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Size / Dimension variant</label>
                  <input type="text" value={formData.size_variant} onChange={e=>setFormData({...formData, size_variant: e.target.value})} placeholder="8x4 Ft" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Category*</label>
                  <select required value={formData.category_id} onChange={e=>setFormData({...formData, category_id: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* RENDER DYNAMIC CUSTOM FIELDS */}
              {customFields.length > 0 && (
                <div className="pt-4 border-t border-slate-105 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dynamic Fields</h4>
                  {customFields.map((field) => (
                    <div key={field.id}>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">
                        {field.label}{field.is_required && "*"}
                      </label>
                      {field.field_type === "dropdown" ? (
                        <select
                          required={field.is_required}
                          value={formCustomValues[field.id] || ""}
                          onChange={(e) => setFormCustomValues({...formCustomValues, [field.id]: e.target.value})}
                          className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl"
                        >
                          <option value="">Select Option</option>
                          {field.choices?.split(",").map((c: string) => (
                            <option key={c.trim()} value={c.trim()}>{c.trim()}</option>
                          ))}
                        </select>
                      ) : field.field_type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={formCustomValues[field.id] === "true"}
                          onChange={(e) => setFormCustomValues({...formCustomValues, [field.id]: e.target.checked ? "true" : "false"})}
                          className="w-4 h-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded"
                        />
                      ) : (
                        <input
                          type={field.field_type === "number" ? "number" : "text"}
                          required={field.is_required}
                          value={formCustomValues[field.id] || ""}
                          onChange={(e) => setFormCustomValues({...formCustomValues, [field.id]: e.target.value})}
                          placeholder={field.label}
                          className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button type="button" onClick={() => setShowFormModal(false)} className="px-5 py-2.5 text-sm border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Log Stock Flow In/Out</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Adjustment Type*</label>
                <select value={adjustment.transaction_type} onChange={e=>setAdjustment({...adjustment, transaction_type: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl">
                  <option value="in">Stock Inward (+)</option>
                  <option value="out">Stock Deduction (-)</option>
                  <option value="damaged">Damaged Deduction (-)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Quantity*</label>
                <input type="number" required min="1" step="any" value={adjustment.quantity || ""} onChange={e=>setAdjustment({...adjustment, quantity: parseFloat(e.target.value) || 0})} placeholder="Quantity value" className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Internal Notes*</label>
                <input type="text" required value={adjustment.notes} onChange={e=>setAdjustment({...adjustment, notes: e.target.value})} placeholder="Purchase GRN receipt or damage code..." className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t mt-6">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow">Apply stock adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCAN BARCODE LOOKUP MODAL */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Barcode Scanner Emulator</h3>
              <button onClick={() => setShowScanModal(false)} className="text-slate-400 hover:bg-slate-150 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleBarcodeLookup} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Simulate Scan / Input Value*</label>
                <input type="text" required value={scanBarcode} onChange={e=>setScanBarcode(e.target.value)} placeholder="Type barcode e.g. 789012" className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">Query Database</button>
            </form>

            {scanResult && (
              <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl animate-in fade-in duration-200 text-xs">
                <h5 className="font-bold text-emerald-800 dark:text-emerald-350">{scanResult.name}</h5>
                <p className="text-slate-500 mt-1">SKU: {scanResult.sku} • Current Stock: {scanResult.quantity} {scanResult.unit}</p>
                <div className="mt-3 flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowScanModal(false); handleOpenEdit(scanResult); }}
                    className="px-3 py-1 bg-white border text-slate-700 font-bold rounded-lg text-[10px]"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV BULK IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Bulk CSV Master Import</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}
            {importSuccess && <div className="bg-emerald-500/10 text-emerald-600 p-2.5 border rounded-lg text-xs mb-3">{importSuccess}</div>}

            <form onSubmit={handleImportCSV} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Select Excel / CSV Data File*</label>
                <input type="file" required accept=".csv" onChange={e=>setCsvFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t mt-6">
                <button type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={importLoading} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow">
                  {importLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Import Data
                </button>
              </div>
            </form>
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
              <button
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
    </div>
  );
}

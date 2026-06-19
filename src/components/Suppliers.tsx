"use client";

import { useState, useEffect } from "react";
import { 
  Plus, User, Phone, Mail, MapPin, Tag, Search, Loader2, X, Star, Truck, 
  Edit, Trash2, CheckSquare, Square, RotateCcw, AlertTriangle, ChevronLeft, ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { supplierService } from "@/services/supplierService";
import { inventoryService } from "@/services/inventoryService";

export default function Suppliers({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active, archived

  // Checkboxes selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & forms
  const [showFormModal, setShowFormModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ name: "", contact_person: "", phone: "", email: "", address: "", gst_number: "", material_categories: "" });
  const [formCustomValues, setFormCustomValues] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  // Confirmation Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // CSV Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const isStoreOrAccountant = ["admin", "store", "accountant"].includes(role);
  const isAdmin = role === "admin";

  const fetchData = async () => {
    try {
      const includeDeleted = statusFilter === "archived";
      const [supData, poData, fieldsData] = await Promise.all([
        supplierService.getSuppliers(includeDeleted),
        inventoryService.getPurchaseOrders(),
        inventoryService.getCustomFields("Supplier")
      ]);

      setSuppliers(supData);
      setPurchaseOrders(poData);
      setCustomFields(fieldsData);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch suppliers", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, statusFilter]);

  const handleOpenAdd = () => {
    setEditMode(false);
    setCurrentItemId(null);
    setFormData({ name: "", contact_person: "", phone: "", email: "", address: "", gst_number: "", material_categories: "" });
    setFormCustomValues({});
    setSubmitError("");
    setShowFormModal(true);
  };

  const handleOpenEdit = async (sup: any) => {
    setEditMode(true);
    setCurrentItemId(sup.id);
    setFormData({
      name: sup.name,
      contact_person: sup.contact_person || "",
      phone: sup.phone || "",
      email: sup.email || "",
      address: sup.address || "",
      gst_number: sup.gst_number || "",
      material_categories: sup.material_categories || ""
    });

    setSubmitError("");
    try {
      const vals = await inventoryService.getEntityFieldValues(sup.id);
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

    // GST Validation length
    if (formData.gst_number && formData.gst_number.trim().length !== 15) {
      setSubmitError("GST Identification Number must be exactly 15 characters long.");
      return;
    }

    // Phone checks
    if (formData.phone && !/^[0-9+\-\s]+$/.test(formData.phone)) {
      setSubmitError("Phone number contains invalid characters.");
      return;
    }

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setSubmitError("Please enter a valid email address.");
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
      let savedSup;
      if (editMode && currentItemId) {
        savedSup = await supplierService.updateSupplier(currentItemId, formData);
        showToast("Supplier details updated successfully", "success");
      } else {
        savedSup = await supplierService.createSupplier(formData);
        showToast("Supplier registered successfully", "success");
      }

      // Save custom fields value text
      await Promise.all(
        Object.entries(formCustomValues).map(([defId, val]) =>
          inventoryService.saveFieldValue({
            field_definition_id: defId,
            entity_id: savedSup.id,
            value_text: val
          })
        )
      );

      setShowFormModal(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Error saving supplier details");
      showToast(err.message || "Failed to save supplier details", "error");
    }
  };

  const handleConfirmDelete = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to archive Supplier: "${name}"? This record can be restored later from the Archive panel.`);
    setConfirmAction(() => async () => {
      try {
        await supplierService.deleteSupplier(id);
        showToast("Supplier archived successfully", "success");
        fetchData();
        setSelectedIds(prev => prev.filter(item => item !== id));
      } catch (e: any) {
        showToast(e.message || "Error archiving supplier", "error");
      }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleConfirmRestore = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to restore Supplier: "${name}" back to the active vendors directory?`);
    setConfirmAction(() => async () => {
      try {
        await supplierService.restoreSupplier(id);
        showToast("Supplier restored successfully", "success");
        fetchData();
      } catch (e: any) {
        showToast(e.message || "Failed to restore supplier", "error");
      }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setSubmitError("Please select a valid CSV file.");
      return;
    }
    setImportLoading(true);
    setSubmitError("");
    setImportSuccess("");
    try {
      const res = await supplierService.importCSV(csvFile);
      setImportSuccess(res.message || "CSV suppliers import completed");
      showToast(res.message || "CSV suppliers import completed", "success");
      setCsvFile(null);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "CSV Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleBulkArchive = () => {
    if (selectedIds.length === 0) return;
    setConfirmMessage(`Are you sure you want to archive all ${selectedIds.length} selected vendors?`);
    setConfirmAction(() => async () => {
      let successCount = 0;
      let failedMessages: string[] = [];
      
      for (const id of selectedIds) {
        try {
          await supplierService.deleteSupplier(id);
          successCount++;
        } catch (e: any) {
          failedMessages.push(e.message || `Failed to archive supplier ID ${id}`);
        }
      }
      
      if (failedMessages.length > 0) {
        showToast(failedMessages.join(" | "), "error");
      } else if (successCount > 0) {
        showToast(`Successfully archived ${successCount} suppliers`, "success");
      }
      
      setSelectedIds([]);
      fetchData();
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const getSupplierPOCount = (supplierId: string) => {
    return purchaseOrders.filter(po => po.supplier_id === supplierId).length;
  };

  // Selection checkboxes helpers
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

  const processedSuppliers = suppliers
    .filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      (s.material_categories && s.material_categories.toLowerCase().includes(search.toLowerCase())) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  // Pagination bounds
  const totalPages = Math.ceil(processedSuppliers.length / itemsPerPage);
  const paginatedSuppliers = processedSuppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Supplier Directory</h2>
          <p className="text-slate-500 mt-1">Manage vendor details, tax registrations, and custom supply metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-750 shadow-sm"
          >
            <option value="active">Active vendors</option>
            <option value="archived">Archived registry</option>
          </select>
          {isStoreOrAccountant && statusFilter === "active" && (
            <div className="flex gap-2">
              <button 
                onClick={() => { setShowImportModal(true); setSubmitError(""); setImportSuccess(""); setCsvFile(null); }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm text-sm font-semibold"
              >
                Import CSV
              </button>
              <button 
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-150 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                New Supplier
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Bulk actions and search bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, contact rep, category..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold"
          />
        </div>

        {selectedIds.length > 0 && isStoreOrAccountant && (
          <div className="flex items-center gap-3 w-full md:w-auto animate-in fade-in duration-300">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{selectedIds.length} Selected</span>
            <button
              onClick={handleBulkArchive}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-100 dark:border-rose-900/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Archive Selected
            </button>
          </div>
        )}
      </div>

      {/* Grid Selection Actions */}
      {paginatedSuppliers.length > 0 && isStoreOrAccountant && (
        <div className="flex items-center gap-2 pl-2">
          <button 
            onClick={() => handleToggleSelectAll(paginatedSuppliers)} 
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600"
          >
            {selectedIds.length === paginatedSuppliers.length ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Select All on Page
          </button>
        </div>
      )}

      {/* Suppliers Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {paginatedSuppliers.length > 0 ? (
          paginatedSuppliers.map((sup) => {
            const poCount = getSupplierPOCount(sup.id);
            const ratingScore = poCount % 2 === 0 ? 5.0 : 4.5;
            const isSelected = selectedIds.includes(sup.id);

            return (
              <div 
                key={sup.id} 
                className={cn(
                  "glass rounded-3xl p-6 border transition-all flex flex-col justify-between relative",
                  isSelected ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200/60 dark:border-slate-800/80 shadow-md hover:shadow-lg"
                )}
              >
                {/* Checkbox select */}
                {isStoreOrAccountant && (
                  <button 
                    onClick={() => handleToggleSelect(sup.id)}
                    className="absolute top-4 right-4 text-slate-300 hover:text-indigo-600 z-10"
                  >
                    {isSelected ? <CheckSquare className="w-4.5 h-4.5 text-indigo-600" /> : <Square className="w-4.5 h-4.5" />}
                  </button>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4 pr-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{sup.name}</h3>
                      {sup.contact_person && (
                        <p className="text-xs text-indigo-650 dark:text-indigo-400 font-semibold mt-1">Rep: {sup.contact_person}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    {sup.gst_number && (
                      <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        GST: {sup.gst_number}
                      </div>
                    )}
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{sup.phone}</span>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{sup.email}</span>
                      </div>
                    )}
                    {sup.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed">{sup.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {sup.material_categories?.split(",").map((cat: string) => (
                      <span key={cat} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 rounded-md inline-flex items-center gap-1 border border-slate-200/20">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer ratings and action triggers */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-2xl text-[10px] font-bold">
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>{ratingScore.toFixed(1)} / 5.0 ({poCount} POs)</span>
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    {statusFilter === "active" ? (
                      <>
                        <button onClick={() => handleOpenEdit(sup)} className="text-slate-400 hover:text-indigo-600 p-1"><Edit className="w-3.5 h-3.5" /></button>
                        {isAdmin && (
                          <button onClick={() => handleConfirmDelete(sup.id, sup.name)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </>
                    ) : (
                      isAdmin && (
                        <button onClick={() => handleConfirmRestore(sup.id, sup.name)} className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-[9px]">
                          <RotateCcw className="w-3 h-3" />
                          Restore
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 glass rounded-3xl text-slate-400">
            <Truck className="w-12 h-12 mx-auto mb-3 text-slate-350" />
            <p className="font-semibold text-slate-500">No Suppliers Registered</p>
          </div>
        )}
      </div>

      {/* Pagination bounds */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 shadow-sm">
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

      {/* FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold">{editMode ? "Edit Supplier Record" : "Add Supplier Record"}</h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 border border-rose-500/25 p-3 rounded-xl text-xs mb-4">{submitError}</div>}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Supplier/Vendor Name*</label>
                <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Apex Boards & Plywood Co." className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Contact Rep</label>
                  <input type="text" value={formData.contact_person} onChange={e=>setFormData({...formData, contact_person: e.target.value})} placeholder="Ravi Kumar" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">GST Registration (15 chars)</label>
                  <input type="text" value={formData.gst_number} onChange={e=>setFormData({...formData, gst_number: e.target.value.toUpperCase()})} placeholder="27AAACA1111A1Z1" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number</label>
                  <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="9988776655" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
                  <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} placeholder="sales@apexboards.com" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Supply Categories (comma-separated)*</label>
                <input type="text" required value={formData.material_categories} onChange={e=>setFormData({...formData, material_categories: e.target.value})} placeholder="Boards, Hardware, Decorative Surfaces" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Warehouse Address</label>
                <textarea rows={2} value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} placeholder="Plot 45, Industrial Area..." className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
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
                          className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
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

      {/* CONFIRMATION POPUP MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Confirm Action</h4>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">{confirmMessage}</p>
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
                Yes, Archive
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CSV BULK IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bulk CSV Suppliers Import</h3>
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
    </div>
  );
}

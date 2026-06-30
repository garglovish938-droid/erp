"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Edit2, Trash2, GitMerge, Move, Plus } from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { useToast } from "./Toast";

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category_id?: string;
  category?: { name: string };
  unit: string;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  items: InventoryItem[];
  onRefresh: () => void;
}

export default function CategoryModal({
  isOpen,
  onClose,
  categories,
  items,
  onRefresh
}: CategoryModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"manage" | "merge" | "reassign">("manage");
  
  // Create / Edit Category state
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  
  // Search Categories state
  const [catSearch, setCatSearch] = useState("");
  
  // Merge state
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  
  // Reassign state
  const [reassignSourceId, setReassignSourceId] = useState("");
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast("Category name is required", "error");
      return;
    }
    setLoading(true);
    try {
      if (editingCatId) {
        // Edit Category
        await apiRequest(`/api/categories/${editingCatId}`, {
          method: "PUT",
          body: JSON.stringify({ name: catName, description: catDesc }),
        });
        showToast("Category updated successfully", "success");
      } else {
        // Create Category
        await apiRequest("/api/categories", {
          method: "POST",
          body: JSON.stringify({ name: catName, description: catDesc }),
        });
        showToast("Category created successfully", "success");
      }
      setCatName("");
      setCatDesc("");
      setEditingCatId(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Failed to save category", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatDesc(cat.description || "");
    setActiveSubTab("manage");
  };

  const handleDeleteClick = async (cat: Category) => {
    const hasItems = items.some(item => item.category_id === cat.id);
    const confirmMsg = hasItems 
      ? `Are you sure you want to delete category "${cat.name}"? This category contains materials which will become "Uncategorized".`
      : `Are you sure you want to delete category "${cat.name}"?`;
      
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await apiRequest(`/api/categories/${cat.id}`, { method: "DELETE" });
      showToast("Category deleted successfully", "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Failed to delete category", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId) {
      showToast("Please select both source and target categories", "error");
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      showToast("Source and target categories must be different", "error");
      return;
    }
    const sourceName = categories.find(c => c.id === mergeSourceId)?.name;
    const targetName = categories.find(c => c.id === mergeTargetId)?.name;
    if (!window.confirm(`Are you sure you want to merge category "${sourceName}" into "${targetName}"? All materials will be moved and "${sourceName}" will be deleted.`)) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/api/categories/merge", {
        method: "POST",
        body: JSON.stringify({ source_id: mergeSourceId, target_id: mergeTargetId }),
      });
      showToast("Categories merged successfully", "success");
      setMergeSourceId("");
      setMergeTargetId("");
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Failed to merge categories", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemIds.length === 0 || !reassignTargetId) {
      showToast("Please select materials and a target category", "error");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/api/categories/move-materials", {
        method: "POST",
        body: JSON.stringify({ material_ids: selectedItemIds, target_id: reassignTargetId }),
      });
      showToast("Materials moved successfully", "success");
      setSelectedItemIds([]);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Failed to move materials", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(catSearch.toLowerCase()) ||
    (cat.description || "").toLowerCase().includes(catSearch.toLowerCase())
  );

  const materialsInSource = items.filter(item => 
    reassignSourceId ? item.category_id === reassignSourceId : !item.category_id
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">

      
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">Category Management</h2>
            <p className="text-xs text-slate-400 font-medium">Create, edit, merge, or reallocate inventory categories</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-4 flex-shrink-0">
          <button
            onClick={() => setActiveSubTab("manage")}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeSubTab === "manage"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Manage Categories
          </button>
          <button
            onClick={() => setActiveSubTab("merge")}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeSubTab === "merge"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-1.5"><GitMerge className="w-3.5 h-3.5" /> Merge Categories</span>
          </button>
          <button
            onClick={() => setActiveSubTab("reassign")}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeSubTab === "reassign"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-1.5"><Move className="w-3.5 h-3.5" /> Reassign Materials</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/20 dark:bg-slate-950/10">
          {activeSubTab === "manage" && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Add / Edit Form */}
              <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-fit">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-500" />
                  {editingCatId ? "Update Category" : "Create New Category"}
                </h3>
                <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Category Name*</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Timberwood, Laminates"
                      value={catName}
                      onChange={e => setCatName(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-850 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Description</label>
                    <textarea
                      placeholder="Enter description..."
                      rows={3}
                      value={catDesc}
                      onChange={e => setCatDesc(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-850 dark:text-white"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-all cursor-pointer disabled:opacity-50"
                    >
                      {editingCatId ? "Save Changes" : "Create Category"}
                    </button>
                    {editingCatId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(null);
                          setCatName("");
                          setCatDesc("");
                        }}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Categories list */}
              <div className="md:col-span-3 flex flex-col gap-3 min-h-[300px]">
                <div className="relative flex-shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                
                <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3 font-bold uppercase tracking-wider text-slate-400">Name</th>
                        <th className="p-3 font-bold uppercase tracking-wider text-slate-400">Description</th>
                        <th className="p-3 font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map(cat => (
                          <tr key={cat.id} className="border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{cat.name}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{cat.description || "—"}</td>
                            <td className="p-3 text-right">
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => handleEditClick(cat)}
                                  className="p-1.5 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-slate-450 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg cursor-pointer transition-colors"
                                  title="Edit/Rename"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(cat)}
                                  className="p-1.5 border border-slate-200 dark:border-slate-800 hover:border-rose-500 text-slate-450 hover:text-rose-600 dark:hover:text-rose-450 rounded-lg cursor-pointer transition-colors"
                                  title="Soft Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-400 font-medium">No categories found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "merge" && (
            <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-indigo-500" />
                Merge Two Categories
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Merging transfers all materials from the <strong>Source Category</strong> into the <strong>Target Category</strong>. The Source Category will then be automatically soft-deleted. This operation is reversible via the Archive Panel.
              </p>
              
              <form onSubmit={handleMerge} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Source Category (To Delete)</label>
                    <select
                      required
                      value={mergeSourceId}
                      onChange={e => setMergeSourceId(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-850 dark:text-white"
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Target Category (To Keep)</label>
                    <select
                      required
                      value={mergeTargetId}
                      onChange={e => setMergeTargetId(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-850 dark:text-white"
                    >
                      <option value="">Select Category</option>
                      {categories.filter(c => c.id !== mergeSourceId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !mergeSourceId || !mergeTargetId}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-150 dark:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  Merge Categories
                </button>
              </form>
            </div>
          )}

          {activeSubTab === "reassign" && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Left filter and target selection */}
              <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl h-fit space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Move className="w-4 h-4 text-indigo-500" />
                  Bulk Reallocation
                </h3>
                
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Filter Source Category</label>
                  <select
                    value={reassignSourceId}
                    onChange={e => {
                      setReassignSourceId(e.target.value);
                      setSelectedItemIds([]);
                    }}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-850 dark:text-white"
                  >
                    <option value="">Uncategorized Materials</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Move Selected To Category*</label>
                  <select
                    required
                    value={reassignTargetId}
                    onChange={e => setReassignTargetId(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-850 dark:text-white"
                  >
                    <option value="">Select Target Category</option>
                    {categories.filter(c => c.id !== reassignSourceId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={handleReassign}
                  disabled={loading || selectedItemIds.length === 0 || !reassignTargetId}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  Move Selected ({selectedItemIds.length}) Materials
                </button>
              </div>

              {/* Right checklist of materials */}
              <div className="md:col-span-3 flex flex-col gap-3 min-h-[300px]">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Materials in Selected Category ({materialsInSource.length})</span>
                  {materialsInSource.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedItemIds.length === materialsInSource.length) {
                          setSelectedItemIds([]);
                        } else {
                          setSelectedItemIds(materialsInSource.map(m => m.id));
                        }
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[9px] cursor-pointer bg-transparent border-0"
                    >
                      {selectedItemIds.length === materialsInSource.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>
                
                <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-y-auto max-h-[350px] bg-white dark:bg-slate-900 p-4 space-y-2.5">
                  {materialsInSource.length > 0 ? (
                    materialsInSource.map(item => (
                      <div
                        key={item.id}
                        onClick={() => toggleSelectItem(item.id)}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all ${
                          selectedItemIds.includes(item.id)
                            ? "border-indigo-650 dark:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.id)}
                          onChange={() => {}} // handled by parent div click
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="text-xs">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium py-12">
                      No materials found in this category.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

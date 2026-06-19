"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Plus, Folder, Calendar, DollarSign, MapPin, Layers, ChevronDown, ChevronUp, 
  Loader2, ArrowRight, X, Trash2, Edit, CheckSquare, Square, RotateCcw, 
  AlertTriangle, ChevronLeft, ChevronRight, FileText, Upload, Download, Eye, Search 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { projectService } from "@/services/projectService";
import { clientService } from "@/services/clientService";
import { inventoryService } from "@/services/inventoryService";
import { API_BASE_URL } from "@/lib/api";

export default function Projects({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  
  // Documents management per project
  const [projectDocs, setProjectDocs] = useState<Record<string, any[]>>({});
  
  const [loading, setLoading] = useState(true);
  const [expandedProj, setExpandedProj] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active, archived
  const [projectStateFilter, setProjectStateFilter] = useState("all"); // planning, active, completed, delayed, on_hold

  // Modals & forms
  const [showFormModal, setShowFormModal] = useState(false);
  const [showBOMModal, setShowBOMModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  
  const [editMode, setEditMode] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState<any>({
    name: "", client_id: "", site_location: "", status: "planning", 
    start_date: "", end_date: "", budget: 0
  });
  const [formCustomValues, setFormCustomValues] = useState<Record<string, string>>({});
  const [newBOMItem, setNewBOMItem] = useState({ inventory_id: "", required_quantity: 0 });
  const [newRequest, setNewRequest] = useState({ inventory_id: "", quantity: 0, notes: "" });
  const [submitError, setSubmitError] = useState("");

  // Inline client creation
  const [showInlineClient, setShowInlineClient] = useState(false);
  const [inlineClientData, setInlineClientData] = useState({ name: "", contact_person: "", phone: "", email: "", address: "" });
  const [savingClient, setSavingClient] = useState(false);

  // Document Upload form state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState("design");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Confirmation Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState("");

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // CSV Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const isManagerOrHigher = ["admin", "manager"].includes(role);
  const isAdmin = role === "admin";

  const fetchData = async () => {
    try {
      const includeDeleted = statusFilter === "archived";
      const [projData, clientData, invData, fieldsData] = await Promise.all([
        projectService.getProjects(includeDeleted),
        clientService.getClients(),
        inventoryService.getInventory(),
        inventoryService.getCustomFields("Project")
      ]);

      setProjects(projData);
      setClients(clientData);
      setInventory(invData);
      setCustomFields(fieldsData);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch projects database", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, statusFilter]);

  // Fetch project specific documents when expanded
  useEffect(() => {
    if (expandedProj) {
      fetchProjectDocs(expandedProj);
    }
  }, [expandedProj]);

  const fetchProjectDocs = async (projId: string) => {
    try {
      const docs = await projectService.getDocuments("Project", projId);
      setProjectDocs(prev => ({ ...prev, [projId]: docs }));
    } catch (e) {
      console.error("Error fetching docs for project", projId);
    }
  };

  const handleOpenAdd = () => {
    setEditMode(false);
    setCurrentItemId(null);
    setFormData({ name: "", client_id: "", site_location: "", status: "planning", start_date: "", end_date: "", budget: 0 });
    setFormCustomValues({});
    setSubmitError("");
    setShowInlineClient(false);
    setInlineClientData({ name: "", contact_person: "", phone: "", email: "", address: "" });
    setShowFormModal(true);
  };

  const handleOpenEdit = async (proj: any) => {
    setEditMode(true);
    setCurrentItemId(proj.id);
    setFormData({
      name: proj.name,
      client_id: proj.client_id || "",
      site_location: proj.site_location || "",
      status: proj.status,
      start_date: proj.start_date || "",
      end_date: proj.end_date || "",
      budget: proj.budget
    });

    setSubmitError("");
    try {
      const vals = await inventoryService.getEntityFieldValues(proj.id);
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

    // Budget check
    if (formData.budget < 0) {
      setSubmitError("Project budget cannot be a negative amount.");
      return;
    }

    // Dates check
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      setSubmitError("Project start date must fall before or on the end date.");
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
      let savedProj;
      if (editMode && currentItemId) {
        savedProj = await projectService.updateProject(currentItemId, formData);
        showToast("Project specifications updated successfully", "success");
      } else {
        savedProj = await projectService.createProject(formData);
        showToast("Project created successfully", "success");
      }

      // Save custom fields
      await Promise.all(
        Object.entries(formCustomValues).map(([defId, val]) =>
          inventoryService.saveFieldValue({
            field_definition_id: defId,
            entity_id: savedProj.id,
            value_text: val
          })
        )
      );

      setShowFormModal(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save project");
      showToast(err.message || "Failed to save project", "error");
    }
  };

  const handleConfirmDelete = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to archive Project: "${name}"? Active material request dependencies will be checked.`);
    setConfirmAction(() => async () => {
      try {
        await projectService.deleteProject(id);
        showToast("Project archived successfully", "success");
        fetchData();
      } catch (e: any) {
        showToast(e.message || "Failed to delete: linked requests/POs active", "error");
      }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleConfirmRestore = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to restore Project: "${name}" back to the active production list?`);
    setConfirmAction(() => async () => {
      try {
        await projectService.restoreProject(id);
        showToast("Project restored successfully", "success");
        fetchData();
      } catch (e: any) {
        showToast(e.message || "Failed to restore project", "error");
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
      const res = await projectService.importCSV(csvFile);
      setImportSuccess(res.message || "CSV projects import completed");
      showToast(res.message || "CSV projects import completed", "success");
      setCsvFile(null);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "CSV Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleAddBOMItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (newBOMItem.required_quantity <= 0) {
      setSubmitError("Quantity must be greater than 0");
      return;
    }
    try {
      await projectService.addBOMItem(selectedProject.id, newBOMItem);
      showToast("BOM item specified successfully", "success");
      setShowBOMModal(false);
      setNewBOMItem({ inventory_id: "", required_quantity: 0 });
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to specify BOM");
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (newRequest.quantity <= 0) {
      setSubmitError("Quantity must be greater than 0");
      return;
    }
    try {
      await projectService.createMaterialRequest({
        project_id: selectedProject.id,
        inventory_id: newRequest.inventory_id,
        quantity: newRequest.quantity,
        notes: newRequest.notes
      });
      showToast("Material Request submitted to Store Manager successfully!", "success");
      setShowRequestModal(false);
      setNewRequest({ inventory_id: "", quantity: 0, notes: "" });
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Error submitting request");
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setSubmitError("Please select a file to upload.");
      return;
    }
    if (!docName.trim()) {
      setSubmitError("Please enter a display name for the document.");
      return;
    }

    setUploadingDoc(true);
    try {
      await projectService.uploadDocument(docName, docCategory, "Project", selectedProject.id, file);
      showToast("Document attached to project successfully", "success");
      setShowDocModal(false);
      setDocName("");
      fetchProjectDocs(selectedProject.id);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string, projId: string) => {
    if (!confirm("Are you sure you want to remove this document attachment?")) return;
    try {
      await projectService.deleteDocument(docId);
      showToast("Document removed", "info");
      fetchProjectDocs(projId);
    } catch (e) {
      showToast("Error deleting document", "error");
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-50 text-emerald-600 border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400";
      case "planning": return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400";
      case "on_hold": return "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400";
      case "delayed": return "bg-rose-50 text-rose-600 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse";
      case "completed": return "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400";
      default: return "bg-slate-50 border-slate-200";
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const processedProjects = projects
    .filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        (p.site_location && p.site_location.toLowerCase().includes(search.toLowerCase())) ||
        (p.client?.name && p.client.name.toLowerCase().includes(search.toLowerCase()));
      
      const matchesState = projectStateFilter === "all" || p.status === projectStateFilter;
      return matchesSearch && matchesState;
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

  const totalPages = Math.ceil(processedProjects.length / itemsPerPage);
  const paginatedProjects = processedProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Furniture & Interior Projects</h2>
          <p className="text-slate-500 mt-1">Oversee blueprints, sites updates, material requests, and design commissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-750 shadow-sm"
          >
            <option value="active">Active Projects</option>
            <option value="archived">Archived Registry</option>
          </select>
          {isManagerOrHigher && statusFilter === "active" && (
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
                New Project
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Filter and search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by project name, location, client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold"
          />
        </div>
        <select
          value={projectStateFilter}
          onChange={(e) => { setProjectStateFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-3 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold"
        >
          <option value="all">All Statuses</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="delayed">Delayed</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {paginatedProjects.length > 0 ? (
          paginatedProjects.map((proj) => {
            const isExpanded = expandedProj === proj.id;
            const completedBOMCount = proj.bom_items.filter((b: any) => b.status === "fulfilled").length;
            const totalBOMCount = proj.bom_items.length;
            const bomProgress = totalBOMCount > 0 ? (completedBOMCount / totalBOMCount) * 100 : 0;
            const docs = projectDocs[proj.id] || [];

            return (
              <div 
                key={proj.id} 
                className="glass rounded-3xl overflow-hidden border border-slate-205 dark:border-slate-800/80 shadow-md hover:shadow-lg transition-all"
              >
                {/* Master details header */}
                <div 
                  onClick={() => setExpandedProj(isExpanded ? null : proj.id)}
                  className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 cursor-pointer select-none bg-white/50 dark:bg-slate-900/10"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                      <Folder className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-850 dark:text-white leading-tight">{proj.name}</h3>
                      <p className="text-xs text-indigo-650 dark:text-indigo-400 font-semibold mt-1">Client: {proj.client?.name || "No client mapped"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-bold">Site Location</span>
                      <span className="flex items-center gap-1 mt-0.5 text-slate-800 dark:text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {proj.site_location || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-bold">Project Budget</span>
                      <span className="flex items-center gap-0.5 mt-0.5 text-slate-800 dark:text-slate-200">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        {proj.budget.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-bold">Status Pipeline</span>
                      <span className={cn("px-2.5 py-0.5 border rounded-full text-[10px] uppercase font-bold inline-block mt-0.5", getStatusBadgeClass(proj.status))}>
                        {proj.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="w-[120px]">
                      <span className="text-[10px] text-slate-400 uppercase block font-bold mb-1">BOM Fulfilled</span>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${bomProgress}%` }}></div>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">{completedBOMCount} of {totalBOMCount} items</span>
                    </div>
                  </div>

                  <div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Sub details expanded drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 p-6 bg-slate-50/20 dark:bg-slate-900/20 space-y-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* BOM Requirements panel */}
                      <div className="lg:col-span-2 glass rounded-2xl p-5 border border-slate-200/50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-indigo-500" />
                            Bill of Materials (BOM) Usage
                          </h4>
                          {isManagerOrHigher && statusFilter === "active" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setSubmitError(""); setShowBOMModal(true); }}
                              className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Specify Material
                            </button>
                          )}
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 pb-2">
                                <th className="pb-2">Material / Brand</th>
                                <th className="pb-2">Required</th>
                                <th className="pb-2">Issued</th>
                                <th className="pb-2">Status</th>
                                {isManagerOrHigher && statusFilter === "active" && <th className="pb-2 text-right">Action</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[11px]">
                              {proj.bom_items.length > 0 ? (
                                proj.bom_items.map((bom: any) => (
                                  <tr key={bom.id} className="hover:bg-slate-50/30">
                                    <td className="py-2">
                                      <div className="font-semibold text-slate-800 dark:text-slate-250">{bom.inventory?.name}</div>
                                      <div className="text-[10px] text-slate-400">{bom.inventory?.brand || "Brand N/A"} • {bom.inventory?.sku}</div>
                                    </td>
                                    <td className="py-2">{bom.required_quantity} {bom.inventory?.unit}</td>
                                    <td className="py-2 font-semibold text-slate-700 dark:text-slate-350">{bom.used_quantity} {bom.inventory?.unit}</td>
                                    <td className="py-2">
                                      <span className={cn(
                                        "px-2 py-0.5 text-[9px] font-bold uppercase rounded",
                                        bom.status === "fulfilled" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                        bom.status === "partial" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                        "bg-slate-100 text-slate-500"
                                      )}>
                                        {bom.status}
                                      </span>
                                    </td>
                                    {isManagerOrHigher && statusFilter === "active" && (
                                      <td className="py-2 text-right">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setNewRequest({ ...newRequest, inventory_id: bom.inventory_id }); setSubmitError(""); setShowRequestModal(true); }}
                                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg border border-indigo-100/30"
                                        >
                                          Request Issue
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="py-4 text-center text-slate-400">No BOM specified for design blueprints yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Documents panel */}
                      <div className="glass rounded-2xl p-5 border border-slate-200/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-indigo-500" />
                              Attached Blueprints & Photos
                            </h4>
                            {statusFilter === "active" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setSubmitError(""); setShowDocModal(true); }}
                                className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Attach
                              </button>
                            )}
                          </div>

                          <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                            {docs.length > 0 ? (
                              docs.map((doc: any) => (
                                <div key={doc.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200/40 rounded-xl text-[11px] font-semibold">
                                  <div className="flex items-center gap-2 max-w-[150px] truncate" title={doc.name}>
                                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <span className="truncate">{doc.name}</span>
                                  </div>
                                  <div className="flex gap-1.5 items-center">
                                    <a
                                      href={`${API_BASE_URL}${doc.file_path}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-600"
                                      title="Open / Download Document"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                    <button
                                      onClick={() => handleDeleteDoc(doc.id, proj.id)}
                                      className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600"
                                      title="Remove attachment"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-6 text-slate-400 text-[11px]">No documents attached to this project record.</div>
                            )}
                          </div>
                        </div>

                        {/* Project Operations Actions */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl">
                          <span className="text-[10px] text-slate-400 uppercase font-black">Admin Actions</span>
                          <div className="flex gap-2">
                            {statusFilter === "active" ? (
                              <>
                                <button onClick={() => handleOpenEdit(proj)} className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-indigo-500 text-xs font-bold shadow-sm">
                                  <Edit className="w-3.5 h-3.5 text-indigo-500" />
                                  Edit Info
                                </button>
                                {isAdmin && (
                                  <button onClick={() => handleConfirmDelete(proj.id, proj.name)} className="flex items-center gap-1 px-3 py-1.5 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold shadow-sm">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Archive
                                  </button>
                                )}
                              </>
                            ) : (
                              isAdmin && (
                                <button onClick={() => handleConfirmRestore(proj.id, proj.name)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Restore Project
                                </button>
                              )
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 glass rounded-3xl text-slate-400">
            <Folder className="w-12 h-12 mx-auto mb-3 text-slate-350" />
            <p className="font-semibold text-slate-500">No Projects Found</p>
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

      {/* ADD / EDIT PROJECT FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold">{editMode ? "Edit Project Specs" : "Add Project Record"}</h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 border border-rose-500/25 p-3 rounded-xl text-xs mb-4">{submitError}</div>}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Project Name*</label>
                <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="3BHK Modular Kitchen - Amit Shah" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Map Client Customer*</label>
                  <select
                    required={!showInlineClient}
                    value={formData.client_id}
                    onChange={e => {
                      if (e.target.value === "__new__") {
                        setShowInlineClient(true);
                        setFormData({...formData, client_id: ""});
                      } else {
                        setFormData({...formData, client_id: e.target.value});
                        setShowInlineClient(false);
                      }
                    }}
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="">Select Customer</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="__new__">+ Create New Client</option>
                  </select>

                  {/* Inline client creation panel */}
                  {showInlineClient && (
                    <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">New Client Details</p>
                      <input
                        type="text"
                        required
                        placeholder="Client Name*"
                        value={inlineClientData.name}
                        onChange={e => setInlineClientData({...inlineClientData, name: e.target.value})}
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Contact Person"
                        value={inlineClientData.contact_person}
                        onChange={e => setInlineClientData({...inlineClientData, contact_person: e.target.value})}
                        className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="tel" placeholder="Phone" value={inlineClientData.phone} onChange={e => setInlineClientData({...inlineClientData, phone: e.target.value})} className="p-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg" />
                        <input type="email" placeholder="Email" value={inlineClientData.email} onChange={e => setInlineClientData({...inlineClientData, email: e.target.value})} className="p-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg" />
                      </div>
                      <input type="text" placeholder="Address" value={inlineClientData.address} onChange={e => setInlineClientData({...inlineClientData, address: e.target.value})} className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg" />
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          disabled={savingClient || !inlineClientData.name.trim()}
                          onClick={async () => {
                            setSavingClient(true);
                            try {
                              const newClient = await clientService.createClient(inlineClientData);
                              setClients(prev => [...prev, newClient]);
                              setFormData({...formData, client_id: newClient.id});
                              setShowInlineClient(false);
                              setInlineClientData({ name: "", contact_person: "", phone: "", email: "", address: "" });
                              showToast(`Client "${newClient.name}" created and selected!`, "success");
                            } catch (err: any) {
                              setSubmitError(err.message || "Failed to create client");
                            } finally {
                              setSavingClient(false);
                            }
                          }}
                          className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {savingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Save Client
                        </button>
                        <button type="button" onClick={() => { setShowInlineClient(false); setFormData({...formData, client_id: ""}); }} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:opacity-80">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Workflow Status*</label>
                  <select required value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <option value="planning">Planning State</option>
                    <option value="active">Active Execution</option>
                    <option value="on_hold">On Hold</option>
                    <option value="delayed">Delayed Schedule</option>
                    <option value="completed">Completed Installation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Scheduled Start Date</label>
                  <input type="date" value={formData.start_date} onChange={e=>setFormData({...formData, start_date: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Target End Date</label>
                  <input type="date" value={formData.end_date} onChange={e=>setFormData({...formData, end_date: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Project Budget ($)*</label>
                  <input type="number" required min="0" value={formData.budget || ""} onChange={e=>setFormData({...formData, budget: parseFloat(e.target.value) || 0})} placeholder="25000" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Site Location/Address</label>
                  <input type="text" value={formData.site_location} onChange={e=>setFormData({...formData, site_location: e.target.value})} placeholder="Andheri East, Flat 402" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
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
                          className="w-4 h-4 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded"
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

      {/* SPECIFY BOM MATERIAL MODAL */}
      {showBOMModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Specify BOM Material</h3>
              <button onClick={() => setShowBOMModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleAddBOMItem} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Select Material SKU*</label>
                <select required value={newBOMItem.inventory_id} onChange={e=>setNewBOMItem({...newBOMItem, inventory_id: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <option value="">Select Material</option>
                  {inventory.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Required Quantity*</label>
                <input type="number" required min="1" step="any" value={newBOMItem.required_quantity || ""} onChange={e=>setNewBOMItem({...newBOMItem, required_quantity: parseFloat(e.target.value) || 0})} placeholder="e.g. 10" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button type="button" onClick={() => setShowBOMModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST MATERIAL ISSUE MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Request Material Issue</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Issue Quantity*</label>
                <input type="number" required min="1" step="any" value={newRequest.quantity || ""} onChange={e=>setNewRequest({...newRequest, quantity: parseFloat(e.target.value) || 0})} placeholder="e.g. 5" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Internal Notes</label>
                <input type="text" value={newRequest.notes} onChange={e=>setNewRequest({...newRequest, notes: e.target.value})} placeholder="Needed for carpenter woodwork assembly..." className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT ATTACH UPLOAD MODAL */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Attach Blueprint / Photo</h3>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:bg-slate-150 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Document Display Name*</label>
                <input type="text" required value={docName} onChange={e=>setDocName(e.target.value)} placeholder="Kitchen Blueprint PDF" className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Attachment Category*</label>
                  <select value={docCategory} onChange={e=>setDocCategory(e.target.value)} className="w-full p-2.5 text-sm bg-slate-50 border rounded-xl">
                    <option value="design">Blueprint Design</option>
                    <option value="site_photo">Site Photo</option>
                    <option value="invoice">Invoice Receipt</option>
                    <option value="contract">Agreement Contract</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Upload File*</label>
                  <input type="file" ref={fileInputRef} required className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setShowDocModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={uploadingDoc} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 shadow">
                  {uploadingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Attach File
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bulk CSV Projects Import</h3>
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

"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Plus, Folder, Calendar, DollarSign, MapPin, Layers, ChevronDown, ChevronUp, 
  Loader2, ArrowRight, X, Trash2, Edit, CheckSquare, Square, RotateCcw, 
  AlertTriangle, ChevronLeft, ChevronRight, FileText, Upload, Download, Eye, Search,
  Users, Clock, ArrowLeftRight
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { projectService } from "@/services/projectService";
import { clientService } from "@/services/clientService";
import { inventoryService } from "@/services/inventoryService";
import { API_BASE_URL } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { apiRequest } from "@/services/apiClient";

export default function Projects({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  
  // Documents management per project
  const [projectDocs, setProjectDocs] = useState<Record<string, any[]>>({});
  
  // Assignments management
  const [assignments, setAssignments] = useState<Record<string, any[]>>({});
  const [projectCosts, setProjectCosts] = useState<Record<string, any>>({});
  const [auditTrails, setAuditTrails] = useState<Record<string, any[]>>({});
  const [staffList, setStaffList] = useState<any[]>([]);


  const [loading, setLoading] = useState(true);
  const [expandedProj, setExpandedProj] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active, archived
  const [projectStateFilter, setProjectStateFilter] = useState("all"); // planning, active, completed, delayed, on_hold

  // New Project Materials & Transfer state
  const [materialHistory, setMaterialHistory] = useState<Record<string, any[]>>({});
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditHistoryModal, setShowEditHistoryModal] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [tempCompletion, setTempCompletion] = useState<Record<string, number>>({});
  const sliderTimeoutRefs = useRef<Record<string, any>>({});
  
  // Add Material form states
  const [addMaterialTab, setAddMaterialTab] = useState<"existing" | "new">("existing");
  const [existingMaterialForm, setExistingMaterialForm] = useState({ inventory_id: "", quantity: 1, action: "used", notes: "", reason: "" });
  const [newMaterialForm, setNewMaterialForm] = useState({
    name: "", category_id: "", sku: "", barcode: "", brand: "", size_variant: "", unit: "Sheets", minimum_stock_level: 5, unit_cost: 0, quantity: 1, notes: "", reason: ""
  });

  // Transfer form states
  const [transferForm, setTransferForm] = useState({ to_project_id: "", inventory_id: "", quantity: 1, notes: "", reason: "" });
  
  // Edit history form states
  const [editHistoryForm, setEditHistoryForm] = useState({ quantity: 1, action: "used", notes: "", reason: "" });

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
  const [submitLoading, setSubmitLoading] = useState(false);

  // BOM Action States
  const [showBOMActionModal, setShowBOMActionModal] = useState(false);
  const [selectedBOMItem, setSelectedBOMItem] = useState<any>(null);
  const [bomAction, setBOMAction] = useState<"edit" | "increase" | "decrease" | "return" | "transfer" | "delete">("edit");
  const [bomActionForm, setBOMActionForm] = useState({ quantity: 1, reason: "", notes: "", to_project_id: "" });
  const [showBOMHistoryModal, setShowBOMHistoryModal] = useState(false);
  const [bomHistoryItem, setBomHistoryItem] = useState<any>(null);

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

  const isManagerOrHigher = ["admin", "manager", "project_manager", "factory_manager", "hr_manager"].includes(role);
  const isAdmin = role === "admin";

  const fetchData = async () => {
    try {
      const includeDeleted = statusFilter === "archived";
      const headers = { Authorization: `Bearer ${token}` };
      
      let projData = [];
      let clientData = [];
      let invData = [];
      let fieldsData = [];
      let staffData = [];
      let catData = [];

      if (isManagerOrHigher) {
        [projData, clientData, invData, fieldsData, staffData, catData] = await Promise.all([
          projectService.getProjects(includeDeleted),
          clientService.getClients(),
          inventoryService.getInventory(),
          inventoryService.getCustomFields("Project"),
          fetch(`${API_BASE_URL}/api/staff`, { headers }).then(r => r.json()),
          fetch(`${API_BASE_URL}/api/categories`, { headers }).then(r => r.json())
        ]);
      } else {
        projData = await projectService.getProjects(includeDeleted);
      }

      setProjects(projData);
      setClients(clientData);
      setInventory(invData);
      setCustomFields(fieldsData);
      setStaffList(Array.isArray(staffData) ? staffData : []);
      setCategories(Array.isArray(catData) ? catData : []);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch projects database", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleWebsocketEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const msg = customEvent.detail;
      if (msg?.event === "project_change") {
        fetchData();
        if (expandedProj) {
          fetchProjectDocs(expandedProj);
          fetchAssignments(expandedProj);
          fetchAuditTrail(expandedProj);
          fetchCosting(expandedProj);
          fetchMaterialHistory(expandedProj);
        }
      } else if (msg?.event === "project_activity" && msg.data?.project_id === expandedProj) {
        if (expandedProj) {
          fetchAuditTrail(expandedProj);
          fetchProjectDocs(expandedProj);
          fetchCosting(expandedProj);
          fetchData();
        }
      }
    };

    window.addEventListener("erp_websocket_event", handleWebsocketEvent);

    // Fallback polling (every 30 seconds)
    const pollInterval = setInterval(() => {
      fetchData();
      if (expandedProj) {
        fetchAuditTrail(expandedProj);
      }
    }, 30000);

    return () => {
      window.removeEventListener("erp_websocket_event", handleWebsocketEvent);
      clearInterval(pollInterval);
    };
  }, [token, statusFilter, expandedProj]);

  // Fetch project specific documents, assignments, and materials history when expanded
  useEffect(() => {
    if (expandedProj) {
      fetchProjectDocs(expandedProj);
      fetchAssignments(expandedProj);
      fetchAuditTrail(expandedProj);
      fetchCosting(expandedProj);
      fetchMaterialHistory(expandedProj);
    }
  }, [expandedProj]);

  const fetchCosting = async (projId: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/costing`, { headers });
      if (res.ok) {
        const data = await res.json();
        setProjectCosts(prev => ({ ...prev, [projId]: data }));
      }
    } catch (e) {
      console.error("Error fetching costing", e);
    }
  };

  const fetchMaterialHistory = async (projId: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/materials/history`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMaterialHistory(prev => ({ ...prev, [projId]: data }));
      }
    } catch (e) {
      console.error("Error fetching material history", e);
    }
  };

  const getReservedStock = (inventoryId: string): number => {
    let reserved = 0;
    projects.forEach(p => {
      if (p.is_deleted) return;
      const bom = p.bom_items?.find((b: any) => b.inventory_id === inventoryId);
      if (bom) {
        const pending = bom.required_quantity - bom.used_quantity;
        if (pending > 0) reserved += pending;
      }
    });
    return reserved;
  };

  const handleRecordUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingMaterialForm.inventory_id || existingMaterialForm.quantity <= 0) {
      setSubmitError("Please select a material and enter a valid quantity.");
      return;
    }
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };
      const url = `${API_BASE_URL}/api/projects/${selectedProject.id}/materials/use?reason=${encodeURIComponent(existingMaterialForm.reason || existingMaterialForm.notes)}`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          inventory_id: existingMaterialForm.inventory_id,
          quantity: existingMaterialForm.quantity,
          action: existingMaterialForm.action,
          notes: existingMaterialForm.notes
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to record usage");
      }
      showToast(`Material ${existingMaterialForm.action === 'used' ? 'used' : 'returned'} successfully`, "success");
      setShowAddMaterialModal(false);
      setExistingMaterialForm({ inventory_id: "", quantity: 1, action: "used", notes: "", reason: "" });
      
      // Reload states
      fetchMaterialHistory(selectedProject.id);
      fetchCosting(selectedProject.id);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to record usage");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCreateNewMaterialAndUse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialForm.name || !newMaterialForm.sku || newMaterialForm.quantity <= 0) {
      setSubmitError("Name, SKU, and quantity are required.");
      return;
    }
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };
      const res = await fetch(`${API_BASE_URL}/api/projects/${selectedProject.id}/materials/add-new`, {
        method: "POST",
        headers,
        body: JSON.stringify(newMaterialForm)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create new material");
      }
      showToast("New material registered and assigned successfully", "success");
      setShowAddMaterialModal(false);
      setNewMaterialForm({
        name: "", category_id: "", sku: "", barcode: "", brand: "", size_variant: "", unit: "Sheets", minimum_stock_level: 5, unit_cost: 0, quantity: 1, notes: "", reason: ""
      });
      
      // Reload states
      fetchMaterialHistory(selectedProject.id);
      fetchCosting(selectedProject.id);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to create new material");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleTransferMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.to_project_id || !transferForm.inventory_id || transferForm.quantity <= 0) {
      setSubmitError("Destination project, material, and quantity are required.");
      return;
    }
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const data = await apiRequest(`/api/projects/materials/transfer?reason=${encodeURIComponent(transferForm.reason || transferForm.notes)}`, {
        method: "POST",
        body: JSON.stringify({
          from_project_id: selectedProject.id,
          to_project_id: transferForm.to_project_id,
          inventory_id: transferForm.inventory_id,
          quantity: transferForm.quantity,
          notes: transferForm.notes
        })
      });
      showToast(data.message || "Material transfer request processed", "success");
      setShowTransferModal(false);
      setTransferForm({ to_project_id: "", inventory_id: "", quantity: 1, notes: "", reason: "" });
      
      // Reload states
      fetchMaterialHistory(selectedProject.id);
      fetchCosting(selectedProject.id);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to transfer material");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editHistoryForm.quantity <= 0) {
      setSubmitError("Quantity must be positive.");
      return;
    }
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      };
      const url = `${API_BASE_URL}/api/projects/${selectedProject.id}/materials/history/${selectedHistoryItem.id}?reason=${encodeURIComponent(editHistoryForm.reason || editHistoryForm.notes)}`;
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          inventory_id: selectedHistoryItem.inventory_id,
          quantity: editHistoryForm.quantity,
          action: editHistoryForm.action,
          notes: editHistoryForm.notes
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update log");
      }
      showToast("Material log updated successfully", "success");
      setShowEditHistoryModal(false);
      setSelectedHistoryItem(null);
      
      // Reload states
      fetchMaterialHistory(selectedProject.id);
      fetchCosting(selectedProject.id);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to update log");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteHistory = async (historyId: string) => {
    if (!window.confirm("Are you sure you want to delete this material log? This will revert the stock and assignment allocations!")) {
      return;
    }
    const reason = window.prompt("Please enter a reason for deleting this history log:");
    if (reason === null) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const url = `${API_BASE_URL}/api/projects/${selectedProject.id}/materials/history/${historyId}?reason=${encodeURIComponent(reason)}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to delete log");
      }
      showToast("Material log deleted and stock reverted successfully", "success");
      fetchMaterialHistory(selectedProject.id);
      fetchCosting(selectedProject.id);
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete log", "error");
    }
  };

  const handleApproveTransfer = async (projId: string, historyId: string) => {
    if (!window.confirm("Are you sure you want to approve this material transfer?")) return;
    try {
      const data = await apiRequest(`/api/projects/materials/transfers/${historyId}/approve`, {
        method: "POST"
      });
      showToast(data.message || "Transfer approved successfully", "success");
      fetchMaterialHistory(projId);
      fetchCosting(projId);
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to approve transfer", "error");
    }
  };

  const handleRejectTransfer = async (projId: string, historyId: string) => {
    const reason = window.prompt("Please enter rejection reason:");
    if (reason === null) return;
    try {
      const data = await apiRequest(`/api/projects/materials/transfers/${historyId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || "Rejected by manager" })
      });
      showToast(data.message || "Transfer rejected successfully", "success");
      fetchMaterialHistory(projId);
      fetchCosting(projId);
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to reject transfer", "error");
    }
  };

  const fetchAuditTrail = async (projId: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/audit-trail`, { headers });
      if (!res.ok) throw new Error("Failed to fetch audit trail");
      const data = await res.json();
      setAuditTrails(prev => ({ ...prev, [projId]: data }));
    } catch (e) {
      console.error("Error fetching audit trail for project", projId, e);
    }
  };

  const fetchProjectDocs = async (projId: string) => {
    try {
      const docs = await projectService.getDocuments("Project", projId);
      setProjectDocs(prev => ({ ...prev, [projId]: docs }));
    } catch (e) {
      console.error("Error fetching docs for project", projId);
    }
  };

  const fetchAssignments = async (projId: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/assignments`, { headers });
      const data = await res.json();
      setAssignments(prev => ({ ...prev, [projId]: data }));
    } catch (e) {
      console.error("Error fetching assignments", e);
    }
  };


  const handleAssignWorker = async (projId: string, userId: string) => {
    if (!userId) return;
    try {
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/assignments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ project_id: projId, user_id: userId })
      });
      if (!res.ok) throw new Error("Failed to assign worker");
      showToast("Worker assigned to project successfully", "success");
      fetchAssignments(projId);
    } catch (e: any) {
      showToast(e.message || "Failed to assign worker", "error");
    }
  };

  const handleUnassignWorker = async (projId: string, userId: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/assignments/${userId}`, {
        method: "DELETE",
        headers
      });
      if (!res.ok) throw new Error("Failed to unassign worker");
      showToast("Worker unassigned from project", "info");
      fetchAssignments(projId);
    } catch (e: any) {
      showToast(e.message || "Failed to unassign worker", "error");
    }
  };

  const handleUpdateProgressMode = async (projId: string, mode: string) => {
    try {
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/progress-mode`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ progress_mode: mode })
      });
      if (res.ok) {
        showToast(`Project progress mode set to ${mode}!`, "success");
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to update progress mode", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Failed to update progress mode", "error");
    }
  };

  const handleUpdateCompletion = async (projId: string, pct: number) => {
    try {
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const res = await fetch(`${API_BASE_URL}/api/projects/${projId}/completion`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ completion_percentage: pct })
      });
      if (res.ok) {
        showToast("Project completion percentage updated!", "success");
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to update completion percentage", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Failed to update completion percentage", "error");
    }
  };

  const handleBOMAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedBOMItem) return;
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      let url = "";
      let method = "POST";
      let body: any = null;

      if (bomAction === "edit") {
        url = `${API_BASE_URL}/api/projects/${selectedProject.id}/bom/${selectedBOMItem.id}`;
        method = "PUT";
        body = { required_quantity: bomActionForm.quantity };
      } else if (bomAction === "delete") {
        url = `${API_BASE_URL}/api/projects/${selectedProject.id}/bom/${selectedBOMItem.id}`;
        method = "DELETE";
      } else if (bomAction === "increase") {
        url = `${API_BASE_URL}/api/projects/${selectedProject.id}/materials/use?reason=${encodeURIComponent(bomActionForm.reason)}`;
        body = {
          inventory_id: selectedBOMItem.inventory_id,
          quantity: bomActionForm.quantity,
          action: "used",
          notes: bomActionForm.notes
        };
      } else if (bomAction === "decrease" || bomAction === "return") {
        url = `${API_BASE_URL}/api/projects/${selectedProject.id}/materials/use?reason=${encodeURIComponent(bomActionForm.reason)}`;
        body = {
          inventory_id: selectedBOMItem.inventory_id,
          quantity: bomActionForm.quantity,
          action: "returned",
          notes: bomActionForm.notes
        };
      } else if (bomAction === "transfer") {
        url = `${API_BASE_URL}/api/projects/materials/transfer?reason=${encodeURIComponent(bomActionForm.reason)}`;
        body = {
          from_project_id: selectedProject.id,
          to_project_id: bomActionForm.to_project_id,
          inventory_id: selectedBOMItem.inventory_id,
          quantity: bomActionForm.quantity,
          notes: bomActionForm.notes
        };
      }

      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      if (res.ok) {
        showToast(`Material allocation action '${bomAction}' executed successfully!`, "success");
        setShowBOMActionModal(false);
        fetchData();
        if (selectedProject) {
          fetchAssignments(selectedProject.id);
        }
      } else {
        const err = await res.json();
        throw new Error(err.detail || `Failed to perform action ${bomAction}`);
      }
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred");
      showToast(err.message || "Operation failed", "error");
    } finally {
      setSubmitLoading(false);
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
            const completedBOMCount = (proj.bom_items || []).filter((b: any) => b.status === "fulfilled").length;
            const totalBOMCount = (proj.bom_items || []).length;
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
                        {formatCurrency(proj.budget)}
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
                      
                      {/* PROJECT MATERIALS Ledger panel */}
                      <div className="lg:col-span-3 glass rounded-2xl p-5 border border-slate-200/50 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-indigo-500" />
                            PROJECT MATERIALS
                          </h4>
                          {isManagerOrHigher && statusFilter === "active" && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setSubmitError(""); setShowBOMModal(true); }}
                                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 rounded-xl font-bold flex items-center gap-1.5 shadow-sm text-xs transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Specify BOM
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setSubmitError(""); setShowAddMaterialModal(true); }}
                                className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm text-xs transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Material
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setSubmitError(""); setShowTransferModal(true); }}
                                className="px-3.5 py-1.5 bg-amber-650 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm text-xs transition-all"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                Transfer Material
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="overflow-x-auto scrollbar-thin">
                          <table className="w-full text-left text-xs font-medium border-collapse min-w-[1100px]">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 pb-2 text-[10px] uppercase font-bold">
                                <th className="pb-2">Material Name</th>
                                <th className="pb-2">Category</th>
                                <th className="pb-2">SKU</th>
                                <th className="pb-2">Unit</th>
                                <th className="pb-2">Allocated Qty</th>
                                <th className="pb-2">Used Qty</th>
                                <th className="pb-2">Returned Qty</th>
                                <th className="pb-2">Remaining Qty</th>
                                <th className="pb-2">Current Inventory Qty</th>
                                <th className="pb-2">Reserved Qty</th>
                                <th className="pb-2">Cost</th>
                                <th className="pb-2">Last Updated</th>
                                <th className="pb-2">Updated By</th>
                                <th className="pb-2">Location</th>
                                <th className="pb-2">Warning</th>
                                <th className="pb-2">Status</th>
                                {isManagerOrHigher && statusFilter === "active" && <th className="pb-2 text-right">Action</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[11px]">
                              {(proj.bom_items || []).length > 0 ? (
                                (proj.bom_items || []).map((bom: any) => {
                                  const returnedQty = (materialHistory[proj.id] || [])
                                    .filter(h => h.inventory_id === bom.inventory_id && h.action === "returned")
                                    .reduce((acc, h) => acc + h.quantity, 0);
                                  const pendingQty = Math.max(0, bom.required_quantity - bom.used_quantity);
                                  const materialCostVal = bom.used_quantity * (bom.inventory?.unit_cost || 0);
                                  const isLowStock = bom.inventory ? bom.inventory.quantity < bom.inventory.minimum_stock_level : false;
                                  const reservedQty = getReservedStock(bom.inventory_id);
                                  
                                  const materialLogs = (materialHistory[proj.id] || [])
                                    .filter((h: any) => h.inventory_id === bom.inventory_id);
                                  const lastLog = materialLogs.length > 0 ? materialLogs[0] : null;
                                  const lastUpdated = lastLog ? new Date(lastLog.created_at).toLocaleDateString("en-IN") : "—";
                                  const updatedBy = lastLog ? lastLog.username : "—";

                                  return (
                                    <tr key={bom.id} className="hover:bg-slate-50/30">
                                      <td className="py-3 font-semibold text-slate-850 dark:text-slate-200">{bom.inventory?.name || "—"}</td>
                                      <td className="py-3 text-slate-500">{bom.inventory?.category?.name || "General"}</td>
                                      <td className="py-3 text-slate-400 font-mono text-[10px]">{bom.inventory?.sku || "—"}</td>
                                      <td className="py-3 text-slate-500">{bom.inventory?.unit || "—"}</td>
                                      <td className="py-3 font-semibold text-slate-500">{bom.required_quantity}</td>
                                      <td className="py-3 text-indigo-650 dark:text-indigo-400 font-semibold">{bom.used_quantity}</td>
                                      <td className="py-3 text-orange-600 font-semibold">{returnedQty}</td>
                                      <td className="py-3 text-amber-600 font-semibold">{pendingQty}</td>
                                      <td className="py-3 font-semibold text-slate-500">{bom.inventory?.quantity || 0}</td>
                                      <td className="py-3 font-semibold text-slate-500">{reservedQty}</td>
                                      <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{formatCurrency(materialCostVal)}</td>
                                      <td className="py-3 text-slate-500 font-medium">{lastUpdated}</td>
                                      <td className="py-3 text-slate-600 font-semibold">{updatedBy}</td>
                                      <td className="py-3 text-slate-500 font-mono text-[10px]">{bom.inventory?.location || "Warehouse"}</td>
                                      <td className="py-3">
                                        {isLowStock ? (
                                          <span className="flex items-center gap-1 text-red-500 font-bold text-[9px] animate-pulse">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Low Stock
                                          </span>
                                        ) : (
                                          <span className="text-emerald-500 font-bold text-[9px]">Normal</span>
                                        )}
                                      </td>
                                      <td className="py-3">
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
                                        <td className="py-3 text-right">
                                          <div className="flex justify-end gap-1.5 flex-wrap">
                                            <button
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedProject(proj); 
                                                setSelectedBOMItem(bom); 
                                                setBOMAction("edit");
                                                setBOMActionForm({ quantity: bom.required_quantity, reason: "", notes: "", to_project_id: "" });
                                                setSubmitError("");
                                                setShowBOMActionModal(true); 
                                              }}
                                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[9px]"
                                              title="Edit Allocated Quantity"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedProject(proj); 
                                                setSelectedBOMItem(bom); 
                                                setBOMAction("increase");
                                                setBOMActionForm({ quantity: 1, reason: "", notes: "", to_project_id: "" });
                                                setSubmitError("");
                                                setShowBOMActionModal(true); 
                                              }}
                                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded text-[9px]"
                                              title="Deduct (Use) stock"
                                            >
                                              + Qty
                                            </button>
                                            <button
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedProject(proj); 
                                                setSelectedBOMItem(bom); 
                                                setBOMAction("decrease");
                                                setBOMActionForm({ quantity: 1, reason: "", notes: "", to_project_id: "" });
                                                setSubmitError("");
                                                setShowBOMActionModal(true); 
                                              }}
                                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold rounded text-[9px]"
                                              title="Return stock"
                                            >
                                              - Qty
                                            </button>
                                            <button
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedProject(proj); 
                                                setSelectedBOMItem(bom); 
                                                setBOMAction("transfer");
                                                setBOMActionForm({ quantity: 1, reason: "", notes: "", to_project_id: "" });
                                                setSubmitError("");
                                                setShowBOMActionModal(true); 
                                              }}
                                              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded text-[9px]"
                                              title="Transfer to another project"
                                            >
                                              Transfer
                                            </button>
                                            <button
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedProject(proj); 
                                                setSelectedBOMItem(bom); 
                                                setBOMAction("delete");
                                                setBOMActionForm({ quantity: 0, reason: "", notes: "", to_project_id: "" });
                                                setSubmitError("");
                                                setShowBOMActionModal(true); 
                                              }}
                                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded text-[9px]"
                                              title="Delete Allocation"
                                            >
                                              Delete
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setBomHistoryItem(bom);
                                                setShowBOMHistoryModal(true);
                                              }}
                                              className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-600 font-bold rounded text-[9px]"
                                              title="View Transaction History"
                                            >
                                              History
                                            </button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={17} className="py-4 text-center text-slate-400">No project materials registered yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* PROJECT MATERIAL HISTORY TIMELINE */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
                          <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            Project Material History
                          </h5>

                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {(materialHistory[proj.id] || []).length > 0 ? (
                              (materialHistory[proj.id] || []).map((log: any) => {
                                const logTime = new Date(log.created_at).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true
                                });
                                const isSuperAdmin = role === "admin";

                                return (
                                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200/40 rounded-2xl text-xs gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-slate-400 font-bold font-mono">{logTime}</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-200">{log.username || "Staff"}</span>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                        log.action === "used" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                        log.action === "returned" ? "bg-orange-50 text-orange-600 border border-orange-100" :
                                        log.action === "transferred_in" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                        "bg-rose-50 text-rose-600 border border-rose-100"
                                      )}>
                                        {log.action.replace("_", " ")}
                                      </span>
                                      <span className="font-semibold text-indigo-650 dark:text-indigo-400">{log.quantity} {log.inventory?.unit || ""}</span>
                                      <span className="text-slate-500 font-bold">{log.inventory?.name}</span>
                                      {log.status === "pending" && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-100 animate-pulse">
                                          Pending Approval
                                        </span>
                                      )}
                                      {log.status === "rejected" && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-100 text-rose-705 border border-rose-200">
                                          Rejected
                                        </span>
                                      )}
                                      {log.notes && <span className="text-slate-400 italic text-[11px]">— "{log.notes}"</span>}
                                    </div>

                                    {log.status === "pending" && isManagerOrHigher ? (
                                      <div className="flex gap-1.5 self-end sm:self-center">
                                        <button
                                          onClick={() => handleApproveTransfer(proj.id, log.id)}
                                          className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleRejectTransfer(proj.id, log.id)}
                                          className="px-2.5 py-1 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    ) : (
                                      isSuperAdmin && log.status !== "rejected" && (
                                        <div className="flex gap-1.5 self-end sm:self-center">
                                          <button
                                            onClick={() => {
                                              setSelectedProject(proj);
                                              setSelectedHistoryItem(log);
                                              setEditHistoryForm({
                                                quantity: log.quantity,
                                                action: log.action,
                                                notes: log.notes || "",
                                                reason: ""
                                              });
                                              setSubmitError("");
                                              setShowEditHistoryModal(true);
                                            }}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600"
                                            title="Edit Log"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => {
                                              setSelectedProject(proj);
                                              handleDeleteHistory(log.id);
                                            }}
                                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-400 hover:text-rose-600"
                                            title="Delete Log"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-center py-6 text-slate-400 text-[11px]">No materials tracking history logged for this project.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Documents panel */}
                      <div className="lg:col-span-2 glass rounded-2xl p-5 border border-slate-200/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-indigo-500" />
                              Attached Blueprints & Photos
                            </h4>
                            {statusFilter === "active" && isManagerOrHigher && (
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
                                    {isManagerOrHigher && (
                                      <button
                                        onClick={() => handleDeleteDoc(doc.id, proj.id)}
                                        className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600"
                                        title="Remove attachment"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-6 text-slate-400 text-[11px]">No documents attached to this project record.</div>
                            )}
                          </div>
                        </div>

                        {/* Project Operations Actions */}
                        {isManagerOrHigher && (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-black">Admin Actions</span>
                            <div className="flex gap-2">
                              {statusFilter === "active" ? (
                                <>
                                  <button onClick={() => handleOpenEdit(proj)} className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-indigo-500 text-xs font-bold shadow-sm">
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
                        )}
                      </div>                      <div className="glass rounded-2xl p-5 border border-slate-200/50 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <DollarSign className="w-4 h-4 text-indigo-500" />
                            Financial Costing Ledger
                          </h4>

                          {projectCosts[proj.id] ? (
                            <div className="space-y-3 text-xs font-semibold">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Project Budget</span>
                                <span className="text-slate-850 dark:text-slate-200">{formatCurrency(projectCosts[proj.id].estimated_cost)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-100 dark:border-slate-850/30 pt-2">
                                <span className="text-slate-400">Material Cost</span>
                                <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(projectCosts[proj.id].material_cost)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-100 dark:border-slate-850/30 pt-2">
                                <span className="text-slate-400">Labour Cost</span>
                                <span className="text-amber-600 dark:text-amber-400">{formatCurrency(projectCosts[proj.id].labour_cost)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-100 dark:border-slate-855/30 pt-2">
                                <span className="text-slate-400">Site Expenses</span>
                                <span className="text-rose-600 dark:text-rose-400">{formatCurrency(projectCosts[proj.id].expenses)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-100 dark:border-slate-855/30 pt-2">
                                <span className="text-slate-400">Transport Cost</span>
                                <span className="text-sky-655 dark:text-sky-400">{formatCurrency(projectCosts[proj.id].transport_cost)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-100 dark:border-slate-855/30 pt-2">
                                <span className="text-slate-400">Misc Cost</span>
                                <span className="text-purple-650 dark:text-purple-400">{formatCurrency(projectCosts[proj.id].misc_cost)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-150 dark:border-slate-800 pt-2 font-bold">
                                <span className="text-slate-500">Total Project Cost</span>
                                <span className="text-slate-800 dark:text-slate-200">{formatCurrency(projectCosts[proj.id].total_cost)}</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-black text-[12px]">
                                <span className="text-slate-500">Remaining Budget</span>
                                <span className={cn(projectCosts[proj.id].remaining_budget >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                  {formatCurrency(projectCosts[proj.id].remaining_budget)}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-black text-[12px]">
                                <span className="text-slate-500">Profit Estimate</span>
                                <span className={cn(projectCosts[proj.id].profit_loss >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                  {projectCosts[proj.id].profit_loss >= 0 ? "Profit" : "Loss"}: {formatCurrency(Math.abs(projectCosts[proj.id].profit_loss))}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-slate-400 text-xs">Loading costing data...</div>
                          )}
                        </div>
                      </div>

                      {/* Project Resource Ledger */}
                      <div className="lg:col-span-3 glass rounded-2xl p-5 border border-slate-200/50 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-indigo-500" />
                            Project Resource Ledger
                          </h4>
                          <span className={cn("px-2.5 py-0.5 border rounded-full text-[10px] uppercase font-bold", getStatusBadgeClass(proj.status))}>
                            {proj.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-bold">Project Name</span>
                            <span className="text-slate-800 dark:text-slate-200 text-sm font-bold block mt-1">{proj.name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-bold">Client</span>
                            <span className="text-indigo-600 dark:text-indigo-400 text-sm font-bold block mt-1">{proj.client?.name || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-bold">Start Date</span>
                            <span className="text-slate-850 dark:text-slate-250 mt-1 block">{proj.start_date ? new Date(proj.start_date).toLocaleDateString() : "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-bold">Due Date</span>
                            <span className="text-slate-850 dark:text-slate-250 mt-1 block">{proj.end_date ? new Date(proj.end_date).toLocaleDateString() : "N/A"}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-bold">Managers</span>
                            <span className="text-slate-800 dark:text-slate-200 block mt-1 space-y-1">
                              {(assignments[proj.id] || [])
                                .filter((a: any) => ["manager", "project_manager", "factory_manager", "admin"].includes(a.user?.role))
                                .map((a: any) => a.user?.full_name)
                                .join(", ") || "None Assigned"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-bold">Supervisors</span>
                            <span className="text-slate-800 dark:text-slate-200 block mt-1">
                              {(assignments[proj.id] || [])
                                .filter((a: any) => ["supervisor", "store", "store_manager"].includes(a.user?.role))
                                .map((a: any) => a.user?.full_name)
                                .join(", ") || "None Assigned"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-bold">Assigned Employees</span>
                            <span className="text-slate-800 dark:text-slate-200 block mt-1">
                              {(assignments[proj.id] || [])
                                .filter((a: any) => !["manager", "project_manager", "factory_manager", "admin", "supervisor", "store", "store_manager"].includes(a.user?.role))
                                .map((a: any) => a.user?.full_name)
                                .join(", ") || "None Assigned"}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Completion Percentage ({proj.completion_percentage || 0}%)</span>
                              {isManagerOrHigher && statusFilter === "active" && (
                                <select
                                  value={proj.progress_mode || "manual"}
                                  onChange={(e) => handleUpdateProgressMode(proj.id, e.target.value)}
                                  className="text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 outline-none cursor-pointer"
                                >
                                  <option value="manual">Manual</option>
                                  <option value="auto">Auto</option>
                                </select>
                              )}
                            </div>
                            <span className="text-[10px] text-indigo-500 font-bold">{proj.progress_mode === "auto" ? "Auto-Calculated" : "Manual Adjustment"}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${tempCompletion[proj.id] !== undefined ? tempCompletion[proj.id] : (proj.completion_percentage || 0)}%` }}
                              ></div>
                            </div>
                            {isManagerOrHigher && statusFilter === "active" && (
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={tempCompletion[proj.id] !== undefined ? tempCompletion[proj.id] : (proj.completion_percentage || 0)} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setTempCompletion(prev => ({ ...prev, [proj.id]: val }));
                                  if (sliderTimeoutRefs.current[proj.id]) {
                                    clearTimeout(sliderTimeoutRefs.current[proj.id]);
                                  }
                                  sliderTimeoutRefs.current[proj.id] = setTimeout(() => {
                                    handleUpdateCompletion(proj.id, val);
                                  }, 400);
                                }}
                                disabled={proj.progress_mode === "auto"}
                                className={`w-32 accent-indigo-600 ${proj.progress_mode === "auto" ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                                title={proj.progress_mode === "auto" ? "Calculated from daily logs & BOM items" : "Slide to adjust progress"}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Worker Assignments panel */}
                      <div className="lg:col-span-3 glass rounded-2xl p-5 border border-slate-200/50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-indigo-500" />
                            Assigned Factory Workers & Staff
                          </h4>
                          {isManagerOrHigher && statusFilter === "active" && (
                            <div className="flex items-center gap-2">
                              <select
                                onChange={(e) => {
                                  handleAssignWorker(proj.id, e.target.value);
                                  e.target.value = "";
                                }}
                                className="p-1.5 bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold outline-none cursor-pointer"
                              >
                                <option value="">+ Assign Staff</option>
                                {staffList
                                  .filter(s => s.user_id && !((assignments[proj.id] || []).some((a: any) => a.user_id === s.user_id)))
                                  .map(s => (
                                    <option key={s.user_id} value={s.user_id}>{s.name} ({s.role})</option>
                                  ))
                                }
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(assignments[proj.id] || []).length > 0 ? (
                            (assignments[proj.id] || []).map((assign: any) => (
                              <div key={assign.id} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 rounded-full text-xs font-semibold shadow-sm">
                                <span className="text-slate-800 dark:text-slate-200">{assign.user?.full_name || "Employee"}</span>
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">
                                  {assign.user?.role || "worker"}
                                </span>
                                {isManagerOrHigher && statusFilter === "active" && (
                                  <button
                                    onClick={() => handleUnassignWorker(proj.id, assign.user_id)}
                                    className="text-rose-500 hover:text-rose-700 transition-colors ml-1 p-0.5"
                                    title="Unassign employee"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-400 text-xs py-2">No workers or staff assigned to this project yet.</div>
                          )}
                        </div>
                      </div>

                      {/* Project Activity Timeline */}
                      <div className="lg:col-span-3 glass rounded-2xl p-5 border border-slate-200/50 mt-4 bg-slate-50/50 dark:bg-slate-900/10">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-indigo-500 animate-spin-slow" />
                            Project Activity Timeline (Real-Time Timeline)
                          </h4>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                            Live Updates Enable
                          </span>
                        </div>

                        <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-thin pr-2 text-left">
                          {(auditTrails[proj.id] || []).length > 0 ? (
                            (auditTrails[proj.id] || []).map((audit: any) => {
                              const dt = new Date(audit.created_at);
                              const serverTimeStr = dt.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });
                              const serverDateStr = dt.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' });
                              
                              let imagesList: string[] = [];
                              if (audit.images) {
                                try {
                                  imagesList = JSON.parse(audit.images);
                                } catch(e) {
                                  imagesList = [];
                                }
                              }
                              
                              return (
                                <div key={audit.id} className="flex gap-4 items-start p-3 bg-white dark:bg-slate-900 border border-slate-200/30 rounded-2xl shadow-sm hover:shadow transition-shadow">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                                    {(audit.user?.full_name || "Employee").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                                  </div>
                                  
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                      <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {audit.user?.full_name || "Unknown User"} 
                                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                                          ({audit.user?.department || "Production"})
                                        </span>
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {serverDateStr} • {serverTimeStr}
                                      </span>
                                    </div>
                                    
                                    <div className="text-xs text-slate-655 dark:text-slate-300 font-medium">
                                      <span className="text-indigo-650 dark:text-indigo-400 font-semibold">{audit.action}</span>: {audit.details}
                                    </div>

                                    {(audit.old_value || audit.new_value) && (
                                      <div className="flex items-center gap-2 text-[10px] font-semibold bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-lg w-max max-w-full">
                                        {audit.old_value && (
                                          <span className="text-slate-400 line-through truncate max-w-[150px]">{audit.old_value}</span>
                                        )}
                                        {audit.old_value && audit.new_value && <span>→</span>}
                                        {audit.new_value && (
                                          <span className="text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">{audit.new_value}</span>
                                        )}
                                      </div>
                                    )}

                                    {audit.action === "Upload Document" && audit.new_value && (
                                      <a href={`${API_BASE_URL}${audit.new_value}`} target="_blank" rel="noreferrer" 
                                        className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline bg-indigo-50/50 p-1.5 rounded-lg mt-1 font-bold">
                                        <FileText className="w-3.5 h-3.5" /> View Uploaded Document
                                      </a>
                                    )}

                                    {imagesList.length > 0 && (
                                      <div className="flex gap-2 flex-wrap mt-2">
                                        {imagesList.map((img: string, i: number) => (
                                          <a key={i} href={`${API_BASE_URL}${img}`} target="_blank" rel="noreferrer">
                                            <img src={`${API_BASE_URL}${img}`} alt="activity-work" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                                          </a>
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/40 mt-2">
                                      <span>Device Time: {audit.device_time || "N/A"}</span>
                                      <span>Server Time: {serverTimeStr}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-slate-400 text-xs py-4 text-center">No real-time activities recorded on this project yet.</div>
                          )}
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
              <button title="Close" onClick={() => setShowFormModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
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
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Project Budget (₹)*</label>
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
                <button title="Close" type="button" onClick={() => setShowFormModal(false)} className="px-5 py-2.5 text-sm border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
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
              <button title="Close" onClick={() => setShowBOMModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
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
                <button title="Close" type="button" onClick={() => setShowBOMModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
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
              <button title="Close" onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
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
                <button title="Close" type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOM HISTORY MODAL */}
      {showBOMHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Material Transaction History</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{bomHistoryItem?.inventory?.name} ({bomHistoryItem?.inventory?.sku})</p>
              </div>
              <button onClick={() => { setShowBOMHistoryModal(false); setBomHistoryItem(null); }} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {(() => {
                const logs = (materialHistory[selectedProject?.id] || []).filter((h: any) => h.inventory_id === bomHistoryItem?.inventory_id);
                if (logs.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No transaction history logs found for this item in this project.
                    </div>
                  );
                }
                return (
                  <div className="space-y-3.5">
                    {logs.map((log: any) => {
                      const dateStr = new Date(log.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      });
                      return (
                        <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 rounded-2xl text-xs space-y-1.5">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <span className={cn(
                              "font-black uppercase text-[9px] px-2 py-0.5 rounded-full",
                              log.action === "used" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600" :
                              log.action === "returned" ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600" :
                              "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600"
                            )}>
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{dateStr}</span>
                          </div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            Quantity: <span className="font-extrabold">{log.quantity}</span> {bomHistoryItem?.inventory?.unit || "Units"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Logged by: <span className="font-bold text-slate-600 dark:text-slate-400">{log.username || "Employee"}</span>
                          </div>
                          {log.notes && (
                            <div className="text-[10px] text-slate-400 italic bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                              Notes: {log.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
              <button type="button" onClick={() => { setShowBOMHistoryModal(false); setBomHistoryItem(null); }} className="px-4 py-2 border rounded-xl text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* BOM ACTION MODAL */}
      {showBOMActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-101 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold capitalize text-slate-900 dark:text-white">{bomAction} Allocation</h3>
              <button title="Close" type="button" onClick={() => setShowBOMActionModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleBOMAction} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Material Name</label>
                <input 
                  type="text" 
                  disabled 
                  value={selectedBOMItem?.inventory?.name || ""} 
                  className="w-full p-2.5 text-sm bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 cursor-not-allowed" 
                />
              </div>

              {bomAction === "delete" ? (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200/50 rounded-xl">
                  Are you sure you want to delete this allocation?
                  {selectedBOMItem?.used_quantity > 0 && (
                    <p className="mt-1 font-bold">
                      Note: The issued/used quantity of {selectedBOMItem.used_quantity} {selectedBOMItem.inventory?.unit} will be returned to the warehouse inventory.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {bomAction === "transfer" && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">Destination Project*</label>
                      <select
                        required
                        value={bomActionForm.to_project_id}
                        onChange={e => setBOMActionForm({ ...bomActionForm, to_project_id: e.target.value })}
                        className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                      >
                        <option value="">Select Project</option>
                        {projects.filter(p => p.id !== selectedProject?.id && !p.is_deleted).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      {bomAction === "edit" ? "Allocated Required Qty*" :
                       bomAction === "increase" ? "Quantity to Deduct (Use)*" :
                       bomAction === "decrease" ? "Quantity to Decrease*" :
                       bomAction === "return" ? "Quantity to Return*" :
                       "Quantity*"}
                    </label>
                    <input 
                      type="number" 
                      required 
                      min="0.01" 
                      step="any" 
                      value={bomActionForm.quantity || ""} 
                      onChange={e => setBOMActionForm({ ...bomActionForm, quantity: parseFloat(e.target.value) || 0 })} 
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none" 
                    />
                  </div>

                  {bomAction !== "edit" && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">Reason*</label>
                        <input 
                          type="text" 
                          required 
                          value={bomActionForm.reason} 
                          onChange={e => setBOMActionForm({ ...bomActionForm, reason: e.target.value })} 
                          placeholder="e.g. damaged during install / extra needed" 
                          className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none" 
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">Notes</label>
                        <input 
                          type="text" 
                          value={bomActionForm.notes} 
                          onChange={e => setBOMActionForm({ ...bomActionForm, notes: e.target.value })} 
                          placeholder="Additional commentary (optional)" 
                          className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none" 
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button title="Close" type="button" onClick={() => setShowBOMActionModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={submitLoading} className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1 ${bomAction === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-650 hover:bg-indigo-700"}`}>
                  {submitLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  {bomAction === "delete" ? "Confirm Delete" : "Save Changes"}
                </button>
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
              <button title="Close" onClick={() => setShowDocModal(false)} className="text-slate-400 hover:bg-slate-150 p-1.5 rounded"><X className="w-5 h-5" /></button>
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
                <button title="Close" type="button" onClick={() => setShowDocModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
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
              <button title="Close" onClick={() => setShowImportModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}
            {importSuccess && <div className="bg-emerald-500/10 text-emerald-600 p-2.5 border rounded-lg text-xs mb-3">{importSuccess}</div>}

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
          </div>
        </div>
      )}

      {/* ADD MATERIAL MODAL */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-105 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold">Add Material to Project</h3>
              <button title="Close" onClick={() => setShowAddMaterialModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            {/* Tab navigation */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 mb-4">
              <button
                type="button"
                onClick={() => setAddMaterialTab("existing")}
                className={cn(
                  "flex-1 pb-2 text-xs font-bold transition-all border-b-2",
                  addMaterialTab === "existing" ? "border-indigo-650 text-indigo-650" : "border-transparent text-slate-400"
                )}
              >
                Existing Inventory Item
              </button>
              <button
                type="button"
                onClick={() => setAddMaterialTab("new")}
                className={cn(
                  "flex-1 pb-2 text-xs font-bold transition-all border-b-2",
                  addMaterialTab === "new" ? "border-indigo-650 text-indigo-650" : "border-transparent text-slate-400"
                )}
              >
                Create New Material
              </button>
            </div>

            {addMaterialTab === "existing" ? (
              <form onSubmit={handleRecordUsage} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Select Material SKU*</label>
                  <select
                    required
                    value={existingMaterialForm.inventory_id}
                    onChange={e => setExistingMaterialForm({ ...existingMaterialForm, inventory_id: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="">Select Material</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku}) — WH Stock: {item.quantity} {item.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Quantity*</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={existingMaterialForm.quantity || ""}
                      onChange={e => setExistingMaterialForm({ ...existingMaterialForm, quantity: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 10"
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Action Type*</label>
                    <select
                      required
                      value={existingMaterialForm.action}
                      onChange={e => setExistingMaterialForm({ ...existingMaterialForm, action: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    >
                      <option value="used">Deduct (Use)</option>
                      <option value="returned">Return (Add Back)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Deduction / Return Reason*</label>
                  <input
                    type="text"
                    required
                    value={existingMaterialForm.reason}
                    onChange={e => setExistingMaterialForm({ ...existingMaterialForm, reason: e.target.value })}
                    placeholder="Why is this material being issued/returned? (e.g. site carpenter installation)"
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Internal Notes</label>
                  <input
                    type="text"
                    value={existingMaterialForm.notes}
                    onChange={e => setExistingMaterialForm({ ...existingMaterialForm, notes: e.target.value })}
                    placeholder="Additional context/remarks..."
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <button title="Close" type="button" onClick={() => setShowAddMaterialModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                  <button type="submit" disabled={submitLoading} className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1">
                    {submitLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirm Allocate
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateNewMaterialAndUse} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-0.5">Material Name*</label>
                  <input
                    type="text"
                    required
                    value={newMaterialForm.name}
                    onChange={e => setNewMaterialForm({ ...newMaterialForm, name: e.target.value })}
                    placeholder="e.g. Teak Wood Panel"
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-0.5">Category*</label>
                  <select
                    required
                    value={newMaterialForm.category_id}
                    onChange={e => setNewMaterialForm({ ...newMaterialForm, category_id: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">SKU (Unique Identifier)*</label>
                    <input
                      type="text"
                      required
                      value={newMaterialForm.sku}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, sku: e.target.value })}
                      placeholder="e.g. WOOD-TEAK-18"
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Barcode (Optional)</label>
                    <input
                      type="text"
                      value={newMaterialForm.barcode}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, barcode: e.target.value })}
                      placeholder="e.g. 89012345"
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Brand</label>
                    <input
                      type="text"
                      value={newMaterialForm.brand}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, brand: e.target.value })}
                      placeholder="CenturyPly"
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Size Variant</label>
                    <input
                      type="text"
                      value={newMaterialForm.size_variant}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, size_variant: e.target.value })}
                      placeholder="8ft x 4ft x 18mm"
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Unit*</label>
                    <input
                      type="text"
                      required
                      value={newMaterialForm.unit}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, unit: e.target.value })}
                      placeholder="Sheets"
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Alert Level*</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newMaterialForm.minimum_stock_level}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, minimum_stock_level: parseInt(e.target.value) || 0 })}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Unit Cost (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={newMaterialForm.unit_cost}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, unit_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Initial Quantity to Assign*</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={newMaterialForm.quantity}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-0.5">Add Reason*</label>
                    <input
                      type="text"
                      required
                      value={newMaterialForm.reason}
                      onChange={e => setNewMaterialForm({ ...newMaterialForm, reason: e.target.value })}
                      placeholder="e.g. customized living room request"
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-0.5">Internal Notes</label>
                  <input
                    type="text"
                    value={newMaterialForm.notes}
                    onChange={e => setNewMaterialForm({ ...newMaterialForm, notes: e.target.value })}
                    placeholder="Any specific instructions..."
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <button title="Close" type="button" onClick={() => setShowAddMaterialModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                  <button type="submit" disabled={submitLoading} className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1">
                    {submitLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Create & Allocate
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TRANSFER MATERIAL MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-101 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Transfer Project Material</h3>
              <button title="Close" onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleTransferMaterial} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Source Project</label>
                <input
                  type="text"
                  disabled
                  value={selectedProject?.name || ""}
                  className="w-full p-2.5 text-sm bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Select Destination Project*</label>
                <select
                  required
                  value={transferForm.to_project_id}
                  onChange={e => setTransferForm({ ...transferForm, to_project_id: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="">Select Project</option>
                  {projects.filter(p => p.id !== selectedProject?.id && !p.is_deleted).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Select Material to Transfer*</label>
                <select
                  required
                  value={transferForm.inventory_id}
                  onChange={e => setTransferForm({ ...transferForm, inventory_id: e.target.value })}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="">Select Material</option>
                  {selectedProject?.bom_items.map((bom: any) => (
                    <option key={bom.id} value={bom.inventory_id}>
                      {bom.inventory?.name} (Used: {bom.used_quantity} {bom.inventory?.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Transfer Qty*</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={transferForm.quantity || ""}
                    onChange={e => setTransferForm({ ...transferForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Reason for Transfer*</label>
                  <input
                    type="text"
                    required
                    value={transferForm.reason}
                    onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
                    placeholder="e.g. excess stock from site A to B"
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder="Additional transfer notes..."
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button title="Close" type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={submitLoading} className="px-4 py-2 bg-amber-650 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1">
                  {submitLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT HISTORY LOG MODAL */}
      {showEditHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-101 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Material Allocation Log</h3>
              <button title="Close" onClick={() => setShowEditHistoryModal(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 p-2.5 border rounded-lg text-xs mb-3">{submitError}</div>}

            <form onSubmit={handleEditHistory} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Material Item</label>
                <input
                  type="text"
                  disabled
                  value={selectedHistoryItem?.inventory?.name || ""}
                  className="w-full p-2.5 text-sm bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Log Quantity*</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={editHistoryForm.quantity || ""}
                    onChange={e => setEditHistoryForm({ ...editHistoryForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Action Type*</label>
                  <select
                    required
                    value={editHistoryForm.action}
                    onChange={e => setEditHistoryForm({ ...editHistoryForm, action: e.target.value })}
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="used">Deduct (Use)</option>
                    <option value="returned">Return (Add Back)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Reason for Update*</label>
                <input
                  type="text"
                  required
                  value={editHistoryForm.reason}
                  onChange={e => setEditHistoryForm({ ...editHistoryForm, reason: e.target.value })}
                  placeholder="Explain why this log is being modified..."
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={editHistoryForm.notes}
                  onChange={e => setEditHistoryForm({ ...editHistoryForm, notes: e.target.value })}
                  placeholder="Additional context notes..."
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button title="Close" type="button" onClick={() => setShowEditHistoryModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={submitLoading} className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1">
                  {submitLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

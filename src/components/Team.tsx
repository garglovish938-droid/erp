"use client";

import { useState, useEffect } from "react";
import { 
  Plus, Users, UserCheck, Calendar, DollarSign, Search, Loader2, X, Clock, 
  Trash2, Edit, CheckSquare, Square, RotateCcw, AlertTriangle, ChevronLeft, ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { staffService } from "@/services/staffService";
import { inventoryService } from "@/services/inventoryService";

export default function Team({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [staff, setStaff] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active"); // active, archived
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // CSV Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Modals & forms
  const [showFormModal, setShowFormModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ name: "", role: "", phone: "", email: "", salary: 0, status: "active" });
  const [formCustomValues, setFormCustomValues] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  // Confirmation Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState("");

  const isManagerOrHigher = ["admin", "manager"].includes(role);
  const isAdmin = role === "admin";

  const fetchData = async () => {
    try {
      const includeDeleted = statusFilter === "archived";
      // Fetch staff and custom fields — don't block on attendance failure
      const [staffData, fieldsData] = await Promise.all([
        staffService.getStaff(includeDeleted),
        inventoryService.getCustomFields("Staff").catch(() => [])
      ]);

      setStaff(Array.isArray(staffData) ? staffData : []);
      setCustomFields(Array.isArray(fieldsData) ? fieldsData : []);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Failed to fetch employees list", "error");
    } finally {
      setLoading(false);
    }

    // Attendance is fetched separately to not block staff rendering
    try {
      const attData = await staffService.getAttendance(selectedDate);
      setAttendance(Array.isArray(attData) ? attData : []);
    } catch (e) {
      // Attendance fetch failure is non-critical
      setAttendance([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, selectedDate, statusFilter]);

  const handleOpenAdd = () => {
    setEditMode(false);
    setCurrentItemId(null);
    setFormData({ name: "", role: "", phone: "", email: "", salary: 0, status: "active" });
    setFormCustomValues({});
    setSubmitError("");
    setShowFormModal(true);
  };

  const handleOpenEdit = async (emp: any) => {
    setEditMode(true);
    setCurrentItemId(emp.id);
    setFormData({
      name: emp.name,
      role: emp.role,
      phone: emp.phone || "",
      email: emp.email || "",
      salary: emp.salary,
      status: emp.status
    });
    
    // Fetch custom values
    setSubmitError("");
    try {
      const vals = await inventoryService.getEntityFieldValues(emp.id);
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

    // Salary validation
    if (formData.salary < 0) {
      setSubmitError("Monthly salary must be greater than or equal to 0.");
      return;
    }

    // Email format validation
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
      let savedEmp;
      if (editMode && currentItemId) {
        savedEmp = await staffService.updateStaff(currentItemId, formData);
        showToast("Employee details updated successfully", "success");
      } else {
        savedEmp = await staffService.createStaff(formData);
        showToast("New employee registered successfully", "success");
      }

      // Save custom field values
      await Promise.all(
        Object.entries(formCustomValues).map(([defId, val]) =>
          inventoryService.saveFieldValue({
            field_definition_id: defId,
            entity_id: savedEmp.id,
            value_text: val
          })
        )
      );

      setShowFormModal(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save employee");
      showToast(err.message || "Failed to save employee", "error");
    }
  };

  const handleConfirmDelete = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to delete Employee: "${name}"? This record can be restored later from the Archive panel.`);
    setConfirmAction(() => async () => {
      try {
        await staffService.deleteStaff(id);
        showToast("Employee archived successfully", "success");
        fetchData();
        setSelectedIds(prev => prev.filter(item => item !== id));
      } catch (e: any) {
        showToast(e.message || "Error deleting employee", "error");
      }
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleConfirmRestore = (id: string, name: string) => {
    setConfirmMessage(`Are you sure you want to restore Employee: "${name}" back to the active workforce list?`);
    setConfirmAction(() => async () => {
      try {
        await staffService.restoreStaff(id);
        showToast("Employee restored successfully", "success");
        fetchData();
      } catch (e: any) {
        showToast(e.message || "Failed to restore employee", "error");
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
      const res = await staffService.importCSV(csvFile);
      setImportSuccess(res.message || "CSV employees import completed");
      showToast(res.message || "CSV employees import completed", "success");
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
    setConfirmMessage(`Are you sure you want to archive all ${selectedIds.length} selected employees?`);
    setConfirmAction(() => async () => {
      let successCount = 0;
      let failedMessages: string[] = [];
      
      for (const id of selectedIds) {
        try {
          await staffService.deleteStaff(id);
          successCount++;
        } catch (e: any) {
          failedMessages.push(e.message || `Failed to archive employee ID ${id}`);
        }
      }
      
      if (failedMessages.length > 0) {
        showToast(failedMessages.join(" | "), "error");
      } else if (successCount > 0) {
        showToast(`Successfully archived ${successCount} employees`, "success");
      }
      
      setSelectedIds([]);
      fetchData();
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  const handleLogAttendance = async (staffId: string, attStatus: string) => {
    try {
      await staffService.logAttendance({
        staff_id: staffId,
        date: selectedDate,
        status: attStatus,
        check_in: attStatus === "present" ? "09:00" : null,
        check_out: attStatus === "present" ? "18:00" : null
      });
      showToast("Attendance logged", "success");
      fetchData();
    } catch (e) {
      showToast("Failed to log attendance", "error");
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

  // Filtering, Searching, and Sorting Staff
  const processedStaff = staff
    .filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        s.role.toLowerCase().includes(search.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
        (s.phone && s.phone.includes(search));
      
      const matchesRole = roleFilter === "all" || s.role === roleFilter;
      const matchesStatus = statusFilter === "archived" ? s.is_deleted : !s.is_deleted;
      return matchesSearch && matchesRole && matchesStatus;
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

  // Pagination bounds
  const totalPages = Math.ceil(processedStaff.length / itemsPerPage);
  const paginatedStaff = processedStaff.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const presentCount = attendance.filter(a => a.status === "present").length;
  const absentCount = attendance.filter(a => a.status === "absent").length;
  const leaveCount = attendance.filter(a => a.status === "leave").length;

  // Extract unique roles for filters
  const rolesList = Array.from(new Set(staff.map(s => s.role)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Staff & Production Team</h2>
          <p className="text-slate-500 mt-1">Configure user custom fields metadata, employee registries, and daily presence logs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-350 shadow-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-750 shadow-sm"
          >
            <option value="active">Active workforce</option>
            <option value="archived">Archived registry</option>
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
                Add Employee
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Attendance Banner */}
      {statusFilter === "active" && (
        <div className="grid grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 p-4 rounded-3xl">
          <div className="text-center py-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Present Today</span>
            <span className="text-2xl font-black text-emerald-600 mt-0.5 block">{presentCount}</span>
          </div>
          <div className="text-center py-2 border-x border-slate-200/50 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Absent</span>
            <span className="text-2xl font-black text-rose-500 mt-0.5 block">{absentCount}</span>
          </div>
          <div className="text-center py-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">On Leave</span>
            <span className="text-2xl font-black text-amber-500 mt-0.5 block">{leaveCount}</span>
          </div>
        </div>
      )}

      {/* Bulk actions and search bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
        <div className="flex flex-1 w-full gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, role, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
            className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold"
          >
            <option value="all">All Roles</option>
            {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {selectedIds.length > 0 && isManagerOrHigher && (
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

      {/* Main Table */}
      <div className="glass rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                {isManagerOrHigher && (
                  <th className="p-5 w-12">
                    <button onClick={() => handleToggleSelectAll(processedStaff)} className="text-slate-400 hover:text-indigo-600">
                      {selectedIds.length === processedStaff.length && processedStaff.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer" onClick={() => handleSort("name")}>
                  Employee Details
                </th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer" onClick={() => handleSort("role")}>
                  Production Role
                </th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 cursor-pointer" onClick={() => handleSort("salary")}>
                  Salary / Mo
                </th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400">
                  Attendance ({selectedDate})
                </th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
              {paginatedStaff.length > 0 ? (
                paginatedStaff.map((emp) => {
                  const att = attendance.find(a => a.staff_id === emp.id);
                  const status = att?.status || "unlogged";
                  const isSelected = selectedIds.includes(emp.id);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      {isManagerOrHigher && (
                        <td className="p-5">
                          <button onClick={() => handleToggleSelect(emp.id)} className="text-slate-400 hover:text-indigo-600">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                      )}
                      <td className="p-5">
                        <div className="font-semibold text-slate-900 dark:text-white">{emp.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{emp.phone || emp.email || "No contact info"}</div>
                      </td>
                      <td className="p-5">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 text-xs font-semibold rounded-lg border border-slate-200/50">
                          {emp.role}
                        </span>
                      </td>
                      <td className="p-5 font-semibold text-slate-700 dark:text-slate-300">${emp.salary.toLocaleString()}</td>
                      <td className="p-5">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase inline-flex items-center gap-1",
                          status === "present" ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/10 dark:text-emerald-400" :
                          status === "absent" ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/10 dark:text-rose-400" :
                          status === "leave" ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/10 dark:text-amber-400" :
                          "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/10"
                        )}>
                          {status}
                        </span>
                        {att?.check_in && (
                          <span className="text-[10px] text-slate-400 block mt-1 font-mono">In: {att.check_in} • Out: {att.check_out}</span>
                        )}
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex gap-2 justify-end items-center">
                          {statusFilter === "active" ? (
                            <>
                              {isManagerOrHigher && (
                                <div className="flex gap-1 border-r border-slate-200 dark:border-slate-800 pr-2">
                                  <button onClick={() => handleLogAttendance(emp.id, "present")} className={cn("px-2 py-0.5 rounded font-bold text-xs", status === "present" ? "bg-emerald-600 text-white" : "text-slate-400")}>P</button>
                                  <button onClick={() => handleLogAttendance(emp.id, "absent")} className={cn("px-2 py-0.5 rounded font-bold text-xs", status === "absent" ? "bg-rose-600 text-white" : "text-slate-400")}>A</button>
                                  <button onClick={() => handleLogAttendance(emp.id, "leave")} className={cn("px-2 py-0.5 rounded font-bold text-xs", status === "leave" ? "bg-amber-500 text-white" : "text-slate-400")}>L</button>
                                </div>
                              )}
                              <button onClick={() => handleOpenEdit(emp)} className="text-slate-400 hover:text-indigo-600 p-1.5"><Edit className="w-4 h-4" /></button>
                              {isAdmin && (
                                <button onClick={() => handleConfirmDelete(emp.id, emp.name)} className="text-slate-400 hover:text-rose-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </>
                          ) : (
                            isAdmin && (
                              <button onClick={() => handleConfirmRestore(emp.id, emp.name)} className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-bold">
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
                  <td colSpan={6} className="text-center p-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold text-slate-500">No Employees Found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold">{editMode ? "Edit Employee details" : "Register Employee"}</h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:bg-slate-150 p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 border border-rose-500/20 p-3 rounded-xl text-xs mb-4">{submitError}</div>}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Full Name*</label>
                <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Amit Kumar" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Production Role / Title*</label>
                <input type="text" required value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} placeholder="Senior Carpenter" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number</label>
                  <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="9876543214" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Monthly Salary ($)*</label>
                  <input type="number" required min="0" value={formData.salary || ""} onChange={e=>setFormData({...formData, salary: parseFloat(e.target.value) || 0})} placeholder="4000" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
                <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} placeholder="amit.kumar@allure.com" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>

              {/* RENDER DYNAMIC CUSTOM FIELDS */}
              {customFields.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
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
                <button type="button" onClick={() => setShowFormModal(false)} className="px-5 py-2.5 text-sm border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">Cancel</button>
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
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Confirm Operation</h4>
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
                Yes, Proceed
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bulk CSV Employees Import</h3>
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

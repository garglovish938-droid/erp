"use client";

import { useState, useEffect } from "react";
import { 
  Database, RefreshCw, FileCode, Clock, ShieldCheck, Loader2, Plus, 
  Trash2, Sliders, Settings2, Save, Sparkles, LayoutGrid, ToggleLeft,
  Lock, Edit, Shield, UserX, UserCheck, AlertTriangle, UserPlus, Search, 
  Check, Briefcase, Users, X
} from "lucide-react";
import { useToast } from "./Toast";
import { inventoryService } from "@/services/inventoryService";
import { projectService } from "@/services/projectService";
import { apiRequest } from "@/services/apiClient";
import { cn } from "@/lib/utils";

interface ParsedLog {
  timestamp: string;
  user: string;
  role: string;
  module: string;
  action: string;
  record_id: string;
  message: string;
}

function parseLogDetails(log: any): ParsedLog {
  const fallbackTime = log.created_at;
  const fallbackUser = log.user?.full_name || "System";
  const fallbackRole = log.user?.role || "system";
  
  let fallbackModule = "System";
  const act = (log.action || "").toLowerCase();
  if (act.includes("supplier")) fallbackModule = "Supplier";
  else if (act.includes("client")) fallbackModule = "Client";
  else if (act.includes("inventory") || act.includes("stock") || act.includes("update_inventory")) fallbackModule = "Inventory";
  else if (act.includes("project")) fallbackModule = "Project";
  else if (act.includes("staff") || act.includes("employee")) fallbackModule = "Staff";
  else if (act.includes("request")) fallbackModule = "MaterialRequest";
  else if (act.includes("purchase") || act.includes("po")) fallbackModule = "PurchaseOrder";
  else if (act.includes("login") || act.includes("logout") || act.includes("register")) fallbackModule = "Auth";

  let fallbackRecordId = "-";
  if (log.details && log.details.includes("ID ")) {
    const parts = log.details.split("ID ");
    if (parts.length > 1) {
      fallbackRecordId = parts[1].trim();
    }
  }

  const fallbackAction = log.action || "execute";
  const fallbackMessage = log.details || log.action || "-";

  if (log.details) {
    try {
      const parsed = JSON.parse(log.details);
      if (parsed && typeof parsed === "object") {
        return {
          timestamp: parsed.timestamp || fallbackTime,
          user: parsed.user || fallbackUser,
          role: parsed.role || fallbackRole,
          module: parsed.module || fallbackModule,
          action: parsed.action || fallbackAction,
          record_id: parsed.record_id || fallbackRecordId,
          message: parsed.message || fallbackMessage,
        };
      }
    } catch (_) {
      // Not JSON, use fallback
    }
  }

  return {
    timestamp: fallbackTime,
    user: fallbackUser,
    role: fallbackRole,
    module: fallbackModule,
    action: fallbackAction,
    record_id: fallbackRecordId,
    message: fallbackMessage,
  };
}

const ALL_ROLES = [
  { value: "admin", label: "Super Admin" },
  { value: "manager", label: "Project Manager" },
  { value: "store", label: "Inventory Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "carpenter", label: "Carpenter" },
  { value: "operator", label: "Machine Operator" },
  { value: "worker", label: "General Staff" }
];

const ALL_DEPARTMENTS = ["Administration", "Projects", "Warehouse", "Finance", "Production", "Design"];

const ALL_PERMISSIONS = [
  { value: "manage_inventory", label: "Manage Inventory (Read/Write)" },
  { value: "approve_requests", label: "Approve Material Requests" },
  { value: "purchase_order", label: "Create & Approve Purchase Orders" },
  { value: "view_reports", label: "Access & Download Reports" },
  { value: "download_backup", label: "Manage Database Backups" },
  { value: "manage_crm", label: "Manage Client CRM Files" },
  { value: "manage_projects", label: "Define BOM & Projects" },
  { value: "manage_staff", label: "Access User & Staff Registry" }
];

export default function Settings({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("backups"); // backups, fields, users
  const [backups, setBackups] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [assignmentsByProject, setAssignmentsByProject] = useState<Record<string, any[]>>({});
  const [userSearch, setUserSearch] = useState("");
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Forms
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "worker",
    employee_code: "",
    department: "",
    status: "active",
    permissions: [] as string[],
    assigned_projects: [] as string[]
  });
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  // Custom field builder form state
  const [selectedEntity, setSelectedEntity] = useState("Supplier"); // Supplier, Client, Staff, Project, InventoryItem
  const [fieldForm, setFieldForm] = useState({
    name: "",
    label: "",
    field_type: "text",
    is_required: false,
    choices: ""
  });

  const isAdmin = role === "admin";

  const fetchSettingsData = async () => {
    try {
      const promises: Promise<any>[] = [
        inventoryService.getBackups(),
        inventoryService.getLogs(),
        inventoryService.getCustomFields(selectedEntity)
      ];

      if (isAdmin) {
        promises.push(apiRequest("/api/users"));
        promises.push(projectService.getProjects());
      }

      const results = await Promise.all(promises);
      setBackups(results[0]);
      setLogs(results[1]);
      setCustomFields(results[2]);

      if (isAdmin) {
        const usersList = results[3] || [];
        const projectsList = results[4] || [];
        setUsers(usersList);
        setProjects(projectsList);

        // Fetch project assignments in parallel
        const assignmentsMap: Record<string, any[]> = {};
        await Promise.all(
          projectsList.map(async (p: any) => {
            try {
              const assigns = await apiRequest(`/api/projects/${p.id}/assignments`);
              assignmentsMap[p.id] = assigns || [];
            } catch (err) {
              console.error(`Failed to fetch assignments for project ${p.id}`, err);
            }
          })
        );
        setAssignmentsByProject(assignmentsMap);
      }
    } catch (e) {
      console.error(e);
      showToast("Error retrieving configuration logs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, [token, selectedEntity]);

  const refreshUsersData = async () => {
    if (!isAdmin) return;
    try {
      const usersList = await apiRequest("/api/users");
      setUsers(usersList || []);
      
      const assignmentsMap: Record<string, any[]> = {};
      await Promise.all(
        projects.map(async (p: any) => {
          try {
            const assigns = await apiRequest(`/api/projects/${p.id}/assignments`);
            assignmentsMap[p.id] = assigns || [];
          } catch (err) {
            console.error(err);
          }
        })
      );
      setAssignmentsByProject(assignmentsMap);
    } catch (err) {
      console.error("Failed to refresh users data", err);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      await inventoryService.createBackup();
      showToast("Database backup snapshot created successfully!", "success");
      fetchSettingsData();
    } catch (e: any) {
      showToast(e.message || "Backup failed", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore the database to backup "${filename}"? This will overwrite current active data.`)) return;
    setRestoreLoading(filename);
    try {
      await inventoryService.restoreBackup(filename);
      showToast("Database restored successfully! Reloading session...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      showToast(e.message || "Database restore failed", "error");
      setRestoreLoading(null);
    }
  };

  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.name.trim() || !fieldForm.label.trim()) {
      showToast("Please enter field internal name and display label", "warning");
      return;
    }

    const cleanName = fieldForm.name.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");

    setActionLoading(true);
    try {
      await inventoryService.createCustomField({
        entity_type: selectedEntity,
        name: cleanName,
        label: fieldForm.label.trim(),
        field_type: fieldForm.field_type,
        is_required: fieldForm.is_required,
        choices: fieldForm.field_type === "dropdown" ? fieldForm.choices : null
      });
      showToast(`Custom field '${fieldForm.label}' created for ${selectedEntity}`, "success");
      setFieldForm({ name: "", label: "", field_type: "text", is_required: false, choices: "" });
      fetchSettingsData();
    } catch (e: any) {
      showToast(e.message || "Failed to define custom field", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCustomField = async (fieldId: string, label: string) => {
    if (!confirm(`Are you sure you want to remove dynamic field: "${label}"? Existing records values will be orphaned.`)) return;
    try {
      await inventoryService.deleteCustomField(fieldId);
      showToast("Custom field removed", "info");
      fetchSettingsData();
    } catch (e) {
      showToast("Failed to delete custom field definition", "error");
    }
  };

  // User Management Actions
  const handleToggleUserStatus = async (user: any) => {
    const newStatus = user.status === "active" ? "disabled" : "active";
    setActionLoading(true);
    try {
      await apiRequest(`/api/users/${user.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus })
      });
      showToast(`User account for ${user.full_name} is now ${newStatus}`, "success");
      await refreshUsersData();
    } catch (e: any) {
      showToast(e.message || "Failed to update user status", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Are you sure you want to delete ${user.full_name}? They will be archived in the system.`)) return;
    setActionLoading(true);
    try {
      await apiRequest(`/api/users/${user.id}`, { method: "DELETE" });
      showToast("User archived successfully", "success");
      await refreshUsersData();
    } catch (e: any) {
      showToast(e.message || "Failed to delete user", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      showToast("Password must be at least 6 characters long", "warning");
      return;
    }
    setActionLoading(true);
    try {
      await apiRequest(`/api/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: resetPasswordVal })
      });
      showToast(`Password successfully reset for ${selectedUser.full_name}`, "success");
      setShowResetModal(false);
      setResetPasswordVal("");
    } catch (e: any) {
      showToast(e.message || "Failed to reset password", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.email || !userForm.password || !userForm.full_name) {
      showToast("Please fill in Name, Email, and Password", "warning");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        email: userForm.email,
        password: userForm.password,
        full_name: userForm.full_name,
        phone: userForm.phone || null,
        role: userForm.role,
        employee_code: userForm.employee_code || null,
        department: userForm.department || null,
        status: userForm.status,
        permissions: userForm.permissions.length > 0 ? userForm.permissions.join(",") : null
      };

      const newUser = await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      // Assign selected projects
      if (userForm.assigned_projects.length > 0) {
        await Promise.all(
          userForm.assigned_projects.map(projectId => 
            apiRequest(`/api/projects/${projectId}/assignments`, {
              method: "POST",
              body: JSON.stringify({ project_id: projectId, user_id: newUser.id })
            }).catch(err => console.error(err))
          )
        );
      }

      showToast("User account registered successfully", "success");
      setShowCreateModal(false);
      await refreshUsersData();
    } catch (e: any) {
      showToast(e.message || "Failed to register user", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        email: userForm.email,
        full_name: userForm.full_name,
        phone: userForm.phone || null,
        role: userForm.role,
        employee_code: userForm.employee_code || null,
        department: userForm.department || null,
        status: userForm.status,
        permissions: userForm.permissions.length > 0 ? userForm.permissions.join(",") : null
      };

      await apiRequest(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      // Synchronize projects
      const originalProjectIds = projects.filter(p => {
        const assigns = assignmentsByProject[p.id] || [];
        return assigns.some(a => a.user_id === selectedUser.id);
      }).map(p => p.id);

      const projectsToAdd = userForm.assigned_projects.filter(pid => !originalProjectIds.includes(pid));
      const projectsToRemove = originalProjectIds.filter(pid => !userForm.assigned_projects.includes(pid));

      await Promise.all([
        ...projectsToAdd.map(projectId =>
          apiRequest(`/api/projects/${projectId}/assignments`, {
            method: "POST",
            body: JSON.stringify({ project_id: projectId, user_id: selectedUser.id })
          }).catch(err => console.error(err))
        ),
        ...projectsToRemove.map(projectId =>
          apiRequest(`/api/projects/${projectId}/assignments/${selectedUser.id}`, {
            method: "DELETE"
          }).catch(err => console.error(err))
        )
      ]);

      showToast("User information updated successfully", "success");
      setShowEditModal(false);
      await refreshUsersData();
    } catch (e: any) {
      showToast(e.message || "Failed to edit user", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setUserForm(prev => {
      const perms = prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission];
      return { ...prev, permissions: perms };
    });
  };

  const handleProjectToggle = (projectId: string) => {
    setUserForm(prev => {
      const pids = prev.assigned_projects.includes(projectId)
        ? prev.assigned_projects.filter(id => id !== projectId)
        : [...prev.assigned_projects, projectId];
      return { ...prev, assigned_projects: pids };
    });
  };

  const getUserAssignedProjects = (userId: string) => {
    return projects.filter(p => {
      const assigns = assignmentsByProject[p.id] || [];
      return assigns.some(a => a.user_id === userId);
    });
  };

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.employee_code || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q)
    );
  });

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
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Admin Settings & Metadata Configurator</h2>
        <p className="text-slate-500 mt-1">Configure automated database backups, dynamic fields forms builder, and manage enterprise security access permissions.</p>
      </header>

      {/* Settings Sub Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveSubTab("backups")}
          className={cn(
            "pb-3 text-sm font-bold border-b-2 transition-all",
            activeSubTab === "backups"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-700"
          )}
        >
          Backups & Security Log
        </button>
        <button
          onClick={() => setActiveSubTab("fields")}
          className={cn(
            "pb-3 text-sm font-bold border-b-2 transition-all",
            activeSubTab === "fields"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-700"
          )}
        >
          Custom Fields Form Builder
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveSubTab("users")}
            className={cn(
              "pb-3 text-sm font-bold border-b-2 transition-all",
              activeSubTab === "users"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-700"
            )}
          >
            User Access & Permissions
          </button>
        )}
      </div>

      {activeSubTab === "backups" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Backup snap registry */}
          <div className="lg:col-span-1 glass rounded-3xl p-6 border border-slate-205 dark:border-slate-800 shadow-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Backup Registry</h3>
              </div>
              <p className="text-xs text-slate-550 leading-relaxed">
                Create instant snapshots of the active SQLite local databases. Restore files back to original states on-demand.
              </p>
              <button
                onClick={handleCreateBackup}
                disabled={actionLoading}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Create DB Backup
              </button>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Available Snapshots</h4>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {backups.length > 0 ? (
                  backups.map((bak) => (
                    <div key={bak.filename} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-between border border-slate-200/40">
                      <div>
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[140px]" title={bak.filename}>
                          {bak.filename}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{bak.created_at}</span>
                      </div>
                      <button
                        onClick={() => handleRestoreBackup(bak.filename)}
                        disabled={restoreLoading !== null}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold rounded-lg transition-colors text-[10px]"
                      >
                        {restoreLoading === bak.filename ? <Loader2 className="w-3 animate-spin" /> : "Restore"}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs font-semibold">No backup files found.</div>
                )}
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="lg:col-span-2 glass rounded-3xl p-6 border border-slate-205 dark:border-slate-800 shadow-md flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Security Audit Log</h3>
              </div>
              <p className="text-xs text-slate-550 leading-relaxed">
                Trace logins, database edits, and stock deductions with exact timestamps and executor credentials.
              </p>
              
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
                <div className="overflow-x-auto max-h-[350px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-400 uppercase">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">User</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Module</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Record ID</th>
                        <th className="p-3">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-650 dark:text-slate-400">
                      {logs.length > 0 ? (
                        logs.map((log) => {
                          const parsed = parseLogDetails(log);
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="p-3 whitespace-nowrap">{new Date(parsed.timestamp).toLocaleString()}</td>
                              <td className="p-3 whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">{parsed.user}</td>
                              <td className="p-3 whitespace-nowrap uppercase text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{parsed.role}</td>
                              <td className="p-3 whitespace-nowrap font-semibold">{parsed.module}</td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded border border-indigo-200/20">
                                  {parsed.action}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap font-mono text-[10px] max-w-[120px] truncate" title={parsed.record_id}>
                                {parsed.record_id}
                              </td>
                              <td className="p-3 max-w-xs truncate" title={parsed.message}>{parsed.message}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center p-4 text-slate-400 font-semibold">No audit logs recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "fields" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-250">
          {/* Custom field builder form */}
          <div className="lg:col-span-1 glass rounded-3xl p-6 border border-slate-205 shadow-md space-y-6">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-bold">Add Custom Field</h3>
            </div>
            
            <form onSubmit={handleCreateCustomField} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Target ERP Module*</label>
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
                >
                  <option value="Supplier">Supplier Module</option>
                  <option value="Client">CRM Client</option>
                  <option value="Staff">Staff Registry</option>
                  <option value="Project">Projects board</option>
                  <option value="InventoryItem">Warehouse Materials</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Internal Name (snake_case)*</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., credit_limit"
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-450 block mb-1">Display Label*</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Credit Limit ($)"
                  value={fieldForm.label}
                  onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Field Type*</label>
                  <select
                    value={fieldForm.field_type}
                    onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <option value="text">Text Box</option>
                    <option value="number">Number Box</option>
                    <option value="date">Date picker</option>
                    <option value="dropdown">Dropdown Select</option>
                    <option value="checkbox">Toggle box</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-450 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldForm.is_required}
                      onChange={(e) => setFieldForm({ ...fieldForm, is_required: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    Is Required?
                  </label>
                </div>
              </div>

              {fieldForm.field_type === "dropdown" && (
                <div>
                  <label className="text-xs font-semibold text-slate-450 block mb-1">Dropdown Choices (comma-separated)*</label>
                  <input
                    type="text"
                    required
                    placeholder="Option A, Option B, Option C"
                    value={fieldForm.choices}
                    onChange={(e) => setFieldForm({ ...fieldForm, choices: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Define Custom Field
              </button>
            </form>
          </div>

          {/* Defined custom fields list */}
          <div className="lg:col-span-2 glass rounded-3xl p-6 border border-slate-205 shadow-md space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold">Dynamic Fields in {selectedEntity}</h3>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded">{customFields.length} Defined</span>
            </div>

            <div className="border border-slate-200/50 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950">
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-400 uppercase">
                      <th className="p-3">Field Label</th>
                      <th className="p-3">Snake Case Name</th>
                      <th className="p-3">Field Type</th>
                      <th className="p-3">Validation</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {customFields.length > 0 ? (
                      customFields.map((field) => (
                        <tr key={field.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{field.label}</td>
                          <td className="p-3 font-mono text-indigo-650 dark:text-indigo-400">{field.name}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-855 rounded border border-slate-200 dark:border-slate-800">
                              {field.field_type}
                            </span>
                          </td>
                          <td className="p-3">{field.is_required ? "Required" : "Optional"}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteCustomField(field.id, field.label)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center p-6 text-slate-400 font-medium">No custom metadata fields defined for {selectedEntity} yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "users" && isAdmin && (
        <div className="space-y-6 animate-in fade-in duration-250">
          {/* User management metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-2xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-450 block">Total User Profiles</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{users.length}</span>
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400 rounded-2xl">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-450 block">Active Employees</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {users.filter(u => u.status === "active").length}
                </span>
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-955/40 text-rose-600 dark:text-rose-400 rounded-2xl">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-450 block">Deactivated Access</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {users.filter(u => u.status === "disabled").length}
                </span>
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-450 block">Active Projects</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{projects.length}</span>
              </div>
            </div>
          </div>

          {/* Search and control bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, code, or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
              />
            </div>
            <button
              onClick={() => {
                setUserForm({
                  email: "",
                  password: "",
                  full_name: "",
                  phone: "",
                  role: "worker",
                  employee_code: "",
                  department: "",
                  status: "active",
                  permissions: [],
                  assigned_projects: []
                });
                setShowCreateModal(true);
              }}
              className="w-full md:w-auto px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Create Employee Profile
            </button>
          </div>

          {/* Registry Table */}
          <div className="border border-slate-200/50 dark:border-slate-850 rounded-3xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-400 uppercase">
                    <th className="p-4">Employee ID</th>
                    <th className="p-4">Profile Details</th>
                    <th className="p-4">Role & Department</th>
                    <th className="p-4">Assigned Projects</th>
                    <th className="p-4">Custom Permissions</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => {
                      const userProj = getUserAssignedProjects(u.id);
                      const userPerms = u.permissions ? u.permissions.split(",") : [];
                      
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200">
                            {u.employee_code || "N/A"}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{u.full_name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{u.email}</div>
                            {u.phone && <div className="text-[10px] text-indigo-500/80 font-mono mt-0.5">{u.phone}</div>}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded uppercase border border-indigo-200/20 mr-2">
                              {ALL_ROLES.find(r => r.value === u.role)?.label || u.role}
                            </span>
                            {u.department && (
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 text-[10px] font-semibold rounded">
                                {u.department}
                              </span>
                            )}
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {userProj.length > 0 ? (
                                userProj.map((p: any) => (
                                  <span key={p.id} className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-650 dark:text-emerald-400 text-[9px] font-medium rounded border border-emerald-250/20 truncate max-w-[120px]" title={p.name}>
                                    {p.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No assigned projects</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {userPerms.length > 0 ? (
                                userPerms.map((p: string) => (
                                  <span key={p} className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/30 text-purple-650 dark:text-purple-400 text-[9px] font-medium rounded border border-purple-250/20">
                                    {ALL_PERMISSIONS.find(ap => ap.value === p)?.label.split(" (")[0] || p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Standard role default</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-bold rounded-full",
                              u.status === "active"
                                ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                            )}>
                              {u.status === "active" ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setUserForm({
                                    email: u.email,
                                    password: "",
                                    full_name: u.full_name,
                                    phone: u.phone || "",
                                    role: u.role,
                                    employee_code: u.employee_code || "",
                                    department: u.department || "",
                                    status: u.status,
                                    permissions: u.permissions ? u.permissions.split(",") : [],
                                    assigned_projects: getUserAssignedProjects(u.id).map(p => p.id)
                                  });
                                  setShowEditModal(true);
                                }}
                                className="p-1.5 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/40 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors"
                                title="Edit profile details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setResetPasswordVal("");
                                  setShowResetModal(true);
                                }}
                                className="p-1.5 bg-slate-50 hover:bg-amber-50 dark:bg-slate-900 dark:hover:bg-amber-950/40 text-slate-600 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors"
                                title="Reset login credentials"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                className={cn(
                                  "p-1.5 border rounded-lg transition-colors",
                                  u.status === "active"
                                    ? "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 border-rose-200 dark:border-rose-900/30"
                                    : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-600 border-emerald-200 dark:border-emerald-900/30"
                                )}
                                title={u.status === "active" ? "Deactivate employee account" : "Activate employee account"}
                              >
                                {u.status === "active" ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 bg-slate-50 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-650 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors"
                                title="Archive user record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-slate-400 font-semibold">No registered users matched search filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                Register New Employee Access
              </h3>
              <p className="text-xs text-slate-450 mt-1">Define credentials, operational department, and custom project scopes.</p>
            </div>
            
            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Full Name*</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Robert Plank"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Employee ID / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-009"
                    value={userForm.employee_code}
                    onChange={(e) => setUserForm({...userForm, employee_code: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Email Address*</label>
                  <input
                    type="email"
                    required
                    placeholder="name@allure.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Password Credentials*</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={userForm.password}
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543219"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Enterprise Role*</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Department</label>
                  <select
                    value={userForm.department}
                    onChange={(e) => setUserForm({...userForm, department: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <option value="">No Department</option>
                    {ALL_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Scope Project Assignments (User only sees these projects)</label>
                <div className="max-h-[100px] overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 gap-2 text-xs">
                  {projects.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:text-indigo-500">
                      <input
                        type="checkbox"
                        checked={userForm.assigned_projects.includes(p.id)}
                        onChange={() => handleProjectToggle(p.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Custom RBAC Overrides (Optional)</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                  {ALL_PERMISSIONS.map((p: any) => (
                    <label key={p.value} className="flex items-center gap-2 cursor-pointer hover:text-indigo-500">
                      <input
                        type="checkbox"
                        checked={userForm.permissions.includes(p.value)}
                        onChange={() => handlePermissionToggle(p.value)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-500 hover:to-purple-550 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Register employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-500" />
                Modify Employee Profile: {selectedUser?.full_name}
              </h3>
              <p className="text-xs text-slate-450 mt-1">Update administrative properties, security clearance, and linked projects.</p>
            </div>
            
            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Full Name*</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Robert Plank"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Employee ID / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-009"
                    value={userForm.employee_code}
                    onChange={(e) => setUserForm({...userForm, employee_code: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Email Address*</label>
                  <input
                    type="email"
                    required
                    placeholder="name@allure.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543219"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Enterprise Role*</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800 font-medium"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Department</label>
                  <select
                    value={userForm.department}
                    onChange={(e) => setUserForm({...userForm, department: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <option value="">No Department</option>
                    {ALL_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Account Status*</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm({...userForm, status: e.target.value})}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Scope Project Assignments (User only sees these projects)</label>
                <div className="max-h-[100px] overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 gap-2 text-xs">
                  {projects.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:text-indigo-500">
                      <input
                        type="checkbox"
                        checked={userForm.assigned_projects.includes(p.id)}
                        onChange={() => handleProjectToggle(p.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Custom RBAC Overrides (Optional)</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                  {ALL_PERMISSIONS.map((p: any) => (
                    <label key={p.value} className="flex items-center gap-2 cursor-pointer hover:text-indigo-500">
                      <input
                        type="checkbox"
                        checked={userForm.permissions.includes(p.value)}
                        onChange={() => handlePermissionToggle(p.value)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-500 hover:to-purple-550 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative text-slate-900 dark:text-white">
            <button 
              onClick={() => setShowResetModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-6">
              <Lock className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
              <h4 className="text-lg font-bold">Reset Employee Password</h4>
              <p className="text-xs text-slate-450 mt-1">Set a new security password for {selectedUser?.full_name}.</p>
            </div>
            
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">New Password*</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-450 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-colors"
                >
                  {actionLoading ? "Updating..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

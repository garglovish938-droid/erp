"use client";

import { useState, useEffect } from "react";
import { 
  Database, RefreshCw, FileCode, Clock, ShieldCheck, Loader2, Plus, 
  Trash2, Sliders, Settings2, Save, Sparkles, LayoutGrid, ToggleLeft 
} from "lucide-react";
import { useToast } from "./Toast";
import { inventoryService } from "@/services/inventoryService";
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
  
  // Try to determine module from action name
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

export default function Settings({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("backups"); // backups, fields, workflows
  const [backups, setBackups] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null);

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
      const [backupsRes, logsRes, fieldsRes] = await Promise.all([
        inventoryService.getBackups(),
        inventoryService.getLogs(),
        inventoryService.getCustomFields(selectedEntity)
      ]);

      setBackups(backupsRes);
      setLogs(logsRes);
      setCustomFields(fieldsRes);
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

    // Convert name to clean snake_case
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
        <p className="text-slate-500 mt-1">Configure automated database backups, dynamic fields forms builder, and view activity audit logs.</p>
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
              <p className="text-xs text-slate-500 leading-relaxed">
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
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Snapshots</h4>
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
              <p className="text-xs text-slate-500 leading-relaxed">
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
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-600 dark:text-slate-400">
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
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-455 block mb-1">Display Label*</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Credit Limit ($)"
                  value={fieldForm.label}
                  onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-455 block mb-1">Field Type*</label>
                  <select
                    value={fieldForm.field_type}
                    onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-955 border rounded-xl"
                  >
                    <option value="text">Text Box</option>
                    <option value="number">Number Box</option>
                    <option value="date">Date picker</option>
                    <option value="dropdown">Dropdown Select</option>
                    <option value="checkbox">Toggle box</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-455 cursor-pointer">
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
                  <label className="text-xs font-semibold text-slate-455 block mb-1">Dropdown Choices (comma-separated)*</label>
                  <input
                    type="text"
                    required
                    placeholder="Option A, Option B, Option C"
                    value={fieldForm.choices}
                    onChange={(e) => setFieldForm({ ...fieldForm, choices: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 border rounded-xl animate-in slide-in-from-top-2"
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
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-855 rounded border">
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
    </div>
  );
}

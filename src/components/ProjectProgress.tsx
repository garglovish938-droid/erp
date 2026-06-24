"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban, Camera, Clock, FileText, TrendingUp,
  Upload, CheckCircle, Image, ChevronDown, ChevronUp, RefreshCw, Plus
} from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";

interface ProjectProgressProps {
  token: string;
  role: string;
}

const isManager = (role: string) => ["admin", "manager"].includes(role);

export default function ProjectProgress({ token, role }: ProjectProgressProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [projectReport, setProjectReport] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "report">("log");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const [form, setForm] = useState({
    task: "",
    hours_worked: "",
    progress_percentage: "",
    remarks: "",
  });
  const [workPhotos, setWorkPhotos] = useState<File[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string[]>([]);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await apiRequest("/api/projects");
        setProjects(data?.filter((p: any) => !p.is_deleted) || []);
      } catch (e) { console.error(e); }
    };
    loadProjects();
  }, []);

  const loadReport = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const [reportData, logsData] = await Promise.all([
        apiRequest(`/api/projects/${selectedProject}/report`),
        apiRequest(`/api/projects/${selectedProject}/daily-logs`)
      ]);
      setProjectReport(reportData);
      setLogs(logsData?.logs || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setWorkPhotos(prev => [...prev, ...files].slice(0, 5));
    const previews = files.map(f => URL.createObjectURL(f));
    setPhotoPreview(prev => [...prev, ...previews].slice(0, 5));
  };

  const removePhoto = (index: number) => {
    setWorkPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) { setError("Please select a project"); return; }
    if (!form.task.trim()) { setError("Task description is required"); return; }
    if (!form.hours_worked || parseFloat(form.hours_worked) <= 0) { setError("Hours worked must be greater than 0"); return; }
    const pct = parseInt(form.progress_percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) { setError("Progress must be between 0 and 100"); return; }

    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("task", form.task);
      fd.append("hours_worked", form.hours_worked);
      fd.append("progress_percentage", form.progress_percentage);
      if (form.remarks) fd.append("remarks", form.remarks);
      workPhotos.forEach(photo => fd.append("work_photos", photo));

      const userData = JSON.parse(localStorage.getItem("allure_erp_user") || "{}");
      const res = await fetch(`${API_BASE_URL}/api/projects/${selectedProject}/daily-log`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userData.token || token}` },
        body: fd
      });
      const result = await res.json();
      if (res.ok) {
        setSuccess("Daily progress log submitted successfully!");
        setForm({ task: "", hours_worked: "", progress_percentage: "", remarks: "" });
        setWorkPhotos([]);
        setPhotoPreview([]);
        await loadReport();
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(result.detail || "Failed to submit log");
      }
    } catch (e: any) {
      setError(e.message || "Failed to submit");
    }
    setSubmitting(false);
  };

  const updateCompletion = async (pct: number) => {
    if (!selectedProject) return;
    try {
      await apiRequest(`/api/projects/${selectedProject}/completion`, {
        method: "PUT",
        body: JSON.stringify({ completion_percentage: pct })
      });
      setSuccess(`Project completion updated to ${pct}%`);
      await loadReport();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to update");
    }
  };

  const statusColor = (s: string) => ({
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-blue-100 text-blue-700",
    planning: "bg-amber-100 text-amber-700",
    on_hold: "bg-slate-100 text-slate-600",
    delayed: "bg-red-100 text-red-700",
  }[s] || "bg-slate-100 text-slate-600");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-purple-700">
          Project Daily Progress
        </h1>
        <p className="text-sm text-slate-500 mt-1">Submit daily work updates and view project timelines</p>
      </div>

      {/* Project Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Select Project</label>
        <select
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        >
          <option value="">— Choose a project —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
          ))}
        </select>
      </div>

      {selectedProject && (
        <>
          {/* Tabs */}
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("log")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "log" ? "bg-violet-600 text-white shadow-md" : "bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700 hover:bg-violet-50"}`}>
              <Plus className="w-4 h-4" /> Submit Daily Log
            </button>
            <button onClick={() => setActiveTab("report")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "report" ? "bg-violet-600 text-white shadow-md" : "bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700 hover:bg-violet-50"}`}>
              <FileText className="w-4 h-4" /> Project Report
            </button>
          </div>

          {/* Alerts */}
          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{success}</p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* SUBMIT LOG TAB */}
          {activeTab === "log" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 space-y-5">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-600" /> Daily Work Log
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Task / Work Done *</label>
                  <textarea value={form.task} onChange={e => { setForm(f => ({ ...f, task: e.target.value })); setError(""); }}
                    rows={3} placeholder="Describe the work done today..."
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Hours Worked *</label>
                    <input type="number" min="0.5" max="24" step="0.5" value={form.hours_worked}
                      onChange={e => { setForm(f => ({ ...f, hours_worked: e.target.value })); setError(""); }}
                      placeholder="e.g. 8"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Progress % (0–100) *</label>
                    <input type="number" min="0" max="100" value={form.progress_percentage}
                      onChange={e => { setForm(f => ({ ...f, progress_percentage: e.target.value })); setError(""); }}
                      placeholder="e.g. 45"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Remarks</label>
                  <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    rows={2} placeholder="Any notes or issues to highlight..."
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Work Photos (up to 5)</label>
                  <label htmlFor="work-photos" className="flex items-center justify-center gap-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 cursor-pointer hover:border-violet-400 transition-colors">
                    <Camera className="w-6 h-6 text-slate-400" />
                    <span className="text-sm text-slate-500">Click to upload work photos</span>
                  </label>
                  <input id="work-photos" type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                  {photoPreview.length > 0 && (
                    <div className="flex gap-3 mt-3 flex-wrap">
                      {photoPreview.map((src, i) => (
                        <div key={i} className="relative group">
                          <img src={src} alt={`preview-${i}`} className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                          <button type="button" onClick={() => removePhoto(i)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-60 shadow-md shadow-violet-200 dark:shadow-none">
                  {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-5 h-5" />}
                  {submitting ? "Submitting..." : "Submit Daily Log"}
                </button>
              </div>
            </form>
          )}

          {/* REPORT TAB */}
          {activeTab === "report" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button onClick={loadReport} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-700">
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : projectReport ? (
                <>
                  {/* Project Summary */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{projectReport.project_name}</h3>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${statusColor(projectReport.status)}`}>{projectReport.status}</span>
                        {projectReport.client && <p className="text-xs text-slate-500 mt-1">Client: {projectReport.client}</p>}
                        {projectReport.site_location && <p className="text-xs text-slate-500">Site: {projectReport.site_location}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-violet-600">{projectReport.completion_percentage}%</div>
                        <div className="text-xs text-slate-400">complete</div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 mb-4">
                      <div className="h-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-700"
                        style={{ width: `${projectReport.completion_percentage}%` }} />
                    </div>

                    {/* Admin: update completion */}
                    {isManager(role) && (
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">Update Completion %</label>
                        <input type="number" min="0" max="100" defaultValue={projectReport.completion_percentage}
                          id="comp-pct-input" className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm w-24 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500" />
                        <button onClick={() => {
                          const val = parseInt((document.getElementById("comp-pct-input") as HTMLInputElement).value);
                          if (!isNaN(val)) updateCompletion(val);
                        }} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm hover:bg-violet-700 transition-colors">
                          Update
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="text-lg font-bold text-indigo-600">{projectReport.total_assigned_workers}</div>
                        <div className="text-xs text-slate-400">Assigned Workers</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="text-lg font-bold text-emerald-600">{projectReport.present_workers_today}</div>
                        <div className="text-xs text-slate-400">Present Today</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="text-lg font-bold text-amber-600">{projectReport.materials?.length || 0}</div>
                        <div className="text-xs text-slate-400">Material Items</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="text-lg font-bold text-purple-600">{projectReport.total_log_entries}</div>
                        <div className="text-xs text-slate-400">Log Entries</div>
                      </div>
                    </div>
                  </div>

                  {/* Materials */}
                  {projectReport.materials?.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Materials (BOM)</h3>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                          <tr>
                            {["Item", "Required", "Used", "Unit", "Status"].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {projectReport.materials.map((m: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{m.item}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.required}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.used}</td>
                              <td className="px-4 py-3 text-slate-500">{m.unit}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === "fulfilled" ? "bg-emerald-100 text-emerald-700" : m.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                  {m.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Daily Logs Timeline */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">Progress Timeline</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {logs.length === 0 ? (
                        <div className="px-6 py-10 text-center text-slate-400 text-sm">No progress logs yet. Submit the first one!</div>
                      ) : logs.map((log: any) => (
                        <div key={log.id} className="px-6 py-4">
                          <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{log.task}</div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                  <span>{log.log_date}</span>
                                  <span>•</span>
                                  <span>{log.staff_name}</span>
                                  <span>•</span>
                                  <span>{log.hours_worked}h worked</span>
                                  <span>•</span>
                                  <span className="text-violet-600 font-semibold">{log.progress_percentage}% progress</span>
                                </div>
                              </div>
                            </div>
                            <button className="text-slate-400 hover:text-slate-600">
                              {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                          {expandedLog === log.id && (
                            <div className="mt-3 ml-5 space-y-2">
                              {log.remarks && (
                                <p className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">{log.remarks}</p>
                              )}
                              {log.work_photos?.length > 0 && (
                                <div className="flex gap-3 flex-wrap mt-2">
                                  {log.work_photos.map((p: string, idx: number) => (
                                    <a key={idx} href={`${API_BASE_URL}${p}`} target="_blank" rel="noreferrer">
                                      <img src={`${API_BASE_URL}${p}`} alt={`work-${idx}`}
                                        className="w-24 h-24 object-cover rounded-xl border border-slate-200 hover:opacity-80 transition-opacity" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">Select a project to view its report</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Loader2, History, User, Shield, Clock, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

export default function Reports({ token, role }: { token: string; role: string }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"reports" | "login_history">("reports");
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const reportsList = [
    {
      id: "inventory",
      title: "Warehouse Inventory & Valuation",
      desc: "Detailed inventory list including SKU, category, brand, quantity, minimum level alerts, unit cost, and total asset valuation.",
      formats: [
        { name: "CSV", path: "/api/reports/inventory/csv", filename: "allure_inventory_report.csv" },
        { name: "Excel", path: "/api/reports/inventory/excel", filename: "allure_inventory_report.xlsx" },
        { name: "PDF", path: "/api/reports/inventory/pdf", filename: "allure_inventory_report.pdf" }
      ]
    },
    {
      id: "projects",
      title: "Production Projects & Budgeting",
      desc: "Summary of designs, site locations, budget allocations, start/end timelines, and overall BOM progress percentages.",
      formats: [
        { name: "CSV", path: "/api/reports/projects/csv", filename: "allure_projects_report.csv" },
        { name: "Excel", path: "/api/reports/projects/excel", filename: "allure_projects_report.xlsx" },
        { name: "PDF", path: "/api/reports/projects/pdf", filename: "allure_projects_report.pdf" }
      ]
    },
    {
      id: "purchasing",
      title: "Supplier Purchase Order Audit",
      desc: "Log of purchase requests, ordered quantities, unit costs, billing totals, status of delivery, and supplier details.",
      formats: [
        { name: "CSV", path: "/api/reports/purchasing/csv", filename: "allure_purchasing_report.csv" }
      ]
    }
  ];

  const handleDownload = async (path: string, filename: string, id: string) => {
    setDownloading(id);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ detail: "Could not download report" }));
        throw new Error(errBody.detail || "Could not download report");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Error generating report: ${e.message || "Unknown error"}`);
    } finally {
      setDownloading(null);
    }
  };

  const fetchLoginHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/login-history?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch login history");
      const data = await response.json();
      setLoginHistory(data);
    } catch (e) {
      setLoginHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "login_history" && role === "admin") {
      fetchLoginHistory();
    }
  }, [activeTab]);

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-700 border border-red-200",
    manager: "bg-blue-100 text-blue-700 border border-blue-200",
    store: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    accountant: "bg-amber-100 text-amber-700 border border-amber-200",
    worker: "bg-purple-100 text-purple-700 border border-purple-200",
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Reports & Monitoring</h2>
        <p className="text-slate-500 mt-1">Export structured Excel, PDF, and CSV files for accounting and audit checks.</p>
      </header>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 ${activeTab === "reports" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-700"}`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Export Reports
        </button>
        {role === "admin" && (
          <button
            onClick={() => setActiveTab("login_history")}
            className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 ${activeTab === "login_history" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-700"}`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Login History & Activity
          </button>
        )}
      </div>

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportsList.map((rep) => (
            <div
              key={rep.id}
              className="glass rounded-3xl p-6 border border-slate-200 dark:border-slate-800/80 shadow-md hover:shadow-lg transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{rep.title}</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{rep.desc}</p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Available Formats:</div>
                <div className="grid grid-cols-3 gap-2">
                  {rep.formats.map((fmt) => (
                    <button
                      key={fmt.name}
                      disabled={downloading !== null}
                      onClick={() => handleDownload(fmt.path, fmt.filename, `${rep.id}-${fmt.name}`)}
                      className="py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-800 dark:hover:bg-slate-700 font-bold text-[11px] shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {downloading === `${rep.id}-${fmt.name}` ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          {fmt.name}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Login History Tab */}
      {activeTab === "login_history" && role === "admin" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Login History</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 50 login events across all users</p>
            </div>
            <button
              onClick={fetchLoginHistory}
              disabled={loadingHistory}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="glass rounded-3xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-md">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading login history...
              </div>
            ) : loginHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No login records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Details</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {loginHistory.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                              <User className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{log.user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{log.user_email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${roleColors[log.user_role] || "bg-slate-100 text-slate-500"}`}>
                            {log.user_role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{log.details || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

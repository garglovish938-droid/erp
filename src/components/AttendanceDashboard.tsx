"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, UserCheck, UserX, Clock, AlertTriangle, LogOut,
  TrendingUp, Calendar, Download, ChevronLeft, ChevronRight,
  BarChart2, Activity, RefreshCw
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";

interface AttendanceDashboardProps {
  token: string;
  role: string;
}

const COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

const KPICard = ({ title, value, subtitle, icon: Icon, color, bg }: any) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 ${bg} border border-white/20 shadow-lg`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{title}</p>
        <p className="mt-1 text-3xl font-bold text-white">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-white/60">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-white/20`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
  </div>
);

export default function AttendanceDashboard({ token, role }: AttendanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<"today" | "history" | "monthly" | "trends">("today");
  const [dashboard, setDashboard] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState({ status: "", staff_id: "" });
  const [selectedDate, setSelectedDate] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const today = new Date();
  const [reportYear, setReportYear] = useState(today.getFullYear());
  const [reportMonth, setReportMonth] = useState(today.getMonth() + 1);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedDate ? `?target_date=${selectedDate}` : "";
      const data = await apiRequest(`/api/attendance/dashboard${params}`);
      setDashboard(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedDate]);

  const loadTrends = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/attendance/trends?days=30`);
      setTrends(data);
    } catch (e) { console.error(e); }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(historyPage), per_page: "30" });
      if (historyFilter.status) params.set("status_filter", historyFilter.status);
      if (historyFilter.staff_id) params.set("staff_id", historyFilter.staff_id);
      const data = await apiRequest(`/api/attendance/history?${params}`);
      setHistory(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [historyPage, historyFilter]);

  const loadMonthly = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/attendance/monthly-report?year=${reportYear}&month=${reportMonth}`);
      setMonthlyReport(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [reportYear, reportMonth]);

  useEffect(() => {
    if (activeTab === "today") { loadDashboard(); loadTrends(); }
    if (activeTab === "history") loadHistory();
    if (activeTab === "monthly") loadMonthly();
    if (activeTab === "trends") loadTrends();
  }, [activeTab, loadDashboard, loadHistory, loadMonthly, loadTrends]);

  useEffect(() => {
    const handleWebsocketEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.event === "attendance_change") {
        if (activeTab === "today") { loadDashboard(); loadTrends(); }
        if (activeTab === "history") loadHistory();
        if (activeTab === "monthly") loadMonthly();
        if (activeTab === "trends") loadTrends();
      }
    };

    window.addEventListener("erp_websocket_event", handleWebsocketEvent);
    return () => window.removeEventListener("erp_websocket_event", handleWebsocketEvent);
  }, [activeTab, loadDashboard, loadHistory, loadMonthly, loadTrends]);

  const exportAttendance = async (format: string) => {
    const url = `/api/attendance/export?year=${reportYear}&month=${reportMonth}&format=${format}`;
    
    try {
      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;
      
      const res = await fetch(`${API_BASE_URL}${url}`, {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`Export failed: ${res.statusText}`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const ext = format === "excel" ? "xlsx" : "csv";
      link.setAttribute("download", `attendance_${reportMonth}_${reportYear}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to export attendance");
    }
  };

  const statusBadge = (status: string) => {
    const map: any = {
      present: "bg-emerald-100 text-emerald-700",
      absent: "bg-red-100 text-red-700",
      leave: "bg-blue-100 text-blue-700",
      half_day: "bg-amber-100 text-amber-700",
    };
    return `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || "bg-slate-100 text-slate-600"}`;
  };

  const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Attendance Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Live factory attendance tracking & analytics</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar whitespace-nowrap">
          {(["today", "history", "monthly", "trends"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all inline-block ${activeTab === tab
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50"}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* TODAY TAB */}
      {activeTab === "today" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800" />
            <button onClick={loadDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dashboard ? (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard title="Total Employees" value={dashboard.total_employees} icon={Users} bg="bg-gradient-to-br from-slate-700 to-slate-900" />
                <KPICard title="Present Today" value={dashboard.present} subtitle={`${dashboard.attendance_percentage}% attendance`} icon={UserCheck} bg="bg-gradient-to-br from-emerald-500 to-teal-600" />
                <KPICard title="Absent" value={dashboard.absent} icon={UserX} bg="bg-gradient-to-br from-red-500 to-rose-600" />
                <KPICard title="On Leave" value={dashboard.on_leave} icon={Calendar} bg="bg-gradient-to-br from-blue-500 to-blue-700" />
                <KPICard title="Half Day" value={dashboard.half_day} icon={Clock} bg="bg-gradient-to-br from-amber-500 to-orange-600" />
                <KPICard title="Late Arrivals" value={dashboard.late_arrivals} icon={AlertTriangle} bg="bg-gradient-to-br from-orange-500 to-red-600" />
                <KPICard title="Checked Out" value={dashboard.checked_out} icon={LogOut} bg="bg-gradient-to-br from-purple-500 to-violet-700" />
                <KPICard title="Pending Checkout" value={dashboard.pending_checkout} icon={Clock} bg="bg-gradient-to-br from-cyan-500 to-blue-600" />
                <KPICard title="Attendance %" value={`${dashboard.attendance_percentage}%`} icon={TrendingUp} bg="bg-gradient-to-br from-indigo-500 to-indigo-700" />
              </div>

              {/* Today's Detail Table */}
              {dashboard.records && dashboard.records.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Today's Records</h3>
                  </div>
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
                    <table className="min-w-[650px] w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                        <tr>
                          {["Employee", "Status", "Check In", "Check Out", "Hours", "Late", "Overtime"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {dashboard.records.map((rec: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{rec.staff_name}</td>
                            <td className="px-4 py-3"><span className={statusBadge(rec.status)}>{rec.status?.replace("_", " ")}</span></td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.check_in || "—"}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.check_out || "—"}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.total_hours?.toFixed(1)}h</td>
                            <td className="px-4 py-3">
                              {rec.late_arrival ? <span className="text-orange-600 font-medium">{rec.late_minutes}m late</span> : <span className="text-emerald-600">On time</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.overtime_hours?.toFixed(1)}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">No attendance data available</div>
          )}

          {/* 30-day trend chart */}
          {trends && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" /> 30-Day Attendance Trend
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trends.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#10B981" strokeWidth={2} dot={false} name="Present" />
                  <Line type="monotone" dataKey="late" stroke="#F59E0B" strokeWidth={2} dot={false} name="Late" />
                  <Line type="monotone" dataKey="overtime_hours" stroke="#6366F1" strokeWidth={2} dot={false} name="OT Hours" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search by name..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 w-full sm:w-64 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            <select value={historyFilter.status} onChange={e => setHistoryFilter(f => ({ ...f, status: e.target.value }))}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 outline-none font-bold">
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
              <option value="half_day">Half Day</option>
            </select>
            <button onClick={loadHistory} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  Attendance History {history ? `(${history.total} records)` : ""}
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} className="p-1 hover:text-indigo-600 disabled:opacity-30" disabled={historyPage === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {historyPage}</span>
                  <button onClick={() => setHistoryPage(p => p + 1)} className="p-1 hover:text-indigo-600">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
                <table className="min-w-[750px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                    <tr>
                      {["Date", "Employee", "Status", "Check In", "Check Out", "Hours", "Late", "OT Hours", "Selfie"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-455 uppercase tracking-wider sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {history?.records?.filter((rec: any) =>
                      !historySearch || rec.staff_name?.toLowerCase().includes(historySearch.toLowerCase())
                    ).map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{rec.date}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{rec.staff_name}</td>
                        <td className="px-4 py-3"><span className={statusBadge(rec.status)}>{rec.status?.replace("_", " ")}</span></td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.check_in || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.check_out || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.total_hours?.toFixed(1)}h</td>
                        <td className="px-4 py-3">
                          {rec.late_arrival
                            ? <span className="text-xs text-orange-600 font-medium">{rec.late_minutes}m late</span>
                            : <span className="text-xs text-emerald-600">✓</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rec.overtime_hours?.toFixed(1)}h</td>
                        <td className="px-4 py-3">
                          {rec.check_in_selfie && (
                            <a href={`${API_BASE_URL}${rec.check_in_selfie}`} target="_blank" rel="noreferrer"
                              className="text-xs text-indigo-600 hover:underline">View</a>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!history?.records || history.records.length === 0) && (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No attendance records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MONTHLY TAB */}
      {activeTab === "monthly" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                ))}
              </select>
              <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={loadMonthly} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700">
                <RefreshCw className="w-4 h-4" /> Generate
              </button>
            </div>
            {["excel", "csv"].map(fmt => (
              <button key={fmt} onClick={() => exportAttendance(fmt)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm hover:border-indigo-400 transition-colors">
                <Download className="w-4 h-4 text-indigo-600" /> Export {fmt.toUpperCase()}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : monthlyReport ? (
            <>
              {/* Bar chart */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">
                  {MONTH_NAMES[reportMonth]} {reportYear} – Employee Comparison
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyReport.report} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="staff_name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present_days" name="Present" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent_days" name="Absent" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late_days" name="Late" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
                  <table className="min-w-[800px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                      <tr>
                        {["Employee", "Dept", "Present", "Half", "Leave", "Absent", "Late", "Working Hrs", "OT Hrs", "Att %"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider sticky top-0 bg-slate-55 dark:bg-slate-800 z-10">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {monthlyReport.report.map((emp: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{emp.staff_name}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{emp.department || emp.role}</td>
                          <td className="px-4 py-3 text-emerald-600 font-semibold">{emp.present_days}</td>
                          <td className="px-4 py-3 text-amber-600">{emp.half_days}</td>
                          <td className="px-4 py-3 text-blue-600">{emp.leave_days}</td>
                          <td className="px-4 py-3 text-red-600">{emp.absent_days}</td>
                          <td className="px-4 py-3 text-orange-600">{emp.late_days}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{emp.total_working_hours}h</td>
                          <td className="px-4 py-3 text-purple-600">{emp.total_overtime_hours}h</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 min-w-[40px]">
                                <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${emp.attendance_percentage}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-indigo-600">{emp.attendance_percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">Click Generate to load report</div>
          )}
        </div>
      )}

      {/* TRENDS TAB */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          <button onClick={loadTrends} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700">
            <RefreshCw className="w-4 h-4" /> Refresh Trends
          </button>

          {trends && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" /> 30-Day Present vs Absent
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trends.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill="#10B981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="#EF4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500" /> Late Arrivals & Overtime Trend
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trends.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="late" stroke="#F59E0B" strokeWidth={2} dot={false} name="Late" />
                    <Line type="monotone" dataKey="overtime_hours" stroke="#6366F1" strokeWidth={2} dot={false} name="OT Hours" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

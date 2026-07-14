"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, AlertCircle, PackageCheck, CheckCircle2, IndianRupee, 
  ShieldAlert, Layers, Bell, LayoutGrid, Settings, Plus, Trash2, 
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Save, Loader2,
  Clock, ClipboardList, CheckSquare, Sparkles, MapPin, Laptop, Calendar,
  LogOut, Camera, ShoppingCart, Receipt, Users, FolderKanban,
  ClipboardCheck, ArrowLeftRight, User, Briefcase, Landmark, ShieldCheck
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell 
} from "recharts";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { formatCurrency } from "@/lib/currency";
import { inventoryService } from "@/services/inventoryService";
import { API_BASE_URL } from "@/lib/api";
import { apiRequest } from "@/services/apiClient";
import CameraModal from "./CameraModal";

const COLORS = ["#4f46e5", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"];

const colSpanMap: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};

const getDeviceFingerprint = () => {
  if (typeof window === "undefined") return "unknown";
  const { width, height, colorDepth } = window.screen;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const language = window.navigator.language || "unknown";
  const rawFingerprint = `${width}x${height}|${colorDepth}|${timeZone}|${language}`;
  
  let hash = 0;
  for (let i = 0; i < rawFingerprint.length; i++) {
    const char = rawFingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `FP-${Math.abs(hash).toString(16)}`;
};

export default function Dashboard({ token, role, name }: { token: string; role: string; name: string }) {
  const { showToast } = useToast();
  const [widgets, setWidgets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customizeMode, setCustomizeMode] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [financialStats, setFinancialStats] = useState<any>(null);

  // Worker states
  const [attendanceStatus, setAttendanceStatus] = useState<any>(null);
  const [assignedProjects, setAssignedProjects] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [logForm, setLogForm] = useState({
    project_id: "",
    task: "",
    hours_worked: 8.0,
    progress_percentage: 10,
    remarks: ""
  });
  const [submittingLog, setSubmittingLog] = useState(false);
  const [attActionLoading, setAttActionLoading] = useState(false);
  const [workLogPhoto, setWorkLogPhoto] = useState<File | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);

  // Attendance camera state
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraMode, setCameraMode] = useState<"in" | "out">("in");
  // Checkout sub-step: selfie → work_photo → details
  const [checkoutStep, setCheckoutStep] = useState<"selfie" | "work_photo" | "details">("selfie");
  const [checkoutSelfieImage, setCheckoutSelfieImage] = useState<string | null>(null);
  const [checkoutWorkPhoto, setCheckoutWorkPhoto] = useState<string | null>(null);
  // Checkout form fields
  const [checkoutProject, setCheckoutProject] = useState("");
  const [checkoutTask, setCheckoutTask] = useState("");
  const [checkoutRemarks, setCheckoutRemarks] = useState("");
  const [checkoutProgress, setCheckoutProgress] = useState(10);

  // ── Helpers used by camera modal callbacks ───────────────────────────────
  const resetCheckoutState = () => {
    setCheckoutStep("selfie");
    setCheckoutSelfieImage(null);
    setCheckoutWorkPhoto(null);
    setCheckoutProject("");
    setCheckoutTask("");
    setCheckoutRemarks("");
    setCheckoutProgress(10);
  };

  const openCheckIn = () => {
    setCameraMode("in");
    resetCheckoutState();
    setShowCameraModal(true);
  };

  const openCheckOut = () => {
    setCameraMode("out");
    resetCheckoutState();
    setShowCameraModal(true);
  };


  const formatUtcTimeToIst = (timeStr: string | null): string => {
    if (!timeStr) return "--:--";
    try {
      if (timeStr.includes("T") || timeStr.includes("Z")) {
        const d = new Date(timeStr);
        return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit', hour12: true });
      }
      const [hoursStr, minutesStr] = timeStr.split(":");
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      const utcDate = new Date();
      utcDate.setUTCHours(hours, minutes, 0, 0);
      return utcDate.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch (e) {
      return timeStr;
    }
  };

  // ── Submit attendance (check-in or check-out) ────────────────────────────
  const handleSubmitSelfieAttendance = async (
    selfieDataUrl: string,
    workPhotoDataUrl: string | null,
    project: string,
    task: string,
    remarks: string,
    progress: number
  ) => {
    setAttActionLoading(true);
    try {
      const response = await fetch(selfieDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${cameraMode === "in" ? "check_in" : "check_out"}.jpg`, { type: "image/jpeg" });

      const fingerprint = getDeviceFingerprint();
      const browser = typeof window !== "undefined" ? window.navigator.userAgent : "unknown";
      const device = typeof window !== "undefined" ? window.navigator.userAgent.substring(0, 100) : "Web Browser";

      const formData = new FormData();
      formData.append("file", file);
      formData.append("device", device);
      formData.append("device_fingerprint", fingerprint);
      formData.append("browser_details", browser);

      if (cameraMode === "out") {
        formData.append("project_id", project);
        formData.append("task", task);
        formData.append("remarks", remarks);
        formData.append("progress_percentage", progress.toString());

        if (workPhotoDataUrl) {
          const wResponse = await fetch(workPhotoDataUrl);
          const wBlob = await wResponse.blob();
          const wFile = new File([wBlob], "work_photo.jpg", { type: "image/jpeg" });
          formData.append("work_photo", wFile);
        }
      }

      const data = await apiRequest(`/api/attendance/selfie-check-${cameraMode}`, {
        method: "POST",
        body: formData
      });

      showToast(`Successfully checked ${cameraMode === "in" ? "in" : "out"} with selfie!`, "success");

      resetCheckoutState();
      setShowCameraModal(false);

      // Refresh attendance status using apiRequest
      const attRes = await apiRequest("/api/attendance/status");
      setAttendanceStatus(attRes);
    } catch (e: any) {
      showToast(e.message || `Failed to check ${cameraMode}`, "error");
    } finally {
      setAttActionLoading(false);
    }
  };

  const formatDashboardDate = () => {
    try {
      return new Date().toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      try {
        return new Date().toLocaleDateString();
      } catch (err) {
        return new Date().toDateString();
      }
    }
  };

  const isWorker = ["worker", "operator", "carpenter"].includes(role);

  const fetchData = async () => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const [statsData, chartsData, notifData, widgetsData, attendanceData, purchasesData, expensesData, requestsData, financialData] = await Promise.all([
        fetchDataFromAPI("/api/dashboard/overview"),
        fetchDataFromAPI("/api/dashboard/charts"),
        fetchDataFromAPI("/api/notifications?unread_only=true"),
        inventoryService.getWidgets(),
        fetchDataFromAPI(`/api/attendance?target_date=${todayStr}`).catch(() => []),
        fetchDataFromAPI("/api/purchasing").catch(() => []),
        fetchDataFromAPI("/api/expenses").catch(() => []),
        fetchDataFromAPI("/api/requests").catch(() => []),
        fetchDataFromAPI("/api/financials/dashboard-summary").catch(() => null)
      ]);

      setStats(statsData);
      setCharts(chartsData);
      setNotifications(Array.isArray(notifData) ? notifData.slice(0, 5) : []);
      setWidgets(Array.isArray(widgetsData) ? widgetsData : []);
      setTodayAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setRecentPurchases(Array.isArray(purchasesData) ? purchasesData.slice(0, 5) : []);
      setRecentExpenses(Array.isArray(expensesData) ? expensesData.slice(0, 5) : []);
      setRecentRequests(Array.isArray(requestsData) ? requestsData.slice(0, 5) : []);
      setFinancialStats(financialData);
      setError("");
    } catch (err: any) {
      setError("Failed to sync dashboard layout and analytics from backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkerData = async () => {
    try {
      const [attRes, projectsRes, logsRes, expensesRes, requestsRes, tasksRes] = await Promise.all([
        apiRequest("/api/attendance/status"),
        apiRequest("/api/projects"),
        apiRequest("/api/work-logs"),
        apiRequest("/api/expenses").catch(() => []),
        apiRequest("/api/requests").catch(() => []),
        apiRequest("/api/tasks").catch(() => [])
      ]);
      setAttendanceStatus(attRes);
      setAssignedProjects(Array.isArray(projectsRes) ? projectsRes : []);
      setWorkLogs(Array.isArray(logsRes) ? logsRes : []);
      setRecentExpenses(Array.isArray(expensesRes) ? expensesRes : []);
      setRecentRequests(Array.isArray(requestsRes) ? requestsRes : []);
      setAssignedTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setError("");
    } catch (err: any) {
      setError("Failed to sync worker data from backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDataFromAPI = async (path: string) => {
    return apiRequest(path);
  };

  useEffect(() => {
    if (isWorker) {
      fetchWorkerData();
    } else {
      fetchData();
    }

    const handleWebsocketEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const msg = customEvent.detail;
      const eventType = msg?.event;

      if (eventType === "notification") {
        showToast(`[LIVE NOTIFICATION] ${msg.data.title}: ${msg.data.description}`, "info");
        setNotifications(prev => [msg.data, ...prev].slice(0, 5));
      } else if (eventType === "project_activity") {
        showToast(`[LIVE ACTIVITY] ${msg.data.employee_name}: ${msg.data.action}`, "success");
        if (!isWorker) {
          fetchData();
        }
      } else {
        if (isWorker) {
          if (["attendance_change", "project_change"].includes(eventType)) {
            fetchWorkerData();
          }
        } else {
          fetchData();
        }
      }
    };

    window.addEventListener("erp_websocket_event", handleWebsocketEvent);

    // Fallback polling (kept at 30 seconds for safety)
    const pollInterval = setInterval(() => {
      if (isWorker) {
        fetchWorkerData();
      } else {
        fetchData();
      }
    }, 30000);

    return () => {
      window.removeEventListener("erp_websocket_event", handleWebsocketEvent);
      clearInterval(pollInterval);
    };
  }, [token, role]);

  const handleUpdateWidgetPosition = (id: string, dir: "left" | "right") => {
    setWidgets(prev => prev.map(w => {
      if (w.id === id) {
        let newX = w.layout_x + (dir === "left" ? -1 : 1);
        if (newX < 0) newX = 0;
        if (newX > 11) newX = 11;
        return { ...w, layout_x: newX };
      }
      return w;
    }));
  };

  const handleResizeWidget = (id: string, action: "grow" | "shrink") => {
    setWidgets(prev => prev.map(w => {
      if (w.id === id) {
        let newW = w.layout_w + (action === "grow" ? 1 : -1);
        if (newW < 2) newW = 2;
        if (newW > 12) newW = 12;
        return { ...w, layout_w: newW };
      }
      return w;
    }));
  };

  const handleRemoveWidget = async (id: string) => {
    try {
      await inventoryService.removeWidget(id);
      setWidgets(prev => prev.filter(w => w.id !== id));
      showToast("Widget removed from dashboard", "info");
    } catch (e) {
      showToast("Failed to delete widget", "error");
    }
  };

  const handleAddWidget = async (widgetType: string) => {
    const typeTitles: Record<string, string> = {
      kpi_stock: "Warehouse Asset Valuation",
      kpi_projects: "Active Production Projects",
      kpi_po: "Open Purchase Orders",
      chart_movement: "Weekly Stock Movements",
      chart_purchases: "Monthly Purchasing Valuation",
      recent_activity: "Alerts & Notifications"
    };

    if (widgets.some(w => w.widget_type === widgetType)) {
      showToast("Widget is already on your dashboard", "warning");
      return;
    }

    const newWidget = {
      title: typeTitles[widgetType] || "New Metric Widget",
      widget_type: widgetType,
      layout_x: 0,
      layout_y: 2,
      layout_w: widgetType.startsWith("chart_") ? 6 : 4,
      layout_h: 2
    };

    try {
      const saved = await inventoryService.saveWidget(newWidget);
      setWidgets(prev => [...prev, saved]);
      showToast("Widget added successfully", "success");
    } catch (e) {
      showToast("Failed to create widget", "error");
    }
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      await Promise.all(widgets.map(w => inventoryService.saveWidget({
        title: w.title,
        widget_type: w.widget_type,
        layout_x: w.layout_x,
        layout_y: w.layout_y,
        layout_w: w.layout_w,
        layout_h: w.layout_h
      })));
      showToast("Dashboard layout saved successfully!", "success");
      setCustomizeMode(false);
    } catch (e) {
      showToast("Error updating layout coordinates", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async () => {
    setAttActionLoading(true);
    try {
      const fingerprint = getDeviceFingerprint();
      const browser = typeof window !== "undefined" ? window.navigator.userAgent : "unknown";
      const device = typeof window !== "undefined" ? window.navigator.userAgent.substring(0, 100) : "Web Browser";
      await apiRequest("/api/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ 
          device, 
          ip_address: "127.0.0.1",
          device_fingerprint: fingerprint,
          browser_details: browser
        })
      });
      showToast("Successfully checked in!", "success");
      
      const attRes = await apiRequest("/api/attendance/status");
      setAttendanceStatus(attRes);
    } catch (e: any) {
      showToast(e.message || "Failed to check in", "error");
    } finally {
      setAttActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setAttActionLoading(true);
    try {
      const fingerprint = getDeviceFingerprint();
      const browser = typeof window !== "undefined" ? window.navigator.userAgent : "unknown";
      const device = typeof window !== "undefined" ? window.navigator.userAgent.substring(0, 100) : "Web Browser";
      await apiRequest("/api/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({
          device,
          ip_address: "127.0.0.1",
          device_fingerprint: fingerprint,
          browser_details: browser
        })
      });
      showToast("Successfully checked out!", "success");
      
      const attRes = await apiRequest("/api/attendance/status");
      setAttendanceStatus(attRes);
    } catch (e: any) {
      showToast(e.message || "Failed to check out", "error");
    } finally {
      setAttActionLoading(false);
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.project_id) {
      showToast("Please select a project", "warning");
      return;
    }
    if (!logForm.task) {
      showToast("Please specify the task", "warning");
      return;
    }
    setSubmittingLog(true);
    try {
      const formData = new FormData();
      formData.append("project_id", logForm.project_id);
      formData.append("task", logForm.task);
      formData.append("hours_worked", logForm.hours_worked.toString());
      formData.append("progress_percentage", logForm.progress_percentage.toString());
      if (logForm.remarks) {
        formData.append("remarks", logForm.remarks);
      }
      if (workLogPhoto) {
        formData.append("work_photo", workLogPhoto);
      }

      await apiRequest("/api/work-logs/form", {
        method: "POST",
        body: formData
      });
      showToast("Work log submitted successfully!", "success");
      setLogForm({
        project_id: "",
        task: "",
        hours_worked: 8.0,
        progress_percentage: 10,
        remarks: ""
      });
      setWorkLogPhoto(null);
      
      const fileInput = document.getElementById("work-log-photo-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      const logsRes = await apiRequest("/api/work-logs");
      setWorkLogs(logsRes);
    } catch (e: any) {
      showToast(e.message || "Failed to submit work log", "error");
    } finally {
      setSubmittingLog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] flex-col gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading dashboard modules...</p>
      </div>
    );
  }

  if (isWorker) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-indigo-500" />
              Welcome back, {name || "Employee"}!
            </h2>
            <p className="text-slate-500 mt-1">
              Your role: <span className="font-bold text-indigo-650 dark:text-indigo-400 capitalize">{role.replace("_", " ")}</span>.
              Manage your real-time attendance and submit daily task reports.
            </p>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
            <Calendar className="w-4 h-4" />
            {formatDashboardDate()}
          </div>
        </header>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-12 gap-6 items-start">
          
          {/* Attendance Widget */}
          <div className="col-span-12 lg:col-span-5 glass rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Real-Time Attendance
              </h3>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold capitalize",
                attendanceStatus?.checked_in ? (attendanceStatus?.checked_out ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400") : "bg-rose-100 text-rose-800 dark:bg-rose-955/35 dark:text-rose-450"
              )}>
                {attendanceStatus?.checked_in 
                  ? (attendanceStatus?.checked_out ? "Shift Completed" : "Currently Active") 
                  : "Not Checked In"}
              </span>
            </div>

            {/* Attendance Details Card */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> IP Address:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-350">{attendanceStatus?.attendance?.ip_address || "127.0.0.1"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 flex items-center gap-1.5"><Laptop className="w-4 h-4" /> Device:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-350 truncate max-w-[200px]" title={attendanceStatus?.attendance?.device || "Desktop Browser"}>
                  {attendanceStatus?.attendance?.device ? (attendanceStatus.attendance.device.includes("Mobi") ? "Mobile Device" : "Desktop PC") : "Desktop PC"}
                </span>
              </div>
              <div className="border-t border-slate-200/40 dark:border-slate-800/60 my-2" />
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white dark:bg-slate-950/40 p-3 rounded-xl border border-slate-250/20 dark:border-slate-800/45">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Checked In</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatUtcTimeToIst(attendanceStatus?.attendance?.check_in)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-955/40 p-3 rounded-xl border border-slate-250/20 dark:border-slate-800/45">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Checked Out</p>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatUtcTimeToIst(attendanceStatus?.attendance?.check_out)}
                  </p>
                </div>
              </div>

              {attendanceStatus?.attendance && (
                <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/60 grid grid-cols-2 gap-4 text-xs font-medium">
                  <div>
                    <span className="text-slate-500 block">Total Hours Worked:</span>
                    <span className="text-sm font-bold text-indigo-650 dark:text-indigo-400">{attendanceStatus.attendance.total_hours} hrs</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Overtime Hours:</span>
                    <span className="text-sm font-bold text-emerald-650 dark:text-emerald-450">{attendanceStatus.attendance.overtime_hours} hrs</span>
                  </div>
                </div>
              )}

              {/* Late / Early Alerts */}
              {attendanceStatus?.attendance?.late_arrival && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-450 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Late Arrival: Checked in after standard shift start time (09:00 AM).</span>
                </div>
              )}
              {attendanceStatus?.attendance?.early_departure && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Early Departure: Checked out before standard shift end time (06:00 PM).</span>
                </div>
              )}
            </div>

            {/* Check-In/Out CTA Button */}
            {!attendanceStatus?.checked_in ? (
              <button
                onClick={openCheckIn}
                disabled={attActionLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 min-h-[56px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 text-sm"
              >
                {attActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                Register Daily Check-In
              </button>
            ) : !attendanceStatus?.checked_out ? (
              <button
                onClick={openCheckOut}
                disabled={attActionLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 min-h-[56px] bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 text-sm"
              >
                {attActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                Register Shift Check-Out
              </button>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30 rounded-2xl p-4 text-center text-emerald-850 dark:text-emerald-400 text-sm font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Shift successfully completed for today. Thank you!
              </div>
            )}
          </div>

          {/* Daily Work Log Form */}
          <div className="col-span-12 lg:col-span-7 glass rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-855 dark:text-slate-200 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              Submit Daily Work Log
            </h3>
            
            <form onSubmit={handleLogSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase">Assigned Project</label>
                  <select
                    value={logForm.project_id}
                    onChange={(e) => setLogForm({ ...logForm, project_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    <option value="">-- Choose Assigned Project --</option>
                    {assignedProjects.map(proj => (
                      <option key={proj.id} value={proj.id}>{proj.name}</option>
                    ))}
                  </select>
                </div>

                {/* Hours Worked */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase">Hours Worked</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={logForm.hours_worked}
                    onChange={(e) => setLogForm({ ...logForm, hours_worked: parseFloat(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Task Details */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Tasks Executed</label>
                <input
                  type="text"
                  placeholder="e.g. Assembled bed headboards, cutting machine operation"
                  value={logForm.task}
                  onChange={(e) => setLogForm({ ...logForm, task: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Progress Work Photo File Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase">Progress Work Photo (Optional)</label>
                  <input
                    id="work-log-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setWorkLogPhoto(e.target.files?.[0] || null)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-850 dark:file:text-indigo-400"
                  />
                </div>

                {/* Progress Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                    <span>Task Progress Percentage</span>
                    <span className="text-indigo-650 dark:text-indigo-400">{logForm.progress_percentage}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={logForm.progress_percentage}
                    onChange={(e) => setLogForm({ ...logForm, progress_percentage: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
                  />
                </div>
              </div>

              {/* Remarks and Submit */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase">Remarks / Issues (Optional)</label>
                  <textarea
                    placeholder="Mention any machine issues, shortage of materials, or blockers..."
                    value={logForm.remarks}
                    onChange={(e) => setLogForm({ ...logForm, remarks: e.target.value })}
                    rows={2}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>

                <div className="pb-1.5">
                  <button
                    type="submit"
                    disabled={submittingLog}
                    className="w-full flex items-center justify-center gap-1.5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-colors disabled:opacity-50 text-sm cursor-pointer"
                  >
                    {submittingLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                    Submit Log
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Work Log History */}
          <div className="col-span-12 glass rounded-3xl p-6">
            <h3 className="text-lg font-bold text-slate-855 dark:text-slate-200 mb-6 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              My Daily Work Logs History
            </h3>
            
            {workLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Tasks Executed</th>
                      <th className="py-3 px-4 text-right">Hours</th>
                      <th className="py-3 px-4 text-center">Progress</th>
                      <th className="py-3 px-4 text-center">Photo</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-400">
                          {new Date(log.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {log.project?.name || "N/A"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-650 dark:text-slate-350">{log.task}</td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-700 dark:text-slate-300">{log.hours_worked} hrs</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full font-bold text-[10px]",
                            log.progress_percentage >= 80 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                            log.progress_percentage >= 40 ? "bg-indigo-100 text-indigo-850 dark:bg-indigo-950/40 dark:text-indigo-400" :
                            "bg-amber-100 text-amber-800 dark:bg-amber-955/35 dark:text-amber-450"
                          )}>
                            {log.progress_percentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {log.work_photo ? (
                            <a 
                              href={`${API_BASE_URL}${log.work_photo}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-455 font-bold hover:underline cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              View
                            </a>
                          ) : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate" title={log.remarks || ""}>
                          {log.remarks || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-500" />
                <p className="font-semibold text-sm">No work logs submitted yet.</p>
                <p className="text-xs text-slate-500 mt-1">Select a project and task above to report your progress today.</p>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Tasks, Material Requests, & Expenses Summary for workers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          
          {/* Assigned Tasks Widget */}
          <div className="glass rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-500" />
              Assigned Tasks ({assignedTasks.length})
            </h3>
            {assignedTasks.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">No active tasks assigned to you.</p>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {assignedTasks.map((t) => (
                  <div key={t.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 space-y-1.5 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-xs text-slate-805 dark:text-slate-200 line-clamp-2">{t.title}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        t.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                        t.status === "in_progress" ? "bg-indigo-50 text-indigo-700" : "bg-amber-55 text-amber-700"
                      }`}>{t.status || "pending"}</span>
                    </div>
                    {t.project_name && (
                      <div className="text-[10px] text-slate-400 font-semibold">Project: {t.project_name}</div>
                    )}
                    {t.due_date && (
                      <div className="text-[10px] text-slate-405">Due: {new Date(t.due_date).toLocaleDateString()}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Material Requests Status Widget */}
          <div className="glass rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-purple-505" />
              Material Requests Status
            </h3>
            {recentRequests.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">No material requests logged.</p>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {recentRequests.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 space-y-1.5 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-xs text-slate-805 dark:text-slate-200 line-clamp-1">{r.inventory?.name || "Material Item"}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        r.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                        r.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                      }`}>{r.status || "pending"}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                      <span>Quantity: {r.quantity}</span>
                      {r.project?.name && <span className="truncate max-w-[120px]">{r.project.name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logged Expenses Summary */}
          <div className="glass rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-505" />
              Logged Expenses Summary
            </h3>
            {recentExpenses.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">No expenses logged recently.</p>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {recentExpenses.map((e) => (
                  <div key={e.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 space-y-1.5 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-xs text-slate-805 dark:text-slate-200">{e.expense_category}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        e.approval_status === "approved" ? "bg-emerald-50 text-emerald-700" :
                        e.approval_status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-55 text-amber-700"
                      }`}>{e.approval_status || "pending"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-405">{e.expense_date}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(e.amount)}</span>
                    </div>
                    {e.supervisor_comment && (
                      <div className="text-[10px] bg-white dark:bg-slate-950 p-1.5 rounded text-slate-400 italic">
                        Comment: {e.supervisor_comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Check-In Camera Modal ─────────────────────────────────────── */}
        <CameraModal
          open={showCameraModal && cameraMode === "in"}
          title="Check-In Selfie"
          mode="selfie"
          hint="Look directly at the camera. Your face should fill the oval guide."
          captureLabel="Capture Check-In Selfie"
          onCapture={(dataUrl) => {
            setShowCameraModal(false);
            handleSubmitSelfieAttendance(dataUrl, null, "", "", "", 0);
          }}
          onClose={() => setShowCameraModal(false)}
        />

        {/* ── Check-Out Camera: Step 1 – Selfie ────────────────────────── */}
        <CameraModal
          open={showCameraModal && cameraMode === "out" && checkoutStep === "selfie"}
          title="Step 1 of 3 — Check-Out Selfie"
          mode="selfie"
          hint="Capture your check-out selfie. Then you will photograph your work."
          captureLabel="Capture Check-Out Selfie"
          onCapture={(dataUrl) => {
            setCheckoutSelfieImage(dataUrl);
            setCheckoutStep("work_photo");
          }}
          onClose={() => {
            resetCheckoutState();
            setShowCameraModal(false);
          }}
        />

        {/* ── Check-Out Camera: Step 2 – Work Photo ────────────────────── */}
        <CameraModal
          open={showCameraModal && cameraMode === "out" && checkoutStep === "work_photo"}
          title="Step 2 of 3 — Work Photo (Optional)"
          mode="work_photo"
          hint="Capture a photo of your completed work or progress. You can also skip this step."
          captureLabel="Capture Work Photo"
          onCapture={(dataUrl) => {
            setCheckoutWorkPhoto(dataUrl);
            setCheckoutStep("details");
          }}
          onClose={() => {
            // Skip work photo — go straight to details
            setCheckoutWorkPhoto(null);
            setCheckoutStep("details");
          }}
        />

        {/* ── Check-Out: Step 3 – Details Form ─────────────────────────── */}
        {showCameraModal && cameraMode === "out" && checkoutStep === "details" && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden flex flex-col" style={{ maxHeight: "95dvh" }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Step 3 of 3 — Shift Details</h3>
                </div>
                <button
                  onClick={() => { resetCheckoutState(); setShowCameraModal(false); }}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              {/* Photo previews */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Check-Out Selfie</span>
                    <div className="aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800">
                      {checkoutSelfieImage && <img src={checkoutSelfieImage} className="w-full h-full object-cover" alt="selfie" />}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Work Photo</span>
                    <div className="aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                      {checkoutWorkPhoto
                        ? <img src={checkoutWorkPhoto} className="w-full h-full object-cover" alt="work" />
                        : <span className="text-[10px] text-slate-500 italic">Skipped</span>
                      }
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Select Project *</label>
                    <select
                      value={checkoutProject}
                      onChange={e => setCheckoutProject(e.target.value)}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Choose Assigned Project --</option>
                      {assignedProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Task Performed *</label>
                    <input
                      type="text"
                      placeholder="e.g. Laminating board, assembling wardrobe drawer"
                      value={checkoutTask}
                      onChange={e => setCheckoutTask(e.target.value)}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Remarks (Optional)</label>
                    <textarea
                      placeholder="Any machinery issues, material shortages..."
                      value={checkoutRemarks}
                      onChange={e => setCheckoutRemarks(e.target.value)}
                      rows={2}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl outline-none resize-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase mb-1">
                      <span>Task Completion</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{checkoutProgress}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={checkoutProgress}
                      onChange={e => setCheckoutProgress(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutStep("selfie")}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors text-sm min-h-[52px]"
                >
                  ← Retake
                </button>
                <button
                  onClick={() => {
                    if (!checkoutProject) { showToast("Please select a project", "warning"); return; }
                    if (!checkoutTask) { showToast("Please enter task details", "warning"); return; }
                    if (!checkoutSelfieImage) { showToast("Selfie missing. Please retake.", "warning"); return; }
                    handleSubmitSelfieAttendance(
                      checkoutSelfieImage,
                      checkoutWorkPhoto,
                      checkoutProject,
                      checkoutTask,
                      checkoutRemarks,
                      checkoutProgress
                    );
                  }}
                  disabled={attActionLoading}
                  className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 text-sm min-h-[52px]"
                >
                  {attActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Submit Check-Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] flex-col gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading customizable dashboard widgets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[70vh] p-4 text-center">
        <div className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Metrics Connection Failed</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            The ERP was unable to read stats from the FastAPI server. Please check connection.
          </p>
          <button 
            onClick={() => { setLoading(true); fetchData(); }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Sort widgets based on layout order
  const sortedWidgets = [...widgets].sort((a, b) => (a.layout_y - b.layout_y) || (a.layout_x - b.layout_x));

  // Dynamic Attendance Stats calculation for managers
  const presentCount = todayAttendance.filter((a: any) => a.status === "present").length;
  const absentCount = todayAttendance.filter((a: any) => a.status === "absent").length;
  const leaveCount = todayAttendance.filter((a: any) => a.status === "leave").length;
  const halfDayCount = todayAttendance.filter((a: any) => a.status === "half_day").length;
  const lateCount = todayAttendance.filter((a: any) => a.late_arrival).length;
  const checkedOutCount = todayAttendance.filter((a: any) => a.check_out).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">ERP Dashboard</h2>
          <p className="text-slate-500 mt-1">Configure widgets layout and monitor furniture factory operations.</p>
        </div>
        <div className="flex items-center gap-3">
          {customizeMode ? (
            <div className="flex gap-2">
              <button
                onClick={() => setCustomizeMode(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLayout}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-55"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Layout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCustomizeMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              Customize Layout
            </button>
          )}
        </div>
      </header>

      {/* Today's Attendance Overview for Managers/Admins */}
      {!isWorker && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm">
          <div className="text-center p-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Present Today</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-450 mt-1 block">{presentCount}</span>
          </div>
          <div className="text-center p-2 border-t sm:border-t-0 sm:border-l border-slate-200/50 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Absent</span>
            <span className="text-xl font-black text-rose-500 mt-1 block">{absentCount}</span>
          </div>
          <div className="text-center p-2 border-t lg:border-t-0 lg:border-l border-slate-200/50 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">On Leave</span>
            <span className="text-xl font-black text-amber-500 mt-1 block">{leaveCount}</span>
          </div>
          <div className="text-center p-2 border-t sm:border-t-0 sm:border-l border-slate-200/50 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Half Day</span>
            <span className="text-xl font-black text-orange-500 mt-1 block">{halfDayCount}</span>
          </div>
          <div className="text-center p-2 border-t lg:border-t-0 lg:border-l border-slate-200/50 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Late Check-In</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-455 mt-1 block">{lateCount}</span>
          </div>
          <div className="text-center p-2 border-t sm:border-t-0 sm:border-l border-slate-200/50 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Checked Out</span>
            <span className="text-xl font-black text-indigo-650 dark:text-indigo-400 mt-1 block">{checkedOutCount}</span>
          </div>
        </div>
      )}

      {/* Today's Active Check-In Selfies */}
      {!isWorker && todayAttendance.filter((a: any) => a.check_in_selfie).length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Today's Attendance Selfies</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {todayAttendance.filter((a: any) => a.check_in_selfie).map((a: any) => (
              <div key={a.id} className="relative group overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-center shadow-xs hover:shadow-md transition-all duration-300">
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 mb-2">
                  <img 
                    src={`${API_BASE_URL}${a.check_in_selfie}`} 
                    alt={a.staff_name} 
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    onError={(e: any) => { e.target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"; }}
                  />
                  <div className="absolute top-1 right-1">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                      a.late_arrival ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40"
                    )}>
                      {a.late_arrival ? "Late" : "On Time"}
                    </span>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.staff_name}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">In: {a.check_in || "—"}</p>
                {a.check_out && <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">Out: {a.check_out}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customize Panel Drawer */}
      {customizeMode && (
        <div className="p-5 bg-indigo-50/40 dark:bg-slate-900/60 border border-indigo-150/40 dark:border-slate-800 rounded-3xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 mb-3">
            <LayoutGrid className="w-4 h-4" />
            <h4 className="text-xs font-black uppercase tracking-wider">Available Dashboard Widgets</h4>
          </div>
          <p className="text-[11px] text-slate-500 mb-4">Click to add any widget below to your live executive metrics dashboard:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { type: "kpi_stock", label: "KPI: Stock Valuation" },
              { type: "kpi_projects", label: "KPI: Production Projects" },
              { type: "kpi_po", label: "KPI: Open POs" },
              { type: "chart_movement", label: "Chart: Stock Flows" },
              { type: "chart_purchases", label: "Chart: Expenses Trend" },
              { type: "chart_categories", label: "Chart: Categories Share" },
              { type: "recent_activity", label: "Alerts List" }
            ].map(item => (
              <button
                key={item.type}
                onClick={() => handleAddWidget(item.type)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Redesigned Wireframe Dashboard Layout */}
      {!customizeMode ? (
        <div className="space-y-8">
          {/* Executive Financial Dashboard Metrics */}
          {financialStats && ["admin", "manager", "accountant", "accounts_manager"].includes(role) && (
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">
                Live Factory Financial Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Factory Balance */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden group">
                  <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10 group-hover:scale-110 transition-transform duration-300">
                    <IndianRupee className="w-28 h-28" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest block">Available Factory Balance</span>
                  <span className="text-2xl font-black mt-2 block select-all">
                    {formatCurrency(financialStats.factory_balance)}
                  </span>
                  <p className="text-[9px] text-emerald-100/80 mt-1">Ready capital for purchase orders & expenses</p>
                </div>

                {/* 2. Today's Expenses */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Factory Expenses</span>
                    <span className="text-xl font-black text-rose-500 mt-1 block font-mono">
                      {formatCurrency(financialStats.today_expenses)}
                    </span>
                  </div>
                  <div className="p-3 bg-rose-500 text-white rounded-2xl">
                    <Receipt className="w-5 h-5" />
                  </div>
                </div>

                {/* 3. Today's Fund Received */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Capital Injection</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block font-mono">
                      {formatCurrency(financialStats.today_fund)}
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-500 text-white rounded-2xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>

                {/* 4. Monthly Fund */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Capital Funding</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white mt-1 block font-mono">
                      {formatCurrency(financialStats.monthly_fund)}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-500 text-white rounded-2xl">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>

                {/* 5. Project Revenue */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Project Revenue (Received)</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block font-mono">
                      {formatCurrency(financialStats.project_revenue)}
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                </div>

                {/* 6. Pending Client Payments */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Client Invoices</span>
                    <span className="text-xl font-black text-rose-600 dark:text-rose-455 mt-1 block font-mono">
                      {formatCurrency(financialStats.pending_client_payments)}
                    </span>
                  </div>
                  <div className="p-3 bg-orange-500 text-white rounded-2xl">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>

                {/* 7. Cash Flow */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Liquid Cash Flow</span>
                    <span className={`text-xl font-black mt-1 block font-mono ${financialStats.cash_flow >= 0 ? "text-emerald-650" : "text-rose-500"}`}>
                      {formatCurrency(financialStats.cash_flow)}
                    </span>
                  </div>
                  <div className={`p-3 text-white rounded-2xl ${financialStats.cash_flow >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>

                {/* 8. Net Profit */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden group">
                  <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10 group-hover:scale-110 transition-transform duration-300">
                    <Sparkles className="w-28 h-28" />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest block">Calculated Net Profit</span>
                  <span className="text-2xl font-black mt-2 block select-all font-mono">
                    {formatCurrency(financialStats.net_profit)}
                  </span>
                  <p className="text-[9px] text-indigo-100/80 mt-1">Project Revenue minus (BOM consumed + project expenses)</p>
                </div>
              </div>
            </div>
          )}

          {/* Top KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {/* Card 1: Inventory Value */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Inventory Value</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                  ₹{stats?.inventory_total_value?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "0"}
                </span>
              </div>
              <div className="p-3.5 bg-indigo-500 text-white rounded-2xl">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Pending Purchases */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Purchases</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                  {stats?.open_pos_count ?? "0"}
                </span>
              </div>
              <div className="p-3.5 bg-amber-500 text-white rounded-2xl">
                <ShoppingCart className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Today's Expense */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Today's Expense</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                  ₹{stats?.today_expense_total?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "0"}
                </span>
              </div>
              <div className="p-3.5 bg-rose-500 text-white rounded-2xl">
                <Receipt className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Active Projects */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Projects</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                  {stats?.active_projects_count ?? "0"}
                </span>
              </div>
              <div className="p-3.5 bg-purple-500 text-white rounded-2xl">
                <FolderKanban className="w-6 h-6" />
              </div>
            </div>

            {/* Card 5: Present Employees */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Present Employees</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                  {stats?.present_employees_count ?? "0"}
                </span>
              </div>
              <div className="p-3.5 bg-emerald-500 text-white rounded-2xl">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Middle Section: Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Purchase Charts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4">
                Monthly Purchase Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts?.purchases_trend || []}>
                    <defs>
                      <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => [`₹${value}`, "Amount"]} />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" fillOpacity={1} fill="url(#colorPurchases)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Expense Charts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4">
                Expense Category Share
              </h3>
              <div className="h-64 flex flex-col justify-between">
                <ResponsiveContainer width="100%" height="75%">
                  <PieChart>
                    <Pie
                      data={
                        charts?.stock_by_category?.length > 0 
                          ? charts.stock_by_category 
                          : [{ name: "Miscellaneous", value: 100 }]
                      }
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(charts?.stock_by_category || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₹${value}`, "Value"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center text-[10px] font-semibold text-slate-500">
                  {(charts?.stock_by_category || []).slice(0, 4).map((entry: any, index: number) => (
                    <span key={entry.name} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      {entry.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 3: Attendance Charts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4">
                Workforce Attendance Status
              </h3>
              <div className="h-64 flex flex-col justify-between">
                <ResponsiveContainer width="100%" height="75%">
                  <BarChart data={[
                    { name: "Present", count: presentCount },
                    { name: "Absent", count: absentCount },
                    { name: "Leave", count: leaveCount },
                    { name: "Half Day", count: halfDayCount }
                  ]}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-center text-xs font-bold text-slate-400">
                  Total Active Workforce: {todayAttendance.length}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Activity Feeds */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Recent Purchases */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-500" /> Recent Purchases
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {recentPurchases.length > 0 ? recentPurchases.map((po) => (
                  <div key={po.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{po.po_number}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{po.vendor_name || po.supplier?.name || "Unknown Supplier"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800 dark:text-slate-200">₹{po.total_cost.toLocaleString("en-IN")}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase mt-1 ${
                        po.status === "received" || po.status === "fully_received" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>{po.status}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-slate-400 text-center py-6">No recent purchases found</p>
                )}
              </div>
            </div>

            {/* Column 2: Recent Expenses */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-500" /> Recent Expenses
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {recentExpenses.length > 0 ? recentExpenses.map((exp) => (
                  <div key={exp.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{exp.expense_category}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{exp.vendor || "Direct Expense"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-600 dark:text-rose-455">₹{exp.amount.toLocaleString("en-IN")}</p>
                      <p className="text-[9px] text-slate-400 mt-1">{exp.expense_date}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-slate-400 text-center py-6">No recent expenses found</p>
                )}
              </div>
            </div>

            {/* Column 3: Recent Material Requests */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" /> Recent Material Requests
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {recentRequests.length > 0 ? recentRequests.map((req) => (
                  <div key={req.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{req.inventory?.name || "Item"}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Qty: {req.quantity} {req.inventory?.unit}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                        req.status === "approved" ? "bg-emerald-100 text-emerald-800" : 
                        req.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"
                      }`}>{req.status}</span>
                      <p className="text-[9px] text-slate-400 mt-1">{req.project?.name || "No Project Link"}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-slate-400 text-center py-6">No recent material requests found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 items-start">
        {sortedWidgets.map((widget) => {
          const gridColSpan = widget.layout_w; // 2 to 12 columns
          
          return (
            <div
              key={widget.id}
              style={{ order: widget.layout_y * 12 + widget.layout_x }}
              className={cn("col-span-12 relative transition-all duration-300", colSpanMap[gridColSpan] || "md:col-span-4")}
            >
              {/* Customize Mode Overlay Actions */}
              {customizeMode && (
                <div className="absolute top-2 right-2 z-10 bg-slate-900/90 text-white rounded-xl p-1.5 flex items-center gap-1 shadow-xl pointer-events-auto">
                  <button onClick={() => handleUpdateWidgetPosition(widget.id, "left")} title="Move Left" className="p-1 hover:bg-slate-800 rounded"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleUpdateWidgetPosition(widget.id, "right")} title="Move Right" className="p-1 hover:bg-slate-800 rounded"><ChevronRight className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleResizeWidget(widget.id, "shrink")} title="Shrink Width" className="p-1 hover:bg-slate-800 rounded"><Minimize2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleResizeWidget(widget.id, "grow")} title="Expand Width" className="p-1 hover:bg-slate-800 rounded"><Maximize2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleRemoveWidget(widget.id)} title="Remove" className="p-1 hover:bg-rose-900/40 rounded text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* Render Widgets depending on type */}
              {widget.widget_type === "kpi_stock" && (
                <StatCard 
                  title={widget.title} 
                  value={formatCurrency(stats?.inventory_total_value)} 
                  subtitle={`${stats?.inventory_total_items} Total Material Codes`}
                  icon={IndianRupee} 
                  color="bg-emerald-500" 
                />
              )}
              {widget.widget_type === "kpi_projects" && (
                <StatCard 
                  title={widget.title} 
                  value={stats?.active_projects_count} 
                  subtitle={`${stats?.completed_projects_count} Projects Completed`}
                  icon={TrendingUp} 
                  color="bg-blue-500" 
                />
              )}
              {widget.widget_type === "kpi_po" && (
                <StatCard 
                  title={widget.title} 
                  value={stats?.open_pos_count} 
                  subtitle={`${stats?.pending_deliveries_count} Pending Deliveries`}
                  icon={PackageCheck} 
                  color="bg-amber-500" 
                />
              )}

              {widget.widget_type === "chart_movement" && (
                <div className="glass rounded-3xl p-6">
                  <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 mb-6">{widget.title}</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={charts?.weeklyStockMovement} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                        <Area type="monotone" name="Inward Stock" dataKey="received" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                        <Area type="monotone" name="Outward Stock" dataKey="issued" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {widget.widget_type === "chart_purchases" && (
                <div className="glass rounded-3xl p-6">
                  <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 mb-6">{widget.title}</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.monthlyPurchaseCost} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                        <Tooltip formatter={(val) => [`₹${val}`, "Cost"]} contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                        <Bar name="Purchase Costs" dataKey="cost" fill="#4f46e5" radius={[10, 10, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {widget.widget_type === "chart_categories" && (
                <div className="glass rounded-3xl p-6">
                  <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 mb-6">{widget.title}</h3>
                  <div className="h-[250px] w-full flex flex-col sm:flex-row items-center justify-around gap-4">
                    <div className="w-[180px] h-[180px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={charts?.categoryDistribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {(charts?.categoryDistribution || []).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-col gap-1.5 text-xs font-semibold max-h-[180px] overflow-y-auto pr-2">
                      {(charts?.categoryDistribution || []).map((entry: any, index: number) => (
                        <div key={entry.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-slate-650 dark:text-slate-350">{entry.name} ({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {widget.widget_type === "chart_suppliers" && (
                <div className="glass rounded-3xl p-6 hidden">
                  <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 mb-6">{widget.title}</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts?.supplierPerformance} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                        <Bar name="Orders Placed" dataKey="orders" fill="#ec4899" radius={[10, 10, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {widget.widget_type === "recent_activity" && (
                <div className="glass rounded-3xl p-6">
                  <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 mb-6 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-500" />
                    {widget.title}
                  </h3>
                  <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div key={notif.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[11px] border border-slate-200/40">
                          <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", notif.type === "out_of_stock" ? "bg-rose-500 animate-pulse" : "bg-amber-500")} />
                          <div>
                            <h5 className="font-bold text-slate-800 dark:text-slate-200">{notif.title}</h5>
                            <p className="text-slate-500 mt-0.5 leading-relaxed">{notif.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-xs font-semibold">No stock or delay alerts</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
      {/* Check-In Camera Modal - Manager/Admin View */}
      <CameraModal
        open={showCameraModal && cameraMode === "in"}
        title="Check-In Selfie"
        mode="selfie"
        hint="Look directly at the camera."
        captureLabel="Capture Check-In Selfie"
        onCapture={(dataUrl) => {
          setShowCameraModal(false);
          handleSubmitSelfieAttendance(dataUrl, null, "", "", "", 0);
        }}
        onClose={() => setShowCameraModal(false)}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="glass rounded-3xl p-6 flex items-center justify-between hover:scale-[1.01] transition-transform duration-300">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
        <h4 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {value}
        </h4>
        <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

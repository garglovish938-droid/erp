"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, AlertCircle, PackageCheck, CheckCircle2, DollarSign, 
  ShieldAlert, Layers, Bell, LayoutGrid, Settings, Plus, Trash2, 
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Save, Loader2 
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell 
} from "recharts";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { inventoryService } from "@/services/inventoryService";
import { API_BASE_URL } from "@/lib/api";

const COLORS = ["#4f46e5", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"];

export default function Dashboard({ token }: { token: string }) {
  const { showToast } = useToast();
  const [widgets, setWidgets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customizeMode, setCustomizeMode] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, chartsData, notifData, widgetsData] = await Promise.all([
        fetchDataFromAPI("/api/dashboard/overview"),
        fetchDataFromAPI("/api/dashboard/charts"),
        fetchDataFromAPI("/api/notifications?unread_only=true"),
        inventoryService.getWidgets()
      ]);

      setStats(statsData);
      setCharts(chartsData);
      setNotifications(notifData.slice(0, 5));
      setWidgets(widgetsData);
      setError("");
    } catch (err: any) {
      setError("Failed to sync dashboard layout and analytics from backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDataFromAPI = async (path: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch(`${API_BASE_URL}${path}`, { headers });
    if (!response.ok) throw new Error("API request failed");
    return response.json();
  };

  useEffect(() => {
    fetchData();
  }, [token]);

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
              { type: "recent_activity", label: "Alerts List" }
            ].map(item => (
              <button
                key={item.type}
                onClick={() => handleAddWidget(item.type)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Widgets Grid Workspace */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {sortedWidgets.map((widget) => {
          const gridColSpan = widget.layout_w; // 2 to 12 columns
          
          return (
            <div
              key={widget.id}
              style={{ order: widget.layout_y * 12 + widget.layout_x }}
              className={`col-span-12 md:col-span-${gridColSpan} relative transition-all duration-300`}
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
                  value={`$${stats?.inventory_total_value.toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
                  subtitle={`${stats?.inventory_total_items} Total Material Codes`}
                  icon={DollarSign} 
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
                        </defs>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                        <Area type="monotone" name="Inward Stock" dataKey="received" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
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
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                        <Tooltip formatter={(val) => [`$${val}`, "Cost"]} contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                        <Bar name="Purchase Costs" dataKey="cost" fill="#4f46e5" radius={[10, 10, 0, 0]} maxBarSize={40} />
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

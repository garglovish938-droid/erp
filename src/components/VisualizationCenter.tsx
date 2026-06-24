"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, AlertCircle, BarChart3, LineChart, PieChart as PieIcon,
  CheckCircle2, Clock, Calendar, Users, Loader2, Play
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { useToast } from "./Toast";
import { API_BASE_URL } from "@/lib/api";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export default function VisualizationCenter({ token, role }: { token: string; role: string }) {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const res = await fetch(`${API_BASE_URL}/api/dashboard/visualization`, { headers });
      if (!res.ok) throw new Error("Failed to fetch visualization data");
      const result = await res.json();
      setData(result);
      setError("");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to fetch visualization stats");
      showToast(e.message || "Failed to load visualization center", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh] flex-col gap-4">
        <Loader2 className="w-12 h-12 text-indigo-650 animate-spin" />
        <p className="text-slate-500 font-semibold animate-pulse">Assembling visualization datasets...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[70vh] p-4 text-center">
        <div className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Visualization Connection Failed</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            The ERP was unable to construct the visualization layout. Please ensure the backend is running.
          </p>
          <button 
            onClick={fetchData}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Calculate current date's attendance percentage
  const todayAttRecord = data.attendance_trend?.[data.attendance_trend.length - 1];
  const currentAttPercentage = todayAttRecord ? todayAttRecord.percentage : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-indigo-500" />
            Visualization Center
          </h2>
          <p className="text-slate-500 mt-1">Real-time aggregate visual analytics and productivity indices across production units.</p>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Index */}
        <div className="glass rounded-3xl p-6 flex items-center justify-between border border-slate-200/50 dark:border-slate-800 shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Attendance Rate</span>
            <span className="text-3xl font-black text-slate-850 dark:text-white">{currentAttPercentage}%</span>
            <span className="text-xs text-slate-500 block">Active factory employees logged</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Late Arrivals Today */}
        <div className="glass rounded-3xl p-6 flex items-center justify-between border border-slate-200/50 dark:border-slate-800 shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late Arrivals (Today)</span>
            <span className="text-3xl font-black text-amber-500">{data.late_arrivals_today}</span>
            <span className="text-xs text-slate-500 block">Exceeded shift start grace timings</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Total Overtime logged today */}
        <div className="glass rounded-3xl p-6 flex items-center justify-between border border-slate-200/50 dark:border-slate-800 shadow-md">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overtime Hours (Today)</span>
            <span className="text-3xl font-black text-emerald-500">{data.overtime_hours_today} hrs</span>
            <span className="text-xs text-slate-500 block">Accumulated post shift hours</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Row 1: Charts */}
      <div className="grid grid-cols-12 gap-6">
        {/* Attendance Trend Chart */}
        <div className="col-span-12 lg:col-span-8 glass rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 flex items-center gap-2">
              <LineChart className="w-4 h-4 text-indigo-500" />
              Daily Attendance Trend (Last 7 Days)
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.attendance_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip formatter={(val) => [`${val}%`, "Attendance Rate"]} contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                <Area type="monotone" name="Attendance %" dataKey="percentage" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAtt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Productivity Chart */}
        <div className="col-span-12 lg:col-span-4 glass rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl flex flex-col justify-between">
          <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 mb-4 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-indigo-500" />
            Unit Productivity Index
          </h3>
          <div className="space-y-5 flex-1 flex flex-col justify-center">
            {data.department_productivity?.map((dept: any, index: number) => (
              <div key={dept.department} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-350">{dept.department}</span>
                  <span className="text-indigo-650 dark:text-indigo-400">{dept.score}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${dept.score}%`, 
                      backgroundColor: COLORS[index % COLORS.length] 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Material Usage vs Purchases Expenses */}
      <div className="grid grid-cols-12 gap-6">
        {/* Monthly Purchase Expense Trend */}
        <div className="col-span-12 lg:col-span-6 glass rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl">
          <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-200 mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Monthly Purchasing Cost (Last 6 Months)
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.expense_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip formatter={(val) => [`$${val.toLocaleString()}`, "Expenses"]} contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                <Bar name="Purchase cost" dataKey="expense" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Material stock out volume */}
        <div className="col-span-12 lg:col-span-6 glass rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl">
          <h3 className="text-sm font-extrabold text-slate-855 dark:text-slate-200 mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Outward Material Stock Flows (Last 7 Days)
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.material_usage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip formatter={(val) => [val, "Quantity Issued"]} contentStyle={{ borderRadius: '16px', border: 'none', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }} />
                <Bar name="Materials quantity issued" dataKey="quantity" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Project Progress and Employee Performance Leaderboards */}
      <div className="grid grid-cols-12 gap-6">
        {/* Project Completion Tracker */}
        <div className="col-span-12 lg:col-span-6 glass rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl">
          <h3 className="text-sm font-extrabold text-slate-855 dark:text-slate-200 mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
            Active Projects Completion Progress
          </h3>
          <div className="space-y-5 max-h-[300px] overflow-y-auto pr-1">
            {data.project_progress && data.project_progress.length > 0 ? (
              data.project_progress.map((p: any) => (
                <div key={p.project_name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{p.project_name}</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{p.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-805 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-650 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-400 py-10">No active production projects found.</div>
            )}
          </div>
        </div>

        {/* Worker Performance Rankings */}
        <div className="col-span-12 lg:col-span-6 glass rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl">
          <h3 className="text-sm font-extrabold text-slate-855 dark:text-slate-200 mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Worker Productivity Leaderboard
          </h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
            {data.worker_performance && data.worker_performance.length > 0 ? (
              data.worker_performance.map((worker: any, idx: number) => (
                <div key={worker.name} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-850/80">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner",
                      idx === 0 ? "bg-amber-100 text-amber-800" :
                      idx === 1 ? "bg-slate-200 text-slate-700" :
                      idx === 2 ? "bg-amber-50 text-amber-700" :
                      "bg-slate-100 text-slate-400"
                    )}>
                      #{idx + 1}
                    </div>
                    <span className="text-xs font-bold text-slate-805 dark:text-slate-200">{worker.name}</span>
                  </div>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/40 px-2 py-0.5 rounded-lg">
                    {worker.score}% Score
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-400 py-10">No employee evaluation logs recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

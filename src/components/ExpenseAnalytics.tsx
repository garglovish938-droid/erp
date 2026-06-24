"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, PieChart as PieIcon, TrendingUp, Download, BarChart2,
  RefreshCw, DollarSign, Calendar, Package, Truck
} from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { apiRequest } from "@/services/apiClient";

interface ExpenseAnalyticsProps {
  token: string;
  role: string;
}

const COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16", "#EC4899", "#14B8A6", "#6B7280"];

const SummaryCard = ({ title, amount, count, icon: Icon, color }: any) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
          ₹{amount?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "0"}
        </p>
        <p className="text-xs text-slate-400 mt-1">{count} orders</p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

const CUSTOM_RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * CUSTOM_RADIAN);
  const y = cy + radius * Math.sin(-midAngle * CUSTOM_RADIAN);
  return percent > 0.05 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};

export default function ExpenseAnalytics({ token, role }: ExpenseAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "categories" | "vendors" | "projects" | "trends">("overview");
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any>(null);
  const [vendors, setVendors] = useState<any>(null);
  const [projectCosts, setProjectCosts] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [exportFormat, setExportFormat] = useState("excel");
  const [expCategories, setExpCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumData, catData, vendData, projData, trendData, catListData] = await Promise.all([
        apiRequest("/api/purchases/expense-summary"),
        apiRequest(`/api/purchases/category-report${dateFilter.start ? `?start_date=${dateFilter.start}${dateFilter.end ? `&end_date=${dateFilter.end}` : ""}` : ""}`),
        apiRequest(`/api/purchases/vendor-report${dateFilter.start ? `?start_date=${dateFilter.start}${dateFilter.end ? `&end_date=${dateFilter.end}` : ""}` : ""}`),
        apiRequest("/api/purchases/project-cost"),
        apiRequest("/api/purchases/trends?months=6"),
        apiRequest("/api/expense/categories"),
      ]);
      setSummary(sumData);
      setCategories(catData);
      setVendors(vendData);
      setProjectCosts(projData);
      setTrends(trendData);
      setExpCategories(catListData?.categories || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  const exportData = async () => {
    const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    const params = new URLSearchParams({ format: exportFormat });
    if (dateFilter.start) params.set("start_date", dateFilter.start);
    if (dateFilter.end) params.set("end_date", dateFilter.end);
    
    try {
      const savedUser = localStorage.getItem("allure_erp_user");
      const userToken = savedUser ? JSON.parse(savedUser).token : token;
      
      const res = await fetch(`${BASE}/api/purchases/export?${params}`, {
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
      const fileExtensions: Record<string, string> = { excel: "xlsx", csv: "csv", pdf: "pdf" };
      const ext = fileExtensions[exportFormat] || "xlsx";
      link.setAttribute("download", `purchase_orders.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to export data");
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: DollarSign },
    { id: "categories", label: "Categories", icon: PieIcon },
    { id: "vendors", label: "Vendors", icon: Truck },
    { id: "projects", label: "Projects", icon: Package },
    { id: "trends", label: "Trends", icon: TrendingUp },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600">
            Expense Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">Purchase & expense intelligence center</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={dateFilter.start} onChange={e => setDateFilter(f => ({ ...f, start: e.target.value }))}
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800" />
          <input type="date" value={dateFilter.end} onChange={e => setDateFilter(f => ({ ...f, end: e.target.value }))}
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800" />
          <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800">
            <option value="excel">Excel</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
          <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ? "bg-emerald-600 text-white shadow-md" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 border border-slate-200 dark:border-slate-700"
              }`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {activeTab === "overview" && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title="Today" amount={summary.today?.total} count={summary.today?.count} icon={Calendar} color="bg-indigo-500" />
                <SummaryCard title="This Week" amount={summary.this_week?.total} count={summary.this_week?.count} icon={BarChart2} color="bg-emerald-500" />
                <SummaryCard title="This Month" amount={summary.this_month?.total} count={summary.this_month?.count} icon={ShoppingCart} color="bg-amber-500" />
                <SummaryCard title="This Year" amount={summary.this_year?.total} count={summary.this_year?.count} icon={TrendingUp} color="bg-purple-500" />
              </div>

              {/* Category Pie */}
              {categories?.categories?.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Expense by Category</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={categories.categories} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={100}
                          labelLine={false} label={renderCustomLabel}>
                          {categories.categories.map((_: any, index: number) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Amount"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Category Breakdown</h3>
                    <div className="space-y-3">
                      {categories.categories.map((cat: any, i: number) => (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-700 dark:text-slate-200 font-medium">{cat.category}</span>
                            <span className="text-slate-500">₹{cat.amount.toLocaleString("en-IN")} ({cat.percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${cat.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === "categories" && categories && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Category-Wise Report</h3>
                <p className="text-xs text-slate-500 mt-1">Grand Total: ₹{categories.grand_total?.toLocaleString("en-IN")}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    {["Category", "Orders", "Amount", "% Share", "Bar"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {categories.categories.map((cat: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {cat.category}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{cat.count}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-100">₹{cat.amount.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3 text-indigo-600 font-bold">{cat.percentage}%</td>
                      <td className="px-5 py-3 w-36">
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* VENDORS TAB */}
          {activeTab === "vendors" && vendors && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Vendor-Wise Analysis</h3>
                  <p className="text-xs text-slate-500 mt-1">Grand Total: ₹{vendors.grand_total?.toLocaleString("en-IN")}</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      {["Vendor", "Orders", "Total Amount", "% Share", "Quantity"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {vendors.vendors.length > 0 ? vendors.vendors.map((v: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{v.vendor}</td>
                        <td className="px-5 py-3 text-slate-500">{v.count}</td>
                        <td className="px-5 py-3 font-semibold text-emerald-600">₹{v.total_amount.toLocaleString("en-IN")}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${v.percentage}%` }} />
                            </div>
                            <span className="text-xs text-emerald-600 font-semibold">{v.percentage}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{v.total_quantity}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No vendor data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PROJECTS TAB */}
          {activeTab === "projects" && projectCosts && (
            <div className="space-y-4">
              {projectCosts.projects.map((proj: any) => (
                <div key={proj.project_id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{proj.project_name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        proj.status === "active" ? "bg-emerald-100 text-emerald-700" :
                        proj.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                      }`}>{proj.status}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-600">{proj.completion_percentage}%</div>
                      <div className="text-xs text-slate-400">complete</div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-3">
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500" style={{ width: `${proj.completion_percentage}%` }} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">₹{proj.budget?.toLocaleString("en-IN")}</div>
                      <div className="text-xs text-slate-400">Budget</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-red-600">₹{proj.material_cost?.toLocaleString("en-IN")}</div>
                      <div className="text-xs text-slate-400">Material Cost</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-indigo-600">{proj.assigned_workers}</div>
                      <div className="text-xs text-slate-400">Workers</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-purple-600">{proj.total_work_hours}h</div>
                      <div className="text-xs text-slate-400">Work Hours</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TRENDS TAB */}
          {activeTab === "trends" && trends && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">6-Month Expense Trend</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trends.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Total"]} />
                    <Legend />
                    <Bar dataKey="total" name="Expense (₹)" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Order Count Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trends.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 5 }} name="Orders" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Login from "@/components/Login";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import Inventory from "@/components/Inventory";
import Projects from "@/components/Projects";
import MaterialRequests from "@/components/MaterialRequests";
import Purchasing from "@/components/Purchasing";
import CRM from "@/components/CRM";
import Suppliers from "@/components/Suppliers";
import Team from "@/components/Team";
import Reports from "@/components/Reports";
import Settings from "@/components/Settings";
import VisualizationCenter from "@/components/VisualizationCenter";
import AttendanceDashboard from "@/components/AttendanceDashboard";
import ExpenseAnalytics from "@/components/ExpenseAnalytics";
import ProjectProgress from "@/components/ProjectProgress";
import DailyExpenses from "@/components/DailyExpenses";

import { apiRequest } from "@/services/apiClient";

export default function Home() {
  const [user, setUser] = useState<{ token: string; refresh_token: string; role: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    // Intercept all fetch requests globally to catch 401 Unauthorized errors
    if (typeof window !== "undefined" && !(window as any).__fetch_intercepted__) {
      (window as any).__fetch_intercepted__ = true;
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const url = args[0];
        const isLoginRequest = typeof url === 'string' && url.includes('/api/auth/login');
        if (response.status === 401 && !isLoginRequest) {
          localStorage.removeItem("allure_erp_user");
          window.location.reload();
        }
        return response;
      };
    }

    const savedUser = localStorage.getItem("allure_erp_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("allure_erp_user");
      }
    }
  }, []);

  const handleLogin = (userData: { token: string; refresh_token: string; role: string; name: string }) => {
    setUser(userData);
    localStorage.setItem("allure_erp_user", JSON.stringify(userData));
    // Workers default to attendance page
    if (["worker", "operator", "carpenter", "machine_operator", "quality_inspector", "store_assistant"].includes(userData.role)) {
      setActiveTab("attendance");
    } else {
      setActiveTab("dashboard");
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Failed to log out on backend", e);
    }
    setUser(null);
    localStorage.removeItem("allure_erp_user");
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative">
      {/* Mobile Backdrop Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileSidebarOpen(false);
        }}
        userRole={user.role}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 z-35 shadow-sm">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
            aria-label="Toggle Sidebar"
          >
            {/* Hamburger Icon */}
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-md">
              A
            </div>
            <span className="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Allure Living
            </span>
          </div>
          <div className="w-6" /> {/* Spacer */}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {activeTab === "dashboard" && <Dashboard token={user.token} role={user.role} name={user.name} />}
          {activeTab === "attendance" && <AttendanceDashboard token={user.token} role={user.role} />}
          {activeTab === "inventory" && <Inventory token={user.token} role={user.role} />}
          {activeTab === "projects" && <Projects token={user.token} role={user.role} />}
          {activeTab === "project-progress" && <ProjectProgress token={user.token} role={user.role} />}
          {activeTab === "requests" && <MaterialRequests token={user.token} role={user.role} />}
          {activeTab === "purchasing" && <Purchasing token={user.token} role={user.role} />}
          {activeTab === "daily-expenses" && <DailyExpenses token={user.token} role={user.role} />}
          {activeTab === "expense-analytics" && <ExpenseAnalytics token={user.token} role={user.role} />}
          {activeTab === "crm" && <CRM token={user.token} role={user.role} />}
          {activeTab === "suppliers" && <Suppliers token={user.token} role={user.role} />}
          {activeTab === "team" && <Team token={user.token} role={user.role} />}
          {activeTab === "reports" && <Reports token={user.token} role={user.role} />}
          {activeTab === "settings" && <Settings token={user.token} role={user.role} />}
          {activeTab === "visualization" && <VisualizationCenter token={user.token} role={user.role} />}
        </main>
      </div>
    </div>
  );
}

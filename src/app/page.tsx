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

import { apiRequest } from "@/services/apiClient";

export default function Home() {
  const [user, setUser] = useState<{ token: string; role: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const savedUser = localStorage.getItem("allure_erp_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("allure_erp_user");
      }
    }
  }, []);

  const handleLogin = (userData: { token: string; role: string; name: string }) => {
    setUser(userData);
    localStorage.setItem("allure_erp_user", JSON.stringify(userData));
    // Default route for worker can be team or notifications
    if (userData.role === "worker") {
      setActiveTab("team");
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
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={user.role} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        {activeTab === "dashboard" && <Dashboard token={user.token} />}
        {activeTab === "inventory" && <Inventory token={user.token} role={user.role} />}
        {activeTab === "projects" && <Projects token={user.token} role={user.role} />}
        {activeTab === "requests" && <MaterialRequests token={user.token} role={user.role} />}
        {activeTab === "purchasing" && <Purchasing token={user.token} role={user.role} />}
        {activeTab === "crm" && <CRM token={user.token} role={user.role} />}
        {activeTab === "suppliers" && <Suppliers token={user.token} role={user.role} />}
        {activeTab === "team" && <Team token={user.token} role={user.role} />}
        {activeTab === "reports" && <Reports token={user.token} role={user.role} />}
        {activeTab === "settings" && <Settings token={user.token} role={user.role} />}
      </main>
    </div>
  );
}


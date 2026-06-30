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
import Archive from "@/components/Archive";

import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";
import { Clock, Sparkles, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [user, setUser] = useState<{ token: string; refresh_token: string; role: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Time synchronization states
  const [serverOffset, setServerOffset] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // AI Assistant Drawer states
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "Hello! I am your AI ERP Assistant. How can I help you manage the factory today?" }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    // Intercept all fetch requests globally to catch 401 Unauthorized errors
    if (typeof window !== "undefined" && !(window as any).__fetch_intercepted__) {
      (window as any).__fetch_intercepted__ = true;
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const url = args[0];
        const isLoginRequest = typeof url === 'string' && url.includes('/api/auth/login');
        const isRefreshRequest = typeof url === 'string' && url.includes('/api/auth/refresh');
        
        if (response.status === 401 && !isLoginRequest) {
          if (isRefreshRequest) {
            localStorage.removeItem("allure_erp_user");
            window.location.reload();
          } else {
            const savedUser = localStorage.getItem("allure_erp_user");
            let hasRefreshToken = false;
            if (savedUser) {
              try {
                const parsed = JSON.parse(savedUser);
                if (parsed.refresh_token || parsed.refreshToken) {
                  hasRefreshToken = true;
                }
              } catch (e) {}
            }
            if (!hasRefreshToken) {
              localStorage.removeItem("allure_erp_user");
              window.location.reload();
            }
          }
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

  // Sync server time on mount and calculate drift offset
  useEffect(() => {
    async function syncTime() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/time`);
        if (res.ok) {
          const data = await res.json();
          const serverTime = new Date(data.utc_time).getTime();
          const clientTime = Date.now();
          setServerOffset(serverTime - clientTime);
        }
      } catch (e) {
        console.error("Failed to sync server time", e);
      }
    }
    syncTime();
  }, []);

  // Update synchronized timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date(Date.now() + serverOffset));
    }, 1000);
    return () => clearInterval(timer);
  }, [serverOffset]);

  useEffect(() => {
    if (!user) return;

    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsHost = window.location.host;
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    if (apiUrl) {
      try {
        const urlObj = new URL(apiUrl);
        wsHost = urlObj.host;
      } catch (e) {}
    }
    
    if (wsHost.includes("localhost:3000") || wsHost.includes("127.0.0.1:3000")) {
      wsHost = "localhost:8000";
    }
    
    const wsUrl = `${wsProto}//${wsHost}/ws`;
    console.log("Connecting to WebSocket:", wsUrl);
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isDisposed = false;
    
    function connect() {
      if (isDisposed) return;
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket connected successfully");
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message received:", message);
          
          const customEvent = new CustomEvent("erp_websocket_event", { detail: message });
          window.dispatchEvent(customEvent);
        } catch (e) {
          if (event.data === "pong") {
            console.log("WebSocket keepalive pong received");
          } else {
            console.error("Failed to parse websocket message", e);
          }
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket closed. Attempting reconnect...");
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
      
      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    }
    
    connect();
    
    const pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 30000);
    
    return () => {
      isDisposed = true;
      clearInterval(pingInterval);
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  const handleLogin = (userData: { token: string; refresh_token: string; role: string; name: string }) => {
    setUser(userData);
    localStorage.setItem("allure_erp_user", JSON.stringify(userData));
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

  const formatClockTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-955 text-slate-900 dark:text-slate-100 relative">
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
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono text-indigo-650 dark:text-indigo-400 bg-slate-50 dark:bg-slate-950/80 border border-slate-200/40 px-2.5 py-1 rounded-xl shadow-xs">
            <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-500" />
            <span>{formatClockTime(currentTime)}</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              A
            </div>
          </div>
        </header>

        {/* Desktop Header Top Bar */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 flex-shrink-0 z-30 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 capitalize">Module:</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{activeTab.replace("-", " ")}</span>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Synchronized Server Clock */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-955/80 px-4 py-1.5 rounded-2xl border border-slate-200/30 dark:border-slate-805/40 text-xs font-medium shadow-inner">
              <Clock className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span className="text-slate-500 dark:text-slate-400 select-none">IST:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-wide">{formatClockTime(currentTime)}</span>
            </div>
            
            {/* User Profile Summary */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold capitalize">
                {user.name.charAt(0)}
              </div>
              <div className="text-[10px] text-left">
                <p className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{user.name}</p>
                <p className="text-slate-500 uppercase font-semibold text-[8px] tracking-wide">{user.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative bg-slate-50/50 dark:bg-slate-950/50">
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
          {activeTab === "team" && <Team token={user.token} role={user.role} />}
          {activeTab === "reports" && <Reports token={user.token} role={user.role} />}
          {activeTab === "settings" && <Settings token={user.token} role={user.role} />}
          {activeTab === "visualization" && <VisualizationCenter token={user.token} role={user.role} />}
          {activeTab === "archive" && <Archive token={user.token} role={user.role} />}
        </main>
      </div>

      {/* Floating AI Assistant Trigger */}
      <button
        onClick={() => setAiOpen(true)}
        className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-40 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-650 hover:to-purple-750 text-white p-4 rounded-full shadow-2xl hover:shadow-indigo-500/20 transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 group border border-indigo-400/20"
      >
        <Sparkles className="w-6 h-6 animate-pulse" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-sm whitespace-nowrap ml-0 group-hover:ml-2">
          AI Assistant
        </span>
      </button>


      {/* AI Assistant Chat Drawer */}
      {aiOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-45 transition-opacity"
            onClick={() => setAiOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm">AI ERP Assistant</h3>
                  <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Online & Connected
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                className="text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed",
                    msg.sender === "user"
                      ? "ml-auto bg-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/40 dark:border-slate-700/40"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}
              {aiLoading && (
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-none p-3 text-xs w-20 flex items-center justify-center gap-1 border border-slate-200/40 dark:border-slate-700/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
            {/* Input Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!aiInput.trim()) return;
                const userMsg = aiInput;
                setAiInput("");
                setAiMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
                setAiLoading(true);
                try {
                  const data = await apiRequest("/api/ai/chat", {
                    method: "POST",
                    body: JSON.stringify({ message: userMsg }),
                  });
                  setAiMessages((prev) => [...prev, { sender: "ai", text: data.response }]);
                } catch (err) {
                  setAiMessages((prev) => [...prev, { sender: "ai", text: "Sorry, I am unable to connect to the backend AI services right now." }]);
                } finally {
                  setAiLoading(false);
                }
              }}
              className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask AI about inventory, projects, staff..."
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all font-bold text-xs shadow-md shadow-indigo-200 dark:shadow-none"
              >
                Send
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

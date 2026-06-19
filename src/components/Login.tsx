"use client";

import { useState } from "react";
import { LogIn, Key, Mail, ShieldAlert } from "lucide-react";

import { API_BASE_URL } from "@/lib/api";

interface LoginProps {
  onLogin: (user: { token: string; role: string; name: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { name: "Super Admin", email: "admin@allure.com", pass: "admin123", role: "admin", color: "from-red-500 to-rose-600" },
    { name: "Project Manager", email: "pm@allure.com", pass: "pm123", role: "manager", color: "from-blue-500 to-indigo-600" },
    { name: "Inventory Manager", email: "store@allure.com", pass: "store123", role: "store", color: "from-emerald-500 to-teal-600" },
    { name: "Accountant", email: "accountant@allure.com", pass: "accountant123", role: "accountant", color: "from-amber-500 to-orange-600" },
    { name: "Staff User", email: "staff@allure.com", pass: "staff123", role: "worker", color: "from-purple-500 to-violet-600" },
  ];

  const handleQuickLogin = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    submitLogin(accEmail, accPass);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitLogin(email, password);
  };

  const submitLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Authentication failed");
      }

      const data = await response.json();
      onLogin({
        token: data.access_token,
        role: data.role,
        name: data.full_name
      });
    } catch (err: any) {
      setError(err.message || "Could not connect to FastAPI server. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8 text-center animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-extrabold text-3xl shadow-xl shadow-indigo-500/20 mb-4 hover:rotate-6 transition-transform">
            A
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
            ALLURE LIVING ERP
          </h2>
          <p className="text-slate-400 mt-2 text-sm max-w-xs">
            Furniture Manufacturing & Project Management Enterprise System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-500">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-indigo-400" />
            Sign in to Workspace
          </h3>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-xl p-4 mb-6 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Connection Error</p>
                <p className="mt-1 text-slate-300 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="admin@allure.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Password</label>
              <div className="relative">
                <Key className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                "Access System"
              )}
            </button>
          </form>

          {/* Quick Demo Accs */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
              Demo Access Simulator
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  onClick={() => handleQuickLogin(acc.email, acc.pass)}
                  className="p-2.5 rounded-xl border border-slate-800/60 bg-slate-950/40 hover:bg-slate-850/60 hover:border-slate-700/85 text-left transition-all text-xs group"
                >
                  <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors">{acc.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{acc.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

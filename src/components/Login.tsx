"use client";

import { useState } from "react";
import { LogIn, Key, User, ShieldAlert, HelpCircle } from "lucide-react";

import { API_BASE_URL } from "@/lib/api";

interface LoginProps {
  onLogin: (user: { token: string; refresh_token: string; role: string; name: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitLogin(username, password);
  };

  const submitLogin = async (loginUsername: string, loginPass: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPass }),
      });

      if (!response.ok) {
        const data = await response.json();
        // Pydantic validation errors return detail as an array of objects
        let detail = data.detail;
        if (Array.isArray(detail)) {
          detail = detail.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
        } else if (typeof detail === "object" && detail !== null) {
          detail = JSON.stringify(detail);
        }
        throw new Error(detail || "Authentication failed");
      }

      const data = await response.json();
      onLogin({
        token: data.access_token,
        refresh_token: data.refresh_token,
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

        <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-500">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-indigo-400" />
            Employee Login
          </h3>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs rounded-xl p-4 mb-6 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Error</p>
                <p className="mt-1 text-slate-300 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Employee ID / Mobile Number</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="EMP-001 or 9876543210"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Forgot Password?
                </button>
              </div>
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
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center relative z-50">
            <HelpCircle className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-white">Reset Password Help</h4>
            <p className="text-xs text-slate-400 leading-relaxed mt-2">
              For security reasons, password resets must be executed by your system administrator. 
              Please contact your Super Admin to receive a temporary credential reset.
            </p>
            <button
              onClick={() => setShowForgotModal(false)}
              className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-955 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full glass border border-red-200/50 dark:border-red-900/30 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-650 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Application Exception Encountered
              </h1>
              <p className="text-xs text-slate-500">
                A client-side error occurred while rendering this view.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-2xl text-left border border-slate-200/50 dark:border-slate-800/80 overflow-auto max-h-40">
                <p className="text-xs font-bold text-red-650 dark:text-red-400 font-mono">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-mono whitespace-pre-wrap leading-tight">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-3 px-4 bg-indigo-650 hover:bg-indigo-750 text-white rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

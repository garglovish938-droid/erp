"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ScanBarcode, QrCode, Printer, Search, AlertTriangle, 
  CheckCircle2, XCircle, RefreshCw, FileSpreadsheet, LayoutGrid, Smartphone, History
} from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BarcodeCenterProps {
  token: string;
  role: string;
}

export default function BarcodeCenter({ token, role }: BarcodeCenterProps) {
  const [activeSubTab, setActiveSubTab] = useState<"gen" | "scan" | "print" | "history">("scan");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Options lists for dropdowns
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<any>(null);

  // Form State: Generate Barcode
  const [genType, setGenType] = useState<"inventory" | "project">("inventory");
  const [genEntityId, setGenEntityId] = useState("");
  const [generatedBarcode, setGeneratedBarcode] = useState("");

  // Form State: Scan Barcode
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  
  // Stock Adjustment for Scanned Item
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Form State: Print Barcode
  const [printBarcode, setPrintBarcode] = useState("");
  const [printCopies, setPrintCopies] = useState(1);
  const [printSize, setPrintSize] = useState("50x25"); // 50x25, 60x40, A4

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    try {
      const items = await apiRequest("/api/inventory");
      setInventoryItems(items || []);
      const projs = await apiRequest("/api/projects");
      setProjects(projs || []);
      if (activeSubTab === "history") {
        const history = await apiRequest("/api/barcode/center/history");
        setHistoryList(history || []);
      }
    } catch (e) {}
  };

  // Camera scanner setup
  useEffect(() => {
    if (!cameraActive) {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    script.onload = () => {
      const Html5QrcodeScanner = (window as any).Html5QrcodeScanner;
      if (!Html5QrcodeScanner) return;

      const scanner = new Html5QrcodeScanner(
        "qr-reader-barcode-center",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText: string) => {
          handleScannedBarcode(decodedText);
          scanner.clear();
          setCameraActive(false);
        },
        (error: any) => {}
      );
      scannerRef.current = scanner;
    };
    document.body.appendChild(script);

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
      }
    };
  }, [cameraActive]);

  const handleScannedBarcode = (text: string) => {
    setScanInput(text);
    handleLookup(text);
  };

  const handleLookup = async (code: string) => {
    if (!code) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setScanResult(null);
    try {
      const res = await apiRequest("/api/barcode/center/scan", {
        method: "POST",
        body: JSON.stringify({ barcode: code })
      });
      setScanResult(res);
      setSuccessMsg(`Record resolved successfully: ${res.type === "inventory" ? res.item.name : res.project.name}`);
    } catch (e: any) {
      setErrorMsg(e.message || "No record matched this barcode in database.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genEntityId) {
      setErrorMsg("Please select an item or project first.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setGeneratedBarcode("");
    try {
      const res = await apiRequest("/api/barcode/center/generate", {
        method: "POST",
        body: JSON.stringify({
          entity_type: genType,
          entity_id: genEntityId
        })
      });
      setGeneratedBarcode(res.barcode);
      setSuccessMsg("Unique barcode generated successfully!");
      fetchData();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to generate barcode.");
    } finally {
      setLoading(false);
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult || scanResult.type !== "inventory" || adjustQty <= 0) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      // Reuse existing backend inventory adjustment endpoint
      const payload = {
        quantity_changed: adjustType === "in" ? adjustQty : -adjustQty,
        notes: adjustNotes || "Barcode Center Adjustment"
      };
      await apiRequest(`/api/inventory/${scanResult.item.id}/stock`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccessMsg("Stock balance adjusted successfully!");
      // Reload lookup details
      handleLookup(scanResult.item.barcode);
      setAdjustQty(0);
      setAdjustNotes("");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to adjust inventory stock.");
    } finally {
      setLoading(false);
    }
  };

  const triggerPrintPdf = async (barcodeVal: string, sizeVal: string, copiesVal: number, itemId: string) => {
    try {
      // Log print count
      await apiRequest(`/api/barcode/center/print-log?barcode=${barcodeVal}`, { method: "POST" });
    } catch (e) {}
    // Open print label PDF endpoint
    window.open(`${API_BASE_URL}/api/wms/print-label?inventory_id=${itemId}&label_type=${sizeVal}&copies=${copiesVal}&token=${token}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl border border-slate-800 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.1),transparent)]" />
        <div className="z-10">
          <h2 className="text-3xl font-extrabold tracking-tight">Barcode Center</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-lg">
            Scan and print unique identification labels for inventory items and project boards.
          </p>
        </div>
      </div>

      {/* Camera scanner wrapper */}
      {cameraActive && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md mx-auto relative">
          <button 
            onClick={() => setCameraActive(false)}
            className="absolute top-4 right-4 text-slate-450 hover:text-white z-10 cursor-pointer"
          >
            <XCircle className="w-6 h-6" />
          </button>
          <h3 className="text-white text-sm font-bold text-center mb-4">Camera Scan Mode</h3>
          <div id="qr-reader-barcode-center" className="overflow-hidden rounded-2xl bg-black border border-slate-800" />
          <p className="text-slate-450 text-[10px] text-center mt-3">Align Barcode inside scanner window</p>
        </div>
      )}

      {/* Toast Alert Feedback */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-250 text-rose-800 rounded-2xl animate-fade-in shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <p className="text-xs font-semibold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Navigation Sub Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200/50 dark:border-slate-800/60">
        {[
          { id: "scan", label: "Scan Barcode", icon: ScanBarcode },
          { id: "gen", label: "Generate Barcode", icon: QrCode },
          { id: "print", label: "Print Barcode", icon: Printer },
          { id: "history", label: "Barcode History", icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id as any);
                setErrorMsg("");
                setSuccessMsg("");
                setGeneratedBarcode("");
              }}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all select-none whitespace-nowrap cursor-pointer",
                active 
                  ? "bg-indigo-650 text-white shadow-lg shadow-indigo-600/10" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}

      {/* Option 1: Scan Barcode */}
      {activeSubTab === "scan" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md lg:col-span-1 space-y-4">
            <h3 className="font-bold text-slate-850 dark:text-slate-200 text-sm">Scan Input</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scan or type barcode (AL-XXXXXX / PRJ-XXXXXX)..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup(scanInput)}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleLookup(scanInput)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-755 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Find
                </button>
              </div>
              <button 
                onClick={() => setCameraActive(!cameraActive)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-all"
              >
                <Smartphone className="w-4 h-4 text-indigo-500" />
                Scan using camera
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            {scanResult ? (
              <div className="glass rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md overflow-hidden animate-fade-in">
                {scanResult.type === "inventory" ? (
                  <div>
                    {/* Header */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-850/30 border-b border-slate-200/50 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{scanResult.item.name}</h4>
                        <p className="text-slate-450 text-xs mt-1">Barcode: <strong className="text-indigo-600 dark:text-indigo-400">{scanResult.item.barcode}</strong> | SKU: {scanResult.item.sku}</p>
                      </div>
                      <button
                        onClick={() => triggerPrintPdf(scanResult.item.barcode, "50x25", 1, scanResult.item.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Label
                      </button>
                    </div>

                    {/* Stock Details & Adjustments */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Specifications</h5>
                        <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2.5 text-xs">
                          <div className="flex justify-between"><span className="text-slate-450">Current Stock:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.item.quantity} {scanResult.item.unit}</span></div>
                          <div className="flex justify-between"><span className="text-slate-450">Brand:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.item.brand || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-450">Sourcing Vendor:</span><span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{scanResult.supplier?.name || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-450">Location Rack:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.item.rack || "N/A"}</span></div>
                        </div>
                      </div>

                      {/* Stock Adjustment Form */}
                      <form onSubmit={handleStockUpdate} className="space-y-4">
                        <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Adjust Stock Balance</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAdjustType("in")}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                              adjustType === "in" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                            )}
                          >
                            Received (+)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustType("out")}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                              adjustType === "out" ? "bg-rose-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                            )}
                          >
                            Issued (-)
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            required
                            min="0.1"
                            step="any"
                            value={adjustQty || ""}
                            placeholder="Qty..."
                            onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                            className="col-span-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-center font-bold text-slate-855 dark:text-slate-100"
                          />
                          <input
                            type="text"
                            placeholder="Remarks..."
                            value={adjustNotes}
                            onChange={(e) => setAdjustNotes(e.target.value)}
                            className="col-span-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-805 p-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={adjustQty <= 0}
                          className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 dark:bg-indigo-600 dark:hover:bg-indigo-705 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Commit Stock Balance
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Project scan card */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-850/30 border-b border-slate-200/50 dark:border-slate-800/60">
                      <h4 className="text-base font-extrabold text-slate-850 dark:text-slate-100">{scanResult.project.name}</h4>
                      <p className="text-slate-450 text-xs mt-1">Barcode: <strong className="text-indigo-600 dark:text-indigo-400">{scanResult.project.barcode}</strong></p>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                      <div className="space-y-2.5 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl">
                        <div className="flex justify-between"><span className="text-slate-455">Status:</span><span className="font-bold uppercase text-indigo-500">{scanResult.project.status}</span></div>
                        <div className="flex justify-between"><span className="text-slate-455">Site Location:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.project.site_location || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-455">Start Date:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.project.start_date || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-455">Budget Allocation:</span><span className="font-bold text-slate-805 dark:text-slate-200">₹{scanResult.project.budget}</span></div>
                      </div>
                      <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 p-6 rounded-2xl bg-white dark:bg-slate-900/20">
                        <ScanBarcode className="w-12 h-12 text-indigo-500 animate-pulse mb-2" />
                        <p className="text-center font-bold text-slate-700 dark:text-slate-300">Project scanning matches routing.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass p-12 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center text-slate-450 dark:text-slate-500">
                <ScanBarcode className="w-16 h-16 text-slate-300 dark:text-slate-800 animate-pulse" />
                <p className="text-xs font-semibold mt-4">Awaiting Scan lookup. Align barcode to query database details instantly.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Option 2: Generate Barcode */}
      {activeSubTab === "gen" && (
        <form onSubmit={handleGenerate} className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-855 dark:text-slate-100 text-lg">Generate Unique Barcode</h3>
            <p className="text-slate-400 text-xs mt-1">Assign unique, sequential barcodes to existing inventory items or project registers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-405 tracking-wider">Classification *</label>
              <select
                value={genType}
                onChange={(e) => {
                  setGenType(e.target.value as any);
                  setGenEntityId("");
                  setGeneratedBarcode("");
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="inventory">Inventory Item (AL-XXXXXX)</option>
                <option value="project">Project Register (PRJ-XXXXXX)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-405 tracking-wider">Select Record *</label>
              {genType === "inventory" ? (
                <select
                  value={genEntityId}
                  onChange={(e) => setGenEntityId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-200"
                >
                  <option value="">Select item...</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name} {item.barcode ? `(${item.barcode})` : "(No Barcode)"}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={genEntityId}
                  onChange={(e) => setGenEntityId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-202"
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.barcode ? `(${p.barcode})` : "(No Barcode)"}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !genEntityId}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-755 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate & Save Barcode"}
          </button>

          {generatedBarcode && (
            <div className="p-6 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl flex flex-col items-center justify-center space-y-4 animate-fade-in">
              <p className="text-xs text-slate-450 font-bold">GENERATED ID: <span className="text-lg text-indigo-500 font-extrabold ml-1">{generatedBarcode}</span></p>
              <div className="flex gap-4">
                <img 
                  src={`${API_BASE_URL}/api/wms/barcode-image?barcode=${generatedBarcode}`} 
                  alt="barcode symbol" 
                  className="h-12 bg-white p-1.5 rounded-xl border border-slate-200" 
                />
                <img 
                  src={`${API_BASE_URL}/api/wms/qr-image?barcode=${generatedBarcode}`} 
                  alt="qr code symbol" 
                  className="w-12 h-12 bg-white p-1.5 rounded-xl border border-slate-200" 
                />
              </div>
            </div>
          )}
        </form>
      )}

      {/* Option 3: Print Barcode */}
      {activeSubTab === "print" && (
        <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-855 dark:text-slate-100 text-lg">Print Labels</h3>
            <p className="text-slate-400 text-xs mt-1">Export high-resolution PDF layouts for barcode thermal printers or standard paper grids.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-405 tracking-wider">Select Material</label>
              <select
                value={printBarcode}
                onChange={(e) => setPrintBarcode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-202 focus:outline-none"
              >
                <option value="">Choose item...</option>
                {inventoryItems.filter(item => item.barcode).map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.barcode})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-405 tracking-wider">Copies</label>
              <input
                type="number"
                min="1"
                max="100"
                value={printCopies}
                onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Label Size / Format</label>
              <select
                value={printSize}
                onChange={(e) => setPrintSize(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-200 focus:outline-none"
              >
                <option value="50x25">50x25 mm (Thermal Label)</option>
                <option value="60x40">60x40 mm (Thermal Label)</option>
                <option value="A4">A4 Sheet Grid (3x8 Layout)</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => {
              const matched = inventoryItems.find(item => item.id === printBarcode);
              if (matched) {
                triggerPrintPdf(matched.barcode, printSize, printCopies, matched.id);
              }
            }}
            disabled={!printBarcode}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-755 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none disabled:opacity-50"
          >
            Export PDF Label Sheet
          </button>
        </div>
      )}

      {/* Option 4: Barcode History */}
      {activeSubTab === "history" && (
        <div className="glass rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/60">
            <h3 className="font-black text-slate-855 dark:text-slate-105 text-sm">Generation History Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-450 uppercase font-black tracking-wider">
                  <th className="p-4">Barcode</th>
                  <th className="p-4">Classification</th>
                  <th className="p-4">Entity Name</th>
                  <th className="p-4">Generated By</th>
                  <th className="p-4">Generated Date</th>
                  <th className="p-4">Print Count</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150/40 dark:divide-slate-800/60">
                {historyList.length > 0 ? (
                  historyList.map((h, i) => (
                    <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 text-slate-700 dark:text-slate-300">
                      <td className="p-4 font-bold text-indigo-500">{h.barcode}</td>
                      <td className="p-4 uppercase text-[9px] font-black">{h.barcode_type}</td>
                      <td className="p-4 font-semibold">{h.entity_name}</td>
                      <td className="p-4">{h.creator_name}</td>
                      <td className="p-4">{new Date(h.generated_date).toLocaleString()}</td>
                      <td className="p-4 font-extrabold text-center sm:text-left">{h.print_count}</td>
                      <td className="p-4">
                        {h.barcode_type === "inventory" && (
                          <button
                            onClick={() => triggerPrintPdf(h.barcode, "50x25", 1, h.inventory_id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-650 dark:text-indigo-400 border border-indigo-200/30 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            Print
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No barcode histories logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

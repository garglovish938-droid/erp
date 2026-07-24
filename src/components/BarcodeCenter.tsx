"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ScanBarcode, QrCode, Printer, Search, AlertTriangle, 
  CheckCircle2, XCircle, Download, Smartphone, History,
  Box, Layers, RefreshCw
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

  // Catalog Data
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Search Filters for Select Lists
  const [searchGenQuery, setSearchGenQuery] = useState("");
  const [searchPrintQuery, setSearchPrintQuery] = useState("");

  // Camera Scanner
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<any>(null);

  // Focus Ref for Scanner Input
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Form State: Generate Barcode
  const [genType, setGenType] = useState<"inventory" | "project">("inventory");
  const [genEntityId, setGenEntityId] = useState("");
  const [generatedBarcode, setGeneratedBarcode] = useState("");

  // Form State: Scan Barcode
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  
  // Stock Adjustment for Scanned Inventory Item
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Form State: Print Barcode
  const [printType, setPrintType] = useState<"inventory" | "project">("inventory");
  const [printEntityId, setPrintEntityId] = useState("");
  const [printCopies, setPrintCopies] = useState(1);
  const [printSize, setPrintSize] = useState("50x25"); // 50x25, 60x40, A4

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  useEffect(() => {
    if (activeSubTab === "scan" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeSubTab]);

  const fetchData = async () => {
    try {
      setErrorMsg("");
      const items = await apiRequest("/api/inventory");
      setInventoryItems(items || []);
      const projs = await apiRequest("/api/projects");
      setProjects(projs || []);
      if (activeSubTab === "history") {
        let history: any[] = [];
        try {
          history = await apiRequest("/api/barcode/center/history");
        } catch (_) {
          try {
            history = await apiRequest("/api/barcode/history");
          } catch (_) {}
        }

        // Reconstruct history list from existing items & projects with barcodes if history endpoint returns 404/empty
        if (!history || history.length === 0) {
          const reconstructed: any[] = [];
          (items || []).forEach((it: any) => {
            if (it.barcode) {
              reconstructed.push({
                id: `hist_inv_${it.id}`,
                barcode: it.barcode,
                barcode_type: "inventory",
                inventory_id: it.id,
                entity_name: it.name,
                creator_name: "Store Keeper",
                generated_date: it.created_at || new Date().toISOString(),
                print_count: 1,
                status: "active"
              });
            }
          });
          (projs || []).forEach((pr: any) => {
            if (pr.barcode) {
              reconstructed.push({
                id: `hist_prj_${pr.id}`,
                barcode: pr.barcode,
                barcode_type: "project",
                project_id: pr.id,
                entity_name: pr.name,
                creator_name: "Project Manager",
                generated_date: pr.created_at || new Date().toISOString(),
                print_count: 1,
                status: "active"
              });
            }
          });
          history = reconstructed;
        }
        setHistoryList(history || []);
      }
    } catch (_) {}
  };

  // Camera scanner integration (html5-qrcode)
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
        () => {}
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
    const cleanCode = code.trim();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setScanResult(null);

    try {
      let res: any = null;
      
      // Try primary barcode scan endpoint
      try {
        res = await apiRequest("/api/barcode/center/scan", {
          method: "POST",
          body: JSON.stringify({ barcode: cleanCode })
        });
      } catch (_) {}

      // Try barcode scan alias endpoint
      if (!res) {
        try {
          res = await apiRequest("/api/barcode/scan", {
            method: "POST",
            body: JSON.stringify({ barcode: cleanCode })
          });
        } catch (_) {}
      }

      // Try inventory lookup endpoint
      if (!res) {
        try {
          const itemRes = await apiRequest(`/api/inventory/lookup/${encodeURIComponent(cleanCode)}`);
          if (itemRes && (itemRes.item || itemRes.name || itemRes.id)) {
            const matchedItem = itemRes.item || itemRes;
            res = {
              type: "inventory",
              item: matchedItem,
              supplier: itemRes.supplier,
              last_purchase: itemRes.last_purchase,
              project_usage: itemRes.project_usage || []
            };
          }
        } catch (_) {}
      }

      // Fallback: Client-side resolution from loaded inventoryItems or projects
      if (!res) {
        const itemMatch = inventoryItems.find(i => 
          (i.barcode && i.barcode.toLowerCase() === cleanCode.toLowerCase()) || 
          (i.sku && i.sku.toLowerCase() === cleanCode.toLowerCase()) ||
          (i.id && String(i.id) === cleanCode)
        );
        if (itemMatch) {
          res = {
            type: "inventory",
            item: itemMatch,
            supplier: itemMatch.supplier,
            last_purchase: null,
            project_usage: []
          };
        } else {
          const projMatch = projects.find(p => 
            (p.barcode && p.barcode.toLowerCase() === cleanCode.toLowerCase()) ||
            (p.id && String(p.id) === cleanCode)
          );
          if (projMatch) {
            res = {
              type: "project",
              project: projMatch
            };
          }
        }
      }

      if (res) {
        setScanResult(res);
        setSuccessMsg(`Matched record: ${res.type === "inventory" ? res.item.name : res.project.name}`);
      } else {
        setErrorMsg(`No record matched barcode "${cleanCode}" in catalog.`);
      }
    } catch (e: any) {
      setErrorMsg(`No record matched barcode "${cleanCode}" in catalog.`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genEntityId) {
      setErrorMsg("Please select a material or project record first.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setGeneratedBarcode("");

    try {
      let barcode = "";
      
      // Try primary barcode generation endpoint
      try {
        const res = await apiRequest("/api/barcode/center/generate", {
          method: "POST",
          body: JSON.stringify({
            entity_type: genType,
            entity_id: genEntityId
          })
        });
        if (res && res.barcode) {
          barcode = res.barcode;
        }
      } catch (_) {}

      // Try barcode generate alias endpoint
      if (!barcode) {
        try {
          const res = await apiRequest("/api/barcode/generate", {
            method: "POST",
            body: JSON.stringify({
              entity_type: genType,
              entity_id: genEntityId,
              module: genType,
              inventory_id: genEntityId,
              project_id: genEntityId
            })
          });
          if (res && res.barcode) {
            barcode = res.barcode;
          }
        } catch (_) {}
      }

      // Fallback client-side generator if backend routes return 404 (e.g. during deployment rollout)
      if (!barcode) {
        const targetItem = inventoryItems.find(i => String(i.id) === String(genEntityId));
        const targetProj = projects.find(p => String(p.id) === String(genEntityId));

        if (genType === "inventory" && targetItem?.barcode && targetItem.barcode.startsWith("AL-")) {
          barcode = targetItem.barcode;
        } else if (genType === "project" && targetProj?.barcode && targetProj.barcode.startsWith("PRJ-")) {
          barcode = targetProj.barcode;
        } else {
          const prefix = genType === "inventory" ? "AL-" : "PRJ-";
          let maxSeq = 0;
          if (genType === "inventory") {
            inventoryItems.forEach(i => {
              if (i.barcode && i.barcode.startsWith("AL-")) {
                const num = parseInt(i.barcode.replace("AL-", ""), 10);
                if (!isNaN(num) && num > maxSeq) maxSeq = num;
              }
            });
          } else {
            projects.forEach(p => {
              if (p.barcode && p.barcode.startsWith("PRJ-")) {
                const num = parseInt(p.barcode.replace("PRJ-", ""), 10);
                if (!isNaN(num) && num > maxSeq) maxSeq = num;
              }
            });
          }
          barcode = `${prefix}${String(maxSeq + 1).padStart(6, "0")}`;

          // Attempt updating item via PUT API
          try {
            if (genType === "inventory") {
              await apiRequest(`/api/inventory/${genEntityId}`, {
                method: "PUT",
                body: JSON.stringify({ barcode: barcode })
              });
            } else {
              await apiRequest(`/api/projects/${genEntityId}`, {
                method: "PUT",
                body: JSON.stringify({ barcode: barcode })
              });
            }
          } catch (_) {}

          // Update local state array so UI reflects changes instantly
          if (genType === "inventory" && targetItem) {
            targetItem.barcode = barcode;
          } else if (genType === "project" && targetProj) {
            targetProj.barcode = barcode;
          }
        }
      }

      if (barcode) {
        setGeneratedBarcode(barcode);
        setSuccessMsg(`Barcode generated successfully: ${barcode}`);
        fetchData();
      } else {
        setErrorMsg("Unable to generate barcode. Please check system connection.");
      }
    } catch (e: any) {
      setErrorMsg("Unable to generate barcode. Please try again.");
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
      const payload = {
        quantity_changed: adjustType === "in" ? adjustQty : -adjustQty,
        notes: adjustNotes || "Barcode Center Stock Update"
      };
      await apiRequest(`/api/inventory/${scanResult.item.id}/stock`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccessMsg("Stock balance updated successfully!");
      handleLookup(scanResult.item.barcode);
      setAdjustQty(0);
      setAdjustNotes("");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to update inventory stock.");
    } finally {
      setLoading(false);
    }
  };

  const triggerPrintPdf = async (barcodeVal: string, sizeVal: string, copiesVal: number, entityId?: string) => {
    try {
      await apiRequest(`/api/barcode/center/print-log?barcode=${encodeURIComponent(barcodeVal)}`, { method: "POST" });
    } catch (e) {}
    const query = entityId ? `inventory_id=${entityId}` : `barcode=${encodeURIComponent(barcodeVal)}`;
    const pdfUrl = `${API_BASE_URL}/api/wms/print-label?${query}&label_type=${sizeVal}&copies=${copiesVal}&token=${token}`;
    
    const win = window.open(pdfUrl, "_blank");
    if (!win) {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.target = "_blank";
      link.click();
    }
  };

  const downloadBarcodePng = (barcodeVal: string) => {
    const imageUrl = `${API_BASE_URL}/api/wms/barcode-image?barcode=${encodeURIComponent(barcodeVal)}`;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `barcode_${barcodeVal}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered inventory items and projects for dropdowns
  const filteredGenItems = inventoryItems.filter(item => 
    !searchGenQuery || 
    item.name.toLowerCase().includes(searchGenQuery.toLowerCase()) || 
    (item.sku && item.sku.toLowerCase().includes(searchGenQuery.toLowerCase())) ||
    (item.barcode && item.barcode.toLowerCase().includes(searchGenQuery.toLowerCase()))
  );

  const filteredGenProjects = projects.filter(p => 
    !searchGenQuery || 
    p.name.toLowerCase().includes(searchGenQuery.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchGenQuery.toLowerCase()))
  );

  const filteredPrintItems = inventoryItems.filter(item => 
    !searchPrintQuery || 
    item.name.toLowerCase().includes(searchPrintQuery.toLowerCase()) || 
    (item.sku && item.sku.toLowerCase().includes(searchPrintQuery.toLowerCase())) ||
    (item.barcode && item.barcode.toLowerCase().includes(searchPrintQuery.toLowerCase()))
  );

  const filteredPrintProjects = projects.filter(p => 
    !searchPrintQuery || 
    p.name.toLowerCase().includes(searchPrintQuery.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchPrintQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl border border-slate-800 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)]" />
        <div className="z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-500/30 rounded-2xl">
              <ScanBarcode className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Barcode Center</h2>
              <p className="text-slate-400 text-xs mt-1">
                Generate, scan, print, and track industrial Code128 barcodes for warehouse materials and project registers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Camera scanner modal wrapper */}
      {cameraActive && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md mx-auto relative">
          <button 
            onClick={() => setCameraActive(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10 cursor-pointer"
          >
            <XCircle className="w-6 h-6" />
          </button>
          <h3 className="text-white text-sm font-bold text-center mb-4 flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4 text-indigo-400" /> Camera Scanner Mode
          </h3>
          <div id="qr-reader-barcode-center" className="overflow-hidden rounded-2xl bg-black border border-slate-800" />
          <p className="text-slate-450 text-[10px] text-center mt-3">Align Barcode or QR code inside the box to trigger instant scan</p>
        </div>
      )}

      {/* Toast Alert Feedback */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 rounded-2xl animate-fade-in shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <p className="text-xs font-semibold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 rounded-2xl animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Navigation Sub Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200/60 dark:border-slate-800/60">
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
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SCAN BARCODE */}
      {activeSubTab === "scan" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md lg:col-span-1 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <ScanBarcode className="w-4 h-4 text-indigo-500" /> Scanner Input
            </h3>
            <p className="text-slate-400 text-xs">
              Supports USB/Wireless hardware scanners (autofocus ready) or camera scan.
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="Scan or type barcode (AL-XXXXXX / PRJ-XXXXXX)..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup(scanInput)}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  onClick={() => handleLookup(scanInput)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
                >
                  Lookup
                </button>
              </div>
              <button 
                onClick={() => setCameraActive(!cameraActive)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-all"
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
                    {/* Inventory Item Result Header */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-850/30 border-b border-slate-200/50 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Box className="w-5 h-5 text-indigo-500" />
                          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{scanResult.item.name}</h4>
                        </div>
                        <p className="text-slate-400 text-xs mt-1">
                          Barcode: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{scanResult.item.barcode || "N/A"}</strong> | SKU: <span className="font-mono">{scanResult.item.sku}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => triggerPrintPdf(scanResult.item.barcode, "50x25", 1, scanResult.item.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print PDF Label
                        </button>
                        <button
                          onClick={() => downloadBarcodePng(scanResult.item.barcode)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/40 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> SVG
                        </button>
                      </div>
                    </div>

                    {/* Stock Details & Adjustments */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Material Specifications</h5>
                        <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2.5 text-xs">
                          <div className="flex justify-between"><span className="text-slate-400">Current Stock:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.item.quantity} {scanResult.item.unit}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Brand / Variant:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.item.brand || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Supplier:</span><span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{scanResult.supplier?.name || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Location Rack:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.item.rack || "N/A"}</span></div>
                        </div>
                      </div>

                      {/* Stock Adjustment Form */}
                      <form onSubmit={handleStockUpdate} className="space-y-4">
                        <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Update Stock Balance</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setAdjustType("in")}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                              adjustType === "in" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                            )}
                          >
                            Received (+)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustType("out")}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                              adjustType === "out" ? "bg-rose-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
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
                            className="col-span-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-center font-bold text-slate-800 dark:text-slate-100"
                          />
                          <input
                            type="text"
                            placeholder="Remarks..."
                            value={adjustNotes}
                            onChange={(e) => setAdjustNotes(e.target.value)}
                            className="col-span-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={adjustQty <= 0 || loading}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Commit Stock Change
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Project Scan Result */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-850/30 border-b border-slate-200/50 dark:border-slate-800/60 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-5 h-5 text-indigo-500" />
                          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{scanResult.project.name}</h4>
                        </div>
                        <p className="text-slate-400 text-xs mt-1">Barcode: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{scanResult.project.barcode}</strong></p>
                      </div>
                      <button
                        onClick={() => triggerPrintPdf(scanResult.project.barcode, "50x25", 1, scanResult.project.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Label
                      </button>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                      <div className="space-y-2.5 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl">
                        <div className="flex justify-between"><span className="text-slate-400">Status:</span><span className="font-bold uppercase text-indigo-500">{scanResult.project.status}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Site Location:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.project.site_location || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Start Date:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.project.start_date || "N/A"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Budget:</span><span className="font-bold text-slate-800 dark:text-slate-200">₹{scanResult.project.budget || 0}</span></div>
                      </div>
                      <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 p-6 rounded-2xl bg-white dark:bg-slate-900/20">
                        <ScanBarcode className="w-12 h-12 text-indigo-500 animate-pulse mb-2" />
                        <p className="text-center font-bold text-slate-700 dark:text-slate-300">Project record verified in register.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass p-12 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <ScanBarcode className="w-16 h-16 text-slate-300 dark:text-slate-800 animate-pulse" />
                <p className="text-xs font-semibold mt-4">Awaiting Scan lookup. Align or enter a barcode to view complete record specifications.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GENERATE BARCODE */}
      {activeSubTab === "gen" && (
        <form onSubmit={handleGenerate} className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-500" /> Generate Unique Barcode
            </h3>
            <p className="text-slate-400 text-xs mt-1">Assign unique, sequential barcodes (`AL-XXXXXX` or `PRJ-XXXXXX`) to existing inventory materials or project registers without altering material names or quantities.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Classification *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setGenType("inventory");
                    setGenEntityId("");
                    setGeneratedBarcode("");
                  }}
                  className={cn(
                    "py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border",
                    genType === "inventory"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                  )}
                >
                  <Box className="w-4 h-4" /> Inventory Item (AL-XXXXXX)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenType("project");
                    setGenEntityId("");
                    setGeneratedBarcode("");
                  }}
                  className={cn(
                    "py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border",
                    genType === "project"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                  )}
                >
                  <Layers className="w-4 h-4" /> Project Register (PRJ-XXXXXX)
                </button>
              </div>
            </div>

            {/* Search Filter for Select List */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Search & Select Record *</label>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter name, brand, SKU or barcode..."
                  value={searchGenQuery}
                  onChange={(e) => setSearchGenQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              {genType === "inventory" ? (
                <select
                  value={genEntityId}
                  onChange={(e) => setGenEntityId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Select inventory material...</option>
                  {filteredGenItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.barcode ? `(${item.barcode})` : "(No Barcode)"}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={genEntityId}
                  onChange={(e) => setGenEntityId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Select project...</option>
                  {filteredGenProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.barcode ? `(${p.barcode})` : "(No Barcode)"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !genEntityId}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Barcode"}
          </button>

          {generatedBarcode && (
            <div className="p-6 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl flex flex-col items-center justify-center space-y-4 animate-fade-in">
              <p className="text-xs text-slate-400 font-bold">GENERATED ID: <span className="text-xl text-indigo-500 font-extrabold font-mono ml-1">{generatedBarcode}</span></p>
              <div className="flex gap-4 items-center bg-white p-3 rounded-2xl border border-slate-200">
                <img 
                  src={`${API_BASE_URL}/api/wms/barcode-image?barcode=${encodeURIComponent(generatedBarcode)}`} 
                  alt="Code128 Barcode" 
                  className="h-14" 
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => triggerPrintPdf(generatedBarcode, "50x25", 1, genEntityId)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Print PDF Label
                </button>
                <button
                  type="button"
                  onClick={() => downloadBarcodePng(generatedBarcode)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download SVG
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* TAB 3: PRINT BARCODE */}
      {activeSubTab === "print" && (
        <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-500" /> Print Labels
            </h3>
            <p className="text-slate-400 text-xs mt-1">Export high-resolution PDF layouts for barcode thermal printers or standard paper grids.</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setPrintType("inventory"); setPrintEntityId(""); }}
                className={cn(
                  "py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all border",
                  printType === "inventory" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                )}
              >
                Inventory Item
              </button>
              <button
                type="button"
                onClick={() => { setPrintType("project"); setPrintEntityId(""); }}
                className={cn(
                  "py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all border",
                  printType === "project" ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                )}
              >
                Project Register
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Record</label>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter record..."
                  value={searchPrintQuery}
                  onChange={(e) => setSearchPrintQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              {printType === "inventory" ? (
                <select
                  value={printEntityId}
                  onChange={(e) => setPrintEntityId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Choose material with barcode...</option>
                  {filteredPrintItems.filter(item => item.barcode).map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.barcode})</option>
                  ))}
                </select>
              ) : (
                <select
                  value={printEntityId}
                  onChange={(e) => setPrintEntityId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Choose project with barcode...</option>
                  {filteredPrintProjects.filter(p => p.barcode).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.barcode})</option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Number of Copies</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Label Size / Layout</label>
                <select
                  value={printSize}
                  onChange={(e) => setPrintSize(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="50x25">50x25 mm (Thermal Roll Label)</option>
                  <option value="60x40">60x40 mm (Thermal Roll Label)</option>
                  <option value="A4">A4 Sheet Grid (3x8 Layout)</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (printEntityId) {
                const item = inventoryItems.find(i => i.id === printEntityId);
                const proj = projects.find(p => p.id === printEntityId);
                const code = item?.barcode || proj?.barcode || printEntityId;
                triggerPrintPdf(code, printSize, printCopies, printEntityId);
              }
            }}
            disabled={!printEntityId}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Export PDF Label Sheet
          </button>
        </div>
      )}

      {/* TAB 4: BARCODE HISTORY */}
      {activeSubTab === "history" && (
        <div className="glass rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/60 flex justify-between items-center">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" /> Barcode Audit & Generation History
            </h3>
            <button
              onClick={fetchData}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Refresh History"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-450 uppercase font-black tracking-wider border-b border-slate-200/60 dark:border-slate-800/60">
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
                  historyList.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 text-slate-700 dark:text-slate-300">
                      <td className="p-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">{h.barcode}</td>
                      <td className="p-4 uppercase text-[9px] font-black">{h.barcode_type}</td>
                      <td className="p-4 font-semibold">{h.entity_name}</td>
                      <td className="p-4">{h.creator_name}</td>
                      <td className="p-4">{new Date(h.generated_date).toLocaleString()}</td>
                      <td className="p-4 font-extrabold">{h.print_count}</td>
                      <td className="p-4">
                        <button
                          onClick={() => triggerPrintPdf(h.barcode, "50x25", 1, h.inventory_id || h.project_id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200/30 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                        >
                          <Printer className="w-3 h-3" /> Reprint
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No barcode generation history logged yet.
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

"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ScanBarcode, QrCode, PackagePlus, PackageMinus, ArrowLeftRight, 
  RotateCcw, ClipboardCheck, Printer, Search, AlertTriangle, 
  CheckCircle2, XCircle, RefreshCw, Layers, Compass, BookOpen, Clock, Landmark, Smartphone
} from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { cn } from "@/lib/utils";

interface WmsHubProps {
  token: string;
  role: string;
}

export default function WmsHub({ token, role }: WmsHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<"dash" | "scan" | "receive" | "issue" | "pick" | "transfer" | "return" | "audit" | "print">("dash");
  
  // Dashboard stats
  const [stats, setStats] = useState({
    scans_today: 0,
    inwards_today: 0,
    outwards_today: 0,
    dispatches_today: 0,
    low_stock_count: 0,
    critical_stock_count: 0,
    pending_po_count: 0,
    damaged_returns_count: 0
  });
  
  // States for search / lookup
  const [searchBarcode, setSearchBarcode] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  
  // States for Receive Workflow
  const [recvBarcode, setRecvBarcode] = useState("");
  const [recvQty, setRecvQty] = useState(1);
  const [recvWarehouse, setRecvWarehouse] = useState("Main");
  const [recvRack, setRecvRack] = useState("");
  const [recvShelf, setRecvShelf] = useState("");
  const [recvBin, setRecvBin] = useState("");
  const [recvPoId, setRecvPoId] = useState("");
  const [recvBatch, setRecvBatch] = useState("");
  const [recvSerial, setRecvSerial] = useState("");
  const [recvNotes, setRecvNotes] = useState("");
  
  // States for Issue Workflow
  const [issueBarcode, setIssueBarcode] = useState("");
  const [issueProjectId, setIssueProjectId] = useState("");
  const [issueQty, setIssueQty] = useState(1);
  const [issueSerial, setIssueSerial] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  
  // States for Picking
  const [pickProjectId, setPickProjectId] = useState("");
  const [pickBOM, setPickBOM] = useState<any[]>([]);
  const [scannedPickItem, setScannedPickItem] = useState("");
  const [pickingStatus, setPickingStatus] = useState<{ [key: string]: "idle" | "success" | "error" }>({});
  
  // States for Transfer
  const [transBarcode, setTransBarcode] = useState("");
  const [transQty, setTransQty] = useState(1);
  const [transToWh, setTransToWh] = useState("Main");
  const [transToRack, setTransToRack] = useState("");
  const [transToShelf, setTransToShelf] = useState("");
  const [transToBin, setTransToBin] = useState("");
  const [transNotes, setTransNotes] = useState("");

  // States for Return
  const [retBarcode, setRetBarcode] = useState("");
  const [retQty, setRetQty] = useState(1);
  const [retReason, setRetReason] = useState("Unused"); // Damage, Replacement, Repair, Unused
  const [retProjId, setRetProjId] = useState("");
  const [retNotes, setRetNotes] = useState("");

  // States for Stock Audit
  const [auditWh, setAuditWh] = useState("Main");
  const [auditRack, setAuditRack] = useState("");
  const [auditShelf, setAuditShelf] = useState("");
  const [auditScans, setAuditScans] = useState<any[]>([]);
  const [auditScanInput, setAuditScanInput] = useState("");

  // States for Label Printing
  const [printItemId, setPrintItemId] = useState("");
  const [printType, setPrintType] = useState("50x25"); // 50x25, 60x40, A4
  const [printCopies, setPrintCopies] = useState(1);

  // Master Lists for Dropdowns
  const [projects, setProjects] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  // Mobile camera scanner
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchDropdowns();
  }, [activeSubTab]);

  const fetchDashboardStats = async () => {
    try {
      const res = await apiRequest("/api/wms/dashboard");
      setStats(res);
    } catch (e) {}
  };

  const fetchDropdowns = async () => {
    try {
      const projs = await apiRequest("/api/projects");
      setProjects(projs || []);
      const pos = await apiRequest("/api/purchasing/orders");
      setPurchaseOrders(pos || []);
      const items = await apiRequest("/api/inventory");
      setInventoryItems(items || []);
    } catch (e) {}
  };

  // Init html5-qrcode scanner
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
        "qr-reader-wms",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText: string) => {
          handleCameraDecoded(decodedText);
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

  const handleCameraDecoded = (text: string) => {
    if (activeSubTab === "scan") {
      setSearchBarcode(text);
      handleBarcodeLookup(text);
    } else if (activeSubTab === "receive") {
      setRecvBarcode(text);
    } else if (activeSubTab === "issue") {
      setIssueBarcode(text);
    } else if (activeSubTab === "transfer") {
      setTransBarcode(text);
    } else if (activeSubTab === "return") {
      setRetBarcode(text);
    } else if (activeSubTab === "pick") {
      handlePickScan(text);
    } else if (activeSubTab === "audit") {
      handleAuditScan(text);
    }
  };

  const handleBarcodeLookup = async (code: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await apiRequest("/api/barcode/scan", {
        method: "POST",
        body: JSON.stringify({ barcode: code })
      });
      setScanResult(res);
    } catch (e: any) {
      setErrorMsg(e.message || "Material not found in WMS");
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const payload = {
        barcode: recvBarcode,
        quantity: recvQty,
        warehouse: recvWarehouse,
        rack: recvRack,
        shelf: recvShelf,
        bin: recvBin,
        purchase_order_id: recvPoId || null,
        batch_number: recvBatch || null,
        serial_number: recvSerial || null,
        notes: recvNotes
      };
      const res = await apiRequest("/api/wms/receive", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccessMsg(res.message || "Material received successfully!");
      setRecvBarcode("");
      setRecvQty(1);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to receive material");
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const payload = {
        barcode: issueBarcode,
        project_id: issueProjectId,
        quantity: issueQty,
        serial_number: issueSerial || null,
        notes: issueNotes
      };
      const res = await apiRequest("/api/wms/issue", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccessMsg(res.message || "Material issued successfully!");
      setIssueBarcode("");
      setIssueQty(1);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to issue material");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const payload = {
        barcode: transBarcode,
        quantity: transQty,
        to_warehouse: transToWh,
        to_rack: transToRack,
        to_shelf: transToShelf,
        to_bin: transToBin,
        notes: transNotes
      };
      const res = await apiRequest("/api/wms/transfer", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccessMsg(res.message || "Material relocated successfully!");
      setTransBarcode("");
      setTransQty(1);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to relocate material");
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const payload = {
        barcode: retBarcode,
        quantity: retQty,
        reason: retReason,
        project_id: retProjId || null,
        notes: retNotes
      };
      const res = await apiRequest("/api/wms/return", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccessMsg(res.message || "Returned item processed!");
      setRetBarcode("");
      setRetQty(1);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to process return");
    } finally {
      setLoading(false);
    }
  };

  // Picking Workflow
  const handleLoadProjectBOM = async (projId: string) => {
    setPickProjectId(projId);
    if (!projId) {
      setPickBOM([]);
      return;
    }
    try {
      const projs = await apiRequest("/api/projects");
      const matched = projs.find((p: any) => p.id === projId);
      setPickBOM(matched?.bom_items || []);
      setPickingStatus({});
    } catch (e) {}
  };

  const handlePickScan = (barcode: string) => {
    setScannedPickItem(barcode);
    const matchedBOM = pickBOM.find(
      (b: any) => b.inventory && (b.inventory.barcode === barcode || b.inventory.sku === barcode)
    );

    if (matchedBOM) {
      setPickingStatus(prev => ({ ...prev, [barcode]: "success" }));
      setSuccessMsg(`Correct Item: ${matchedBOM.inventory.name} verified!`);
      setErrorMsg("");
    } else {
      setPickingStatus(prev => ({ ...prev, [barcode]: "error" }));
      setErrorMsg("Wrong Item scanned! Item is not in this project Pick List.");
      setSuccessMsg("");
    }
  };

  // Audit Scan list builder
  const handleAuditScan = async (barcode: string) => {
    if (!barcode) return;
    try {
      const res = await apiRequest("/api/barcode/scan", {
        method: "POST",
        body: JSON.stringify({ barcode })
      });
      
      const existing = auditScans.find(s => s.inventory_id === res.item.id);
      if (existing) {
        setAuditScans(prev => prev.map(s => s.inventory_id === res.item.id ? { ...s, actual_qty: s.actual_qty + 1 } : s));
      } else {
        setAuditScans(prev => [
          ...prev,
          {
            inventory_id: res.item.id,
            sku: res.item.sku,
            name: res.item.name,
            expected_qty: res.item.quantity,
            actual_qty: 1,
            notes: ""
          }
        ]);
      }
      setSuccessMsg(`Scanned: ${res.item.name}`);
    } catch (e) {
      setErrorMsg("Scanned item not found in records");
    }
  };

  const handleCommitAudit = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const payload = {
        warehouse: auditWh,
        rack: auditRack || null,
        shelf: auditShelf || null,
        items: auditScans.map(s => ({
          inventory_id: s.inventory_id,
          expected_qty: s.expected_qty,
          actual_qty: s.actual_qty,
          notes: s.notes
        }))
      };
      await apiRequest("/api/wms/audit", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setSuccessMsg("Audit session committed and inventory synchronized!");
      setAuditScans([]);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to commit stock audit");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = (itemId: string, type: string, copies: number) => {
    window.open(`/api/wms/print-label?inventory_id=${itemId}&label_type=${type}&copies=${copies}&token=${token}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl border border-slate-800 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.1),transparent)]" />
        <div className="z-10">
          <h2 className="text-3xl font-extrabold tracking-tight">Nexora WMS operations</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-lg">
            Real-time material flows, Code128 barcodes, multi-warehouse racking layouts, and instant audit trails.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 z-10">
          <button 
            onClick={() => setCameraActive(!cameraActive)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs tracking-wider transition-all select-none shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            <Smartphone className="w-4 h-4 animate-bounce" />
            {cameraActive ? "Close Camera" : "Open Camera Scanner"}
          </button>
        </div>
      </div>

      {/* Camera stream view when active */}
      {cameraActive && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md mx-auto relative">
          <button 
            onClick={() => setCameraActive(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10 cursor-pointer"
          >
            <XCircle className="w-6 h-6" />
          </button>
          <h3 className="text-white text-sm font-bold text-center mb-4">WMS Camera Scanner Active</h3>
          <div id="qr-reader-wms" className="overflow-hidden rounded-2xl bg-black border border-slate-850" />
          <p className="text-slate-400 text-[10px] text-center mt-3">Align Barcode or QR code inside the box to trigger instant scan</p>
        </div>
      )}

      {/* Toast Alert Feedback */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl animate-fade-in shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <p className="text-xs font-semibold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Navigation Modules Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200/50 dark:border-slate-800/60">
        {[
          { id: "dash", label: "Dashboard", icon: BookOpen },
          { id: "scan", label: "Scan Lookup", icon: Search },
          { id: "receive", label: "Inward (Receive)", icon: PackagePlus },
          { id: "issue", label: "Outward (Issue)", icon: PackageMinus },
          { id: "pick", label: "BOM Picking", icon: ClipboardCheck },
          { id: "transfer", label: "Relocate", icon: ArrowLeftRight },
          { id: "return", label: "Returns", icon: RotateCcw },
          { id: "audit", label: "Stock Audit", icon: Layers },
          { id: "print", label: "Print Labels", icon: Printer }
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
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all select-none whitespace-nowrap cursor-pointer",
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

      {/* Tab Panels */}
      
      {/* 1. Dashboard panel */}
      {activeSubTab === "dash" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Today's scans", val: stats.scans_today, color: "from-blue-500 to-indigo-500", icon: ScanBarcode },
            { label: "Today's inward count", val: stats.inwards_today, color: "from-emerald-500 to-teal-500", icon: PackagePlus },
            { label: "Today's outward count", val: stats.outwards_today, color: "from-amber-500 to-orange-500", icon: PackageMinus },
            { label: "Today's dispatch logs", val: stats.dispatches_today, color: "from-indigo-500 to-purple-500", icon: ClipboardCheck },
            { label: "Low stock items", val: stats.low_stock_count, color: "from-rose-500 to-red-500", icon: AlertTriangle, status: "low" },
            { label: "Critical stock limit reached", val: stats.critical_stock_count, color: "from-rose-600 to-red-700", icon: AlertTriangle, status: "critical" },
            { label: "Pending purchase orders", val: stats.pending_po_count, color: "from-sky-500 to-blue-600", icon: Printer },
            { label: "Damaged item returns today", val: stats.damaged_returns_count, color: "from-pink-500 to-rose-500", icon: RotateCcw }
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md flex items-center gap-4 relative overflow-hidden group">
                <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white", c.color)}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{c.label}</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{c.val}</p>
                </div>
                {c.status && c.val > 0 && (
                  <span className={cn(
                    "absolute top-4 right-4 text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                    c.status === "critical" ? "bg-rose-100 text-rose-700 animate-pulse" : "bg-amber-100 text-amber-700"
                  )}>
                    Alert
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Scan Lookup Panel */}
      {activeSubTab === "scan" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md lg:col-span-1 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Material Scanner Lookup</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Scan or type barcode/SKU..."
                value={searchBarcode}
                onChange={(e) => setSearchBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup(searchBarcode)}
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleBarcodeLookup(searchBarcode)}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center cursor-pointer"
              >
                Lookup
              </button>
            </div>
            <p className="text-[10px] text-slate-450 leading-normal">
              Entering a Code128 pattern or SKU returns physical warehouse coordinates, supplier costs, and current project usages in real-time.
            </p>
          </div>

          <div className="lg:col-span-2">
            {scanResult ? (
              <div className="glass rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md overflow-hidden animate-fade-in">
                {/* Product Title Bar */}
                <div className="p-6 bg-slate-50 dark:bg-slate-850/30 border-b border-slate-200/50 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{scanResult.item.name}</h3>
                    <p className="text-slate-400 text-xs mt-1">SKU: <span className="font-bold text-slate-655 dark:text-slate-350">{scanResult.item.sku}</span> | Barcode: <span className="font-bold text-slate-655 dark:text-slate-350">{scanResult.item.barcode}</span></p>
                  </div>
                  <button
                    onClick={() => handlePrintLabel(scanResult.item.id, "50x25", 1)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-805 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Reprint 50x25 label
                  </button>
                </div>
                {/* Grid details */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Physical Location */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-wider">
                      <Compass className="w-4 h-4" />
                      Warehouse Coordinates
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2.5 text-xs">
                      <div className="flex justify-between"><span className="text-slate-405">Warehouse:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.item.warehouse || "N/A"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Rack Coordinate:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.item.rack || "N/A"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Shelf Coordinate:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.item.shelf || "N/A"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Bin:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.item.bin || "N/A"}</span></div>
                    </div>
                  </div>
                  {/* Center Column: Inventory quantities */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider">
                      <Layers className="w-4 h-4" />
                      Stock Balances
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2.5 text-xs">
                      <div className="flex justify-between"><span className="text-slate-405">Physical Qty:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.item.quantity} {scanResult.item.unit}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Reserved Qty:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.item.reserved_quantity} {scanResult.item.unit}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Available Qty:</span><span className="font-bold text-emerald-600 dark:text-emerald-450 font-extrabold">{scanResult.item.available_quantity} {scanResult.item.unit}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Reorder Alert:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.item.reorder_level} {scanResult.item.unit}</span></div>
                    </div>
                  </div>
                  {/* Right Column: Sourcing details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                      <Landmark className="w-4 h-4" />
                      Sourcing & Cost
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl space-y-2.5 text-xs">
                      <div className="flex justify-between"><span className="text-slate-405">Purchase Price:</span><span className="font-bold text-slate-700 dark:text-slate-200">₹{scanResult.item.unit_cost}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Last Receipt:</span><span className="font-bold text-slate-700 dark:text-slate-200">{scanResult.last_purchase?.date || "N/A"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Vendor:</span><span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]" title={scanResult.supplier?.name}>{scanResult.supplier?.name || "N/A"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-405">Current Batch:</span><span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{scanResult.item.batch || "N/A"}</span></div>
                    </div>
                  </div>
                </div>
                {/* Project usages */}
                {scanResult.project_usage.length > 0 && (
                  <div className="p-6 border-t border-slate-200/50 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/10">
                    <h4 className="font-bold text-slate-700 dark:text-slate-350 text-xs mb-3">Active Project Usages</h4>
                    <div className="space-y-2">
                      {scanResult.project_usage.map((u: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/30 dark:border-slate-805/50">
                          <span className="font-semibold text-slate-650 dark:text-slate-300">{u.project_name}</span>
                          <span className="text-slate-400">Used: <strong className="text-slate-700 dark:text-slate-200">{u.total_used}</strong> | Consumed: <strong className="text-slate-700 dark:text-slate-200">{u.total_consumed}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass p-12 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center text-slate-450 dark:text-slate-500">
                <ScanBarcode className="w-16 h-16 animate-pulse text-slate-300 dark:text-slate-750" />
                <p className="text-xs font-semibold mt-4">Awaiting Scan lookup. Align or enter a valid barcode to view complete specifications.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Inward / Receive Workflow */}
      {activeSubTab === "receive" && (
        <form onSubmit={handleReceive} className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Inward Material Workflow</h3>
            <p className="text-slate-400 text-xs mt-1">Receive material into physical stock, assign location coordinates, and reconcile Purchase Orders.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scanned Barcode / SKU *</label>
              <input
                type="text"
                required
                value={recvBarcode}
                onChange={(e) => setRecvBarcode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inward quantity *</label>
              <input
                type="number"
                required
                min="0.1"
                step="any"
                value={recvQty}
                onChange={(e) => setRecvQty(parseFloat(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warehouse location</label>
              <input
                type="text"
                value={recvWarehouse}
                onChange={(e) => setRecvWarehouse(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Rack</label>
                <input type="text" placeholder="R1" value={recvRack} onChange={(e) => setRecvRack(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 text-center" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Shelf</label>
                <input type="text" placeholder="S1" value={recvShelf} onChange={(e) => setRecvShelf(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 text-center" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Bin</label>
                <input type="text" placeholder="B1" value={recvBin} onChange={(e) => setRecvBin(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 text-center" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Match Purchase Order (PO)</label>
              <select
                value={recvPoId}
                onChange={(e) => setRecvPoId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-205 focus:outline-none"
              >
                <option value="">No PO matching</option>
                {purchaseOrders.filter(po => po.status !== "received").map(po => (
                  <option key={po.id} value={po.id}>{po.po_number} - {po.material_name} (Qty: {po.quantity})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Batch Number / Lot</label>
              <input
                type="text"
                placeholder="BAT-101"
                value={recvBatch}
                onChange={(e) => setRecvBatch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Serial Number (Expensive Hardware)</label>
              <input
                type="text"
                placeholder="SN-990288"
                value={recvSerial}
                onChange={(e) => setRecvSerial(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Notes / Remarks</label>
              <textarea
                value={recvNotes}
                onChange={(e) => setRecvNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
                rows={2}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none"
          >
            {loading ? "Processing..." : "Commit Inward Shipment"}
          </button>
        </form>
      )}

      {/* 4. Outward / Issue Workflow */}
      {activeSubTab === "issue" && (
        <form onSubmit={handleIssue} className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Issue Material Workflow</h3>
            <p className="text-slate-400 text-xs mt-1">Deduct inventory quantities, record usage against specific projects, and log audit entries.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scanned Barcode / SKU *</label>
              <input
                type="text"
                required
                value={issueBarcode}
                onChange={(e) => setIssueBarcode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Project *</label>
              <select
                required
                value={issueProjectId}
                onChange={(e) => setIssueProjectId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-200 focus:outline-none"
              >
                <option value="">Choose active project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quantity to issue *</label>
              <input
                type="number"
                required
                min="0.1"
                step="any"
                value={issueQty}
                onChange={(e) => setIssueQty(parseFloat(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Serial Number (Optional)</label>
              <input
                type="text"
                placeholder="SN-990288"
                value={issueSerial}
                onChange={(e) => setIssueSerial(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Usage Details / Notes</label>
              <textarea
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
                rows={2}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none"
          >
            {loading ? "Processing..." : "Commit Stock Issue"}
          </button>
        </form>
      )}

      {/* 5. Picking Workflow */}
      {activeSubTab === "pick" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md lg:col-span-1 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Project Picking setup</h3>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select active project</label>
              <select
                value={pickProjectId}
                onChange={(e) => handleLoadProjectBOM(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-205 focus:outline-none"
              >
                <option value="">Select project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {pickProjectId && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scan pick list item</label>
                <input
                  type="text"
                  placeholder="Scan item to verify..."
                  value={scannedPickItem}
                  onChange={(e) => setScannedPickItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePickScan(scannedPickItem)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {pickProjectId ? (
              <div className="glass rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md p-6 space-y-4">
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm">Project Pick List Required items</h3>
                <div className="space-y-3">
                  {pickBOM.length > 0 ? (
                    pickBOM.map((bom: any) => {
                      const barcode = bom.inventory?.barcode;
                      const status = pickingStatus[barcode] || "idle";
                      return (
                        <div 
                          key={bom.id} 
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border text-xs transition-all",
                            status === "success" 
                              ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                              : status === "error"
                                ? "bg-rose-50 border-rose-250 text-rose-800"
                                : "bg-slate-50/50 border-slate-200/50 dark:bg-slate-900/50 dark:border-slate-800/50 text-slate-800 dark:text-slate-200"
                          )}
                        >
                          <div>
                            <p className="font-bold">{bom.inventory?.name}</p>
                            <p className="text-[10px] text-slate-450 mt-1">SKU: {bom.inventory?.sku} | Barcode: {bom.inventory?.barcode}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold">Required Qty: {bom.required_quantity}</span>
                            {status === "success" && (
                              <span className="px-2 py-0.5 bg-emerald-200/85 text-emerald-950 font-bold uppercase text-[8px] rounded-full">Scanned & Verified</span>
                            )}
                            {status === "error" && (
                              <span className="px-2 py-0.5 bg-rose-200/85 text-rose-955 font-bold uppercase text-[8px] rounded-full">Mismatch</span>
                            )}
                            {status === "idle" && (
                              <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 font-bold uppercase text-[8px] rounded-full">Pending scan</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-slate-400 text-xs">No Bill of Materials (BOM) linked to this project.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass p-12 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center text-slate-405">
                <ClipboardCheck className="w-16 h-16 text-slate-300 dark:text-slate-755" />
                <p className="text-xs font-semibold mt-4">Choose a project to load its Picking lists and scan verify materials.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Stock Relocation (Transfer) Panel */}
      {activeSubTab === "transfer" && (
        <form onSubmit={handleTransfer} className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Material Relocation (Stock Transfer)</h3>
            <p className="text-slate-400 text-xs mt-1">Scan item to relocate between warehouses, zones, racks, or shelves with audit trail.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scanned Barcode / SKU *</label>
              <input
                type="text"
                required
                value={transBarcode}
                onChange={(e) => setTransBarcode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Relocation Quantity *</label>
              <input
                type="number"
                required
                min="0.1"
                step="any"
                value={transQty}
                onChange={(e) => setTransQty(parseFloat(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Warehouse *</label>
              <input
                type="text"
                required
                value={transToWh}
                onChange={(e) => setTransToWh(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Target Rack</label>
                <input type="text" placeholder="R2" value={transToRack} onChange={(e) => setTransToRack(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 text-center" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Target Shelf</label>
                <input type="text" placeholder="S3" value={transToShelf} onChange={(e) => setTransToShelf(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 text-center" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Target Bin</label>
                <input type="text" placeholder="B4" value={transToBin} onChange={(e) => setTransToBin(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 text-center" />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Transfer Notes / Reason</label>
              <textarea
                value={transNotes}
                onChange={(e) => setTransNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none"
                rows={2}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none"
          >
            {loading ? "Processing..." : "Commit Stock Relocation"}
          </button>
        </form>
      )}

      {/* 7. Returns Module */}
      {activeSubTab === "return" && (
        <form onSubmit={handleReturn} className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Process Returned Material</h3>
            <p className="text-slate-400 text-xs mt-1">Receive material back from sites. Catalog by reason (unused, repair, replacement, or damage).</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scanned Barcode / SKU *</label>
              <input
                type="text"
                required
                value={retBarcode}
                onChange={(e) => setRetBarcode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Return Quantity *</label>
              <input
                type="number"
                required
                min="0.1"
                step="any"
                value={retQty}
                onChange={(e) => setRetQty(parseFloat(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reason for Return *</label>
              <select
                value={retReason}
                onChange={(e) => setRetReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-205 focus:outline-none"
              >
                <option value="Unused">Unused (Return to available stock)</option>
                <option value="Damage">Damage (Flagged and quarantined)</option>
                <option value="Replacement">Replacement</option>
                <option value="Repair">Repair</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Originating Project (Optional)</label>
              <select
                value={retProjId}
                onChange={(e) => setRetProjId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-205 focus:outline-none"
              >
                <option value="">Select project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Condition / Notes</label>
              <textarea
                value={retNotes}
                onChange={(e) => setRetNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-855 dark:text-slate-100 focus:outline-none"
                rows={2}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none"
          >
            {loading ? "Processing..." : "Process Return"}
          </button>
        </form>
      )}

      {/* 8. Stock Audit Panel */}
      {activeSubTab === "audit" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md lg:col-span-1 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Create Audit Session</h3>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warehouse Zone *</label>
              <input type="text" value={auditWh} onChange={(e) => setAuditWh(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Rack Coordinate</label>
                <input type="text" value={auditRack} onChange={(e) => setAuditRack(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 text-center" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-slate-400">Shelf Coordinate</label>
                <input type="text" value={auditShelf} onChange={(e) => setAuditShelf(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 text-center" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scan to add Item</label>
              <input
                type="text"
                placeholder="Scan item barcode..."
                value={auditScanInput}
                onChange={(e) => setAuditScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAuditScan(auditScanInput);
                    setAuditScanInput("");
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="glass rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md p-6">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm mb-4">Items in current Audit</h3>
              
              {auditScans.length > 0 ? (
                <div className="space-y-3">
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                    {auditScans.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-250/20 dark:border-slate-805/50 text-xs">
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-200">{item.name}</p>
                          <p className="text-[10px] text-slate-450 mt-1">SKU: {item.sku}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span>Expected: <strong className="text-slate-655 dark:text-slate-300">{item.expected_qty}</strong></span>
                          <div className="flex items-center gap-1">
                            <span>Actual Count:</span>
                            <input 
                              type="number" 
                              value={item.actual_qty} 
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setAuditScans(prev => prev.map((s, i) => i === idx ? { ...s, actual_qty: val } : s));
                              }}
                              className="w-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-lg text-center font-bold text-slate-855 dark:text-slate-100" 
                            />
                          </div>
                          <span className={cn(
                            "font-bold px-2 py-0.5 rounded-full text-[9px]",
                            item.actual_qty - item.expected_qty === 0 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-rose-100 text-rose-700"
                          )}>
                            Diff: {item.actual_qty - item.expected_qty}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleCommitAudit}
                    disabled={loading}
                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none mt-4"
                  >
                    {loading ? "Reconciling balances..." : "Commit Audit & Adjust Balances"}
                  </button>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-12">
                  <Layers className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-800 mb-2" />
                  <p className="text-xs">No items scanned in this session yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Printable Labels Panel */}
      {activeSubTab === "print" && (
        <div className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">Label Printing Dashboard</h3>
            <p className="text-slate-400 text-xs mt-1">Export high-resolution PDF sheets for physical shelf tags or thermal printing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Material</label>
              <select
                value={printItemId}
                onChange={(e) => setPrintItemId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-205 focus:outline-none"
              >
                <option value="">Choose item...</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Label Size / Layout</label>
              <select
                value={printType}
                onChange={(e) => setPrintType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-805 dark:text-slate-205 focus:outline-none"
              >
                <option value="50x25">50x25 mm (Single Thermal Label)</option>
                <option value="60x40">60x40 mm (Single Thermal Label)</option>
                <option value="A4">A4 Sheet Grid (3x8 Layout)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Copies</label>
              <input
                type="number"
                min="1"
                max="100"
                value={printCopies}
                onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-808 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={() => handlePrintLabel(printItemId, printType, printCopies)}
            disabled={!printItemId}
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none disabled:opacity-55 disabled:cursor-not-allowed"
          >
            Export Printable Label PDF
          </button>
        </div>
      )}

    </div>
  );
}

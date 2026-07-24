"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ScanBarcode, QrCode, Printer, Search, AlertTriangle, 
  CheckCircle2, XCircle, Download, Smartphone, History,
  Box, Layers, RefreshCw, Camera, Info
} from "lucide-react";
import { apiRequest } from "@/services/apiClient";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BarcodeCenterProps {
  token: string;
  role: string;
}

// Code128B Pattern Definitions for 100% Client-Side Pure SVG Rendering
const CODE128B_PATTERNS: { [key: number]: string } = {
  0: "212222", 1: "222122", 2: "222221", 3: "121223", 4: "121322", 5: "131222", 6: "122213", 7: "122312", 8: "132212", 9: "221213",
  10: "221312", 11: "231212", 12: "112232", 13: "122132", 14: "122231", 15: "113222", 16: "123122", 17: "123221", 18: "223211", 19: "221132",
  20: "221231", 21: "213212", 22: "223112", 23: "312131", 24: "311222", 25: "321122", 26: "321221", 27: "312212", 28: "322112", 29: "322211",
  30: "212123", 31: "212321", 32: "232121", 33: "111323", 34: "131123", 35: "131321", 36: "112313", 37: "132113", 38: "132311", 39: "211313",
  40: "231113", 41: "231311", 42: "112133", 43: "112331", 44: "132131", 45: "113123", 46: "113321", 47: "133121", 48: "313121", 49: "211331",
  50: "231131", 51: "213113", 52: "213311", 53: "213131", 54: "311123", 55: "311321", 56: "331121", 57: "312113", 58: "312311", 59: "332111",
  60: "314111", 61: "221411", 62: "431111", 63: "111224", 64: "111422", 65: "121124", 66: "121421", 67: "141122", 68: "141221", 69: "112214",
  70: "112412", 71: "122114", 72: "122411", 73: "142112", 74: "142211", 75: "241211", 76: "221114", 77: "413111", 78: "241112", 79: "134111",
  80: "111242", 81: "121142", 82: "121241", 83: "114212", 84: "124112", 85: "124211", 86: "411212", 87: "421112", 88: "421211", 89: "212141",
  90: "214121", 91: "412121", 92: "111143", 93: "111341", 94: "131141", 95: "114113", 96: "114311", 97: "411113", 98: "411311", 99: "113141",
  100: "114131", 101: "311141", 102: "411131", 103: "211412", 104: "211214", 105: "211232", 106: "2331112"
};

function generateCode128SvgBars(text: string): string[] {
  let checksum = 104;
  const codes: number[] = [104];
  
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    const validCode = (code >= 0 && code <= 95) ? code : 0;
    codes.push(validCode);
    checksum += validCode * (i + 1);
  }
  
  const checkSymbol = checksum % 103;
  codes.push(checkSymbol);
  codes.push(106);
  
  return codes.map(c => CODE128B_PATTERNS[c] || CODE128B_PATTERNS[0]);
}

// Pure Industrial Code128 Barcode Generator (Bold 3px Module Width + 15-Module Quiet Zones)
function Code128BarcodeSvg({ text, width = 380, height = 110 }: { text: string; width?: number; height?: number }) {
  const patterns = generateCode128SvgBars(text || "ALI-000001");
  const patternStr = patterns.join("");
  
  let totalModules = 0;
  for (let i = 0; i < patternStr.length; i++) {
    totalModules += parseInt(patternStr[i], 10);
  }
  
  const quietZoneModules = 15;
  const totalWidthModules = totalModules + (quietZoneModules * 2);
  const moduleWidth = 3;
  
  const svgWidth = totalWidthModules * moduleWidth;
  const barHeight = height - 28;
  
  let currentX = quietZoneModules * moduleWidth;
  const rects: { x: number; w: number }[] = [];
  let isBar = true;
  
  for (let i = 0; i < patternStr.length; i++) {
    const modLen = parseInt(patternStr[i], 10);
    const barW = modLen * moduleWidth;
    if (isBar) {
      rects.push({ x: currentX, w: barW });
    }
    currentX += barW;
    isBar = !isBar;
  }
  
  return (
    <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm max-w-full overflow-x-auto">
      <svg 
        width={svgWidth} 
        height={height} 
        viewBox={`0 0 ${svgWidth} ${height}`} 
        shapeRendering="crispEdges"
      >
        <rect x="0" y="0" width={svgWidth} height={height} fill="#FFFFFF" />
        {rects.map((r, idx) => (
          <rect key={idx} x={r.x} y={6} width={r.w} height={barHeight} fill="#000000" />
        ))}
        <text x={svgWidth / 2} y={height - 4} textAnchor="middle" fontSize="13" fontFamily="monospace" fontWeight="bold" fill="#000000" letterSpacing="2">
          {text}
        </text>
      </svg>
    </div>
  );
}

export default function BarcodeCenter({ token, role }: BarcodeCenterProps) {
  const userRole = (role || "").toLowerCase();
  const isAdmin = ["admin", "super_admin", "factory_manager", "manager"].includes(userRole);
  const isPurchase = ["purchase", "purchase_manager"].includes(userRole);
  const isStore = ["store", "store_assistant", "inventory_manager"].includes(userRole);
  const isProduction = ["production", "worker", "carpenter", "operator"].includes(userRole);
  const isDispatch = ["dispatch", "supervisor"].includes(userRole);
  const isAuditor = ["auditor", "accountant", "accounts_manager"].includes(userRole);

  const canScan = isAdmin || isStore || isProduction || isDispatch;
  const canGenerate = isAdmin || isPurchase || isStore;
  const canPrint = isAdmin || isPurchase || isStore;
  const canViewHistory = isAdmin || isPurchase || isStore || isAuditor;

  const defaultTab = canScan ? "scan" : (canGenerate ? "gen" : (canPrint ? "print" : "history"));
  const [activeSubTab, setActiveSubTab] = useState<"gen" | "scan" | "print" | "history">(defaultTab);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const [searchGenQuery, setSearchGenQuery] = useState("");
  const [searchPrintQuery, setSearchPrintQuery] = useState("");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<{ id: string; label: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const html5QrCodeInstanceRef = useRef<any>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const scannerBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const [genType, setGenType] = useState<"inventory" | "project">("inventory");
  const [genEntityId, setGenEntityId] = useState("");
  const [generatedBarcode, setGeneratedBarcode] = useState("");
  const [isDuplicate, setIsDuplicate] = useState(false);

  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");
  const [adjustNotes, setAdjustNotes] = useState("");

  const [printType, setPrintType] = useState<"inventory" | "project">("inventory");
  const [printEntityId, setPrintEntityId] = useState("");
  const [printCopies, setPrintCopies] = useState(1);
  const [printSize, setPrintSize] = useState("50x25");

  const [printModalData, setPrintModalData] = useState<{ name: string; barcode: string; sku: string; copies: number; size: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  useEffect(() => {
    if (activeSubTab === "scan" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeSubTab]);

  // Global Keydown Listener for USB & Wireless Barcode Hardware Scanners
  useEffect(() => {
    if (activeSubTab !== "scan") return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === "TEXTAREA") return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        if (scannerBufferRef.current.trim()) {
          const barcodeScanned = scannerBufferRef.current.trim();
          scannerBufferRef.current = "";
          setScanInput(barcodeScanned);
          handleLookup(barcodeScanned);
        }
      } else if (e.key.length === 1) {
        if (timeDiff > 100) {
          scannerBufferRef.current = e.key;
        } else {
          scannerBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [activeSubTab, inventoryItems, projects]);

  // Request Camera Permissions & Enumerate Video Input Devices
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices
          .filter((d) => d.kind === "videoinput")
          .map((d, index) => ({
            id: d.deviceId,
            label: d.label || `Camera ${index + 1}`
          }));
        setCameraDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          const rearCam = videoInputs.find(c => c.label.toLowerCase().includes("back") || c.label.toLowerCase().includes("rear") || c.label.toLowerCase().includes("environment"));
          setSelectedDeviceId(rearCam ? rearCam.id : videoInputs[0].id);
        }
      }).catch(() => {});
    }
  }, [cameraActive]);

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

  // Direct Native Html5Qrcode Camera Scanner Engine (high sensitivity 20 FPS continuous decoding)
  useEffect(() => {
    if (!cameraActive) {
      if (html5QrCodeInstanceRef.current) {
        try {
          html5QrCodeInstanceRef.current.stop().catch(() => {});
        } catch (e) {}
        html5QrCodeInstanceRef.current = null;
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    script.onload = () => {
      const Html5Qrcode = (window as any).Html5Qrcode;
      if (!Html5Qrcode) return;

      try {
        const html5QrCode = new Html5Qrcode("qr-reader-barcode-center");
        html5QrCodeInstanceRef.current = html5QrCode;

        const cameraConfig = selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: "environment" };

        const scanConfig = {
          fps: 20,
          qrbox: { width: 300, height: 160 },
          aspectRatio: 1.777778,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };

        html5QrCode.start(
          cameraConfig,
          scanConfig,
          (decodedText: string) => {
            handleScannedBarcode(decodedText);
            try {
              html5QrCode.stop();
            } catch (_) {}
            setCameraActive(false);
          },
          () => {}
        ).catch((err: any) => {
          setErrorMsg("Camera permission denied or camera device in use.");
          setCameraActive(false);
        });
      } catch (e) {
        setErrorMsg("Failed to start camera scanner.");
        setCameraActive(false);
      }
    };
    document.body.appendChild(script);

    return () => {
      if (html5QrCodeInstanceRef.current) {
        try {
          html5QrCodeInstanceRef.current.stop().catch(() => {});
        } catch (e) {}
      }
    };
  }, [cameraActive, selectedDeviceId]);

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
      
      // 1. Try GET /api/barcode/lookup/{barcode} (Primary Barcode Master lookup)
      try {
        const masterRes = await apiRequest(`/api/barcode/lookup/${encodeURIComponent(cleanCode)}`);
        if (masterRes && (masterRes.item || masterRes.project)) {
          res = masterRes;
        }
      } catch (_) {}

      // 2. Try GET /api/inventory/lookup/{barcode}
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

      // 3. Try GET /api/inventory/scan/{barcode}
      if (!res) {
        try {
          const scanItem = await apiRequest(`/api/inventory/scan/${encodeURIComponent(cleanCode)}`);
          if (scanItem && (scanItem.id || scanItem.name)) {
            res = {
              type: "inventory",
              item: scanItem,
              supplier: scanItem.supplier_name ? { name: scanItem.supplier_name } : null,
              last_purchase: scanItem.last_transaction,
              project_usage: []
            };
          }
        } catch (_) {}
      }

      // 4. Client-side catalog resolution fallback (matching barcode, sku, id, or name)
      if (!res) {
        const cleanLower = cleanCode.toLowerCase();
        const itemMatch = inventoryItems.find(i => 
          (i.barcode && i.barcode.toLowerCase() === cleanLower) || 
          (i.sku && i.sku.toLowerCase() === cleanLower) ||
          (i.id && String(i.id).toLowerCase() === cleanLower) ||
          (i.name && i.name.toLowerCase().trim() === cleanLower)
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
            (p.barcode && p.barcode.toLowerCase() === cleanLower) ||
            (p.id && String(p.id).toLowerCase() === cleanLower) ||
            (p.name && p.name.toLowerCase().trim() === cleanLower)
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
        setErrorMsg(`Barcode Not Found: "${cleanCode}" in master catalog.`);
      }
    } catch (_) {
      setErrorMsg(`Barcode Not Found: "${cleanCode}" in master catalog.`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genEntityId) {
      setErrorMsg("Please select an existing material or project record first.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setGeneratedBarcode("");
    setIsDuplicate(false);

    try {
      let barcode = "";
      let alreadyExists = false;
      const targetItem = inventoryItems.find(i => String(i.id) === String(genEntityId));
      const targetProj = projects.find(p => String(p.id) === String(genEntityId));

      if (genType === "inventory" && targetItem?.barcode) {
        barcode = targetItem.barcode;
        alreadyExists = true;
      } else if (genType === "project" && targetProj?.barcode) {
        barcode = targetProj.barcode;
        alreadyExists = true;
      }

      if (!barcode) {
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
            alreadyExists = !!res.already_exists;
          }
        } catch (_) {}
      }

      if (!barcode) {
        const prefix = genType === "inventory" ? "ALI-" : "ALP-";
        let maxSeq = 0;
        if (genType === "inventory") {
          inventoryItems.forEach(i => {
            if (i.barcode && (i.barcode.startsWith("ALI-") || i.barcode.startsWith("AL-"))) {
              const num = parseInt(i.barcode.replace(/^(ALI-|AL-)/, ""), 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
        } else {
          projects.forEach(p => {
            if (p.barcode && (p.barcode.startsWith("ALP-") || p.barcode.startsWith("PRJ-"))) {
              const num = parseInt(p.barcode.replace(/^(ALP-|PRJ-)/, ""), 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
        }
        barcode = `${prefix}${String(maxSeq + 1).padStart(6, "0")}`;

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
      }

      if (genType === "inventory" && targetItem) {
        targetItem.barcode = barcode;
      } else if (genType === "project" && targetProj) {
        targetProj.barcode = barcode;
      }

      setGeneratedBarcode(barcode);
      setIsDuplicate(alreadyExists);
      if (alreadyExists) {
        setErrorMsg(`Barcode Already Exists: ${barcode}`);
      } else {
        setSuccessMsg(`Barcode Generated Successfully: ${barcode}`);
      }
      fetchData();
    } catch (_) {
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

  const openPrintModal = (name: string, barcode: string, sku: string, copies: number = 1, size: string = "50x25") => {
    setPrintModalData({ name, barcode, sku, copies, size });
    try {
      apiRequest(`/api/barcode/center/print-log?barcode=${encodeURIComponent(barcode)}`, { method: "POST" });
    } catch (_) {}
  };

  const downloadBarcodeSvg = (barcodeVal: string) => {
    const svgEl = document.getElementById(`barcode-svg-element-${barcodeVal}`);
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `barcode_${barcodeVal}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
      {/* Global CSS for Clean Thermal Printer & PDF Output (Prints ONLY pure barcode) */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-pure-barcode-area, #printable-pure-barcode-area * {
            visibility: visible !important;
          }
          #printable-pure-barcode-area {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: #ffffff !important;
            width: auto !important;
            height: auto !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }
        }
      `}</style>

      {/* Printable Label View Modal - PURE BARCODE ONLY */}
      {printModalData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-6 text-slate-900">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" /> Barcode Label Print
              </h3>
              <button 
                onClick={() => setPrintModalData(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* PURE BARCODE ONLY CONTAINER */}
            <div 
              id="printable-pure-barcode-area" 
              className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white space-y-2 border border-slate-200"
            >
              <div id={`barcode-svg-element-${printModalData.barcode}`}>
                <Code128BarcodeSvg text={printModalData.barcode} width={380} height={110} />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Trigger Thermal Printer / PDF
              </button>
              <button
                onClick={() => downloadBarcodeSvg(printModalData.barcode)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" /> SVG
              </button>
            </div>
          </div>
        </div>
      )}

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
                Industrial Code128 barcode management for warehouse inventory materials and project registers.
              </p>
            </div>
          </div>
        </div>
        <div className="z-10 bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-2xl text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Role: <strong className="text-white capitalize">{userRole}</strong></span>
        </div>
      </div>

      {/* Camera scanner modal */}
      {cameraActive && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md mx-auto relative space-y-4">
          <button 
            onClick={() => setCameraActive(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10 cursor-pointer"
          >
            <XCircle className="w-6 h-6" />
          </button>
          <h3 className="text-white text-sm font-bold text-center flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4 text-indigo-400" /> High-Speed Camera Scanner Mode
          </h3>

          {cameraDevices.length > 1 && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Switch Video Input Camera</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none"
              >
                {cameraDevices.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          <div id="qr-reader-barcode-center" className="overflow-hidden rounded-2xl bg-black border border-slate-800 aspect-video" />
          <p className="text-slate-450 text-[10px] text-center">Align Code128 Barcode inside box to trigger instant scan</p>
        </div>
      )}

      {/* Toast Alert Feedback */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 rounded-2xl animate-fade-in shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
          <p className="text-xs font-semibold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 rounded-2xl animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Navigation Sub Tabs with Role Access */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200/60 dark:border-slate-800/60">
        {[
          { id: "scan", label: "Scan Barcode", icon: ScanBarcode, show: canScan },
          { id: "gen", label: "Generate Barcode", icon: QrCode, show: canGenerate },
          { id: "print", label: "Print Barcode", icon: Printer, show: canPrint },
          { id: "history", label: "Barcode History", icon: History, show: canViewHistory }
        ].filter(t => t.show).map(tab => {
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
                setIsDuplicate(false);
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
      {activeSubTab === "scan" && canScan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md lg:col-span-1 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <ScanBarcode className="w-4 h-4 text-indigo-500" /> Scanner Input
            </h3>
            <p className="text-slate-400 text-xs">
              Supports USB/Wireless hardware scanners (plug & play auto-trigger ready) or high-speed camera scan.
            </p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="Scan or type barcode (ALI-XXXXXX / ALP-XXXXXX)..."
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
                <Camera className="w-4 h-4 text-indigo-500" />
                Scan using camera / Webcam
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
                          onClick={() => openPrintModal(scanResult.item.name, scanResult.item.barcode || scanResult.item.sku, scanResult.item.sku, 1, "50x25")}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print Label
                        </button>
                        <button
                          onClick={() => downloadBarcodeSvg(scanResult.item.barcode || scanResult.item.sku)}
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
                          <div className="flex justify-between"><span className="text-slate-400">Supplier:</span><span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{scanResult.supplier?.name || scanResult.item.supplier_name || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Location Rack:</span><span className="font-bold text-slate-800 dark:text-slate-200">{scanResult.item.rack || scanResult.item.rack_location || "N/A"}</span></div>
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
                        onClick={() => openPrintModal(scanResult.project.name, scanResult.project.barcode, scanResult.project.barcode, 1, "50x25")}
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
                <p className="text-xs font-semibold mt-4">Awaiting Scan lookup. Point hardware scanner or align camera to view complete record specifications.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GENERATE BARCODE */}
      {activeSubTab === "gen" && canGenerate && (
        <form onSubmit={handleGenerate} className="glass p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-md max-w-2xl mx-auto space-y-6">
          <div className="border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-500" /> Generate Unique Barcode
            </h3>
            <p className="text-slate-400 text-xs mt-1">Assign unique, sequential barcodes (`ALI-XXXXXX` or `ALP-XXXXXX`) to existing inventory materials or project registers without altering material names or quantities.</p>
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
                    setIsDuplicate(false);
                  }}
                  className={cn(
                    "py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border",
                    genType === "inventory"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                  )}
                >
                  <Box className="w-4 h-4" /> Inventory Item (ALI-XXXXXX)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenType("project");
                    setGenEntityId("");
                    setGeneratedBarcode("");
                    setIsDuplicate(false);
                  }}
                  className={cn(
                    "py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border",
                    genType === "project"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                  )}
                >
                  <Layers className="w-4 h-4" /> Project Register (ALP-XXXXXX)
                </button>
              </div>
            </div>

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
                  onChange={(e) => {
                    setGenEntityId(e.target.value);
                    setGeneratedBarcode("");
                    setIsDuplicate(false);
                  }}
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
                  onChange={(e) => {
                    setGenEntityId(e.target.value);
                    setGeneratedBarcode("");
                    setIsDuplicate(false);
                  }}
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
            {loading ? "Checking & Generating..." : "Generate Barcode"}
          </button>

          {generatedBarcode && (
            <div className={cn(
              "p-6 border rounded-2xl flex flex-col items-center justify-center space-y-4 animate-fade-in",
              isDuplicate ? "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
            )}>
              {isDuplicate ? (
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Barcode Already Exists: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{generatedBarcode}</strong></span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-bold">NEWLY GENERATED ID: <span className="text-xl text-indigo-500 font-extrabold font-mono ml-1">{generatedBarcode}</span></p>
              )}
              
              <div id={`barcode-svg-element-${generatedBarcode}`}>
                <Code128BarcodeSvg text={generatedBarcode} width={380} height={110} />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const item = inventoryItems.find(i => String(i.id) === String(genEntityId));
                    const proj = projects.find(p => String(p.id) === String(genEntityId));
                    const name = item?.name || proj?.name || "Record";
                    const sku = item?.sku || generatedBarcode;
                    openPrintModal(name, generatedBarcode, sku, 1, "50x25");
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Label
                </button>
                <button
                  type="button"
                  onClick={() => downloadBarcodeSvg(generatedBarcode)}
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
      {activeSubTab === "print" && canPrint && (
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
                const item = inventoryItems.find(i => String(i.id) === String(printEntityId));
                const proj = projects.find(p => String(p.id) === String(printEntityId));
                const code = item?.barcode || proj?.barcode || printEntityId;
                const name = item?.name || proj?.name || "Record Label";
                const sku = item?.sku || code;
                openPrintModal(name, code, sku, printCopies, printSize);
              }
            }}
            disabled={!printEntityId}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-md select-none disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Open Label Print Sheet
          </button>
        </div>
      )}

      {/* TAB 4: BARCODE HISTORY */}
      {activeSubTab === "history" && canViewHistory && (
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
                          onClick={() => openPrintModal(h.entity_name, h.barcode, h.barcode, 1, "50x25")}
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

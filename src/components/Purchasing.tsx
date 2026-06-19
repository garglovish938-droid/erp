"use client";

import { useState, useEffect } from "react";
import { Plus, ShoppingCart, Truck, Clipboard, Calendar, FileText, User, Loader2, X, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api";

export default function Purchasing({ token, role }: { token: string; role: string }) {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPO, setNewPO] = useState({ supplier_id: "", inventory_id: "", quantity: 0, unit_cost: 0 });
  const [submitError, setSubmitError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAccountant = ["admin", "accountant"].includes(role);
  const isStore = ["admin", "store"].includes(role);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [poRes, supRes, invRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/purchasing`, { headers }),
        fetch(`${API_BASE_URL}/api/suppliers`, { headers }),
        fetch(`${API_BASE_URL}/api/inventory`, { headers })
      ]);

      if (poRes.ok) setPurchaseOrders(await poRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (invRes.ok) setInventory(await invRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchasing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newPO)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create PO");
      }
      setShowAddModal(false);
      setNewPO({ supplier_id: "", inventory_id: "", quantity: 0, unit_cost: 0 });
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  const handleUpdateStatus = async (poId: string, newStatus: string) => {
    setActionLoading(poId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchasing/${poId}/status?status=${newStatus}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to update PO status");
      }
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400";
      case "approved": return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400";
      case "ordered": return "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400";
      case "delivered": return "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400";
      case "received": return "bg-emerald-50 text-emerald-600 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400";
      default: return "bg-slate-50 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Purchase Orders</h2>
          <p className="text-slate-500 mt-1">Manage purchase requests, supplier orders, and incoming warehouse deliveries.</p>
        </div>
        <div>
          {isAccountant && (
            <button 
              onClick={() => { setShowAddModal(true); setSubmitError(""); }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-150 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          )}
        </div>
      </header>

      {/* PO Table */}
      <div className="glass rounded-3xl overflow-hidden border border-slate-200/60 dark:border-slate-800/80 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-55 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800/80">
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400">PO Number</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400">Supplier Name</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400">Item Details</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400">Qty Ordered</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400">Total Budget</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400">Status</th>
                <th className="p-5 font-bold text-xs uppercase tracking-wider text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium">
              {purchaseOrders.length > 0 ? (
                purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="p-5 font-mono text-xs font-bold text-slate-900 dark:text-white">{po.po_number}</td>
                    <td className="p-5">{po.supplier?.name}</td>
                    <td className="p-5">
                      <div className="font-semibold">{po.inventory?.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{po.inventory?.sku}</div>
                    </td>
                    <td className="p-5">{po.quantity} {po.inventory?.unit}</td>
                    <td className="p-5 text-indigo-650 dark:text-indigo-400 font-bold">${po.total_cost.toLocaleString()}</td>
                    <td className="p-5">
                      <span className={cn("px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase", getStatusColor(po.status))}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      {actionLoading === po.id ? (
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin ml-auto" />
                      ) : (
                        <div className="flex gap-2 justify-end">
                          {/* Accountant Approvals */}
                          {po.status === "pending" && isAccountant && (
                            <button 
                              onClick={() => handleUpdateStatus(po.id, "approved")}
                              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-100 transition-colors text-xs border border-indigo-100/50"
                            >
                              Approve
                            </button>
                          )}
                          {po.status === "approved" && isAccountant && (
                            <button 
                              onClick={() => handleUpdateStatus(po.id, "ordered")}
                              className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold rounded-xl hover:bg-purple-100 transition-colors text-xs border border-purple-100/50"
                            >
                              Place Order
                            </button>
                          )}
                          {po.status === "ordered" && isAccountant && (
                            <button 
                              onClick={() => handleUpdateStatus(po.id, "delivered")}
                              className="px-3 py-1.5 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 font-bold rounded-xl hover:bg-yellow-100 transition-colors text-xs border border-yellow-100/50"
                            >
                              Mark Shipped
                            </button>
                          )}

                          {/* Storekeeper Goods Received */}
                          {(po.status === "ordered" || po.status === "delivered") && isStore && (
                            <button 
                              onClick={() => handleUpdateStatus(po.id, "received")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md text-xs flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Receive Goods
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold text-slate-500">No Purchase Orders</p>
                    <p className="text-xs text-slate-400 mt-1">Submit purchase requests to restock inventory items.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE PO MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold">Request Purchase Order</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-455 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {submitError && <div className="bg-rose-500/10 text-rose-500 border border-rose-500/25 p-3 rounded-xl text-xs mb-4">{submitError}</div>}

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Select Supplier*</label>
                <select required value={newPO.supplier_id} onChange={e=>setNewPO({...newPO, supplier_id: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <option value="">Choose Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.material_categories})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Material to Order*</label>
                <select required value={newPO.inventory_id} onChange={e=>setNewPO({...newPO, inventory_id: e.target.value})} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <option value="">Choose Material</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Quantity*</label>
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    value={newPO.quantity || ""} 
                    onChange={e=>setNewPO({...newPO, quantity: parseFloat(e.target.value) || 0})} 
                    placeholder="e.g. 50" 
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" 
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Unit Cost ($)*</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required 
                    min="0.01" 
                    value={newPO.unit_cost || ""} 
                    onChange={e=>setNewPO({...newPO, unit_cost: parseFloat(e.target.value) || 0})} 
                    placeholder="e.g. 35.00" 
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" 
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-150/10 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Estimated Total:</span>
                <span className="text-lg font-black">${(newPO.quantity * newPO.unit_cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-sm border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-100 dark:shadow-none">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

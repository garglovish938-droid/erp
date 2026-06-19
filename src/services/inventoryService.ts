import { apiRequest } from "./apiClient";
import { API_BASE_URL } from "@/lib/api";

export const inventoryService = {
  getInventory: (includeDeleted = false) =>
    apiRequest(`/api/inventory?include_deleted=${includeDeleted}`),
    
  createInventoryItem: (data: any) =>
    apiRequest("/api/inventory", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  updateInventoryItem: (id: string, data: any) =>
    apiRequest(`/api/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    
  deleteInventoryItem: (id: string) =>
    apiRequest(`/api/inventory/${id}`, {
      method: "DELETE",
    }),
    
  restoreInventoryItem: (id: string) =>
    apiRequest(`/api/inventory/${id}/restore`, {
      method: "POST",
    }),
    
  adjustStock: (id: string, data: any) =>
    apiRequest(`/api/inventory/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  getCategories: () =>
    apiRequest("/api/categories"),
    
  createCategory: (data: any) =>
    apiRequest("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  getPurchaseOrders: () =>
    apiRequest("/api/purchasing"),
    
  createPurchaseOrder: (data: any) =>
    apiRequest("/api/purchasing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  updatePurchaseOrderStatus: (id: string, status: string) =>
    apiRequest(`/api/purchasing/${id}/status?status=${status}`, {
      method: "PUT",
    }),

  importCSV: async (file: File) => {
    let token = "";
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("allure_erp_user");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          token = parsed.token || "";
        } catch (e) {}
      }
    }
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`${API_BASE_URL}/api/inventory/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "CSV Import failed" }));
      throw new Error(err.detail || "CSV Import failed");
    }
    return response.json();
  },

  // --- Dynamic Custom Field System ---
  getCustomFields: (entityType: string) =>
    apiRequest(`/api/custom-fields/${entityType}`),

  createCustomField: (data: any) =>
    apiRequest("/api/custom-fields", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteCustomField: (id: string) =>
    apiRequest(`/api/custom-fields/${id}`, {
      method: "DELETE",
    }),

  getEntityFieldValues: (entityId: string) =>
    apiRequest(`/api/custom-fields/values/${entityId}`),

  saveFieldValue: (data: any) =>
    apiRequest("/api/custom-fields/values", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Versioning Snapshot History ---
  getVersions: (entityType: string, entityId: string) =>
    apiRequest(`/api/versions/${entityType}/${entityId}`),

  // --- Backups & Restore System ---
  getBackups: () =>
    apiRequest("/api/settings/backups"),

  createBackup: () =>
    apiRequest("/api/settings/backup", {
      method: "POST",
    }),

  restoreBackup: (filename: string) =>
    apiRequest(`/api/settings/restore/${filename}`, {
      method: "POST",
    }),

  getLogs: () =>
    apiRequest("/api/settings/logs"),
    
  // --- Dashboard Customizable widgets ---
  getWidgets: () =>
    apiRequest("/api/dashboard/widgets"),

  saveWidget: (data: any) =>
    apiRequest("/api/dashboard/widgets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeWidget: (id: string) =>
     apiRequest(`/api/dashboard/widgets/${id}`, {
       method: "DELETE",
     }),
};

import { apiRequest } from "./apiClient";

export const supplierService = {
  getSuppliers: (includeDeleted = false) =>
    apiRequest(`/api/suppliers?include_deleted=${includeDeleted}`),
    
  createSupplier: (data: any) =>
    apiRequest("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  updateSupplier: (id: string, data: any) =>
    apiRequest(`/api/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    
  deleteSupplier: (id: string) =>
    apiRequest(`/api/suppliers/${id}`, {
      method: "DELETE",
    }),
    
  restoreSupplier: (id: string) =>
    apiRequest(`/api/suppliers/${id}/restore`, {
      method: "POST",
    }),
    
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/api/suppliers/import", {
      method: "POST",
      body: formData,
    });
  },
};


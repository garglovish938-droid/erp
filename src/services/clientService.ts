import { apiRequest } from "./apiClient";

export const clientService = {
  getClients: (includeDeleted = false) =>
    apiRequest(`/api/clients?include_deleted=${includeDeleted}`),
    
  createClient: (data: any) =>
    apiRequest("/api/clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  updateClient: (id: string, data: any) =>
    apiRequest(`/api/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    
  deleteClient: (id: string) =>
    apiRequest(`/api/clients/${id}`, {
      method: "DELETE",
    }),
    
  restoreClient: (id: string) =>
    apiRequest(`/api/clients/${id}/restore`, {
      method: "POST",
    }),
    
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/api/clients/import", {
      method: "POST",
      body: formData,
    });
  },
};


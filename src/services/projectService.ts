import { apiRequest } from "./apiClient";
import { API_BASE_URL } from "@/lib/api";

export const projectService = {
  getProjects: (includeDeleted = false) =>
    apiRequest(`/api/projects?include_deleted=${includeDeleted}`),
    
  createProject: (data: any) =>
    apiRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  updateProject: (id: string, data: any) =>
    apiRequest(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    
  deleteProject: (id: string) =>
    apiRequest(`/api/projects/${id}`, {
      method: "DELETE",
    }),
    
  restoreProject: (id: string) =>
    apiRequest(`/api/projects/${id}/restore`, {
      method: "POST",
    }),
    
  addBOMItem: (projectId: string, data: any) =>
    apiRequest(`/api/projects/${projectId}/bom`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  getMaterialRequests: () =>
    apiRequest("/api/requests"),
    
  createMaterialRequest: (data: any) =>
    apiRequest("/api/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  updateMaterialRequestStatus: (id: string, status: string) =>
    apiRequest(`/api/requests/${id}/status?status=${status}`, {
      method: "PUT",
    }),

  // Documents
  getDocuments: (entityType?: string, entityId?: string) => {
    let url = "/api/documents";
    const params = [];
    if (entityType) params.push(`entity_type=${entityType}`);
    if (entityId) params.push(`entity_id=${entityId}`);
    if (params.length) url += `?${params.join("&")}`;
    return apiRequest(url);
  },

  uploadDocument: async (name: string, category: string, entityType: string, entityId: string, file: File) => {
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

    const url = `${API_BASE_URL}/api/documents?name=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}&entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return response.json();
  },

  deleteDocument: (id: string) =>
    apiRequest(`/api/documents/${id}`, {
      method: "DELETE",
    }),
    
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/api/projects/import", {
      method: "POST",
      body: formData,
    });
  },
};


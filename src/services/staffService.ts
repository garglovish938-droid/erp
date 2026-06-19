import { apiRequest } from "./apiClient";

export const staffService = {
  getStaff: (includeDeleted = false) =>
    apiRequest(`/api/staff?include_deleted=${includeDeleted}`),
    
  createStaff: (data: any) =>
    apiRequest("/api/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  updateStaff: (id: string, data: any) =>
    apiRequest(`/api/staff/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    
  deleteStaff: (id: string) =>
    apiRequest(`/api/staff/${id}`, {
      method: "DELETE",
    }),
    
  restoreStaff: (id: string) =>
    apiRequest(`/api/staff/${id}/restore`, {
      method: "POST",
    }),
    
  getAttendance: (dateString: string) =>
    apiRequest(`/api/attendance?target_date=${dateString}`),
    
  logAttendance: (data: any) =>
    apiRequest("/api/attendance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Tasks
  getTasks: (includeDeleted = false) =>
    apiRequest(`/api/tasks?include_deleted=${includeDeleted}`),

  createTask: (data: any) =>
    apiRequest("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTask: (id: string, data: any) =>
    apiRequest(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTask: (id: string) =>
    apiRequest(`/api/tasks/${id}`, {
      method: "DELETE",
    }),
    
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/api/staff/import", {
      method: "POST",
      body: formData,
    });
  },
};

import { API_BASE_URL } from "@/lib/api";

export async function apiRequest(path: string, options: RequestInit = {}) {
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

  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  if (!(options.body instanceof FormData) && options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = "API request failed";
    try {
      const errorBody = await response.json();
      if (errorBody) {
        if (typeof errorBody.detail === "string") {
          errorMessage = errorBody.detail;
        } else if (Array.isArray(errorBody.detail)) {
          // FastAPI validation errors return an array of objects
          errorMessage = errorBody.detail
            .map((e: any) =>
              typeof e === "object" ? (e.msg || JSON.stringify(e)) : String(e)
            )
            .join("; ");
        } else if (errorBody.detail && typeof errorBody.detail === "object") {
          errorMessage = JSON.stringify(errorBody.detail);
        } else if (errorBody.message) {
          errorMessage = typeof errorBody.message === "object" ? JSON.stringify(errorBody.message) : String(errorBody.message);
        } else if (typeof errorBody === "object") {
          errorMessage = JSON.stringify(errorBody);
        } else {
          errorMessage = String(errorBody);
        }
      }
    } catch (_) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

import { API_BASE_URL } from "@/lib/api";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  let token = "";
  let refreshToken = "";
  if (typeof window !== "undefined") {
    const savedUser = localStorage.getItem("allure_erp_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        token = parsed.token || "";
        // Support both old naming and new naming convention for session security compatibility
        refreshToken = parsed.refresh_token || parsed.refreshToken || "";
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

  // If unauthorized and has refresh token, attempt silent refresh
  if (response.status === 401 && refreshToken && !path.includes("/api/auth/login") && !path.includes("/api/auth/refresh")) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          if (typeof window !== "undefined") {
            const savedUser = localStorage.getItem("allure_erp_user");
            if (savedUser) {
              const parsed = JSON.parse(savedUser);
              parsed.token = data.access_token;
              parsed.refresh_token = data.refresh_token;
              localStorage.setItem("allure_erp_user", JSON.stringify(parsed));
            }
          }
          isRefreshing = false;
          onRefreshed(data.access_token);
        } else {
          isRefreshing = false;
          if (typeof window !== "undefined") {
            localStorage.removeItem("allure_erp_user");
            window.location.reload();
          }
          throw new Error("Session expired. Please log in again.");
        }
      } catch (err) {
        isRefreshing = false;
        if (typeof window !== "undefined") {
          localStorage.removeItem("allure_erp_user");
          window.location.reload();
        }
        throw err;
      }
    }

    const retryOriginalRequest = new Promise((resolve) => {
      subscribeTokenRefresh((newToken: string) => {
        headers["Authorization"] = `Bearer ${newToken}`;
        resolve(
          fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers,
          })
        );
      });
    });

    const retriedResponse = (await retryOriginalRequest) as Response;
    return handleResponse(retriedResponse);
  }

  return handleResponse(response);
}

async function handleResponse(response: Response): Promise<any> {
  if (!response.ok) {
    let errorMessage = "API request failed";
    try {
      const errorBody = await response.json();
      if (errorBody) {
        if (typeof errorBody.detail === "string") {
          errorMessage = errorBody.detail;
        } else if (Array.isArray(errorBody.detail)) {
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

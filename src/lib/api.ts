// IMPORTANT: NEXT_PUBLIC_API_URL must be set in Vercel environment variables
// Fallback to the Render backend URL to prevent "Failed to fetch" on missing env var
const RENDER_BACKEND_URL = "https://factory-erp-backend-cwcb.onrender.com";

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const envUrl = process.env.NEXT_PUBLIC_API_URL || "";
    
    if (isLocalhost) {
      return envUrl || "http://127.0.0.1:8000";
    } else {
      if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
        return envUrl;
      }
      return RENDER_BACKEND_URL;
    }
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || "";
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  return RENDER_BACKEND_URL;
};

const rawApiUrl = getApiUrl();
export const API_BASE_URL = rawApiUrl.replace(/\/$/, "");





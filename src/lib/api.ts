// IMPORTANT: NEXT_PUBLIC_API_URL must be set in Vercel environment variables
// Fallback to the Render backend URL to prevent "Failed to fetch" on missing env var
const RENDER_BACKEND_URL = "https://factory-erp-backend-cwcb.onrender.com";

const rawApiUrl = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || RENDER_BACKEND_URL)
  : (process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || RENDER_BACKEND_URL);

// Strip trailing slash if present to prevent double slash errors (e.g. //api/auth/login)
export const API_BASE_URL = rawApiUrl.replace(/\/$/, "");





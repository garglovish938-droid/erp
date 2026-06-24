// IMPORTANT: NEXT_PUBLIC_API_URL must be set in Vercel environment variables
// Fallback to the Render backend URL to prevent "Failed to fetch" on missing env var
const RENDER_BACKEND_URL = "https://factory-erp-backend-cwcb.onrender.com";

export const API_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || RENDER_BACKEND_URL)
  : (process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || RENDER_BACKEND_URL);




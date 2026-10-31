const raw = import.meta.env.VITE_API_URL || "https://memora-ai-backend-0nls.onrender.com";
export const API_URL = raw.replace(/\/+$/, "");


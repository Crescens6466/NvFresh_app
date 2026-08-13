// api.js — fetch wrapper for the admin app, attaches JWT automatically
//
// In local dev, Vite proxies "/api" to the server on :5000 (see vite.config.js).
// In production (e.g. Vercel), there's no server behind the static build, so
// set VITE_API_URL to your deployed backend's URL, e.g.:
//   VITE_API_URL=https://nvfresh-api.onrender.com/api
const BASE = import.meta.env.VITE_API_URL || "/api";
const API_ORIGIN = BASE.startsWith("http") ? BASE.replace(/\/api\/?$/, "") : "";

// Product/QR images come back as paths relative to the backend (e.g.
// "/api/files/xxx"). In dev, Vite's proxy makes that resolve correctly against
// the frontend's own origin; in production, frontend and backend are on
// different domains, so an <img src="/api/files/xxx"> would otherwise
// request the frontend's own domain and get its SPA fallback HTML instead.
export function resolveImageUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

function getToken() {
  return window.localStorage.getItem("nvfresh_admin_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  // A 401 while we sent a token means the session died (expired, or a stale
  // offline-demo token) — not a login attempt, since login never sends one.
  // Every write would otherwise keep silently failing with a confusing
  // "Invalid or expired token" toast until the user thinks to log out
  // manually. Clear it and send them back to log in again immediately.
  if (res.status === 401 && token) {
    window.localStorage.removeItem("nvfresh_admin_token");
    window.localStorage.removeItem("nvfresh_admin_username");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  login: (username, password) =>
    request(`/auth/login`, { method: "POST", body: JSON.stringify({ username, password }) }),

  getStats: () => request(`/dashboard/stats`),

  getProducts: () => request(`/products`),
  createProduct: (data) => request(`/products`, { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) =>
    request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),

  getOrders: () => request(`/orders`),
  updateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  getCustomers: (search) =>
    request(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  getSettings: () => request(`/settings`),
  updateSettings: (data) => request(`/settings`, { method: "PUT", body: JSON.stringify(data) }),

  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return request(`/upload`, { method: "POST", body: formData });
  },
};

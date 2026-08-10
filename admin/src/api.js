// api.js — fetch wrapper for the admin app, attaches JWT automatically
//
// In local dev, Vite proxies "/api" to the server on :5000 (see vite.config.js).
// In production (e.g. Vercel), there's no server behind the static build, so
// set VITE_API_URL to your deployed backend's URL, e.g.:
//   VITE_API_URL=https://nvfresh-api.onrender.com/api
const BASE = import.meta.env.VITE_API_URL || "/api";

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

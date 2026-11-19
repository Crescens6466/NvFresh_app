// api.js — fetch wrapper for the admin app
//
// In local dev, Vite proxies "/api" to the server on :5000 (see vite.config.js).
// In production (e.g. Vercel), there's no server behind the static build, so
// set VITE_API_URL to your deployed backend's URL, e.g.:
//   VITE_API_URL=https://nvfresh-api.onrender.com/api
const BASE = import.meta.env.VITE_API_URL || "/api";
const API_ORIGIN = BASE.startsWith("http") ? BASE.replace(/\/api\/?$/, "") : "";

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
  registerFcmToken: (token) =>
    request(`/admin-notifications/fcm-token`, { method: "POST", body: JSON.stringify({ token }) }),
  removeFcmToken: (token) =>
    request(`/admin-notifications/fcm-token`, { method: "DELETE", body: JSON.stringify({ token }) }),
  getNotifications: () => request(`/admin-notifications`),
  getUnreadNotificationCount: () => request(`/admin-notifications/unread-count`),
  markNotificationRead: (id) => request(`/admin-notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: () => request(`/admin-notifications/read-all`, { method: "PUT" }),

  getStats: () => request(`/dashboard/stats`),

  getProducts: () => request(`/products`),
  createProduct: (data) => request(`/products`, { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) =>
    request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),

  getCategories: () => request(`/categories`),
  getAdminCategories: () => request(`/categories/admin`),
  createCategory: (data) =>
    request(`/categories`, { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id, data) =>
    request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id, replacementCategory) =>
    request(`/categories/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ replacementCategory }),
    }),

  getOrders: () => request(`/orders`),
  updateOrderStatus: (id, status, reason) =>
    request(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status, reason }) }),
  updatePaymentStatus: (id, status) =>
    request(`/orders/${id}/payment-status`, { method: "PUT", body: JSON.stringify({ status }) }),

  getCustomers: (search) =>
    request(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  getSettings: () => request(`/settings`),
  updateSettings: (data) => request(`/settings`, { method: "PUT", body: JSON.stringify(data) }),
  getDeliveryAreas: () => request(`/delivery-areas/admin`),
  createDeliveryArea: (data) =>
    request(`/delivery-areas`, { method: "POST", body: JSON.stringify(data) }),
  updateDeliveryArea: (id, data) =>
    request(`/delivery-areas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDeliveryArea: (id) => request(`/delivery-areas/${id}`, { method: "DELETE" }),

  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return request(`/upload`, { method: "POST", body: formData });
  },
};

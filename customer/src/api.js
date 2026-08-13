// api.js — small fetch wrapper for the customer app
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

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  getSettings: () => request(`/settings`),
  placeOrder: (order, token) =>
    request(`/orders`, {
      method: "POST",
      body: JSON.stringify(order),
      headers: authHeaders(token),
    }),
  // items: [{ productId, weight, quantity }] — price/total are never sent;
  // the backend recomputes everything from the database and returns the
  // authoritative totals plus a QR for the selected advance amount.
  getOrderQuote: (items, advancePercentage, token) =>
    request(`/orders/quote`, {
      method: "POST",
      body: JSON.stringify({ items, advancePercentage }),
      headers: authHeaders(token),
    }),
  getMyOrders: (token) => request(`/orders/mine`, { headers: authHeaders(token) }),
  sendPhoneOtp: (phone) =>
    request(`/customer-auth/send-otp`, { method: "POST", body: JSON.stringify({ phone }) }),
  verifyPhoneOtp: (phone, code) =>
    request(`/customer-auth/verify-otp`, { method: "POST", body: JSON.stringify({ phone, code }) }),
};

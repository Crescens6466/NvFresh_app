// api.js — small fetch wrapper for the customer app
//
// In local dev, Vite proxies "/api" to the server on :5000 (see vite.config.js).
// In production (e.g. Vercel), there's no server behind the static build, so
// set VITE_API_URL to your deployed backend's URL, e.g.:
//   VITE_API_URL=https://nvfresh-api.onrender.com/api
const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  getSettings: () => request(`/settings`),
  placeOrder: (order) =>
    request(`/orders`, { method: "POST", body: JSON.stringify(order) }),
};

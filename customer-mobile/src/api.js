// api.js — fetch wrapper for the customer mobile app, ported from
// customer/src/api.js. Talks to the exact same backend (server/) over the
// exact same /api/* routes — no backend changes required.
//
// Unlike the Vite web app (which proxies "/api" to localhost in dev), a
// native app has no same-origin dev server to proxy through, so
// EXPO_PUBLIC_API_URL must always be an absolute URL — either the deployed
// backend, or your machine's LAN IP (e.g. http://192.168.1.20:5000/api) when
// testing against a local server/ instance from a device or emulator.
const DEFAULT_API_URL = "https://nv-fresh-app-x1mc.vercel.app/api";
const BASE = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
const API_ORIGIN = BASE.replace(/\/api\/?$/, "");

// Product/QR images come back as paths relative to the backend (e.g.
// "/api/files/xxx"). There's no same-origin proxy on native, so these always
// need to be resolved to an absolute URL against the backend's own origin.
export function resolveImageUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//.test(path) || /^data:/.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    return res.json();
  } catch (err) {
    if (__DEV__) {
      console.warn(`[api] Request error for ${url}:`, err.message || err);
    }
    throw err;
  }
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  getProducts: (params = {}) => {
    const cleanParams = {};
    if (params.category && params.category !== "All") {
      cleanParams.category = params.category;
    }
    if (params.search && typeof params.search === "string" && params.search.trim()) {
      cleanParams.search = params.search.trim();
    }
    const qs = new URLSearchParams(cleanParams).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  getSettings: () => request(`/settings`),
  getDeliveryAreas: () => request(`/delivery-areas`),
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
  cancelOrder: (id, reason, token) =>
    request(`/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      headers: authHeaders(token),
    }),
  sendPhoneOtp: (phone) =>
    request(`/customer-auth/send-otp`, { method: "POST", body: JSON.stringify({ phone }) }),
  verifyPhoneOtp: (phone, code) =>
    request(`/customer-auth/verify-otp`, { method: "POST", body: JSON.stringify({ phone, code }) }),
  exchangeMsg91AccessToken: (accessToken) =>
    request(`/customer-auth/msg91-exchange`, {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    }),
  getCustomerNotifications: (token) => request(`/customer-notifications`, { headers: authHeaders(token) }),
  getCustomerNotificationUnreadCount: (token) => request(`/customer-notifications/unread-count`, { headers: authHeaders(token) }),
  markCustomerNotificationRead: (id, token) => request(`/customer-notifications/${encodeURIComponent(id)}/read`, { method: "PUT", headers: authHeaders(token) }),
  markAllCustomerNotificationsRead: (token) => request(`/customer-notifications/read-all`, { method: "PUT", headers: authHeaders(token) }),
  registerCustomerDeviceToken: (token, bearerToken) => request(`/customer-notifications/device-token`, {
    method: "POST",
    body: JSON.stringify({ token, platform: "android" }),
    headers: authHeaders(bearerToken),
  }),
  deleteCustomerDeviceToken: (token, bearerToken) => request(`/customer-notifications/device-token`, {
    method: "DELETE",
    body: JSON.stringify({ token }),
    headers: authHeaders(bearerToken),
  }),
};

import { io } from "socket.io-client";
import { api } from "./api.js";

let socket;

function getSocketUrl() {
  const configuredApi = import.meta.env.VITE_API_URL;
  if (configuredApi?.startsWith("http")) {
    return configuredApi.replace(/\/api\/?$/, "");
  }
  return window.location.origin;
}

export function connectNotificationSocket() {
  if (socket) return socket;

  socket = io(getSocketUrl(), {
    auth: { token: window.localStorage.getItem("nvfresh_admin_token") },
    path: "/api/index/socket.io",
    transports: ["websocket"],
  });

  socket.on("new_admin_notification", (notification) => {
    window.dispatchEvent(
      new CustomEvent("admin-notifications-received", { detail: notification })
    );
  });
  socket.on("connect", () => {
    window.dispatchEvent(new Event("admin-notifications-updated"));
  });
  socket.on("connect_error", (error) => {
    console.warn("[admin-notifications] Real-time connection unavailable:", error.message);
  });

  return socket;
}

export function disconnectNotificationSocket() {
  socket?.disconnect();
  socket = undefined;
}

export async function refreshNotificationState() {
  const { count } = await api.getUnreadNotificationCount();
  window.dispatchEvent(
    new CustomEvent("admin-notifications-count", { detail: { count } })
  );
}

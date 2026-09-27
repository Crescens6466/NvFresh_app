import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useCustomerAuth } from "./CustomerAuthContext.jsx";
import {
  getCustomerPushToken,
  subscribeToCustomerMessages,
} from "../customerPush.js";

const CustomerNotificationContext = createContext(null);

function getPermission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export function CustomerNotificationProvider({ children }) {
  const { isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState(getPermission);
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [deviceRegistrationLoading, setDeviceRegistrationLoading] = useState(false);
  const [deviceRegistrationError, setDeviceRegistrationError] = useState("");
  const lastAuthToken = useRef(null);
  const registeredDevice = useRef(null);

  async function loadNotifications(token, active = () => true) {
    const bearer = token || (await getIdToken());
    if (!bearer) return;
    const [items, countResult] = await Promise.all([
      api.getCustomerNotifications(bearer),
      api.getCustomerNotificationUnreadCount(bearer),
    ]);
    if (!active()) return;
    setNotifications(Array.isArray(items) ? items : []);
    setUnreadCount(Number(countResult?.count) || 0);
  }

  async function registerDevice(bearer, active = () => true) {
    if (registeredDevice.current?.bearer === bearer) {
      setDeviceRegistered(true);
      return true;
    }
    setDeviceRegistrationLoading(true);
    setDeviceRegistrationError("");
    try {
      const deviceToken = await getCustomerPushToken();
      if (!active()) return false;
      await api.registerCustomerDeviceToken(deviceToken, bearer);
      if (!active()) {
        await api.removeCustomerDeviceToken(deviceToken, bearer).catch(() => {});
        return false;
      }
      registeredDevice.current = { token: deviceToken, bearer };
      setDeviceRegistered(true);
      return true;
    } catch (registrationError) {
      setDeviceRegistrationError(
        registrationError.message || "Could not register this device for notifications."
      );
      console.warn("Customer web push registration failed:", registrationError.message);
      return false;
    } finally {
      setDeviceRegistrationLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return undefined;

    if (!isLoggedIn) {
      setNotifications([]);
      setUnreadCount(0);
      setError("");
      setLoading(false);
      setDeviceRegistered(false);
      setDeviceRegistrationLoading(false);
      setDeviceRegistrationError("");
      const registered = registeredDevice.current;
      registeredDevice.current = null;
      const bearer = registered?.bearer || lastAuthToken.current;
      lastAuthToken.current = null;
      if (registered && bearer) {
        api.removeCustomerDeviceToken(registered.token, bearer).catch((removeError) => {
          console.warn("Could not remove customer web push token:", removeError.message);
        });
      }
      return undefined;
    }

    let active = true;
    const refreshOnFocus = () => {
      loadNotifications(undefined, () => active).catch((loadError) => {
        if (active) setError(loadError.message || "Could not refresh notifications.");
      });
    };
    const refreshInterval = window.setInterval(refreshOnFocus, 60000);
    window.addEventListener("focus", refreshOnFocus);
    setLoading(true);
    setError("");
    (async () => {
      try {
        const bearer = await getIdToken();
        if (!bearer || !active) return;
        lastAuthToken.current = bearer;
        await loadNotifications(bearer, () => active);
        if (!active) return;
        setError("");
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load notifications.");
      } finally {
        if (active) setLoading(false);
      }

      if (active && getPermission() === "granted") {
        const bearer = lastAuthToken.current;
        if (bearer) await registerDevice(bearer, () => active);
      }
    })();

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [authLoading, isLoggedIn]);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return undefined;
    let active = true;
    let unsubscribe;
    subscribeToCustomerMessages((payload) => {
      if (!active) return;
      loadNotifications(undefined, () => active).catch((loadError) => {
        if (active) setError(loadError.message || "Could not refresh notifications.");
      });

      const title = payload.notification?.title || payload.data?.title || "NvFresh";
      const message = payload.notification?.body || payload.data?.message || "";
      if (getPermission() === "granted") {
        try {
          const notification = new Notification(title, {
            body: message,
            tag: payload.data?.notificationId
              ? `customer-notification-${payload.data.notificationId}`
              : undefined,
          });
          notification.onclick = () => {
            notification.close();
            const orderId = payload.data?.orderId;
            navigate(
              orderId
                ? `/orders?orderId=${encodeURIComponent(orderId)}`
                : "/notifications"
            );
          };
        } catch (displayError) {
          console.warn("Could not display customer notification:", displayError.message);
        }
      }
    })
      .then((stop) => {
        unsubscribe = stop;
        if (!active) unsubscribe?.();
      })
      .catch((listenError) => {
        console.warn("Could not listen for customer notifications:", listenError.message);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [authLoading, isLoggedIn]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      throw new Error("This browser does not support web notifications.");
    }

    let nextPermission = Notification.permission;
    if (nextPermission === "default") {
      nextPermission = await Notification.requestPermission();
    }
    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      throw new Error(
        nextPermission === "denied"
          ? "Notifications are blocked. Allow them in your browser settings to enable alerts."
          : "Notification permission was not granted."
      );
    }

    if (!isLoggedIn) return true;

    const bearer = await getIdToken();
    if (!bearer) throw new Error("Your session has expired. Please sign in again.");
    const deviceToken = await getCustomerPushToken();
    await api.registerCustomerDeviceToken(deviceToken, bearer);
    registeredDevice.current = { token: deviceToken, bearer };
    lastAuthToken.current = bearer;
    setDeviceRegistered(true);
    setDeviceRegistrationError("");
    return true;
  }

  async function markRead(id) {
    const bearer = await getIdToken();
    if (!bearer) return;
    await api.markCustomerNotificationRead(id, bearer);
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((current) =>
      Math.max(0, current - (notifications.find((item) => item.id === id && !item.isRead) ? 1 : 0))
    );
  }

  async function markAllRead() {
    const bearer = await getIdToken();
    if (!bearer) return;
    await api.markAllCustomerNotificationsRead(bearer);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  }

  function openNotification(item) {
    if (!item.isRead) markRead(item.id).catch((markError) => {
      setError(markError.message || "Could not mark notification as read.");
    });
    if (item.orderId) {
      navigate(`/orders?orderId=${encodeURIComponent(item.orderId)}`);
    }
  }

  return (
    <CustomerNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        permission,
        isLoggedIn,
        deviceRegistered,
        deviceRegistrationLoading,
        deviceRegistrationError,
        enableNotifications,
        markRead,
        markAllRead,
        openNotification,
        refreshNotifications: () =>
          loadNotifications().catch((loadError) => {
            setError(loadError.message || "Could not refresh notifications.");
          }),
      }}
    >
      {children}
    </CustomerNotificationContext.Provider>
  );
}

export function useCustomerNotifications() {
  const context = useContext(CustomerNotificationContext);
  if (!context) {
    throw new Error(
      "useCustomerNotifications must be used within CustomerNotificationProvider"
    );
  }
  return context;
}

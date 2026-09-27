import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../api.js";
import { useCustomerAuth } from "./CustomerAuthContext.jsx";
import { ensureAndroidNotificationChannel, registerAndroidDeviceToken } from "../services/customerNotifications.js";
import { openOrderHistoryFromNotification } from "../navigation/notificationNavigation.js";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const CustomerNotificationsContext = createContext(null);

function responseKey(response) {
  return `${response?.notification?.request?.identifier || ""}:${response?.actionIdentifier || ""}`;
}

function responseData(response) {
  const content = response?.notification?.request?.content;
  return content?.data || {};
}

export function CustomerNotificationsProvider({ children }) {
  const { isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const pendingResponse = useRef(null);
  const seenResponses = useRef(new Set());

  const refreshUnreadCount = useCallback(async () => {
    if (authLoading || !isLoggedIn) {
      setUnreadCount(0);
      return 0;
    }
    try {
      const token = await getIdToken();
      if (!token) return 0;
      const result = await api.getCustomerNotificationUnreadCount(token);
      const count = Number(result?.count) || 0;
      setUnreadCount(count);
      return count;
    } catch {
      return 0;
    }
  }, [authLoading, getIdToken, isLoggedIn]);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    refreshUnreadCount();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshUnreadCount();
    });
    return () => appStateSubscription.remove();
  }, [authLoading, isLoggedIn, refreshUnreadCount]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    ensureAndroidNotificationChannel().catch(() => {});
    let active = true;
    const subscription = Notifications.addPushTokenListener(async (pushToken) => {
      if (!active || authLoading || !isLoggedIn || !pushToken?.data) return;
      try {
        const bearerToken = await getIdToken();
        if (active && bearerToken) await registerAndroidDeviceToken(pushToken.data, bearerToken);
      } catch {
        // Token refresh will be retried on the next permission/session refresh.
      }
    });

    if (!authLoading && isLoggedIn) {
      (async () => {
        try {
          const permission = await Notifications.getPermissionsAsync();
          if (!active || !permission.granted) return;
          await ensureAndroidNotificationChannel();
          const nativeToken = await Notifications.getDevicePushTokenAsync();
          const bearerToken = await getIdToken();
          if (active && bearerToken && nativeToken?.data) {
            await registerAndroidDeviceToken(nativeToken.data, bearerToken);
          }
        } catch {
          // Registration is best-effort and never interrupts app startup.
        }
      })();
    }

    return () => {
      active = false;
      subscription.remove();
    };
  }, [authLoading, getIdToken, isLoggedIn]);

  const requestNotificationPermission = useCallback(async () => {
    if (Platform.OS !== "android") return false;
    if (authLoading || !isLoggedIn) throw new Error("Sign in to enable notifications.");
    await ensureAndroidNotificationChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;
    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const bearerToken = await getIdToken();
    if (!bearerToken) throw new Error("Your session has expired. Please sign in again.");
    if (!nativeToken?.data) throw new Error("Could not retrieve the Android device token.");
    await registerAndroidDeviceToken(nativeToken.data, bearerToken);
    return true;
  }, [authLoading, getIdToken, isLoggedIn]);

  const processPendingResponse = useCallback(async () => {
    if (authLoading || !isLoggedIn || !pendingResponse.current) return;
    const response = pendingResponse.current;
    const data = responseData(response);
    try {
      const token = await getIdToken();
      if (!token) return;
      const notificationId = data.notificationId ?? data.id;
      if (notificationId != null) await api.markCustomerNotificationRead(notificationId, token);
      await refreshUnreadCount();
      pendingResponse.current = null;
    } catch {
      pendingResponse.current = null;
    }
  }, [authLoading, getIdToken, isLoggedIn, refreshUnreadCount]);

  const handleNotificationResponse = useCallback((response) => {
    const key = responseKey(response);
    if (seenResponses.current.has(key)) return;
    seenResponses.current.add(key);
    pendingResponse.current = response;
    const data = responseData(response);
    openOrderHistoryFromNotification(data.orderId ?? data.order_id);
    processPendingResponse();
  }, [processPendingResponse]);

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      refreshUnreadCount();
    });
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleNotificationResponse(response);
      })
      .catch(() => {});
    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [handleNotificationResponse, refreshUnreadCount]);

  useEffect(() => {
    processPendingResponse();
  }, [authLoading, isLoggedIn, processPendingResponse]);

  const value = useMemo(() => ({
    unreadCount,
    refreshUnreadCount,
    requestNotificationPermission,
  }), [refreshUnreadCount, requestNotificationPermission, unreadCount]);

  return (
    <CustomerNotificationsContext.Provider value={value}>
      {children}
    </CustomerNotificationsContext.Provider>
  );
}

export function useCustomerNotifications() {
  const context = useContext(CustomerNotificationsContext);
  if (!context) throw new Error("useCustomerNotifications must be used within CustomerNotificationsProvider");
  return context;
}

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../api.js";

let registeredDeviceToken = null;

export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "General notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#C62828",
  });
}

export async function registerAndroidDeviceToken(deviceToken, bearerToken) {
  if (Platform.OS !== "android" || !deviceToken || !bearerToken) return;
  if (registeredDeviceToken && registeredDeviceToken !== deviceToken) {
    try {
      await api.deleteCustomerDeviceToken(registeredDeviceToken, bearerToken);
    } catch {
      // Keep registration resilient if cleanup of an expired token fails.
    }
  }
  await api.registerCustomerDeviceToken(deviceToken, bearerToken);
  registeredDeviceToken = deviceToken;
}

export async function unregisterCurrentAndroidDeviceToken(bearerToken) {
  if (Platform.OS !== "android" || !bearerToken) return;
  let deviceToken = registeredDeviceToken;
  if (!deviceToken) {
    const result = await Notifications.getDevicePushTokenAsync();
    deviceToken = result?.data;
  }
  if (!deviceToken) return;
  await api.deleteCustomerDeviceToken(deviceToken, bearerToken);
  if (registeredDeviceToken === deviceToken) registeredDeviceToken = null;
}

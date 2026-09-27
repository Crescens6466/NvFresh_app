import { getMessaging, isSupported, getToken, onMessage } from "firebase/messaging";
import { app, firebaseConfig } from "./firebase.js";

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const workerScript = "/customer-messaging-sw.js";
const firebaseConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

export const isCustomerPushConfigured = Boolean(app && vapidKey);

async function supportedMessaging() {
  if (!isCustomerPushConfigured || !(await isSupported())) return null;
  return getMessaging(app);
}

async function registerCustomerServiceWorker() {
  const params = new URLSearchParams();
  for (const key of firebaseConfigKeys) {
    if (firebaseConfig[key]) params.set(key, firebaseConfig[key]);
  }
  return navigator.serviceWorker.register(`${workerScript}?${params.toString()}`);
}

export async function getCustomerPushToken() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support web notifications.");
  }
  const messaging = await supportedMessaging();
  if (!messaging) {
    throw new Error("Web notifications are not available in this browser.");
  }

  const serviceWorkerRegistration = await registerCustomerServiceWorker();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });
  if (!token) throw new Error("Could not register this device for notifications.");
  return token;
}

export async function subscribeToCustomerMessages(onNotification) {
  const messaging = await supportedMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, onNotification);
}

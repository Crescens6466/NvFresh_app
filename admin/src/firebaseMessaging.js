import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { api } from "./api.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const isConfigured = Object.values(firebaseConfig).every(Boolean);

function getFirebaseApp() {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function getServiceWorkerUrl() {
  const params = new URLSearchParams(firebaseConfig);
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

async function getActiveServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register(getServiceWorkerUrl(), {
    scope: "/",
  });
  const readyRegistration = await navigator.serviceWorker.ready;

  if (!readyRegistration.active) {
    throw new Error("Firebase messaging service worker is not active");
  }

  console.info("[admin-notifications] Service worker ready");
  return readyRegistration;
}

export async function setupAdminNotifications() {
  if (!isConfigured || !("Notification" in window) || !("serviceWorker" in navigator) || !vapidKey) return () => {};
  if (!(await isSupported())) return () => {};

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return () => {};

  const registration = await getActiveServiceWorkerRegistration();
  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return () => {};

  console.info("[admin-notifications] FCM token obtained");
  await api.registerFcmToken(token);
  const unsubscribe = onMessage(messaging, (payload) => {
    window.dispatchEvent(new CustomEvent("admin-notifications-updated", {
      detail: { showAlert: true },
    }));
    const title = payload.data?.title || "New Order Received";
    const body = payload.data?.body || "A new order was received.";
    const notification = new Notification(title, { body, data: { url: "/orders" } });
    notification.onclick = () => {
      window.focus();
      window.location.href = payload.data?.url || "/orders";
    };
  });
  return unsubscribe;
}

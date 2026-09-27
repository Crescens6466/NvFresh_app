importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

const configParams = new URL(self.location.href).searchParams;
const firebaseConfig = Object.fromEntries(
  ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]
    .map((key) => [key, configParams.get(key)])
    .filter(([, value]) => value)
);

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = payload.notification?.title || data.title || "NvFresh";
  const orderId = data.orderId;
  const target = orderId
    ? `/orders?orderId=${encodeURIComponent(orderId)}`
    : "/notifications";

  return self.registration.showNotification(title, {
    body: payload.notification?.body || data.message || "",
    data: { target },
    tag: data.notificationId
      ? `customer-notification-${data.notificationId}`
      : undefined,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.target || "/notifications";
  const targetUrl = new URL(target, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        return existing.navigate(targetUrl).then((client) => client?.focus());
      }
      return clients.openWindow(targetUrl);
    })
  );
});

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

let messaging = null;
let adminAuth = null;

function getAdminApp() {
  const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } = process.env;
  if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
    return null;
  }

  return (
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId: FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    })
  );
}

export function getAdminMessaging() {
  if (messaging) return messaging;

  const app = getAdminApp();
  if (!app) {
    console.warn("[admin-notifications] Firebase Admin is not configured");
    return null;
  }

  messaging = getMessaging(app);
  return messaging;
}

export function getAdminAuth() {
  if (adminAuth) return adminAuth;

  const app = getAdminApp();
  if (!app) {
    console.warn("[firebase-admin] Firebase Admin Auth is not configured");
    return null;
  }

  adminAuth = getAuth(app);
  return adminAuth;
}

export async function sendAdminNewOrderNotification(order) {
  const firebaseMessaging = getAdminMessaging();
  if (!firebaseMessaging) return;

  const Admin = (await import("./models/Admin.js")).default;
  const admins = await Admin.find({ "fcm_tokens.0": { $exists: true } }).select("fcm_tokens");
  const tokenOwners = admins.flatMap((admin) =>
    admin.fcm_tokens.map((entry) => ({ adminId: admin._id, token: entry.token }))
  );
  const uniqueTokenOwners = [...new Map(tokenOwners.map((entry) => [entry.token, entry])).values()];
  if (uniqueTokenOwners.length === 0) {
    console.warn("[admin-notifications] No registered FCM tokens found");
    return;
  }

  const orderId = String(order.id);
  console.info(`[admin-notifications] Registered admin token count: ${uniqueTokenOwners.length}`);
  console.info(`[admin-notifications] Sending FCM notification to ${uniqueTokenOwners.length} device(s)`);
  const response = await firebaseMessaging.sendEachForMulticast({
    tokens: uniqueTokenOwners.map(({ token }) => token),
    notification: {
      title: "New Order Received",
      body: `Order #${orderId} • ₹${order.total}`,
    },
    data: {
      type: "new_order",
      orderId,
      title: "New Order Received",
      body: `Order #${orderId} • ₹${order.total}`,
      url: "/orders",
    },
  });
  console.info(
    `[admin-notifications] FCM notification sent successfully: ${response.successCount} succeeded, ${response.failureCount} failed`
  );
  const failureCodes = response.responses
    .map((result) => result.error?.code)
    .filter(Boolean);
  if (failureCodes.length > 0) {
    console.error(`[admin-notifications] FCM send failed: ${[...new Set(failureCodes)].join(", ")}`);
  }

  const invalidTokens = uniqueTokenOwners
    .filter((_, index) => {
      const errorCode = response.responses[index].error?.code;
      return errorCode === "messaging/registration-token-not-registered" || errorCode === "messaging/invalid-registration-token";
    })
    .map(({ token }) => token);

  if (invalidTokens.length > 0) {
    await Admin.updateMany({}, { $pull: { fcm_tokens: { token: { $in: invalidTokens } } } });
    console.warn(`[admin-notifications] Removed ${invalidTokens.length} invalid FCM token(s)`);
  }
}

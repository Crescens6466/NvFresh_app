import CustomerDeviceToken from "../models/CustomerDeviceToken.js";
import CustomerNotification from "../models/CustomerNotification.js";
import { getAdminMessaging } from "../firebaseAdmin.js";

const EVENT_DETAILS = {
  order_placed: (id) => ({
    title: "🛒 Order Placed",
    message: `Your NvFresh order #${id} has been placed successfully.`,
  }),
  payment_confirmed: (id) => ({
    title: "💳 Payment Confirmed",
    message: `Your payment for order #${id} has been confirmed.`,
  }),
  order_preparing: (id) => ({
    title: "👨‍🍳 Order Being Prepared",
    message: `Your NvFresh order #${id} is now being prepared.`,
  }),
  order_delivered: (id) => ({
    title: "🚚 Order Delivered",
    message: `Your NvFresh order #${id} has been delivered.`,
  }),
  order_cancelled: (id) => ({
    title: "❌ Order Cancelled",
    message: `Your NvFresh order #${id} has been cancelled.`,
  }),
};

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);
const CLAIM_LEASE_MS = 2 * 60 * 1000;

function createEventKey(orderId, type) {
  return `order:${orderId}:${type}`;
}

export function buildCustomerOrderNotification(type, orderId) {
  const buildDetails = EVENT_DETAILS[type];
  if (!buildDetails) return null;
  return buildDetails(String(orderId));
}

export function buildCustomerPushMessage(notification, webUrl = process.env.CUSTOMER_WEB_URL) {
  const orderId = String(notification.orderId);
  const route = `/orders?orderId=${encodeURIComponent(orderId)}`;
  const normalizedWebUrl = webUrl?.replace(/\/+$/, "");
  return {
    notification: { title: notification.title, body: notification.message },
    data: {
      notificationId: String(notification._id),
      type: notification.type,
      orderId,
      route,
    },
    ...(normalizedWebUrl
      ? { webpush: { fcmOptions: { link: `${normalizedWebUrl}${route}` } } }
      : {}),
  };
}

async function getOrCreateNotification({ recipientCustomer, orderId, type, eventKey }) {
  const details = buildCustomerOrderNotification(type, orderId);
  if (!details) return null;
  const { title, message } = details;
  try {
    return await CustomerNotification.findOneAndUpdate(
      { eventKey },
      {
        $setOnInsert: {
          recipientCustomer,
          eventKey,
          type,
          title,
          message,
          orderId,
          isRead: false,
          deliveryStatus: "pending",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    return CustomerNotification.findOne({ eventKey });
  }
}

async function sendNotification(notification) {
  const claim = await CustomerNotification.findOneAndUpdate(
    {
      _id: notification._id,
      $or: [
        { deliveryStatus: { $in: ["pending", "failed"] } },
        { deliveryStatus: "sending", lastAttemptAt: { $lt: new Date(Date.now() - CLAIM_LEASE_MS) } },
      ],
    },
    {
      $set: { deliveryStatus: "sending", lastAttemptAt: new Date() },
      $inc: { deliveryAttempts: 1 },
    },
    { new: true }
  );
  if (!claim) return;

  const messaging = getAdminMessaging();
  if (!messaging) {
    await CustomerNotification.updateOne(
      { _id: claim._id, deliveryStatus: "sending" },
      { $set: { deliveryStatus: "failed" } }
    );
    return;
  }

  const deviceTokens = await CustomerDeviceToken.find({
    customerUid: claim.recipientCustomer,
  }).select("token").lean();
  if (!deviceTokens.length) {
    await CustomerNotification.updateOne(
      { _id: claim._id, deliveryStatus: "sending" },
      { $set: { deliveryStatus: "no_tokens" } }
    );
    return;
  }

  const message = buildCustomerPushMessage(claim);

  let successCount = 0;
  const invalidTokens = [];
  for (let index = 0; index < deviceTokens.length; index += 500) {
    const batch = deviceTokens.slice(index, index + 500);
    const result = await messaging.sendEachForMulticast({
      ...message,
      tokens: batch.map(({ token }) => token),
    });
    successCount += result.successCount;
    result.responses.forEach((response, responseIndex) => {
      if (INVALID_TOKEN_CODES.has(response.error?.code)) {
        invalidTokens.push(batch[responseIndex].token);
      }
    });
  }

  if (invalidTokens.length) {
    await CustomerDeviceToken.deleteMany({ token: { $in: invalidTokens } });
  }

  await CustomerNotification.updateOne(
    { _id: claim._id, deliveryStatus: "sending" },
    { $set: { deliveryStatus: successCount ? "sent" : "failed" } }
  );
  if (!successCount) {
    console.error(`[customer-notifications] Push delivery failed for ${claim.type}`);
  }
}

export async function createAndSendCustomerOrderNotification({
  customerUid,
  orderId,
  type,
}) {
  if (!customerUid || !EVENT_DETAILS[type]) return;

  const eventKey = createEventKey(orderId, type);
  let notification;
  try {
    notification = await getOrCreateNotification({
      recipientCustomer: customerUid,
      orderId,
      type,
      eventKey,
    });
  } catch (err) {
    console.error("[customer-notifications] Could not persist notification:", err.message);
    return;
  }

  try {
    if (notification) await sendNotification(notification);
  } catch (err) {
    await CustomerNotification.updateOne(
      { _id: notification._id, deliveryStatus: "sending" },
      { $set: { deliveryStatus: "failed" } }
    ).catch((updateError) =>
      console.error("[customer-notifications] Could not record push failure:", updateError.message)
    );
    console.error("[customer-notifications] Could not send push notification:", err.message);
  }
}

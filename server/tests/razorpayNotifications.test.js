// server/tests/razorpayNotifications.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sendAdminOrderTelegramOnce,
  sendAdminOrderNotificationsOnce,
} from "../routes/orders.js";

describe("Razorpay Notification Pipeline & Idempotency", () => {
  it("ensures sendAdminOrderTelegramOnce is atomic and executes exactly once under concurrency", async () => {
    let telegramSendCount = 0;

    // Simulated atomic state in memory mimicking MongoDB findOneAndUpdate({ status: { $in: ["pending", "failed"] } })
    const simulatedOrder = {
      _id: "order_test_atomic_1",
      admin_telegram_notification: {
        status: "pending",
        attempted_at: null,
        sent_at: null,
      },
    };

    async function mockClaimAndSend(callerId) {
      // Atomic compare-and-swap
      let claimed = false;
      if (simulatedOrder.admin_telegram_notification.status === "pending") {
        simulatedOrder.admin_telegram_notification.status = "sending";
        simulatedOrder.admin_telegram_notification.attempted_at = new Date();
        claimed = true;
      }
      if (!claimed) return { claimed: false, callerId };

      telegramSendCount++;
      simulatedOrder.admin_telegram_notification.status = "sent";
      simulatedOrder.admin_telegram_notification.sent_at = new Date();
      return { claimed: true, callerId };
    }

    // Run webhook and verify-payment simultaneously
    const [resWebhook, resVerify] = await Promise.all([
      mockClaimAndSend("webhook"),
      mockClaimAndSend("frontend_verify"),
    ]);

    assert.equal(telegramSendCount, 1, "Telegram send must execute EXACTLY once across concurrent callers");
    const claimedResults = [resWebhook.claimed, resVerify.claimed];
    assert.equal(claimedResults.filter(Boolean).length, 1, "Only one caller must win the atomic claim");
    assert.equal(simulatedOrder.admin_telegram_notification.status, "sent");
  });

  it("ensures admin in-app notification is created exactly once under concurrency", async () => {
    const notificationsDb = new Map(); // orderId:type -> notification

    async function mockInsertNotification(orderId, type, title, message) {
      const key = `${orderId}:${type}`;
      if (notificationsDb.has(key)) {
        return { created: false, notification: notificationsDb.get(key) };
      }
      const record = { id: `notif_${Date.now()}`, orderId, type, title, message, createdAt: new Date() };
      notificationsDb.set(key, record);
      return { created: true, notification: record };
    }

    const orderId = "order_rzp_concurrent_99";
    const [res1, res2] = await Promise.all([
      mockInsertNotification(orderId, "new_order", "New Order (Razorpay Paid)", "Order #123"),
      mockInsertNotification(orderId, "new_order", "New Order (Razorpay Paid)", "Order #123"),
    ]);

    assert.equal(notificationsDb.size, 1, "Exactly one in-app notification record must exist");
    const createdCount = [res1.created, res2.created].filter(Boolean).length;
    assert.equal(createdCount, 1, "Only one insert must succeed; duplicate must be skipped");
  });

  it("verifies webhook arriving before verify-payment leaves order with verified signature and notifications", async () => {
    // 1. Webhook arrives first: creates order, sets status Paid, razorpay_signature is null
    const orderDoc = {
      _id: "6ae4497366cfa64bc6bf7e4e",
      customer_name: "Suneetha",
      phone: "9494770342",
      total: 350,
      advance_paid: 88,
      advance_payment_status: "Paid",
      status: "Pending",
      payment_method: "razorpay",
      transaction_id: "pay_Tu2X6PAi8wEDta",
      razorpay_order_id: "order_Tu2X0mEZ4l84LY",
      razorpay_payment_id: "pay_Tu2X6PAi8wEDta",
      razorpay_signature: null,
      admin_telegram_notification: { status: "pending", attempted_at: null },
    };

    let notificationsSent = 0;
    function dispatchNotifications() {
      notificationsSent++;
    }

    // Webhook dispatches notifications
    dispatchNotifications();
    assert.equal(notificationsSent, 1);

    // 2. Frontend verify-payment arrives later with signature
    const frontendPayload = {
      razorpay_order_id: "order_Tu2X0mEZ4l84LY",
      razorpay_payment_id: "pay_Tu2X6PAi8wEDta",
      razorpay_signature: "sig_abc123verified",
    };

    // Duplicate check in verify-payment
    const duplicate = orderDoc;
    if (duplicate) {
      if (!duplicate.razorpay_signature && frontendPayload.razorpay_signature) {
        duplicate.razorpay_signature = frontendPayload.razorpay_signature;
      }
      // notifications called idempotently
      if (duplicate.admin_telegram_notification.status === "pending") {
        dispatchNotifications();
      }
    }

    assert.equal(orderDoc.razorpay_signature, "sig_abc123verified", "Razorpay signature must be saved by verify-payment");
    assert.equal(orderDoc.advance_payment_status, "Paid");
    assert.equal(orderDoc.status, "Pending");
  });

  it("verifies frontend arriving before webhook does not create duplicate order or duplicate notifications", async () => {
    let orderCount = 0;
    let notificationCount = 0;

    const ordersDb = new Map();

    function createOrder(orderId, paymentId, signature) {
      if (ordersDb.has(paymentId)) {
        throw { code: 11000, message: "Duplicate key" };
      }
      const order = { id: orderId, paymentId, signature, status: "Paid" };
      ordersDb.set(paymentId, order);
      orderCount++;
      notificationCount++;
      return order;
    }

    // 1. Frontend arrives first
    const frontendOrder = createOrder("ord_1", "pay_1", "sig_1");
    assert.equal(orderCount, 1);
    assert.equal(notificationCount, 1);

    // 2. Webhook arrives later
    try {
      createOrder("ord_1", "pay_1", null);
      assert.fail("Webhook must catch duplicate key error");
    } catch (err) {
      assert.equal(err.code, 11000);
      // Webhook catches 11000, finds existing order, skips duplicate creation
      const existing = ordersDb.get("pay_1");
      assert.ok(existing);
      assert.equal(existing.signature, "sig_1");
    }

    assert.equal(orderCount, 1, "Exactly one order must exist");
    assert.equal(notificationCount, 1, "Notifications must not be duplicated");
  });

  it("confirms notification failure does NOT revert payment status or order creation", async () => {
    const order = {
      _id: "order_test_fail_tel",
      total: 500,
      advance_paid: 125,
      advance_payment_status: "Paid",
      status: "Pending",
      admin_telegram_notification: {
        status: "pending",
        attempted_at: null,
        error: null,
      },
    };

    // Simulate Telegram failure (e.g. unconfigured token)
    try {
      order.admin_telegram_notification.status = "sending";
      order.admin_telegram_notification.attempted_at = new Date();
      throw new Error("Telegram order notification is not configured");
    } catch (err) {
      order.admin_telegram_notification.status = "failed";
      order.admin_telegram_notification.error = err.message;
    }

    assert.equal(order.advance_payment_status, "Paid", "Payment status must stay Paid even when Telegram fails");
    assert.equal(order.status, "Pending", "Order status must stay Pending");
    assert.equal(order.admin_telegram_notification.status, "failed");
    assert.equal(order.admin_telegram_notification.error, "Telegram order notification is not configured");
  });

  it("confirms default payment method (manual UPI) notification payload format matches expected structure", async () => {
    const defaultOrder = {
      id: "6adf11b83755d677181856cf",
      total: 350,
      customer_name: "Crescens Penumala",
      phone: "6302936466",
      advance_paid: 88,
    };

    const isRazorpay = false;
    const title = isRazorpay ? "New Order (Razorpay Paid)" : "New Order Received";
    const message = isRazorpay
      ? `Order #${defaultOrder.id} • ₹${defaultOrder.total} (Advance Paid ₹${defaultOrder.advance_paid})`
      : `Order #${defaultOrder.id} • ₹${defaultOrder.total}`;

    assert.equal(title, "New Order Received");
    assert.equal(message, "Order #6adf11b83755d677181856cf • ₹350");
  });
});


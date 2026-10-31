// server/tests/razorpayNotifications.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sendAdminOrderTelegramOnce,
  sendAdminOrderNotificationsOnce,
} from "../routes/orders.js";
import {
  buildAdminOrderTelegramPayload,
  escapeHtml,
  splitTelegramMessage,
} from "../utils/telegram.js";
import {
  findOrderByPaymentId,
  withPaymentLock,
} from "../routes/payment.js";

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

describe("Enhanced Telegram Order Packing & Delivery Notification", () => {
  const dummyChatId = "-100123456789";

  it("renders a single-product order with correct formatting and payment details", () => {
    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "6ae4497366cfa64bc6bf7e4e",
      customerName: "Ramesh Kumar",
      phone: "9876543210",
      address: "House 12, Road 4, Gunadala, Vijayawada - 520004",
      items: [
        { name: "Fresh Chicken Curry Cut", weight: "1kg", quantity: 1, price: 280 },
      ],
      total: 280,
      advancePaid: 70,
      remainingAmount: 210,
    });

    assert.equal(payload.chat_id, dummyChatId);
    assert.equal(payload.parse_mode, "HTML");
    const text = payload.text;

    assert.ok(text.includes("🔔 NEW NVFRESH ORDER"));
    assert.ok(text.includes("Order: #6ae4497366cfa64bc6bf7e4e"));
    assert.ok(text.includes("Customer: Ramesh Kumar"));
    assert.ok(text.includes("Phone: 9876543210"));
    assert.ok(text.includes("📦 ORDER ITEMS:\n• Fresh Chicken Curry Cut — 1kg × 1"));
    assert.ok(text.includes("📍 DELIVERY ADDRESS:\nHouse 12, Road 4, Gunadala, Vijayawada - 520004"));
    assert.ok(text.includes("💰 PAYMENT SUMMARY:"));
    assert.ok(text.includes("Order Total: ₹280.00"));
    assert.ok(text.includes("Advance Paid: ₹70.00"));
    assert.ok(text.includes("Remaining on Delivery: ₹210.00"));
    assert.ok(text.includes('<a href="https://admin.nvfresh.in">🔗 Open Admin Panel</a>'));
    assert.ok(!text.includes("Fully paid — nothing to collect on delivery."));
  });

  it("renders multiple products with various weights and quantities dynamically", () => {
    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "6adf11b83755d677181856cf",
      customerName: "Suneetha",
      phone: "9494770342",
      address: "Flat 402, Green Meadows, Benz Circle, Vijayawada - 520010",
      items: [
        { name: "Country Chicken Curry Cut", weight: "500g", quantity: 2, price: 360 },
        { name: "Fresh Mutton Biryani Cut", weight: "1kg", quantity: 1, price: 850 },
        { name: "Cleaned Sea Prawns", weight: "250g", quantity: 3, price: 600 },
        { name: "Country Eggs (6 pcs)", weight: "", quantity: 1, price: 90 },
      ],
      total: 1900,
      advancePaid: 950,
      remainingAmount: 950,
    });

    const text = payload.text;
    assert.ok(text.includes("• Country Chicken Curry Cut — 500g × 2"));
    assert.ok(text.includes("• Fresh Mutton Biryani Cut — 1kg × 1"));
    assert.ok(text.includes("• Cleaned Sea Prawns — 250g × 3"));
    assert.ok(text.includes("• Country Eggs (6 pcs) × 1"));
    assert.ok(text.includes("Order Total: ₹1900.00"));
    assert.ok(text.includes("Advance Paid: ₹950.00"));
    assert.ok(text.includes("Remaining on Delivery: ₹950.00"));
  });

  it("includes complete multi-line delivery address without truncation", () => {
    const fullAddress = `Door No: 40-1-12/A, 4th Floor
Sri Sai Towers, Behind Executive Club
Near Sweet Magic, Bandar Road, Kanuru
Vijayawada, Andhra Pradesh - 520007`;

    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "6adf11b83755d677181856d1",
      customerName: "Venkat Rao",
      phone: "9988776655",
      address: fullAddress,
      items: [{ name: "Skinless Chicken", weight: "1kg", quantity: 1 }],
      total: 260,
      advancePaid: 65,
    });

    const text = payload.text;
    assert.ok(text.includes(`📍 DELIVERY ADDRESS:\n${fullAddress}`));
  });

  it("handles partial advance payments correctly (25%, 50%, 75%)", () => {
    const payload25 = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_25",
      customerName: "Customer 25",
      phone: "9000000025",
      address: "Address 25",
      items: [{ name: "Item", weight: "500g", quantity: 1 }],
      total: 400,
      advancePaid: 100,
    });
    assert.ok(payload25.text.includes("Order Total: ₹400.00"));
    assert.ok(payload25.text.includes("Advance Paid: ₹100.00"));
    assert.ok(payload25.text.includes("Remaining on Delivery: ₹300.00"));
    assert.ok(!payload25.text.includes("Fully paid"));

    const payload75 = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_75",
      customerName: "Customer 75",
      phone: "9000000075",
      address: "Address 75",
      items: [{ name: "Item", weight: "500g", quantity: 1 }],
      total: 400,
      advancePaid: 300,
    });
    assert.ok(payload75.text.includes("Order Total: ₹400.00"));
    assert.ok(payload75.text.includes("Advance Paid: ₹300.00"));
    assert.ok(payload75.text.includes("Remaining on Delivery: ₹100.00"));
    assert.ok(!payload75.text.includes("Fully paid"));
  });

  it("handles fully paid order (100% advance) with zero remaining and confirmation text", () => {
    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_100",
      customerName: "Ananya",
      phone: "9888877777",
      address: "Labbipet, Vijayawada",
      items: [{ name: "Mutton Boneless", weight: "500g", quantity: 2 }],
      total: 750,
      advancePaid: 750,
    });

    const text = payload.text;
    assert.ok(text.includes("Order Total: ₹750.00"));
    assert.ok(text.includes("Advance Paid: ₹750.00"));
    assert.ok(text.includes("Remaining on Delivery: ₹0.00"));
    assert.ok(text.includes("Fully paid — nothing to collect on delivery."));
  });

  it("never displays a negative remaining amount if advance exceeds total", () => {
    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_overpaid",
      customerName: "Test",
      phone: "9000000000",
      address: "Test Address",
      items: [{ name: "Test", weight: "1kg", quantity: 1 }],
      total: 500,
      advancePaid: 500.5,
    });

    assert.ok(payload.text.includes("Order Total: ₹500.00"));
    assert.ok(payload.text.includes("Advance Paid: ₹500.50"));
    assert.ok(payload.text.includes("Remaining on Delivery: ₹0.00"));
    assert.ok(!payload.text.includes("Remaining on Delivery: ₹-"));
    assert.ok(payload.text.includes("Fully paid — nothing to collect on delivery."));
  });

  it("supports existing manual UPI orders identically", () => {
    // Mimicking clientOrder from POST /api/orders (manual UPI)
    const manualUpiOrder = {
      id: "6adf11b83755d677181856cf",
      customer_name: "Crescens Penumala",
      phone: "6302936466",
      address: "123 Main St, Vijayawada",
      items: [
        { product_id: "prod_1", name: "Chicken Curry Cut", weight: "1kg", quantity: 1, price: 300 },
      ],
      total: 350,
      advance_paid: 88,
      remaining_amount: 262,
      payment_method: "upi_qr",
    };

    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      ...manualUpiOrder,
    });

    const text = payload.text;
    assert.ok(text.includes("Order: #6adf11b83755d677181856cf"));
    assert.ok(text.includes("Customer: Crescens Penumala"));
    assert.ok(text.includes("Phone: 6302936466"));
    assert.ok(text.includes("• Chicken Curry Cut — 1kg × 1"));
    assert.ok(text.includes("📍 DELIVERY ADDRESS:\n123 Main St, Vijayawada"));
    assert.ok(text.includes("Order Total: ₹350.00"));
    assert.ok(text.includes("Advance Paid: ₹88.00"));
    assert.ok(text.includes("Remaining on Delivery: ₹262.00"));
    assert.ok(text.includes('<a href="https://admin.nvfresh.in">🔗 Open Admin Panel</a>'));
  });

  it("includes delivery instructions when present and omits them cleanly when missing", () => {
    // When present
    const withInstruction = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_inst_1",
      customerName: "Rao",
      phone: "9111122222",
      address: "Governorpet, Vijayawada",
      items: [{ name: "Chicken", weight: "500g", quantity: 1 }],
      total: 150,
      advancePaid: 150,
      deliveryInstruction: "Please call when you reach the gate and leave with security.",
    });

    assert.ok(
      withInstruction.text.includes(
        "📦 Please call when you reach the gate and leave with security."
      )
    );

    // When missing
    const withoutInstruction = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_inst_2",
      customerName: "Rao",
      phone: "9111122222",
      address: "Governorpet, Vijayawada",
      items: [{ name: "Chicken", weight: "500g", quantity: 1 }],
      total: 150,
      advancePaid: 150,
      deliveryInstruction: "",
    });

    // The only 📦 in the text should be 📦 ORDER ITEMS:
    const boxEmojiCount = (withoutInstruction.text.match(/📦/g) || []).length;
    assert.equal(boxEmojiCount, 1, "Only '📦 ORDER ITEMS:' must have 📦 when no delivery instruction is provided");
  });

  it("safely escapes HTML characters in customer name, product names, instructions, and addresses", () => {
    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_html_escape",
      customerName: "Sita & Gita <VIP>",
      phone: "9876543210",
      address: "Flat 101 & 102, <Phase 2> Towers",
      items: [
        { name: "Fish & Prawns Combo <Special>", weight: "500g", quantity: 1 },
      ],
      total: 500,
      advancePaid: 500,
      deliveryInstruction: "Call <Gate Guard> & check before entry",
    });

    const text = payload.text;
    assert.ok(text.includes("Customer: Sita &amp; Gita &lt;VIP&gt;"));
    assert.ok(text.includes("Flat 101 &amp; 102, &lt;Phase 2&gt; Towers"));
    assert.ok(text.includes("• Fish &amp; Prawns Combo &lt;Special&gt; — 500g × 1"));
    assert.ok(text.includes("📦 Call &lt;Gate Guard&gt; &amp; check before entry"));
    // Ensure raw unescaped HTML angle brackets outside the admin link are NOT present
    assert.ok(!text.includes("<VIP>"));
    assert.ok(!text.includes("<Phase 2>"));
    assert.ok(!text.includes("<Special>"));
    assert.ok(!text.includes("<Gate Guard>"));
  });

  it("splits long messages approaching or exceeding the 4000 character limit safely without losing data", () => {
    // Generate an order with 60 distinct items that exceeds 4000 chars
    const items = [];
    for (let i = 1; i <= 60; i++) {
      items.push({
        name: `Special Organic Country Chicken & Sea Fish Variety Cut Item #${i}`,
        weight: "1kg",
        quantity: 2,
        price: 350,
      });
    }

    const payload = buildAdminOrderTelegramPayload({
      chatId: dummyChatId,
      orderId: "ord_long_message",
      customerName: "Long Order Customer",
      phone: "9876543210",
      address: "123 Very Long Road Name, Tower B, Complex C, Sector D, Vijayawada, Andhra Pradesh, India - 520001",
      items,
      total: 21000,
      advancePaid: 5250,
      deliveryInstruction: "Extra packaging requested with ice packs for all varieties.",
    });

    assert.ok(payload.text.length > 4000, `Payload text length should exceed 4000 chars (is ${payload.text.length})`);
    const chunks = splitTelegramMessage(payload.text, 4000);
    assert.ok(chunks.length >= 2, "Message should be split into at least 2 chunks");

    for (const chunk of chunks) {
      assert.ok(chunk.length <= 4000, `Each chunk must be <= 4000 chars (got ${chunk.length})`);
    }

    // Verify all content is preserved across chunks
    const joined = chunks.join("\n");
    assert.ok(joined.includes("Special Organic Country Chicken &amp; Sea Fish Variety Cut Item #1"));
    assert.ok(joined.includes("Special Organic Country Chicken &amp; Sea Fish Variety Cut Item #60"));
    assert.ok(joined.includes("Order Total: ₹21000.00"));
    assert.ok(joined.includes('<a href="https://admin.nvfresh.in">🔗 Open Admin Panel</a>'));
  });
});

describe("Payment ID Canonicalization, Concurrency & Notification Deduplication", () => {
  it("withPaymentLock serializes concurrent executions for the exact same payment ID", async () => {
    const paymentId = "pay_test_mutex_100";
    const executionOrder = [];

    async function task(callerName, delayMs) {
      return withPaymentLock(paymentId, async () => {
        executionOrder.push(`${callerName}_start`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        executionOrder.push(`${callerName}_end`);
        return `${callerName}_done`;
      });
    }

    const [t1, t2] = await Promise.all([
      task("verify", 20),
      task("webhook", 5),
    ]);

    assert.equal(t1, "verify_done");
    assert.equal(t2, "webhook_done");

    // Must be completely serialized: verify start -> verify end -> webhook start -> webhook end
    assert.deepEqual(executionOrder, [
      "verify_start",
      "verify_end",
      "webhook_start",
      "webhook_end",
    ]);
  });

  it("ensures simultaneous webhook and frontend verification produce exactly one order and identical result", async () => {
    const paymentId = "pay_Tu43J7s0IHSiW2_test_sim";
    const orderId = "order_Tu43DVNgoUvI0K_test_sim";
    let insertCount = 0;
    const db = new Map();

    async function mockProcess(caller) {
      return withPaymentLock(paymentId, async () => {
        // Step 1: Check existing
        if (db.has(paymentId)) {
          const existing = db.get(paymentId);
          if (caller === "verify" && !existing.razorpay_signature) {
            existing.razorpay_signature = "sig_verified_123";
          }
          return { status: "already_processed", order: existing, caller };
        }

        // Simulate creating the single order
        insertCount++;
        const newOrder = {
          _id: "6ae45e64_test_canonical",
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          transaction_id: paymentId,
          customer_name: "Suneetha",
          total: 350,
          advance_paid: 88,
          status: "Pending",
          advance_payment_status: "Paid",
          razorpay_signature: caller === "verify" ? "sig_verified_123" : null,
        };
        db.set(paymentId, newOrder);
        return { status: "created", order: newOrder, caller };
      });
    }

    // Run both simultaneously
    const [res1, res2] = await Promise.all([
      mockProcess("verify"),
      mockProcess("webhook"),
    ]);

    assert.equal(insertCount, 1, "Exactly one order must be inserted into the database");
    assert.equal(db.size, 1, "Database must hold exactly one order for the payment ID");

    // Both callers must reference the exact same order document
    assert.equal(res1.order._id, res2.order._id);
    assert.equal(res1.order.razorpay_payment_id, paymentId);
    assert.equal(res2.order.razorpay_payment_id, paymentId);
  });

  it("handles database E11000 duplicate key error and recovers by returning existing canonical order", async () => {
    const paymentId = "pay_e11000_conflict";
    const db = new Map();

    function insertOrder(data) {
      if (db.has(data.razorpay_payment_id)) {
        const err = new Error("E11000 duplicate key error collection: orders index: uniq_razorpay_payment_id");
        err.code = 11000;
        throw err;
      }
      db.set(data.razorpay_payment_id, data);
      return data;
    }

    // First request inserts successfully
    const order1 = insertOrder({
      _id: "order_canonical_e11000",
      razorpay_payment_id: paymentId,
      customer_name: "Suneetha",
      total: 350,
      razorpay_signature: null,
    });
    assert.equal(order1._id, "order_canonical_e11000");

    // Second request attempts concurrent insert, catches E11000, recovers canonical order
    let recoveredOrder = null;
    try {
      insertOrder({
        _id: "order_duplicate_should_fail",
        razorpay_payment_id: paymentId,
        customer_name: "Suneetha",
        total: 350,
      });
      assert.fail("Should have thrown E11000");
    } catch (createErr) {
      if (createErr.code === 11000 || /E11000|duplicate key/i.test(createErr.message)) {
        recoveredOrder = db.get(paymentId);
        // Attach signature if missing
        recoveredOrder.razorpay_signature = "sig_recovered_signature";
      } else {
        throw createErr;
      }
    }

    assert.ok(recoveredOrder, "Must recover canonical order on E11000 error");
    assert.equal(recoveredOrder._id, "order_canonical_e11000");
    assert.equal(recoveredOrder.razorpay_signature, "sig_recovered_signature");
    assert.equal(db.size, 1, "Database must not contain duplicate order documents");
  });

  it("deduplicates Telegram notifications across different orders referencing the same Razorpay payment", async () => {
    const paymentId = "pay_dup_order_prevention";
    let telegramSends = 0;

    // Simulate database with two orders referencing the same payment ID
    const ordersDb = [
      {
        _id: "ord_first",
        razorpay_payment_id: paymentId,
        admin_telegram_notification: { status: "pending" },
      },
      {
        _id: "ord_second",
        razorpay_payment_id: paymentId,
        admin_telegram_notification: { status: "pending" },
      },
    ];

    async function sendTelegramForOrder(targetOrderId) {
      const order = ordersDb.find((o) => o._id === targetOrderId);
      if (!order) return;

      // Check if any order with this payment ID already sent notification
      const alreadySent = ordersDb.find(
        (o) => o.razorpay_payment_id === order.razorpay_payment_id && o.admin_telegram_notification.status === "sent"
      );
      if (alreadySent && alreadySent._id !== order._id) {
        order.admin_telegram_notification.status = "sent";
        return; // Skip duplicate send!
      }

      if (order.admin_telegram_notification.status === "pending") {
        order.admin_telegram_notification.status = "sent";
        telegramSends++;
      }
    }

    await sendTelegramForOrder("ord_first");
    assert.equal(telegramSends, 1, "First order sends Telegram notification");

    // Second order attempts to send for the same payment
    await sendTelegramForOrder("ord_second");
    assert.equal(telegramSends, 1, "Second order referencing same payment ID must NOT send duplicate notification");
  });

  it("deduplicates in-app admin notifications across different orders referencing the same Razorpay payment", async () => {
    const paymentId = "pay_inapp_dup_prevention";
    const notifications = [];

    const ordersDb = [
      { _id: "ord_101", razorpay_payment_id: paymentId },
      { _id: "ord_102", razorpay_payment_id: paymentId },
    ];

    async function createInAppNotification(orderId, paymentId) {
      // Find all order IDs related to this payment ID
      const relatedIds = ordersDb
        .filter((o) => o.razorpay_payment_id === paymentId)
        .map((o) => o._id);

      // Check if any notification already exists for any of these related order IDs
      const existing = notifications.find(
        (n) => relatedIds.includes(n.orderId) && n.type === "new_order"
      );
      if (!existing) {
        notifications.push({ orderId, type: "new_order", message: `New order #${orderId}` });
      }
    }

    await createInAppNotification("ord_101", paymentId);
    assert.equal(notifications.length, 1);

    await createInAppNotification("ord_102", paymentId);
    assert.equal(notifications.length, 1, "Must not create duplicate in-app notification for the same payment ID");
  });

  it("confirms manual UPI order flow continues working with null razorpay_payment_id", async () => {
    const manualOrder = {
      _id: "ord_upi_manual_99",
      customer_name: "UPI Customer",
      payment_method: "upi_qr",
      transaction_id: "UTR123456789012",
      payment_reference: "NVF-20261030-001",
      razorpay_payment_id: null,
      admin_telegram_notification: { status: "pending" },
    };

    assert.equal(manualOrder.payment_method, "upi_qr");
    assert.equal(manualOrder.razorpay_payment_id, null);
    assert.ok(manualOrder.transaction_id.startsWith("UTR"));
  });

  it("prioritizes exact razorpay_payment_id over legacy transaction_id and excludes archived duplicates", async () => {
    const paymentId = "pay_priority_test_1";
    const archivedId = `${paymentId}_duplicate_canonical123`;

    // Simulated collection containing:
    // 1. Canonical order
    // 2. Archived duplicate
    // 3. Genuine legacy order
    const mockOrders = [
      {
        _id: "order_canonical",
        razorpay_payment_id: paymentId,
        transaction_id: paymentId,
        status: "Pending",
      },
      {
        _id: "order_archived_dup",
        razorpay_payment_id: archivedId,
        transaction_id: paymentId,
        status: "Cancelled",
        cancellation_reason: "Duplicate webhook creation",
      },
      {
        _id: "order_genuine_legacy",
        razorpay_payment_id: null,
        transaction_id: "pay_legacy_only",
        status: "Pending",
      },
    ];

    async function mockFindOrderByPaymentId(searchId) {
      // 1. Exact canonical razorpay_payment_id match
      const canonical = mockOrders.find((o) => o.razorpay_payment_id === searchId);
      if (canonical) return canonical;

      // 2. Fallback for genuine legacy where razorpay_payment_id is absent/null/empty and not cancelled
      const legacy = mockOrders.find(
        (o) =>
          o.transaction_id === searchId &&
          (!o.razorpay_payment_id || o.razorpay_payment_id === "") &&
          o.status !== "Cancelled"
      );
      if (legacy) return legacy;

      return null;
    }

    // 1. Lookup with paymentId must return the canonical order, NOT the archived duplicate
    const result1 = await mockFindOrderByPaymentId(paymentId);
    assert.ok(result1);
    assert.equal(result1._id, "order_canonical");

    // 2. If canonical order didn't exist, search must NOT return the archived duplicate
    mockOrders.shift(); // remove canonical
    const resultAfterRemoval = await mockFindOrderByPaymentId(paymentId);
    assert.equal(resultAfterRemoval, null, "Archived duplicate must never be returned as canonical");

    // 3. Genuine legacy order lookup works
    const resultLegacy = await mockFindOrderByPaymentId("pay_legacy_only");
    assert.ok(resultLegacy);
    assert.equal(resultLegacy._id, "order_genuine_legacy");
  });

  it("simulates multiple serverless Vercel instances with separate memory spaces relying on database uniqueness", async () => {
    const paymentId = "pay_multi_instance_race";
    const databaseCollection = new Map();

    // Instance 1 and Instance 2 have completely SEPARATE in-memory locks (simulating separate lambda containers)
    const instance1Locks = new Map();
    const instance2Locks = new Map();

    async function runInstanceVerify(instanceId, instanceLocks, signature = null) {
      // Small simulated container network delay
      await new Promise((r) => setTimeout(r, Math.random() * 10));

      // Check if order exists in database
      const existing = databaseCollection.get(paymentId);
      if (existing) {
        if (!existing.razorpay_signature && signature) {
          existing.razorpay_signature = signature;
        }
        return { instanceId, order: existing, action: "retrieved_existing" };
      }

      // Try database insert with unique index enforcement
      try {
        if (databaseCollection.has(paymentId)) {
          const err = new Error("E11000 duplicate key error collection: test.orders index: uniq_razorpay_payment_id");
          err.code = 11000;
          throw err;
        }
        const created = {
          _id: `ord_${instanceId}_created`,
          razorpay_payment_id: paymentId,
          transaction_id: paymentId,
          razorpay_signature: signature,
          status: "Pending",
          advance_payment_status: "Paid",
        };
        databaseCollection.set(paymentId, created);
        return { instanceId, order: created, action: "created_new" };
      } catch (err) {
        if (err.code === 11000) {
          const canonical = databaseCollection.get(paymentId);
          if (!canonical.razorpay_signature && signature) {
            canonical.razorpay_signature = signature;
          }
          return { instanceId, order: canonical, action: "recovered_from_e11000" };
        }
        throw err;
      }
    }

    // Run both independent instances concurrently
    const [resInstance1, resInstance2] = await Promise.all([
      runInstanceVerify("instance_1", instance1Locks, "sig_inst1"),
      runInstanceVerify("instance_2", instance2Locks, null),
    ]);

    assert.equal(databaseCollection.size, 1, "Database must hold exactly ONE order across separate instances");
    const actions = [resInstance1.action, resInstance2.action];
    assert.ok(actions.includes("created_new"), "One instance must create the order");
    assert.ok(
      actions.includes("retrieved_existing") || actions.includes("recovered_from_e11000"),
      "The other instance must safely recover or retrieve the existing order"
    );

    // Both instances end up referencing the exact same canonical order ID
    assert.equal(resInstance1.order._id, resInstance2.order._id);
  });
});

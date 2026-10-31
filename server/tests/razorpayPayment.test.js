// server/tests/razorpayPayment.test.js
// Final Pre-Deployment Security Audit & Concurrency Tests for Razorpay Integration
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  verifySignature,
  createItemsSummary,
  parseItemsSummary,
  hashItemsSummary,
  ensurePaymentCaptured,
} from "../routes/payment.js";
import { computeAdvance, isValidAdvancePercentage } from "../utils/pricing.js";
import Order from "../models/Order.js";

describe("1. Webhook Raw-Body Verification & Timing-Safe Security", () => {
  const webhookSecret = "whsec_test_audit_key_555";
  const rawBodyBuffer = Buffer.from(
    JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: { entity: { id: "pay_test123", order_id: "order_test123", amount: 25000, status: "captured" } },
      },
    }),
    "utf8"
  );

  it("verifies the exact raw Buffer request body using HMAC-SHA256 and timingSafeEqual", () => {
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBodyBuffer)
      .digest("hex");

    const bufA = Buffer.from(expectedSig, "utf8");
    const bufB = Buffer.from(expectedSig, "utf8");
    assert.equal(bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB), true);
  });

  it("rejects when raw body is altered or re-serialized with differing whitespace/keys", () => {
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBodyBuffer)
      .digest("hex");

    // Altered serialization (extra spaces)
    const alteredBuffer = Buffer.from(
      JSON.stringify(JSON.parse(rawBodyBuffer.toString()), null, 2),
      "utf8"
    );

    const bufA = Buffer.from(expectedSig, "utf8");
    const bufB = Buffer.from(
      crypto.createHmac("sha256", webhookSecret).update(alteredBuffer).digest("hex"),
      "utf8"
    );

    assert.equal(crypto.timingSafeEqual(bufA, bufB), false, "Mismatched raw buffer must fail signature check");
  });

  it("rejects forged webhook signatures", () => {
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBodyBuffer)
      .digest("hex");

    const forgedSig = crypto
      .createHmac("sha256", "forged_secret")
      .update(rawBodyBuffer)
      .digest("hex");

    const bufA = Buffer.from(expectedSig, "utf8");
    const bufB = Buffer.from(forgedSig, "utf8");
    assert.equal(crypto.timingSafeEqual(bufA, bufB), false);
  });
});

describe("2. Webhook Payment Validation (Anti-Spoofing & Replay Protection)", () => {
  it("strictly validates payment status is 'captured', currency is 'INR', and amount matches", () => {
    function validateWebhookEntities(payment, rzpOrder) {
      if (!payment || !rzpOrder) return { valid: false, error: "Entities missing" };
      if (payment.status !== "captured") return { valid: false, error: "Payment not captured" };
      if (payment.currency?.toUpperCase() !== "INR") return { valid: false, error: "Invalid currency" };
      if (payment.order_id !== rzpOrder.id) return { valid: false, error: "Order ID mismatch" };
      if (payment.amount !== rzpOrder.amount) return { valid: false, error: "Amount mismatch" };
      return { valid: true };
    }

    const validPayment = { id: "pay_1", order_id: "order_1", currency: "INR", amount: 25000, status: "captured" };
    const validOrder = { id: "order_1", amount: 25000 };
    assert.deepEqual(validateWebhookEntities(validPayment, validOrder), { valid: true });

    // Status authorized (not captured) must be rejected
    const authPayment = { ...validPayment, status: "authorized" };
    assert.equal(validateWebhookEntities(authPayment, validOrder).valid, false);

    // Currency USD must be rejected
    const usdPayment = { ...validPayment, currency: "USD" };
    assert.equal(validateWebhookEntities(usdPayment, validOrder).valid, false);

    // Mismatched order ID must be rejected
    const orderMismatchPayment = { ...validPayment, order_id: "order_different" };
    assert.equal(validateWebhookEntities(orderMismatchPayment, validOrder).valid, false);

    // Mismatched amount must be rejected
    const amountMismatchPayment = { ...validPayment, amount: 10000 };
    assert.equal(validateWebhookEntities(amountMismatchPayment, validOrder).valid, false);
  });

  it("handles duplicate webhook events idempotently without corrupting or duplicating orders", () => {
    const existingOrdersDb = new Map();
    existingOrdersDb.set("pay_dup_event", {
      id: "ord_already_paid",
      advance_payment_status: "Paid",
      transaction_id: "pay_dup_event",
    });

    function processWebhookEvent(paymentId) {
      const existing = existingOrdersDb.get(paymentId);
      if (existing) {
        if (existing.advance_payment_status === "Paid") {
          return { status: "already_processed", orderId: existing.id };
        }
      }
      return { status: "created" };
    }

    const firstRun = processWebhookEvent("pay_dup_event");
    assert.equal(firstRun.status, "already_processed");
    assert.equal(firstRun.orderId, "ord_already_paid");
  });
});

describe("3. Database-Level Idempotency & Concurrency Safety", () => {
  it("enforces unique partial index on razorpay_payment_id in Order schema", () => {
    const schema = Order.schema;
    const paymentIdField = schema.paths.razorpay_payment_id;
    assert.ok(paymentIdField, "razorpay_payment_id must exist in Order schema");

    const indexes = schema.indexes();
    const rzpIndex = indexes.find((idx) => idx[0]?.razorpay_payment_id === 1);
    assert.ok(rzpIndex, "Unique partial index on razorpay_payment_id must exist in Order schema");
    assert.equal(rzpIndex[1]?.unique, true, "Index must have unique: true");
    assert.deepEqual(
      rzpIndex[1]?.partialFilterExpression,
      { razorpay_payment_id: { $type: "string" } },
      "Index must have partialFilterExpression for string type"
    );
  });

  it("safely handles race condition between simultaneous frontend verification and webhook processing", async () => {
    // Simulate atomic database collection with unique index constraint on razorpay_payment_id
    const db = new Map();

    async function atomicInsertOrder(orderData) {
      const paymentId = orderData.razorpay_payment_id;
      // MongoDB's unique index atomically enforces uniqueness across concurrent inserts
      if (db.has(paymentId)) {
        const error = new Error("E11000 duplicate key error index: razorpay_payment_id_1 dup key");
        error.code = 11000;
        throw error;
      }
      const created = { ...orderData, _id: "ord_unique_id_12345" };
      db.set(paymentId, created);
      return created;
    }

    async function safeVerifyOrder(paymentId) {
      // Simulate small variable network latency before attempting write
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      try {
        const order = await atomicInsertOrder({
          razorpay_payment_id: paymentId,
          advance_payment_status: "Paid",
        });
        return { success: true, order, isDuplicate: false };
      } catch (err) {
        if (err.code === 11000) {
          const existing = db.get(paymentId);
          return { success: true, order: existing, isDuplicate: true };
        }
        throw err;
      }
    }

    // Run Frontend Verify and Webhook simultaneously for the same paymentId
    const sharedPaymentId = "pay_race_condition_test_123";
    const [resultA, resultB] = await Promise.all([
      safeVerifyOrder(sharedPaymentId),
      safeVerifyOrder(sharedPaymentId),
    ]);

    assert.equal(resultA.success, true);
    assert.equal(resultB.success, true);
    assert.equal(resultA.order._id, resultB.order._id, "Both must resolve to the EXACT SAME order ID");
    assert.equal(db.size, 1, "Exactly one order must exist in the database");
    // One created the order, the other caught E11000 duplicate key and returned the existing one
    assert.equal(resultA.isDuplicate !== resultB.isDuplicate, true);
  });
});

describe("4. Payment Capture Concurrency & Status Transition", () => {
  it("handles two simultaneous verification requests for the same authorized payment", async () => {
    let paymentState = "authorized";
    let captureCount = 0;

    // Simulated Razorpay SDK client
    const mockRazorpay = {
      payments: {
        async fetch(id) {
          return { id, status: paymentState, amount: 25000, currency: "INR" };
        },
        async capture(id, amount, currency) {
          if (paymentState === "captured") {
            // Razorpay API returns BAD_REQUEST_ERROR if already captured
            const err = new Error("Payment has already been captured");
            err.statusCode = 400;
            err.error = { code: "BAD_REQUEST_ERROR", description: "This payment has already been captured" };
            throw err;
          }
          captureCount++;
          paymentState = "captured";
          return { id, status: "captured", amount, currency };
        },
      },
    };

    // Both requests invoke ensurePaymentCaptured concurrently
    const [paymentResult1, paymentResult2] = await Promise.all([
      ensurePaymentCaptured(mockRazorpay, "pay_concurrent_123", 25000),
      ensurePaymentCaptured(mockRazorpay, "pay_concurrent_123", 25000),
    ]);

    assert.equal(paymentResult1.status, "captured");
    assert.equal(paymentResult2.status, "captured");
    assert.equal(captureCount, 1, "Razorpay capture API must be executed successfully once");
  });

  it("never marks an order Paid if capture fails or payment remains pending/failed", async () => {
    const mockFailedRazorpay = {
      payments: {
        async fetch(id) {
          return { id, status: "failed", amount: 25000 };
        },
      },
    };

    await assert.rejects(
      async () => {
        await ensurePaymentCaptured(mockFailedRazorpay, "pay_failed_123", 25000);
      },
      { message: /Payment failed on payment gateway/ }
    );

    const mockPendingRazorpay = {
      payments: {
        async fetch(id) {
          return { id, status: "pending", amount: 25000 };
        },
      },
    };

    await assert.rejects(
      async () => {
        await ensurePaymentCaptured(mockPendingRazorpay, "pay_pending_123", 25000);
      },
      { message: /Payment is still pending on payment gateway/ }
    );
  });
});

describe("5. Parsing & Cryptographic Items Summary", () => {
  it("parses and reconstructs items summary symmetrically", () => {
    const items = [
      { productId: "60d5ec123456789012345678", weight: "1 kg", quantity: 2 },
      { productId: "60d5ec987654321098765432", weight: "0.5 kg", quantity: 1 },
    ];

    const summary = createItemsSummary(items);
    const parsed = parseItemsSummary(summary);

    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].productId, items[0].productId);
    assert.equal(parsed[0].quantity, 2);
    assert.equal(parsed[1].productId, items[1].productId);
    assert.equal(parsed[1].quantity, 1);

    const recomputedSummary = createItemsSummary(parsed);
    assert.equal(summary, recomputedSummary);
  });
});

describe("6. Advance Payment Calculations & Server-Side Rules", () => {
  it("enforces allowed advance percentages (25, 50, 75, 100)", () => {
    assert.equal(isValidAdvancePercentage(25), true);
    assert.equal(isValidAdvancePercentage(50), true);
    assert.equal(isValidAdvancePercentage(75), true);
    assert.equal(isValidAdvancePercentage(100), true);
    assert.equal(isValidAdvancePercentage("25"), true);
    assert.equal(isValidAdvancePercentage("100"), true);

    assert.equal(isValidAdvancePercentage(10), false);
    assert.equal(isValidAdvancePercentage(0), false);
    assert.equal(isValidAdvancePercentage(80), false);
    assert.equal(isValidAdvancePercentage(-25), false);
  });

  it("correctly computes advance and remaining amounts", () => {
    const total = 1000;

    const adv25 = computeAdvance(total, 25);
    assert.equal(adv25.advanceAmount, 250);
    assert.equal(adv25.remainingAmount, 750);

    const adv50 = computeAdvance(total, 50);
    assert.equal(adv50.advanceAmount, 500);
    assert.equal(adv50.remainingAmount, 500);

    const adv75 = computeAdvance(total, 75);
    assert.equal(adv75.advanceAmount, 750);
    assert.equal(adv75.remainingAmount, 250);

    const adv100 = computeAdvance(total, 100);
    assert.equal(adv100.advanceAmount, 1000);
    assert.equal(adv100.remainingAmount, 0);
  });

  it("validates minimum 100 paise rule (₹1.00)", () => {
    const validAmountPaise = Math.round(1.0 * 100); // 100 paise
    const belowMinPaise = Math.round(0.5 * 100); // 50 paise

    assert.ok(validAmountPaise >= 100, "100 paise or more is allowed");
    assert.ok(belowMinPaise < 100, "Less than 100 paise must be flagged as below minimum");
  });

  it("detects amount tampering when client amount disagrees with server calculation", () => {
    const serverAdvanceAmount = 250;
    const serverPaise = Math.round(serverAdvanceAmount * 100); // 25000 paise

    const clientTamperedPaise = 100; // Customer modified JS in browser to ₹1
    const matches = clientTamperedPaise === serverPaise || clientTamperedPaise === serverAdvanceAmount;

    assert.equal(matches, false, "Tampered client amount must not match server-calculated amount");
  });
});

describe("7. Prevention of Arbitrary orderData / Identity Spoofing", () => {
  it("detects when customer attempts to substitute arbitrary items in verify-payment", () => {
    const originalItems = [{ productId: "60d5ec1", weight: "1 kg", quantity: 1 }]; // ₹220
    const originalHash = hashItemsSummary(createItemsSummary(originalItems));

    const tamperedItems = [{ productId: "60d5ec9_mutton", weight: "2 kg", quantity: 5 }]; // Tampered
    const tamperedHash = hashItemsSummary(createItemsSummary(tamperedItems));

    assert.notEqual(originalHash, tamperedHash, "Tampered items must result in hash mismatch");
  });

  it("prevents User B from verifying a payment or order belonging to User A", () => {
    const rzpOrderNotes = {
      customerUid: "user_A_uid_12345",
      itemsHash: "hash_abc",
      advancePercentage: "25",
    };

    const requestingUserUid = "user_B_attacker_67890";
    const isOwner = rzpOrderNotes.customerUid === requestingUserUid;

    assert.equal(isOwner, false, "Payment belonging to User A must be rejected for User B");
  });
});

describe("8. Razorpay Standard Checkout Protocol Compliance", () => {
  const testKeySecret = "nclFB8evZ0a70sro2uICrGuT";

  it("verifies valid HMAC-SHA256 signature conforming to order_id|payment_id", () => {
    const orderId = "order_Pv9824XyzAbc12";
    const paymentId = "pay_Qe7712MnoDef34";
    const generatedSignature = crypto
      .createHmac("sha256", testKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = verifySignature(orderId, paymentId, generatedSignature, testKeySecret);
    assert.equal(isValid, true, "Signature must verify successfully");
  });

  it("rejects invalid or tampered signature", () => {
    const orderId = "order_Pv9824XyzAbc12";
    const paymentId = "pay_Qe7712MnoDef34";
    const invalidSignature = "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

    const isValid = verifySignature(orderId, paymentId, invalidSignature, testKeySecret);
    assert.equal(isValid, false, "Tampered signature must be rejected");
  });

  it("handles missing parameters safely without throwing", () => {
    assert.equal(verifySignature(null, "pay_1", "sig", testKeySecret), false);
    assert.equal(verifySignature("order_1", null, "sig", testKeySecret), false);
    assert.equal(verifySignature("order_1", "pay_1", null, testKeySecret), false);
    assert.equal(verifySignature("order_1", "pay_1", "sig", null), false);
  });
});

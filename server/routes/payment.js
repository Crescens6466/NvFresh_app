// routes/payment.js — Razorpay Standard Web Checkout order creation and verification
import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import { waitUntil } from "@vercel/functions";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Settings from "../models/Settings.js";
import Admin from "../models/Admin.js";
import Notification from "../models/Notification.js";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import { verifyFirebaseIdToken } from "../firebaseTokenVerify.js";
import { CUSTOMER_JWT_SECRET } from "./customerAuth.js";
import { toClient } from "../utils/serialize.js";
import {
  computeOrderTotals,
  computeAdvance,
  isValidAdvancePercentage,
  OrderValidationError,
} from "../utils/pricing.js";
import {
  sendOrderConfirmation,
  sendAdminOrderAlert,
  sendPaymentConfirmedNotification,
} from "../utils/notify.js";
import { sendAdminNewOrderNotification } from "../firebaseAdmin.js";
import { emitAdminNotification } from "../realtime.js";
import {
  notifyAndRecord,
  sendAdminOrderTelegramOnce,
  sendAdminOrderNotificationsOnce,
  scheduleCustomerOrderNotification,
  safeWaitUntil,
} from "./orders.js";
import {
  isDeliveryAreaServiceableAsync,
  getServiceableAreaErrorMessageAsync,
} from "../utils/serviceAreas.js";

const router = express.Router();

export function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

export function createItemsSummary(items) {
  if (!Array.isArray(items)) return "";
  return items
    .map((i) => `${String(i.productId || i.product_id)}:${String(i.weight)}:${String(i.quantity)}`)
    .sort()
    .join("|");
}

export function parseItemsSummary(summary) {
  if (!summary || typeof summary !== "string") return [];
  return summary
    .split("|")
    .filter(Boolean)
    .map((entry) => {
      const [productId, weight, quantity] = entry.split(":");
      return {
        productId,
        weight,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
      };
    });
}

export function hashItemsSummary(summary) {
  return crypto.createHash("sha256").update(summary || "").digest("hex").slice(0, 32);
}

export async function findOrderByPaymentId(paymentId, razorpayOrderId = null) {
  if (!paymentId) return null;

  // 1. Exact canonical razorpay_payment_id match takes absolute priority
  const canonical = await Order.findOne({
    razorpay_payment_id: paymentId,
  });
  if (canonical) return canonical;

  // 2. Fallback for genuine legacy records where razorpay_payment_id is absent, null or empty.
  // Exclude any archived duplicates (which have a suffixed razorpay_payment_id or status Cancelled).
  const legacyOrder = await Order.findOne({
    transaction_id: paymentId,
    $or: [
      { razorpay_payment_id: null },
      { razorpay_payment_id: { $exists: false } },
      { razorpay_payment_id: "" },
    ],
    status: { $ne: "Cancelled" },
  });
  if (legacyOrder) return legacyOrder;

  // 3. Fallback by razorpay_order_id if provided (for draft orders not yet stamped with payment ID)
  if (razorpayOrderId) {
    const orderMatch = await Order.findOne({
      razorpay_order_id: razorpayOrderId,
      $or: [
        { razorpay_payment_id: null },
        { razorpay_payment_id: { $exists: false } },
        { razorpay_payment_id: "" },
      ],
      status: { $ne: "Cancelled" },
    });
    if (orderMatch) return orderMatch;
  }

  return null;
}

export const inFlightPaymentLocks = new Map();

export async function withPaymentLock(paymentId, fn) {
  if (!paymentId) return fn();
  while (inFlightPaymentLocks.has(paymentId)) {
    try {
      await inFlightPaymentLocks.get(paymentId);
    } catch {
      // previous lock error handled by original caller
    }
  }

  let resolveLock;
  let rejectLock;
  const lockPromise = new Promise((resolve, reject) => {
    resolveLock = resolve;
    rejectLock = reject;
  });
  inFlightPaymentLocks.set(paymentId, lockPromise);

  try {
    const result = await fn();
    resolveLock(result);
    return result;
  } catch (err) {
    rejectLock(err);
    throw err;
  } finally {
    inFlightPaymentLocks.delete(paymentId);
  }
}

export async function optionalCustomerAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    req.customer = null;
    return next();
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, CUSTOMER_JWT_SECRET);
    req.customer = { uid: decoded.uid, phone: decoded.phone, email: null, name: null };
    return next();
  } catch {
    // try firebase
  }

  try {
    req.customer = await verifyFirebaseIdToken(token);
    return next();
  } catch {
    req.customer = null;
    return next();
  }
}

export function verifySignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const bufA = Buffer.from(expectedSignature, "utf8");
    const bufB = Buffer.from(signature, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    console.error("[razorpay] Signature verification exception:", err.message);
    return false;
  }
}

export async function ensurePaymentCaptured(razorpay, paymentId, expectedAmountPaise) {
  let payment = await razorpay.payments.fetch(paymentId);
  if (!payment) {
    throw new Error("Payment not found on Razorpay");
  }

  if (payment.status === "failed") {
    throw new Error("Payment failed on payment gateway");
  }
  if (payment.status === "created" || payment.status === "pending") {
    throw new Error("Payment is still pending on payment gateway");
  }

  if (payment.status === "authorized") {
    try {
      payment = await razorpay.payments.capture(paymentId, expectedAmountPaise, "INR");
    } catch (capErr) {
      // Concurrency check: if another concurrent process or webhook already captured it,
      // re-fetch the payment to verify its current state rather than failing
      console.warn("[razorpay] Capture call threw; checking if already captured:", capErr.message);
      try {
        payment = await razorpay.payments.fetch(paymentId);
      } catch (reFetchErr) {
        throw new Error("Payment authorization could not be captured: " + capErr.message);
      }
    }
  }

  if (payment.status !== "captured") {
    throw new Error(`Payment is not captured (status: ${payment.status}). Only captured payments can be marked as Paid.`);
  }

  return payment;
}

// GET /api/payment/payment-config — public helper for checkout initialization
router.get("/payment-config", (req, res) => {
  res.json({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    keyId: process.env.RAZORPAY_KEY_ID || "",
    currency: "INR",
  });
});

// POST /api/create-order (or /api/payment/create-order)
router.post("/create-order", optionalCustomerAuth, async (req, res, next) => {
  try {
    const {
      items,
      advancePercentage,
      orderId,
      customerName,
      phone,
      address,
      amount: clientAmount,
      currency: clientCurrency,
      receipt: clientReceipt,
    } = req.body;

    let payableAmountPaise;
    let itemsHash = "";
    let itemsSummary = "";

    if (items && Array.isArray(items) && items.length > 0) {
      if (!isValidAdvancePercentage(advancePercentage)) {
        return res.status(400).json({ error: "advancePercentage must be one of 25, 50, 75, 100" });
      }

      if (address && !(await isDeliveryAreaServiceableAsync(address))) {
        return res.status(400).json({ error: await getServiceableAreaErrorMessageAsync() });
      }

      const { resolvedItems, total } = await computeOrderTotals(items);
      const { advanceAmount } = computeAdvance(total, Number(advancePercentage));
      payableAmountPaise = Math.round(advanceAmount * 100);

      // Validate client amount if provided to prevent frontend tampering
      if (clientAmount !== undefined && clientAmount !== null) {
        const clientNum = Number(clientAmount);
        if (clientNum !== payableAmountPaise && clientNum !== advanceAmount) {
          return res.status(400).json({ error: "Client amount does not match server-calculated advance" });
        }
      }

      itemsSummary = createItemsSummary(resolvedItems);
      itemsHash = hashItemsSummary(itemsSummary);
    } else if (orderId) {
      const existing = await Order.findById(orderId);
      if (!existing) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (existing.customer_uid && req.customer?.uid && existing.customer_uid !== req.customer.uid) {
        return res.status(403).json({ error: "Order does not belong to the signed-in customer" });
      }
      if (existing.advance_payment_status === "Paid") {
        return res.status(400).json({ error: "Order is already paid" });
      }
      payableAmountPaise = Math.round(existing.advance_paid * 100);
      itemsSummary = createItemsSummary(existing.items);
      itemsHash = hashItemsSummary(itemsSummary);
    } else if (clientAmount !== undefined && clientAmount !== null) {
      payableAmountPaise = Math.round(Number(clientAmount));
      itemsSummary = "direct_amount";
      itemsHash = hashItemsSummary(itemsSummary);
    } else {
      return res.status(400).json({ error: "amount, items, or existing orderId must be provided to create payment order" });
    }

    if (!Number.isInteger(payableAmountPaise)) {
      return res.status(400).json({ error: "Payable amount must be an integer number of paise" });
    }

    if (payableAmountPaise < 100) {
      return res.status(400).json({ error: "Payable amount must be at least 100 paise (₹1)" });
    }

    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      console.error("[razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured");
      return res.status(500).json({ error: "Payment gateway is not configured on the server" });
    }

    const receipt = clientReceipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const rzpOrder = await razorpay.orders.create({
      amount: payableAmountPaise,
      currency: clientCurrency || "INR",
      receipt,
      notes: {
        customerUid: req.customer?.uid || "guest",
        itemsHash,
        itemsSummary: itemsSummary.slice(0, 250),
        advancePercentage: String(advancePercentage || 25),
        customerName: (customerName || "").slice(0, 100),
        phone: (phone || req.customer?.phone || "").slice(0, 20),
        address: (address || "").slice(0, 250),
        orderId: orderId || "",
      },
    });

    res.json({
      order_id: rzpOrder.id,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID || "",
      keyId: process.env.RAZORPAY_KEY_ID || "",
      receipt: rzpOrder.receipt,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("[razorpay] Order creation failure:", err.message);
    if (err.statusCode === 401 || err.error?.code === "BAD_REQUEST_ERROR") {
      return res.status(502).json({ error: "Payment provider rejected order request" });
    }
    res.status(500).json({ error: "Could not create payment order" });
  }
});

// POST /api/verify-payment (or /api/payment/verify-payment)
router.post("/verify-payment", optionalCustomerAuth, async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
      orderData,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        verified: false,
        error: "Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)",
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[razorpay] RAZORPAY_KEY_SECRET is not configured");
      return res.status(500).json({ verified: false, error: "Payment gateway secret is not configured" });
    }

    // 1. Cryptographic signature verification using HMAC-SHA256 and timing-safe comparison
    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret);
    if (!isValid) {
      console.warn("[razorpay] Payment signature mismatch for order:", razorpay_order_id);
      return res.status(400).json({ verified: false, error: "Invalid payment signature" });
    }

    // Direct standalone verification when orderId and orderData are not supplied
    if (!orderId && !orderData) {
      return res.json({
        verified: true,
        success: true,
        message: "Payment signature verified successfully",
        razorpay_order_id,
        razorpay_payment_id,
      });
    }

    return await withPaymentLock(razorpay_payment_id, async () => {
      // 2. Prevent duplicate processing (Idempotency)
      const duplicate = await findOrderByPaymentId(razorpay_payment_id, razorpay_order_id);
      if (duplicate) {
        if (!duplicate.razorpay_signature && razorpay_signature) {
          duplicate.razorpay_signature = razorpay_signature;
          await duplicate.save();
        }
        const clientOrder = toClient(duplicate);
        return res.json({
          verified: true,
          success: true,
          message: "Payment already verified",
          order: clientOrder,
        });
      }

      let expectedAmountPaise;
      let computedItemsHash = "";

      if (orderId) {
        const existing = await Order.findById(orderId);
        if (!existing) {
          return res.status(404).json({ verified: false, error: "Order not found" });
        }
        if (existing.customer_uid && req.customer?.uid && existing.customer_uid !== req.customer.uid) {
          return res.status(403).json({ verified: false, error: "Order does not belong to this customer" });
        }
        if (existing.advance_payment_status === "Paid") {
          return res.json({
            verified: true,
            success: true,
            message: "Order already paid",
            order: toClient(existing),
          });
        }
        expectedAmountPaise = Math.round(existing.advance_paid * 100);
        computedItemsHash = hashItemsSummary(createItemsSummary(existing.items));
      } else if (orderData) {
        const { customerName, phone, address, items, advancePercentage } = orderData;
        if (!customerName || !phone || !address || !items || !advancePercentage) {
          return res.status(400).json({ verified: false, error: "Missing required order data for verification" });
        }
        if (!(await isDeliveryAreaServiceableAsync(address))) {
          return res.status(400).json({ verified: false, error: await getServiceableAreaErrorMessageAsync() });
        }
        if (!isValidAdvancePercentage(advancePercentage)) {
          return res.status(400).json({ verified: false, error: "advancePercentage must be one of 25, 50, 75, 100" });
        }
        const { resolvedItems, total } = await computeOrderTotals(items);
        const { advanceAmount } = computeAdvance(total, Number(advancePercentage));
        expectedAmountPaise = Math.round(advanceAmount * 100);
        computedItemsHash = hashItemsSummary(createItemsSummary(resolvedItems));
      }

      // 3. Verification with Razorpay API (Payment Status & Order Ownership)
      const razorpay = getRazorpayInstance();
      if (razorpay) {
        try {
          const payment = await ensurePaymentCaptured(razorpay, razorpay_payment_id, expectedAmountPaise);
          if (payment.order_id && payment.order_id !== razorpay_order_id) {
            return res.status(400).json({ verified: false, error: "Payment does not belong to the expected order" });
          }
          if (payment.currency && payment.currency.toUpperCase() !== "INR") {
            return res.status(400).json({ verified: false, error: "Payment currency mismatch" });
          }
          if (payment.amount !== undefined && payment.amount !== expectedAmountPaise) {
            return res.status(400).json({ verified: false, error: "Payment amount does not match expected order amount" });
          }
        } catch (rzpErr) {
          console.warn("[razorpay] Payment capture/verification error:", rzpErr.message);
          return res.status(400).json({ verified: false, error: rzpErr.message || "Payment could not be confirmed as captured" });
        }

        // 4. Verify Razorpay Order ownership and item integrity
        try {
          const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
          if (rzpOrder) {
            if (rzpOrder.notes?.customerUid && req.customer?.uid && rzpOrder.notes.customerUid !== "guest") {
              if (rzpOrder.notes.customerUid !== req.customer.uid) {
                return res.status(403).json({ verified: false, error: "Payment order does not belong to this customer" });
              }
            }
            if (rzpOrder.amount && rzpOrder.amount !== expectedAmountPaise) {
              return res.status(400).json({ verified: false, error: "Payment order amount mismatch" });
            }
            if (orderData?.advancePercentage && rzpOrder.notes?.advancePercentage) {
              if (rzpOrder.notes.advancePercentage !== String(orderData.advancePercentage)) {
                return res.status(400).json({ verified: false, error: "Advance percentage mismatch with payment order" });
              }
            }
            if (rzpOrder.notes?.itemsHash && computedItemsHash) {
              if (rzpOrder.notes.itemsHash !== computedItemsHash) {
                return res.status(400).json({ verified: false, error: "Order items do not match payment order" });
              }
            }
          }
        } catch (orderFetchErr) {
          if (orderFetchErr.statusCode === 404 || orderFetchErr.statusCode === 400) {
            return res.status(400).json({ verified: false, error: "Invalid payment order ID" });
          }
          console.warn("[razorpay] Notice: Could not fetch order entity from Razorpay API:", orderFetchErr.message);
        }
      }

      let clientOrder;

      if (orderId) {
        const existing = await Order.findById(orderId);
        existing.advance_payment_status = "Paid";
        existing.transaction_id = razorpay_payment_id;
        existing.payment_reference = razorpay_order_id;
        existing.payment_method = "razorpay";
        existing.razorpay_order_id = razorpay_order_id;
        existing.razorpay_payment_id = razorpay_payment_id;
        existing.razorpay_signature = razorpay_signature;
        await existing.save();

        clientOrder = toClient(existing);
        scheduleCustomerOrderNotification(existing.customer_uid, existing._id, "payment_confirmed");
        notifyAndRecord(existing._id, sendPaymentConfirmedNotification(clientOrder));
        safeWaitUntil(sendAdminOrderNotificationsOnce(existing._id, clientOrder, true));
      } else {
        const { customerName, phone, address, items, advancePercentage } = orderData;
        const { resolvedItems, subtotal, deliveryCharge, total } = await computeOrderTotals(items);
        const { advanceAmount, remainingAmount } = computeAdvance(total, Number(advancePercentage));
        const customerUid = req.customer?.uid || `guest_${phone.trim().replace(/\D/g, "") || Date.now()}`;

        let order;
        try {
          order = await Order.create({
            customer_uid: customerUid,
            customer_name: customerName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            items: resolvedItems.map((i) => ({
              product_id: i.productId,
              name: i.name,
              weight: i.weight,
              quantity: i.quantity,
              price: i.price,
            })),
            subtotal,
            delivery_charge: deliveryCharge,
            total,
            advance_paid: advanceAmount,
            advance_percentage: Number(advancePercentage),
            remaining_amount: remainingAmount,
            transaction_id: razorpay_payment_id,
            payment_reference: razorpay_order_id,
            payment_method: "razorpay",
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            advance_payment_status: "Paid",
            status: "Pending",
          });
        } catch (createErr) {
          if (createErr.code === 11000 || /E11000|duplicate key/i.test(createErr.message)) {
            const existingOrder = await findOrderByPaymentId(razorpay_payment_id);
            if (existingOrder) {
              if (!existingOrder.razorpay_signature && razorpay_signature) {
                existingOrder.razorpay_signature = razorpay_signature;
                await existingOrder.save();
              }
              const existingClientOrder = toClient(existingOrder);
              return res.json({
                verified: true,
                success: true,
                message: "Payment already verified",
                order: existingClientOrder,
              });
            }
          }
          throw createErr;
        }

        // Upsert customer profile
        await Customer.findOneAndUpdate(
          { phone: phone.trim() },
          { name: customerName.trim(), phone: phone.trim(), address: address.trim() },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        clientOrder = toClient(order);

        // Customer Notifications
        if (customerUid) {
          scheduleCustomerOrderNotification(customerUid, order._id, "order_placed");
          scheduleCustomerOrderNotification(customerUid, order._id, "payment_confirmed");
        }

        if (process.env.WHATSAPP_SEND_CUSTOMER_CONFIRMATION === "true") {
          notifyAndRecord(order._id, sendOrderConfirmation(clientOrder));
        }
        notifyAndRecord(order._id, sendPaymentConfirmedNotification(clientOrder));

        // Admin Notifications: Telegram, In-App Notification, Socket.IO, FCM, WhatsApp
        safeWaitUntil(sendAdminOrderNotificationsOnce(order._id, clientOrder, true));
      }

      return res.json({
        verified: true,
        success: true,
        message: "Payment verified successfully",
        order: clientOrder,
      });
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ verified: false, error: err.message });
    }
    console.error("[razorpay] Verify payment error:", err.message);
    res.status(500).json({ verified: false, error: "Failed to verify payment" });
  }
});

// Webhook handler — reliable fallback if the customer closes their browser tab after completing payment
router.post("/webhook", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(200).json({ status: "ignored_no_secret" });
  }

  const signature = req.headers["x-razorpay-signature"];
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : typeof req.body === "string"
    ? Buffer.from(req.body, "utf8")
    : null;

  if (!rawBody) {
    return res.status(400).json({ error: "Missing raw request body for webhook verification" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const bufA = Buffer.from(expectedSignature, "utf8");
  const bufB = Buffer.from(signature || "", "utf8");
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  let eventData;
  try {
    eventData = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON webhook payload" });
  }

  const event = eventData.event;
  if (event === "payment.captured" || event === "order.paid") {
    const paymentEntity = eventData.payload?.payment?.entity;
    const paymentId = paymentEntity?.id;
    const rzpOrderId = paymentEntity?.order_id || eventData.payload?.order?.entity?.id;

    if (!paymentId || !rzpOrderId) {
      return res.status(400).json({ error: "Missing payment or order ID in webhook payload" });
    }

    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(500).json({ error: "Razorpay instance not configured" });
    }

    let payment;
    let rzpOrder;
    try {
      payment = await razorpay.payments.fetch(paymentId);
      rzpOrder = await razorpay.orders.fetch(rzpOrderId);
    } catch (fetchErr) {
      console.error("[razorpay-webhook] Could not fetch entities from Razorpay API:", fetchErr.message);
      return res.status(400).json({ error: "Payment or order entity not found on Razorpay" });
    }

    if (!payment || !rzpOrder) {
      return res.status(400).json({ error: "Entities not found on Razorpay" });
    }

    // 1. Confirm payment status is captured
    if (payment.status !== "captured") {
      return res.status(400).json({ error: `Payment is not captured (status: ${payment.status})` });
    }

    // 2. Confirm currency is INR
    if (payment.currency && payment.currency.toUpperCase() !== "INR") {
      return res.status(400).json({ error: "Invalid payment currency" });
    }

    // 3. Confirm payment belongs to the expected Razorpay order
    if (payment.order_id !== rzpOrderId) {
      return res.status(400).json({ error: "Payment does not belong to expected Razorpay order" });
    }

    // 4. Confirm amount matches between payment and order
    if (payment.amount !== rzpOrder.amount) {
      return res.status(400).json({ error: "Payment amount does not match Razorpay order amount" });
    }

    return await withPaymentLock(payment.id, async () => {
      // 5. Check if order already exists in database
      const existingOrder = await findOrderByPaymentId(payment.id, rzpOrderId);

      if (existingOrder) {
        if (existingOrder.advance_payment_status === "Paid") {
          return res.json({ status: "already_processed", orderId: existingOrder._id });
        }
        existingOrder.advance_payment_status = "Paid";
        existingOrder.transaction_id = payment.id;
        existingOrder.razorpay_payment_id = payment.id;
        existingOrder.razorpay_order_id = rzpOrderId;
        existingOrder.payment_method = "razorpay";
        await existingOrder.save();

        const clientOrder = toClient(existingOrder);
        scheduleCustomerOrderNotification(existingOrder.customer_uid, existingOrder._id, "payment_confirmed");
        notifyAndRecord(existingOrder._id, sendPaymentConfirmedNotification(clientOrder));
        safeWaitUntil(sendAdminOrderNotificationsOnce(existingOrder._id, clientOrder, true));
        return res.json({ status: "updated_to_paid", orderId: existingOrder._id });
      }

      // 6. Dropped browser recovery: Reconstruct order if browser closed before verify-payment arrived
      if (rzpOrder.notes?.customerUid && rzpOrder.notes?.itemsSummary) {
        try {
          const itemsRaw = parseItemsSummary(rzpOrder.notes.itemsSummary);
          if (itemsRaw.length === 0) {
            return res.status(400).json({ error: "Cannot reconstruct order without items" });
          }

          const advancePct = Number(rzpOrder.notes.advancePercentage) || 25;
          const { resolvedItems, subtotal, deliveryCharge, total } = await computeOrderTotals(itemsRaw);
          const { advanceAmount, remainingAmount } = computeAdvance(total, advancePct);

          // Security check: Verify calculated advance matches the captured payment amount
          if (Math.round(advanceAmount * 100) !== payment.amount) {
            console.error("[razorpay-webhook] Price mismatch between calculated advance and captured payment");
            return res.status(400).json({ error: "Amount mismatch during order reconstruction" });
          }

          // Security check: Verify items hash matches the order notes hash
          const computedHash = hashItemsSummary(createItemsSummary(resolvedItems));
          if (rzpOrder.notes.itemsHash && rzpOrder.notes.itemsHash !== computedHash) {
            console.error("[razorpay-webhook] Items hash mismatch during order reconstruction");
            return res.status(400).json({ error: "Items integrity check failed" });
          }

          let newOrder;
          try {
            newOrder = await Order.create({
              customer_uid: rzpOrder.notes.customerUid,
              customer_name: (rzpOrder.notes.customerName || "Customer").trim(),
              phone: (rzpOrder.notes.phone || "").trim(),
              address: (rzpOrder.notes.address || "").trim(),
              items: resolvedItems.map((i) => ({
                product_id: i.productId,
                name: i.name,
                weight: i.weight,
                quantity: i.quantity,
                price: i.price,
              })),
              subtotal,
              delivery_charge: deliveryCharge,
              total,
              advance_paid: advanceAmount,
              advance_percentage: advancePct,
              remaining_amount: remainingAmount,
              transaction_id: payment.id,
              payment_reference: rzpOrderId,
              payment_method: "razorpay",
              razorpay_order_id: rzpOrderId,
              razorpay_payment_id: payment.id,
              advance_payment_status: "Paid",
              status: "Pending",
            });
          } catch (createErr) {
            if (createErr.code === 11000 || /E11000|duplicate key/i.test(createErr.message)) {
              // Already created concurrently by frontend verify-payment
              const existingOrder = await findOrderByPaymentId(payment.id);
              if (existingOrder) {
                return res.json({ status: "already_processed", orderId: existingOrder._id });
              }
            }
            throw createErr;
          }

          const clientOrder = toClient(newOrder);
          scheduleCustomerOrderNotification(rzpOrder.notes.customerUid, newOrder._id, "order_placed");
          scheduleCustomerOrderNotification(rzpOrder.notes.customerUid, newOrder._id, "payment_confirmed");
          if (process.env.WHATSAPP_SEND_CUSTOMER_CONFIRMATION === "true") {
            notifyAndRecord(newOrder._id, sendOrderConfirmation(clientOrder));
          }
          notifyAndRecord(newOrder._id, sendPaymentConfirmedNotification(clientOrder));

          // Admin Notifications: Telegram, In-App Notification, Socket.IO, FCM, WhatsApp
          safeWaitUntil(sendAdminOrderNotificationsOnce(newOrder._id, clientOrder, true));

          // Upsert customer profile
          if (rzpOrder.notes?.phone) {
            Customer.findOneAndUpdate(
              { phone: rzpOrder.notes.phone.trim() },
              {
                name: (rzpOrder.notes.customerName || "Customer").trim(),
                phone: rzpOrder.notes.phone.trim(),
                address: (rzpOrder.notes.address || "").trim(),
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            ).catch((err) => console.error("[customer] Upsert error from webhook:", err.message));
          }

          return res.json({ status: "order_created", orderId: newOrder._id });
        } catch (webhookErr) {
          console.error("[razorpay-webhook] Failed to auto-create order from webhook:", webhookErr.message);
          return res.status(500).json({ error: "Failed to process webhook order" });
        }
      }
      return res.json({ status: "ok" });
    });
  }

  res.json({ status: "ok" });
});

export default router;

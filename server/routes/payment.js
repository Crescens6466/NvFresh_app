// routes/payment.js — Razorpay Standard Web Checkout order creation and verification
import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { waitUntil } from "@vercel/functions";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Settings from "../models/Settings.js";
import Admin from "../models/Admin.js";
import Notification from "../models/Notification.js";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
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
  scheduleCustomerOrderNotification,
} from "./orders.js";
import {
  isDeliveryAreaServiceableAsync,
  getServiceableAreaErrorMessageAsync,
} from "../utils/serviceAreas.js";

const router = express.Router();

function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

function verifySignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const bufA = Buffer.from(expectedSignature, "utf8");
  const bufB = Buffer.from(signature, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/create-order (or /api/payment/create-order)
router.post("/create-order", requireCustomerAuth, async (req, res, next) => {
  try {
    const { items, advancePercentage, orderId, amount: clientAmount } = req.body;

    let payableAmountPaise;

    if (items && Array.isArray(items) && items.length > 0) {
      if (!isValidAdvancePercentage(advancePercentage)) {
        return res.status(400).json({ error: "advancePercentage must be one of 25, 50, 75, 100" });
      }
      const { total } = await computeOrderTotals(items);
      const { advanceAmount } = computeAdvance(total, Number(advancePercentage));
      payableAmountPaise = Math.round(advanceAmount * 100);

      // Validate client amount if provided to prevent frontend tampering
      if (clientAmount !== undefined && clientAmount !== null) {
        const clientNum = Number(clientAmount);
        if (clientNum !== payableAmountPaise && clientNum !== advanceAmount) {
          return res.status(400).json({ error: "Client amount does not match server-calculated advance" });
        }
      }
    } else if (orderId) {
      const existing = await Order.findById(orderId);
      if (!existing) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (existing.advance_payment_status === "Paid") {
        return res.status(400).json({ error: "Order is already paid" });
      }
      payableAmountPaise = Math.round(existing.advance_paid * 100);
    } else if (clientAmount !== undefined && clientAmount !== null) {
      payableAmountPaise = Number(clientAmount);
    } else {
      return res.status(400).json({ error: "Items or amount must be provided to create payment order" });
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

    const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const rzpOrder = await razorpay.orders.create({
      amount: payableAmountPaise,
      currency: "INR",
      receipt,
      notes: {
        customerUid: req.customer?.uid || "",
        orderId: orderId || "",
      },
    });

    res.json({
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
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
router.post("/verify-payment", requireCustomerAuth, async (req, res, next) => {
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
        error: "Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)",
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[razorpay] RAZORPAY_KEY_SECRET is not configured");
      return res.status(500).json({ error: "Payment gateway secret is not configured" });
    }

    // Cryptographic signature verification
    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret);
    if (!isValid) {
      console.warn("[razorpay] Payment signature mismatch for order:", razorpay_order_id);
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Prevent duplicate processing
    const duplicate = await Order.findOne({
      $or: [
        { transaction_id: razorpay_payment_id },
        { razorpay_payment_id: razorpay_payment_id },
      ],
    });
    if (duplicate) {
      return res.json({
        success: true,
        message: "Payment already verified",
        order: toClient(duplicate),
      });
    }

    let clientOrder;

    if (orderId) {
      const existing = await Order.findById(orderId);
      if (!existing) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (existing.advance_payment_status === "Paid") {
        return res.json({
          success: true,
          message: "Order already paid",
          order: toClient(existing),
        });
      }

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
    } else if (orderData) {
      const { customerName, phone, address, items, advancePercentage } = orderData;
      if (!customerName || !phone || !address || !items || !advancePercentage) {
        return res.status(400).json({ error: "Missing required order data for verification" });
      }
      if (!(await isDeliveryAreaServiceableAsync(address))) {
        return res.status(400).json({ error: await getServiceableAreaErrorMessageAsync() });
      }
      if (!isValidAdvancePercentage(advancePercentage)) {
        return res.status(400).json({ error: "advancePercentage must be one of 25, 50, 75, 100" });
      }

      const { resolvedItems, subtotal, deliveryCharge, total } = await computeOrderTotals(items);
      const { advanceAmount, remainingAmount } = computeAdvance(total, Number(advancePercentage));

      const order = await Order.create({
        customer_uid: req.customer.uid,
        customer_name: customerName,
        phone,
        address,
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

      // Upsert customer profile
      await Customer.findOneAndUpdate(
        { phone },
        { name: customerName, phone, address },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      clientOrder = toClient(order);

      // Notifications
      scheduleCustomerOrderNotification(req.customer.uid, order._id, "order_placed");
      scheduleCustomerOrderNotification(req.customer.uid, order._id, "payment_confirmed");

      if (process.env.WHATSAPP_SEND_CUSTOMER_CONFIRMATION === "true") {
        notifyAndRecord(order._id, sendOrderConfirmation(clientOrder));
      }
      notifyAndRecord(order._id, sendPaymentConfirmedNotification(clientOrder));

      Settings.findOne()
        .then((settings) => notifyAndRecord(order._id, sendAdminOrderAlert(clientOrder, settings?.phone_number)))
        .catch((err) => console.error("[notify] Could not load Settings for admin alert:", err.message));

      waitUntil(
        sendAdminOrderTelegramOnce(order._id, {
          id: clientOrder.id,
          total: clientOrder.total,
          customer_name: clientOrder.customer_name,
          phone: clientOrder.phone,
        })
      );

      Promise.resolve()
        .then(async () => {
          const admins = await Admin.find().select("_id").lean();
          const createdNotifications = await Notification.insertMany(
            admins.map((admin) => ({
              recipientAdmin: admin._id,
              type: "new_order",
              title: "New Order (Razorpay Paid)",
              message: `Order #${clientOrder.id} • ₹${clientOrder.total} (Advance Paid ₹${clientOrder.advance_paid})`,
              orderId: order._id,
            }))
          );
          createdNotifications.forEach((notification, index) =>
            emitAdminNotification(String(admins[index]._id), {
              id: String(notification._id),
              type: "new_order",
              title: "New Order (Razorpay Paid)",
              message: `Order #${clientOrder.id} • ₹${clientOrder.total} (Advance Paid ₹${clientOrder.advance_paid})`,
              orderId: String(order._id),
              createdAt: notification.createdAt.toISOString(),
              isRead: false,
            })
          );
        })
        .catch((err) => console.error("[admin-notifications] Could not save notification:", err.message))
        .finally(() =>
          sendAdminNewOrderNotification(clientOrder).catch((err) =>
            console.error("[fcm] Could not send admin new-order notification:", err.message)
          )
        );
    } else {
      return res.status(400).json({ error: "Either orderId or orderData must be provided" });
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      order: clientOrder,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("[razorpay] Verify payment error:", err.message);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// Optional webhook handler
router.post("/webhook", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(200).json({ status: "ignored_no_secret" });
  }

  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const event = req.body.event;
  if (event === "payment.captured" || event === "order.paid") {
    const payment = req.body.payload?.payment?.entity;
    if (payment?.order_id) {
      const order = await Order.findOne({ razorpay_order_id: payment.order_id });
      if (order && order.advance_payment_status !== "Paid") {
        order.advance_payment_status = "Paid";
        order.transaction_id = payment.id;
        order.razorpay_payment_id = payment.id;
        await order.save();
      }
    }
  }

  res.json({ status: "ok" });
});

export default router;


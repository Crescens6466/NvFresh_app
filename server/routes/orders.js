// routes/orders.js — order placement and management (MongoDB)
import express from "express";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Settings from "../models/Settings.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import { sendOrderConfirmation, sendAdminOrderAlert } from "../utils/notify.js";
import { toClient, toClientList } from "../utils/serialize.js";
import {
  computeOrderTotals,
  computeAdvance,
  isValidAdvancePercentage,
  OrderValidationError,
} from "../utils/pricing.js";
import { buildUpiUrl, generateQrDataUrl } from "../utils/upiPayment.js";

const router = express.Router();

// POST /api/orders/quote — live preview of totals + a dynamic QR for the
// selected advance %. Never writes to the database — switching between
// 25/50/75/100% just calls this again, so no draft orders ever pile up.
// Only items + advancePercentage are trusted from the client; every amount
// shown is computed here from the current product prices in the database.
router.post("/quote", requireCustomerAuth, async (req, res, next) => {
  try {
    const { items, advancePercentage } = req.body;
    if (!isValidAdvancePercentage(advancePercentage)) {
      return res.status(400).json({ error: "advancePercentage must be one of 25, 50, 75, 100" });
    }

    const { resolvedItems, subtotal, deliveryCharge, total } = await computeOrderTotals(items);
    const { advanceAmount, remainingAmount } = computeAdvance(total, Number(advancePercentage));

    const settings = await Settings.findOne();
    let qrDataUrl = null;
    let upiUrl = null;
    if (settings?.upi_id) {
      upiUrl = buildUpiUrl({
        upiId: settings.upi_id,
        businessName: settings.business_name || "NvFresh",
        amount: advanceAmount,
        note: `NvFresh advance ${advancePercentage}%`,
      });
      qrDataUrl = await generateQrDataUrl(upiUrl);
    }

    res.json({
      items: resolvedItems,
      subtotal,
      deliveryCharge,
      total,
      advancePercentage: Number(advancePercentage),
      advanceAmount,
      remainingAmount,
      upiUrl,
      qrDataUrl,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// POST /api/orders — place a new order (customer must be signed in). All
// pricing is recomputed here from the database — subtotal/total/advance are
// never trusted from the client, only which products+weights+quantities
// they want and what advance % they chose.
router.post("/", requireCustomerAuth, async (req, res, next) => {
  try {
    const { customerName, phone, address, items, advancePercentage, transactionId } = req.body;

    if (!customerName || !phone || !address || !transactionId) {
      return res.status(400).json({ error: "Missing required order fields" });
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
      transaction_id: transactionId,
      status: "Pending",
    });

    // upsert customer record
    await Customer.findOneAndUpdate(
      { phone },
      { name: customerName, phone, address },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const clientOrder = toClient(order);

    // Fire-and-forget — a notification failure should never block order placement.
    // Customer confirmations are opt-in (need their own approved template) —
    // set WHATSAPP_SEND_CUSTOMER_CONFIRMATION=true once that's set up too.
    if (process.env.WHATSAPP_SEND_CUSTOMER_CONFIRMATION === "true") {
      sendOrderConfirmation(clientOrder);
    }
    Settings.findOne()
      .then((settings) => sendAdminOrderAlert(clientOrder, settings?.phone_number))
      .catch((err) => console.error(`[notify] Could not load Settings for admin alert:`, err.message));

    res.status(201).json(clientOrder);
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/orders/mine — the signed-in customer's own order history
// (must come before the /:id route below so "mine" isn't parsed as an id)
router.get("/mine", requireCustomerAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ customer_uid: req.customer.uid }).sort({ created_at: -1 });
    res.json(toClientList(orders));
  } catch (err) {
    next(err);
  }
});

// GET /api/orders — list all orders (admin only)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ created_at: -1 });
    res.json(toClientList(orders));
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id — single order (admin only)
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(toClient(order));
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Order not found" });
    next(err);
  }
});

// PUT /api/orders/:id/status — update fulfillment status (admin only)
router.put("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["Pending", "Preparing", "Delivered", "Cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(toClient(order));
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Order not found" });
    next(err);
  }
});

// PUT /api/orders/:id/payment-status — manually verify/confirm the advance
// payment (admin only). This is the ONLY way an order's advance_payment_status
// can become "Paid" — never automatic, never customer-triggered.
router.put("/:id/payment-status", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["Pending", "Verifying", "Paid"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid payment status" });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { advance_payment_status: status }, { new: true });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(toClient(order));
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Order not found" });
    next(err);
  }
});

export default router;

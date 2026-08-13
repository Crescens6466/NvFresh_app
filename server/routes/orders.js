// routes/orders.js — order placement and management (MongoDB)
import express from "express";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Settings from "../models/Settings.js";
import { requireAuth } from "../middleware/auth.js";
import { sendOrderConfirmation, sendAdminOrderAlert } from "../utils/notify.js";
import { toClient, toClientList } from "../utils/serialize.js";

const router = express.Router();

// POST /api/orders — place a new order (public, from customer site)
router.post("/", async (req, res, next) => {
  try {
    const {
      customerName,
      phone,
      address,
      items,
      subtotal,
      deliveryCharge,
      total,
      advancePaid,
      transactionId,
    } = req.body;

    if (!customerName || !phone || !address || !items || !items.length || !transactionId) {
      return res.status(400).json({ error: "Missing required order fields" });
    }

    const order = await Order.create({
      customer_name: customerName,
      phone,
      address,
      items,
      subtotal,
      delivery_charge: deliveryCharge,
      total,
      advance_paid: advancePaid,
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

// PUT /api/orders/:id/status — update order status (admin only)
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

export default router;

// routes/customers.js — customer list & search (admin only, MongoDB)
import express from "express";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";
import { toClient } from "../utils/serialize.js";

const router = express.Router();

// GET /api/customers?search=
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    const customers = await Customer.find(query).sort({ created_at: -1 });

    const withOrderCounts = await Promise.all(
      customers.map(async (c) => {
        const ordersCount = await Order.countDocuments({ phone: c.phone });
        return { ...toClient(c), ordersCount };
      })
    );

    res.json(withOrderCounts);
  } catch (err) {
    next(err);
  }
});

export default router;

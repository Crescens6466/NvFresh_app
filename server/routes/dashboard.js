// routes/dashboard.js — aggregate stats for admin dashboard (MongoDB)
import express from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import { requireAuth } from "../middleware/auth.js";
import { toClientList } from "../utils/serialize.js";

const router = express.Router();

router.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const [totalProducts, totalOrders, totalCustomers, pendingOrders, recentOrders, totals] =
      await Promise.all([
        Product.countDocuments(),
        Order.countDocuments(),
        Customer.countDocuments(),
        Order.countDocuments({ status: "Pending" }),
        Order.find().sort({ created_at: -1 }).limit(5),
        Order.aggregate([
          {
            $group: {
              _id: null,
              revenue: { $sum: "$total" },
              // Only count advances the admin has actually verified — a
              // submitted UTR isn't confirmed money until reviewed.
              advanceCollected: {
                $sum: { $cond: [{ $eq: ["$advance_payment_status", "Paid"] }, "$advance_paid", 0] },
              },
            },
          },
        ]),
      ]);

    res.json({
      totalProducts,
      totalOrders,
      totalCustomers,
      pendingOrders,
      revenue: totals[0]?.revenue || 0,
      advanceCollected: totals[0]?.advanceCollected || 0,
      recentOrders: toClientList(recentOrders),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import express from "express";
import CustomerDeviceToken from "../models/CustomerDeviceToken.js";
import CustomerNotification from "../models/CustomerNotification.js";
import { requireCustomerAuth } from "../middleware/customerAuth.js";

const router = express.Router();

router.get("/", requireCustomerAuth, async (req, res, next) => {
  try {
    const notifications = await CustomerNotification.find({
      recipientCustomer: req.customer.uid,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(
      notifications.map(({ _id, __v, ...notification }) => ({
        ...notification,
        id: String(_id),
        orderId: String(notification.orderId),
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", requireCustomerAuth, async (req, res, next) => {
  try {
    const count = await CustomerNotification.countDocuments({
      recipientCustomer: req.customer.uid,
      isRead: false,
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.put("/read-all", requireCustomerAuth, async (req, res, next) => {
  try {
    await CustomerNotification.updateMany(
      { recipientCustomer: req.customer.uid, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/read", requireCustomerAuth, async (req, res, next) => {
  try {
    const notification = await CustomerNotification.findOneAndUpdate(
      { _id: req.params.id, recipientCustomer: req.customer.uid },
      { $set: { isRead: true } },
      { new: true }
    ).lean();
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Notification not found" });
    next(err);
  }
});

router.post("/device-token", requireCustomerAuth, async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    if (typeof token !== "string" || token.trim().length < 20) {
      return res.status(400).json({ error: "A valid device token is required" });
    }
    if (!["web", "android"].includes(platform)) {
      return res.status(400).json({ error: "platform must be web or android" });
    }

    const now = new Date();
    try {
      await CustomerDeviceToken.findOneAndUpdate(
        { token: token.trim(), customerUid: req.customer.uid },
        {
          $set: { platform, updatedAt: now },
          $setOnInsert: {
            customerUid: req.customer.uid,
            createdAt: now,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: "Device token is already registered to another customer" });
      }
      throw err;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/device-token", requireCustomerAuth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ error: "A valid device token is required" });
    }
    await CustomerDeviceToken.deleteOne({
      customerUid: req.customer.uid,
      token: token.trim(),
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

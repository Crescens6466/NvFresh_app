import express from "express";
import Admin from "../models/Admin.js";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipientAdmin: req.admin.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(
      notifications.map(({ _id, __v, ...notification }) => ({
        ...notification,
        id: String(_id),
        orderId: notification.orderId ? String(notification.orderId) : null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipientAdmin: req.admin.id,
      isRead: false,
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.put("/read-all", requireAuth, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientAdmin: req.admin.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientAdmin: req.admin.id },
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

router.post("/fcm-token", requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || token.trim().length < 20) {
      return res.status(400).json({ error: "A valid FCM token is required" });
    }

    const normalizedToken = token.trim();
    await Admin.updateMany(
      { _id: { $ne: req.admin.id } },
      { $pull: { fcm_tokens: { token: normalizedToken } } }
    );
    await Admin.findByIdAndUpdate(req.admin.id, {
      $pull: { fcm_tokens: { token: normalizedToken } },
    });
    await Admin.findByIdAndUpdate(req.admin.id, {
      $push: {
        fcm_tokens: {
          token: normalizedToken,
          created_at: new Date(),
          updated_at: new Date(),
        },
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/fcm-token", requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ error: "A valid FCM token is required" });
    }
    await Admin.findByIdAndUpdate(req.admin.id, {
      $pull: { fcm_tokens: { token: token.trim() } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

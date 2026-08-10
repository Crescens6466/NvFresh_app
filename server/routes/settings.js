// routes/settings.js — business settings (MongoDB, singleton document)
import express from "express";
import Settings from "../models/Settings.js";
import { requireAuth } from "../middleware/auth.js";
import { toClient } from "../utils/serialize.js";

const router = express.Router();

async function getOrCreateSettings() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
}

// GET /api/settings — public, used by customer payment page
router.get("/", async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(toClient(settings));
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings — admin only
router.put("/", requireAuth, async (req, res, next) => {
  try {
    const { businessName, phoneNumber, upiId, qrImage } = req.body;
    const existing = await getOrCreateSettings();

    if (businessName !== undefined) existing.business_name = businessName;
    if (phoneNumber !== undefined) existing.phone_number = phoneNumber;
    if (upiId !== undefined) existing.upi_id = upiId;
    if (qrImage !== undefined) existing.qr_image = qrImage;

    await existing.save();
    res.json(toClient(existing));
  } catch (err) {
    next(err);
  }
});

export default router;

// routes/settings.js — business settings (MongoDB, singleton document)
import express from "express";
import Settings from "../models/Settings.js";
import { requireAuth } from "../middleware/auth.js";
import { toClient } from "../utils/serialize.js";

const router = express.Router();

export const DEFAULT_SETTINGS = {
  business_name: "NvFresh",
  phone_number: "+91 98765 43210",
  upi_id: "nvfresh@upi",
  qr_image: null,
  delivery_charge: 0,
  support_email: "support@nvfresh.in",
  business_address: "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India",
  support_hours: "Everyday, 7:00 AM – 9:00 PM",
  delivery_schedule: "Orders confirmed Saturday, delivered fresh every Sunday morning",
};

export function formatSettingsResponse(doc) {
  const data = toClient(doc);
  // Ensure fallbacks for any missing fields (e.g. from existing DB documents)
  data.business_name = data.business_name || DEFAULT_SETTINGS.business_name;
  data.phone_number = data.phone_number || DEFAULT_SETTINGS.phone_number;
  data.upi_id = data.upi_id || DEFAULT_SETTINGS.upi_id;
  data.support_email = data.support_email || DEFAULT_SETTINGS.support_email;
  data.business_address = data.business_address || DEFAULT_SETTINGS.business_address;
  data.support_hours = data.support_hours || DEFAULT_SETTINGS.support_hours;
  data.delivery_schedule = data.delivery_schedule || DEFAULT_SETTINGS.delivery_schedule;
  if (data.delivery_charge == null) data.delivery_charge = 0;

  // Add camelCase aliases for convenience
  data.businessName = data.business_name;
  data.phoneNumber = data.phone_number;
  data.upiId = data.upi_id;
  data.qrImage = data.qr_image;
  data.deliveryCharge = data.delivery_charge;
  data.supportEmail = data.support_email;
  data.businessAddress = data.business_address;
  data.supportHours = data.support_hours;
  data.deliverySchedule = data.delivery_schedule;

  return data;
}

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

async function getOrCreateSettings() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
}

// GET /api/settings — public, used by customer payment page & contact page
router.get("/", async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(formatSettingsResponse(settings));
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings — admin only
router.put("/", requireAuth, async (req, res, next) => {
  try {
    const businessName = req.body.businessName ?? req.body.business_name;
    const phoneNumber = req.body.phoneNumber ?? req.body.phone_number;
    const upiId = req.body.upiId ?? req.body.upi_id;
    const qrImage = req.body.qrImage ?? req.body.qr_image;
    const deliveryCharge = req.body.deliveryCharge ?? req.body.delivery_charge;
    const supportEmail = req.body.supportEmail ?? req.body.support_email;
    const businessAddress = req.body.businessAddress ?? req.body.business_address;
    const supportHours = req.body.supportHours ?? req.body.support_hours;
    const deliverySchedule =
      req.body.deliverySchedule ??
      req.body.delivery_schedule ??
      req.body.deliveryDay ??
      req.body.delivery_day;

    const existing = await getOrCreateSettings();

    if (businessName !== undefined) existing.business_name = String(businessName).trim();
    if (phoneNumber !== undefined) existing.phone_number = String(phoneNumber).trim();
    if (upiId !== undefined) existing.upi_id = String(upiId).trim();
    if (qrImage !== undefined) existing.qr_image = qrImage;

    if (deliveryCharge !== undefined) {
      const charge = Number(deliveryCharge);
      if (!Number.isFinite(charge) || charge < 0) {
        return res.status(400).json({ error: "Delivery charge must be a non-negative number" });
      }
      existing.delivery_charge = charge;
    }

    if (supportEmail !== undefined) {
      const email = String(supportEmail).trim();
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid support email address" });
      }
      existing.support_email = email;
    }

    if (businessAddress !== undefined) {
      existing.business_address = String(businessAddress).trim();
    }

    if (supportHours !== undefined) {
      existing.support_hours = String(supportHours).trim();
    }

    if (deliverySchedule !== undefined) {
      existing.delivery_schedule = String(deliverySchedule).trim();
    }

    await existing.save();
    res.json(formatSettingsResponse(existing));
  } catch (err) {
    next(err);
  }
});

export default router;

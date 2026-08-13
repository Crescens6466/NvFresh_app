// routes/customerAuth.js — customer phone/OTP login, delivered via WhatsApp
// instead of SMS (avoids Firebase's paid-billing requirement for phone
// auth). Google sign-in stays on Firebase directly from the client — this
// only handles the phone path. Issues its own session JWT on success,
// which middleware/customerAuth.js accepts alongside Firebase ID tokens.
import express from "express";
import jwt from "jsonwebtoken";
import PhoneOtp from "../models/PhoneOtp.js";
import { sendOtpWhatsApp } from "../utils/notify.js";

const router = express.Router();

export const CUSTOMER_JWT_SECRET =
  process.env.CUSTOMER_JWT_SECRET || "nvfresh_customer_dev_secret_change_in_production";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeDigits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/customer-auth/send-otp
router.post("/send-otp", async (req, res, next) => {
  try {
    const digits = normalizeDigits(req.body.phone);
    if (digits.length !== 10) {
      return res.status(400).json({ error: "Enter a valid 10-digit mobile number" });
    }

    const recent = await PhoneOtp.findOne({ phone: digits }).sort({ created_at: -1 });
    if (recent && Date.now() - recent.created_at.getTime() < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: "Please wait a moment before requesting another OTP" });
    }

    const code = generateCode();

    try {
      await sendOtpWhatsApp(digits, code);
    } catch (err) {
      console.error(`[customerAuth] Could not send OTP to ${digits}:`, err.message);
      return res.status(503).json({ error: "Could not send OTP right now — please try again shortly" });
    }

    await PhoneOtp.create({ phone: digits, code, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-auth/verify-otp
router.post("/verify-otp", async (req, res, next) => {
  try {
    const digits = normalizeDigits(req.body.phone);
    const code = String(req.body.code || "").trim();
    if (digits.length !== 10 || !code) {
      return res.status(400).json({ error: "Phone and OTP are required" });
    }

    const otpDoc = await PhoneOtp.findOne({ phone: digits }).sort({ created_at: -1 });
    if (!otpDoc || otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ error: "OTP expired — request a new one" });
    }
    if (otpDoc.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Too many incorrect attempts — request a new OTP" });
    }
    if (otpDoc.code !== code) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    await PhoneOtp.deleteOne({ _id: otpDoc._id });

    const uid = `phone:${digits}`;
    const token = jwt.sign({ uid, phone: digits }, CUSTOMER_JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, uid, phone: digits });
  } catch (err) {
    next(err);
  }
});

export default router;

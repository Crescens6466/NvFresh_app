// routes/customerAuth.js — customer phone/OTP login, delivered via SMS
// through SMSGate (an Android phone + SIM acting as an SMS gateway — not
// Firebase Phone Auth, which needs paid Blaze billing; not a DLT-registered
// SMS provider like MSG91, which needs GST/Udyam; not WhatsApp — Meta
// requires an Authentication-category template for OTP content, which isn't
// available on this WABA). Google sign-in stays on Firebase directly from
// the client — this only handles the phone path. Issues its own session
// JWT on success, which middleware/customerAuth.js accepts alongside
// Firebase ID tokens.
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import PhoneOtp from "../models/PhoneOtp.js";
import { bumpRateLimit } from "../models/OtpRateLimit.js";
import { sendOtpSms } from "../utils/smsgate.js";

const router = express.Router();

export const CUSTOMER_JWT_SECRET =
  process.env.CUSTOMER_JWT_SECRET || "nvfresh_customer_dev_secret_change_in_production";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_PER_PHONE_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 15;

function normalizeDigits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function generateCode() {
  // Cryptographically secure — Math.random() is not suitable for OTPs.
  return String(crypto.randomInt(100000, 1000000));
}

// OTPs are never stored in plaintext — only this HMAC digest. Keyed by the
// same secret that signs session JWTs, so no extra env var is needed; the
// phone number is mixed into the input so a hash can't be replayed against
// a different number.
function hashOtp(phone, code) {
  return crypto.createHmac("sha256", CUSTOMER_JWT_SECRET).update(`${phone}:${code}`).digest("hex");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function clientIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0].trim() || "unknown";
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

    // Mongo-backed rate limiting (not in-memory) so it holds up across
    // Vercel's stateless serverless invocations. Bumped before generating
    // the code so retry storms still count against the quota even if
    // delivery itself later fails.
    const [phoneHits, ipHits] = await Promise.all([
      bumpRateLimit(`otp:phone:${digits}`),
      bumpRateLimit(`otp:ip:${clientIp(req)}`),
    ]);
    if (phoneHits > MAX_PER_PHONE_PER_HOUR) {
      return res.status(429).json({ error: "Too many OTP requests for this number — try again later" });
    }
    if (ipHits > MAX_PER_IP_PER_HOUR) {
      return res.status(429).json({ error: "Too many OTP requests — try again later" });
    }

    const code = generateCode();

    // SMS_ENABLED=false lets the app run (e.g. local dev) without real
    // SMSGate credentials. The OTP is still generated/hashed/stored
    // normally — only delivery is skipped, and only the server log sees the
    // code, never the API response.
    if (process.env.SMS_ENABLED === "false") {
      console.log(`[customerAuth] SMS disabled — OTP for ${digits} is ${code} (dev mode only)`);
    } else {
      try {
        await sendOtpSms(digits, code);
      } catch (err) {
        console.error(`[customerAuth] Could not send OTP to ${digits}:`, err.message);
        return res.status(503).json({ error: "Could not send OTP right now — please try again shortly" });
      }
    }

    await PhoneOtp.create({
      phone: digits,
      code: hashOtp(digits, code),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });
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
    if (!safeEqual(otpDoc.code, hashOtp(digits, code))) {
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

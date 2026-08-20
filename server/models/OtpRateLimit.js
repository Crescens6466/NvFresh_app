// models/OtpRateLimit.js — Vercel-safe (Mongo-backed, no in-memory counters)
// rate limiting for OTP requests. One doc per rate-limit key (a phone number
// or a client IP), auto-expiring after WINDOW_MS so the hourly window resets
// itself via the TTL index rather than needing a cron/cleanup job.
import mongoose from "mongoose";

const otpRateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

otpRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OtpRateLimit = mongoose.model("OtpRateLimit", otpRateLimitSchema);

const WINDOW_MS = 60 * 60 * 1000;

// Atomically increments the hit count for `key` within the current window
// (creating a fresh window if none is active) and returns the new count.
export async function bumpRateLimit(key) {
  const doc = await OtpRateLimit.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(Date.now() + WINDOW_MS) },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.count;
}

export default OtpRateLimit;

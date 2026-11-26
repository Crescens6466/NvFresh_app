// models/LocationRateLimit.js — Vercel-safe (Mongo-backed, no in-memory counters)
// rate limiting for geocoding and location validation requests.
// Auto-expiring via TTL index so rate limit windows reset automatically.
import mongoose from "mongoose";

const locationRateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

locationRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LocationRateLimit = mongoose.model("LocationRateLimit", locationRateLimitSchema);

/**
 * Atomically increments hit count for `key` within `windowMs` and returns current count.
 * Handles duplicate key races (E11000) and connection edge cases safely.
 */
export async function bumpLocationRateLimit(key, windowMs = 60 * 1000) {
  if (mongoose.connection.readyState !== 1) {
    // If Mongo is not connected, fail open to avoid crashing requests
    return 1;
  }

  try {
    const doc = await LocationRateLimit.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(Date.now() + windowMs) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc?.count || 1;
  } catch (err) {
    if (err.code === 11000) {
      // Race condition during upsert insert: another invocation inserted first, so increment existing doc
      try {
        const retryDoc = await LocationRateLimit.findOneAndUpdate(
          { key },
          { $inc: { count: 1 } },
          { new: true }
        );
        return retryDoc?.count || 1;
      } catch (retryErr) {
        console.warn("[locationRateLimit] Retry increment failed:", retryErr.message);
        return 1;
      }
    }
    console.warn("[locationRateLimit] Error bumping rate limit:", err.message);
    return 1;
  }
}

export default LocationRateLimit;

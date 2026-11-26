// middleware/locationRateLimit.js — Vercel-safe throttling for location geocoding & verification
import jwt from "jsonwebtoken";
import { bumpLocationRateLimit } from "../models/LocationRateLimit.js";
import { optionalCustomerAuth } from "./customerAuth.js";
import { JWT_SECRET } from "./auth.js";

function getClientIp(req) {
  // Allow test suites to simulate distinct client IPs
  if (process.env.NODE_ENV === "test" && req.headers["x-test-ip"]) {
    return String(req.headers["x-test-ip"]).trim();
  }
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0].trim() || "unknown";
}

// Limits per role:
// Guests (unauthenticated): 25 requests / min, 80 requests / hr per IP
// Authenticated Customers: 40 requests / min, 150 requests / hr per customer
// Admin: 60 requests / min, 300 requests / hr per admin
const LIMITS = {
  guest: { min: 25, hr: 80 },
  customer: { min: 40, hr: 150 },
  admin: { min: 60, hr: 300 },
};

/**
 * Middleware that throttles location validation and geocoding requests across serverless instances.
 * Rate limit counters are stored in MongoDB with auto-expiring TTL indexes.
 */
export const throttleLocationRequests = [
  optionalCustomerAuth,
  async (req, res, next) => {
    try {
      // Also inspect if token belongs to an admin
      if (!req.customer && req.headers.authorization?.startsWith("Bearer ")) {
        try {
          const token = req.headers.authorization.split(" ")[1];
          const adminDecoded = jwt.verify(token, JWT_SECRET);
          if (adminDecoded) {
            req.admin = adminDecoded;
          }
        } catch {
          // Not an admin token
        }
      }

      const ip = getClientIp(req);
      let role = "guest";
      let identifier = ip;

      if (req.admin?.id || req.admin?.email) {
        role = "admin";
        identifier = req.admin.id || req.admin.email;
      } else if (req.customer?.uid || req.customer?.phone) {
        role = "customer";
        identifier = req.customer.uid || req.customer.phone;
      }

      const minKey = `loc:${role}:min:${identifier}`;
      const hrKey = `loc:${role}:hr:${identifier}`;

      const { min: maxMin, hr: maxHr } = LIMITS[role];

      const [minHits, hrHits] = await Promise.all([
        bumpLocationRateLimit(minKey, 60 * 1000),
        bumpLocationRateLimit(hrKey, 60 * 60 * 1000),
      ]);

      if (minHits > maxMin || hrHits > maxHr) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({
          error: "Too many location verification requests. Please wait a moment before trying again.",
          serviceable: false,
          valid: false,
          retryAfter: 60,
        });
      }

      next();
    } catch (err) {
      console.warn("[locationRateLimit] Throttler error, failing open to preserve availability:", err.message);
      next();
    }
  },
];

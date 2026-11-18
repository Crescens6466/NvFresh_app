// middleware/customerAuth.js — accepts either a Firebase ID token (Google
// sign-in) or our own phone-OTP session JWT (issued by routes/customerAuth.js
// after WhatsApp OTP verification). Two independent identity sources feed
// into the same req.customer shape.
import jwt from "jsonwebtoken";
import { verifyFirebaseIdToken } from "../firebaseTokenVerify.js";
import { CUSTOMER_JWT_SECRET } from "../routes/customerAuth.js";

export async function requireCustomerAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not signed in" });
  }
  const token = header.split(" ")[1];

  // Try our own phone-OTP session token first — it's a cheap local check,
  // vs. Firebase verification which fetches/caches Google's public certs.
  try {
    const decoded = jwt.verify(token, CUSTOMER_JWT_SECRET);
    req.customer = {
      uid: decoded.uid,
      phone: decoded.phone,
      email: null,
      name: null,
      authProvider: "phone",
      tokenIssuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
    };
    return next();
  } catch {
    // Not one of ours — fall through and try it as a Firebase ID token.
  }

  try {
    const verified = await verifyFirebaseIdToken(token);
    req.customer = {
      ...verified,
      authProvider: "firebase",
    };
    next();
  } catch (err) {
    console.error("[customerAuth] Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

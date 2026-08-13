// middleware/customerAuth.js — verifies a Firebase ID token from the
// customer app (separate from admin's JWT-based requireAuth in auth.js).
import { getFirebaseAuth } from "../firebaseAdmin.js";

export async function requireCustomerAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not signed in" });
  }
  const idToken = header.split(" ")[1];
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    req.customer = {
      uid: decoded.uid,
      phone: decoded.phone_number || null,
      email: decoded.email || null,
      name: decoded.name || null,
    };
    next();
  } catch (err) {
    console.error("[customerAuth] Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

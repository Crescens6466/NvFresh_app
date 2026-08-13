// firebaseTokenVerify.js — verifies Firebase Authentication ID tokens
// without the firebase-admin SDK. firebase-admin is a large package with
// dependencies (gRPC, protobuf, etc.) that don't bundle reliably in
// serverless environments like Vercel — this does the same signature/claims
// check directly using the `jsonwebtoken` package already used for admin
// auth, verified against Google's public signing certs. Only Firebase's
// PROJECT ID is needed (already public, baked into the client config) —
// no service account private key required on the backend at all.
import jwt from "jsonwebtoken";

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const ISSUER_PREFIX = "https://securetoken.google.com/";
const DEFAULT_CACHE_MS = 60 * 60 * 1000; // 1 hour, if Google's response omits max-age

let certsCache = null;
let certsCacheExpiry = 0;

async function getCerts() {
  if (certsCache && Date.now() < certsCacheExpiry) return certsCache;

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certs: HTTP ${res.status}`);
  }
  const certs = await res.json();

  const maxAgeMatch = (res.headers.get("cache-control") || "").match(/max-age=(\d+)/);
  const cacheMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : DEFAULT_CACHE_MS;

  certsCache = certs;
  certsCacheExpiry = Date.now() + cacheMs;
  return certs;
}

export async function verifyFirebaseIdToken(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "FIREBASE_PROJECT_ID is not set. Add it to server/.env (same value as " +
        "VITE_FIREBASE_PROJECT_ID in customer/.env)."
    );
  }

  const decodedHeader = jwt.decode(idToken, { complete: true });
  const kid = decodedHeader?.header?.kid;
  if (!kid) {
    throw new Error("Malformed token: missing key id");
  }

  const certs = await getCerts();
  const cert = certs[kid];
  if (!cert) {
    throw new Error("Malformed token: unknown signing key");
  }

  const payload = jwt.verify(idToken, cert, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `${ISSUER_PREFIX}${projectId}`,
  });

  if (!payload.sub) {
    throw new Error("Malformed token: missing subject");
  }

  return {
    uid: payload.sub,
    phone: payload.phone_number || null,
    email: payload.email || null,
    name: payload.name || null,
  };
}

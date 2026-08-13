// firebaseAdmin.js — lazy-initialized Firebase Admin SDK, used to verify
// customer ID tokens issued by the customer app's Firebase Authentication.
//
// Uses the modular firebase-admin/app + firebase-admin/auth imports rather
// than the legacy `import admin from "firebase-admin"` default export —
// under this project's ESM setup, the default import's `.apps` array comes
// back undefined (a known firebase-admin/ESM interop quirk), which crashes
// every token verification with "Cannot read properties of undefined
// (reading 'length')" instead of actually checking the token.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let authInstance = null;

export function getFirebaseAuth() {
  if (!authInstance) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is not set. Paste the full service account JSON " +
          "(Firebase Console > Project settings > Service accounts > Generate new " +
          "private key) as a single-line string into server/.env."
      );
    }
    const serviceAccount = JSON.parse(raw);
    const app = getApps().length === 0 ? initializeApp({ credential: cert(serviceAccount) }) : getApps()[0];
    authInstance = getAuth(app);
  }
  return authInstance;
}

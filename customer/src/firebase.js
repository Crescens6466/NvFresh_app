// firebase.js — Firebase client SDK setup for customer login (phone/OTP + Google).
// Config comes from VITE_FIREBASE_* env vars — see customer/.env.example.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// CustomerAuthProvider wraps the entire app, so a missing/invalid config here
// must never crash browsing — it should just leave login/checkout disabled
// (with a clear error when actually attempted) until VITE_FIREBASE_* is set.
let appInstance = null;
let authInstance = null;
if (isFirebaseConfigured) {
  try {
    appInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
  } catch (err) {
    console.error("Firebase failed to initialize:", err.message);
  }
} else {
  console.warn(
    "Firebase is not configured (VITE_FIREBASE_* env vars missing) — customer " +
      "login, checkout, and order history are disabled until they're set."
  );
}

export const auth = authInstance;
export const app = appInstance;
export { firebaseConfig };
export const googleProvider = new GoogleAuthProvider();

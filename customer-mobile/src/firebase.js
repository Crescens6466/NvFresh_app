// firebase.js — Firebase client SDK setup for customer login (Google), ported
// from customer/src/firebase.js. Uses the SAME Firebase project as the
// website (same EXPO_PUBLIC_FIREBASE_PROJECT_ID the backend already trusts
// in server/firebaseTokenVerify.js), so no backend change is needed.
//
// initializeAuth + getReactNativePersistence (instead of getAuth) persists
// the signed-in session across app restarts via AsyncStorage — Metro resolves
// "firebase/auth" to its React Native build automatically, which is where
// getReactNativePersistence lives.
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, GoogleAuthProvider } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCbpY8Pl4To2Jc1xaECOJBUtuD3p2cjLMk",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "nvfresh-da6d8.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "nvfresh-da6d8",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "nvfresh-da6d8.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "725533349098",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:725533349098:web:d536197e176c00a160f393",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// CustomerAuthProvider wraps the entire app, so a missing/invalid config here
// must never crash browsing — it should just leave Google sign-in disabled
// (with a clear error when actually attempted) until EXPO_PUBLIC_FIREBASE_* is set.
let authInstance = null;
if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (err) {
    console.error("Firebase failed to initialize:", err.message);
  }
} else {
  console.warn(
    "Firebase is not configured (EXPO_PUBLIC_FIREBASE_* env vars missing) — " +
      "Google sign-in is disabled until they're set. Phone/OTP login still works."
  );
}

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();

// CustomerAuthContext.jsx — ported from
// customer/src/context/CustomerAuthContext.jsx. Same public API (user,
// profile, isLoggedIn, loading, loginWithGoogle, sendOtp, verifyOtp, logout,
// getIdToken).
//
// Phone/OTP is a direct port (same api.js calls, same session shape) — only
// Google sign-in differs: the web app uses Firebase's signInWithPopup, which
// has no native equivalent. Here, expo-auth-session runs the native Google
// OAuth flow to get a Google ID token, then Firebase's signInWithCredential
// exchanges it for a Firebase user — producing the exact same kind of
// Firebase ID token that server/firebaseTokenVerify.js already accepts from
// the website, so the backend needs no changes.
import React, { createContext, useContext, useEffect, useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, isFirebaseConfigured } from "../firebase.js";
import { api } from "../api.js";

WebBrowser.maybeCompleteAuthSession();

const CustomerAuthContext = createContext(null);

// Phone sign-in doesn't use Firebase at all (avoids its paid-billing
// requirement for SMS) — the backend sends an OTP via SMS (SMSGate) and,
// once verified, issues its own session token. That session lives here,
// independent of Firebase's onAuthStateChanged (which only tracks Google).
const PHONE_SESSION_KEY = "nvfresh_phone_session";

export function CustomerAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [phoneSession, setPhoneSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // expo-auth-session's Google provider throws synchronously (during render,
  // from inside its own useMemo) whenever the client ID for the current
  // platform isn't set — e.g. `androidClientId` on Android. That would crash
  // the whole app on mount since this hook can't be called conditionally, so
  // instead we always call it and catch that specific "not configured" case,
  // matching the isFirebaseConfigured degrade-gracefully pattern below.
  // EXPO_PUBLIC_* env vars are static per bundle, so which branch is taken
  // stays consistent across renders — safe for the Rules of Hooks.
  let googleRequest = null;
  let promptGoogleAsync = null;
  try {
    const [request, , promptAsync] = Google.useIdTokenAuthRequest({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    });
    googleRequest = request;
    promptGoogleAsync = promptAsync;
  } catch (err) {
    console.warn(
      "Google sign-in isn't configured for this platform yet " +
        "(missing EXPO_PUBLIC_GOOGLE_*_CLIENT_ID) — Google sign-in is disabled until it's set. Phone/OTP login still works.",
      err?.message
    );
  }

  useEffect(() => {
    AsyncStorage.getItem(PHONE_SESSION_KEY)
      .then((raw) => {
        if (raw) setPhoneSession(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // auth is null when Firebase isn't configured (see firebase.js) — treat
    // that as "no Google session" rather than crashing; phone login is
    // independent of this anyway.
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function loginWithGoogle() {
    if (!auth || !isFirebaseConfigured) {
      throw new Error("Google sign-in isn't set up yet — please check back soon.");
    }
    if (!promptGoogleAsync) {
      throw new Error("Google sign-in isn't set up yet — please check back soon.");
    }
    if (!googleRequest) {
      throw new Error("Google sign-in is still loading — try again in a moment.");
    }
    const result = await promptGoogleAsync();
    if (result?.type !== "success" || !result.params?.id_token) {
      if (result?.type === "cancel" || result?.type === "dismiss") {
        throw new Error("Sign-in was cancelled");
      }
      throw new Error("Google sign-in failed");
    }
    const credential = GoogleAuthProvider.credential(result.params.id_token);
    await signInWithCredential(auth, credential);
  }

  async function sendOtp(phone) {
    await api.sendPhoneOtp(phone);
  }

  async function verifyOtp(phone, code) {
    const { token, phone: verifiedPhone } = await api.verifyPhoneOtp(phone, code);
    const session = { token, phone: verifiedPhone };
    await AsyncStorage.setItem(PHONE_SESSION_KEY, JSON.stringify(session));
    setPhoneSession(session);
  }

  async function logout() {
    if (phoneSession) {
      await AsyncStorage.removeItem(PHONE_SESSION_KEY);
      setPhoneSession(null);
    }
    if (auth && firebaseUser) {
      await signOut(auth);
    }
  }

  async function getIdToken() {
    // Phone session takes precedence if both somehow exist — it's the more
    // recently established one in that edge case.
    if (phoneSession) return phoneSession.token;
    if (auth?.currentUser) return auth.currentUser.getIdToken();
    return null;
  }

  const isLoggedIn = !!firebaseUser || !!phoneSession;
  const profile = firebaseUser
    ? { name: firebaseUser.displayName || "", phone: firebaseUser.phoneNumber || "", email: firebaseUser.email || "" }
    : phoneSession
      ? { name: "", phone: phoneSession.phone, email: "" }
      : null;

  return (
    <CustomerAuthContext.Provider
      value={{
        user: firebaseUser,
        profile,
        isLoggedIn,
        loading,
        loginWithGoogle,
        sendOtp,
        verifyOtp,
        logout,
        getIdToken,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}

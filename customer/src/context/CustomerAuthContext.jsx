import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase.js";

const CustomerAuthContext = createContext(null);

const NOT_CONFIGURED_ERROR = "Sign-in isn't set up yet — please check back soon.";

function ensureAuth() {
  if (!auth) throw new Error(NOT_CONFIGURED_ERROR);
}

export function CustomerAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // auth is null when Firebase isn't configured (see firebase.js) — treat
    // that as "no one is logged in" rather than crashing the whole app.
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function loginWithGoogle() {
    ensureAuth();
    await signInWithPopup(auth, googleProvider);
  }

  // containerId must be an already-mounted DOM element (an invisible div in
  // Login.jsx) — Firebase renders its reCAPTCHA challenge into it.
  function getRecaptchaVerifier(containerId) {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    }
    return window.recaptchaVerifier;
  }

  async function sendOtp(phoneNumber, containerId) {
    ensureAuth();
    const verifier = getRecaptchaVerifier(containerId);
    // Firebase requires E.164 format (e.g. +919876543210) — assume a bare
    // 10-digit number is an Indian mobile, same convention as the backend's
    // WhatsApp phone normalization.
    const digits = phoneNumber.replace(/\D/g, "");
    const formatted = phoneNumber.trim().startsWith("+")
      ? phoneNumber.trim()
      : `+91${digits}`;
    return signInWithPhoneNumber(auth, formatted, verifier);
  }

  async function verifyOtp(confirmationResult, code) {
    await confirmationResult.confirm(code);
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
  }

  async function getIdToken() {
    if (!auth?.currentUser) return null;
    return auth.currentUser.getIdToken();
  }

  // Phone sign-in gives a verified phoneNumber; Google gives displayName/email
  // but never a phone. Either way this is just for pre-filling the checkout
  // form — still fully editable there.
  const profile = user
    ? {
        name: user.displayName || "",
        phone: user.phoneNumber || "",
        email: user.email || "",
      }
    : null;

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        profile,
        isLoggedIn: !!user,
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

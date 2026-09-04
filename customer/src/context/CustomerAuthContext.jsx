import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase.js";
import { api } from "../api.js";
import { retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from "../services/msg91Otp.js";

const CustomerAuthContext = createContext(null);

// Phone sign-in doesn't use Firebase. The website uses MSG91's Custom UI SDK,
// then exchanges its verified access token for the same NvFresh session JWT
// used by the legacy mobile SMSGate flow.
const PHONE_SESSION_KEY = "nvfresh_phone_session";

function loadPhoneSession() {
  try {
    const raw = window.localStorage.getItem(PHONE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [phoneSession, setPhoneSession] = useState(loadPhoneSession);
  const [loading, setLoading] = useState(true);

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
    if (!auth) throw new Error("Google sign-in isn't set up yet — please check back soon.");
    await signInWithPopup(auth, googleProvider);
  }

  async function sendOtp(phone) {
    await sendMsg91Otp(phone);
  }

  async function retryOtp() {
    await retryMsg91Otp();
  }

  async function verifyOtp(phone, code) {
    // The server verifies the MSG91 access token before issuing this JWT; the
    // supplied phone is intentionally not trusted for the session identity.
    const msg91AccessToken = await verifyMsg91Otp(code);
    const { token, phone: verifiedPhone } = await api.exchangeMsg91AccessToken(msg91AccessToken);
    const session = { token, phone: verifiedPhone };
    window.localStorage.setItem(PHONE_SESSION_KEY, JSON.stringify(session));
    setPhoneSession(session);
  }

  async function logout() {
    if (phoneSession) {
      window.localStorage.removeItem(PHONE_SESSION_KEY);
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
        retryOtp,
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

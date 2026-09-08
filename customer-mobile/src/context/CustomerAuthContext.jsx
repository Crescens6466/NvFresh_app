// CustomerAuthContext.jsx — ported from
// customer/src/context/CustomerAuthContext.jsx. Same public API (user,
// profile, isLoggedIn, loading, loginWithGoogle, sendOtp, verifyOtp, logout,
// getIdToken).
//
// Phone/OTP is a direct port (same api.js calls, same session shape) — only
// Google sign-in differs: the native Google Sign-In library obtains a Google
// ID token, then Firebase's signInWithCredential exchanges it for a Firebase
// user. This produces the same Firebase ID token that
// server/firebaseTokenVerify.js already accepts from the website.
import React, { createContext, useContext, useEffect, useState } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, isFirebaseConfigured } from "../firebase.js";
import { api } from "../api.js";
import { sendMsg91Otp, retryMsg91Otp, verifyMsg91Otp } from "../services/msg91Otp.js";

const CustomerAuthContext = createContext(null);
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

GoogleSignin.configure({
  webClientId: googleWebClientId,
});

// Phone sign-in doesn't use Firebase at all (avoids its paid-billing
// requirement for SMS) — the backend sends an OTP via SMS (SMSGate) and,
// once verified, issues its own session token. That session lives here,
// independent of Firebase's onAuthStateChanged (which only tracks Google).
const PHONE_SESSION_KEY = "nvfresh_phone_session";

export function CustomerAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [phoneSession, setPhoneSession] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (!googleWebClientId) {
      throw new Error("Google sign-in isn't set up yet — please check back soon.");
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result?.type !== "success" || !result.data?.idToken) {
      if (result?.type === "cancelled") {
        throw new Error("Sign-in was cancelled");
      }
      throw new Error("Google sign-in failed");
    }
    const credential = GoogleAuthProvider.credential(result.data.idToken);
    await signInWithCredential(auth, credential);
  }

  async function sendOtp(phone) {
    await sendMsg91Otp(phone);
  }

  async function retryOtp() {
    await retryMsg91Otp();
  }

  async function verifyOtp(phone, code) {
    const accessToken = await verifyMsg91Otp(code);
    const { token, phone: verifiedPhone } = await api.exchangeMsg91AccessToken(accessToken);
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

import React, { createContext, useContext, useState } from "react";

const CustomerAuthContext = createContext(null);
const STORAGE_KEY = "nvfresh_customer_profile";

// No password/OTP — this just remembers name/phone/address on this device so
// returning customers skip re-typing them at checkout. Guests who never log
// in keep working exactly as before (Payment.jsx's fields just start blank).
function loadProfile() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }) {
  const [profile, setProfile] = useState(loadProfile);

  function login({ name, phone, address }) {
    const next = { name, phone, address: address || "" };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProfile(next);
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
  }

  return (
    <CustomerAuthContext.Provider value={{ profile, isLoggedIn: !!profile, login, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}

import React, { createContext, useContext, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "nvfresh_admin_token";
const USER_KEY = "nvfresh_admin_username";

// Fallback offline credentials — used only if the real API call fails (e.g.
// the backend isn't deployed/reachable yet). This just gets you past the
// login screen; pages that fetch real data (Products, Orders, etc.) still
// need a working API connection (see VITE_API_URL in .env / README).
const OFFLINE_USERNAME = "admin";
const OFFLINE_PASSWORD = "nvfresh123";

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(() => window.localStorage.getItem(USER_KEY));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAuthenticated = Boolean(window.localStorage.getItem(TOKEN_KEY));

  async function login(user, pass) {
    setLoading(true);
    setError("");
    try {
      const res = await api.login(user, pass);
      window.localStorage.setItem(TOKEN_KEY, res.token);
      window.localStorage.setItem(USER_KEY, res.username);
      setUsername(res.username);
      return true;
    } catch (err) {
      if (user === OFFLINE_USERNAME && pass === OFFLINE_PASSWORD) {
        window.localStorage.setItem(TOKEN_KEY, "offline-demo-token");
        window.localStorage.setItem(USER_KEY, OFFLINE_USERNAME);
        setUsername(OFFLINE_USERNAME);
        return true;
      }
      setError(err.message || "Login failed");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setUsername(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

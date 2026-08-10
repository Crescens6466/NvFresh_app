import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { HiOutlineUser, HiOutlineLockClosed } from "react-icons/hi2";
import { useAuth } from "../context/AuthContext.jsx";
import "./Login.css";

export default function Login() {
  const { login, isAuthenticated, error, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await login(username, password);
    if (ok) navigate("/");
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <h1>NvFresh</h1>
          <span>Admin Panel</span>
        </div>

        <div className="field">
          <label>Username</label>
          <div className="login-input-wrap">
            <HiOutlineUser />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
            />
          </div>
        </div>

        <div className="field">
          <label>Password</label>
          <div className="login-input-wrap">
            <HiOutlineLockClosed />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>

        <p className="login-hint">Demo credentials: admin / nvfresh123</p>
      </form>
    </div>
  );
}

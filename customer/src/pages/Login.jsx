import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import { FcGoogle } from "react-icons/fc";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, sendOtp, verifyOtp } = useCustomerAuth();
  const { showToast } = useToast();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function afterLogin() {
    showToast("Signed in successfully");
    navigate(location.state?.from || "/profile", { replace: true });
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
      showToast("Enter a valid 10-digit mobile number", "error");
      return;
    }
    setSending(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
      showToast("OTP sent via WhatsApp");
    } catch (err) {
      showToast(err.message || "Could not send OTP", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp) {
      showToast("Enter the OTP", "error");
      return;
    }
    setVerifying(true);
    try {
      await verifyOtp(phone, otp);
      afterLogin();
    } catch (err) {
      showToast(err.message || "Invalid OTP", "error");
    } finally {
      setVerifying(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      afterLogin();
    } catch (err) {
      showToast(err.message || "Google sign-in failed", "error");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="customer-login page-fade">
      <div className="payment-header">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Sign In</h2>
      </div>

      <p className="customer-login-subtitle">
        Sign in to place orders and track your order status.
      </p>

      <button
        type="button"
        className="btn btn-outline btn-block customer-login-google"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <FcGoogle /> {googleLoading ? "Signing in..." : "Continue with Google"}
      </button>

      <div className="customer-login-divider">
        <span>or</span>
      </div>

      {!otpSent ? (
        <form className="payment-form" onSubmit={handleSendOtp}>
          <label>
            Mobile Number
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              inputMode="numeric"
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
            {sending ? "Sending OTP..." : "Send OTP via WhatsApp"}
          </button>
        </form>
      ) : (
        <form className="payment-form" onSubmit={handleVerifyOtp}>
          <label>
            Enter OTP (sent via WhatsApp)
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              inputMode="numeric"
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={verifying}>
            {verifying ? "Verifying..." : "Verify OTP"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => setOtpSent(false)}
          >
            Change number
          </button>
        </form>
      )}
    </div>
  );
}

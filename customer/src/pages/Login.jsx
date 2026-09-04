import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import { FcGoogle } from "react-icons/fc";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, sendOtp, retryOtp, verifyOtp } = useCustomerAuth();
  const { showToast } = useToast();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!otpSent || resendCountdown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [otpSent, resendCountdown]);

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
    if (sending) return;
    setSending(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
      setResendCount(0);
      setResendCountdown(15);
      showToast("OTP sent via SMS");
    } catch (err) {
      showToast(err.message || "Could not send OTP", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleResendOtp() {
    if (resending || resendCountdown > 0 || resendCount >= 3) return;
    setResending(true);
    try {
      await retryOtp();
      setResendCount((current) => current + 1);
      setResendCountdown(15);
      showToast("OTP resent via SMS");
    } catch (err) {
      showToast(err.message || "Could not resend OTP", "error");
    } finally {
      setResending(false);
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
            {sending ? "Sending OTP..." : "Send OTP via SMS"}
          </button>
        </form>
      ) : (
        <form className="payment-form" onSubmit={handleVerifyOtp}>
          <label>
            Enter OTP (sent via SMS)
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
          {resendCount >= 3 ? (
            <p className="customer-login-resend-message">
              Resend limit reached. Please request a new OTP by changing the number.
            </p>
          ) : resendCountdown > 0 ? (
            <p className="customer-login-resend-message">Resend OTP in {resendCountdown}s</p>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={handleResendOtp}
              disabled={resending}
            >
              {resending ? "Resending OTP..." : "Resend OTP"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setResendCountdown(0);
              setResendCount(0);
            }}
          >
            Change number
          </button>
        </form>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiArrowLeft,
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineTrash,
  HiOutlineEnvelope,
} from "react-icons/hi2";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { api } from "../api.js";
import "./StaticPage.css";

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { profile, isLoggedIn, loading: authLoading, getIdToken, logout } = useCustomerAuth();
  const { clearCart } = useCart();

  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { status: "completed" | "pending", message: string }
  const [errorMsg, setErrorMsg] = useState("");

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (submitting || !confirmed) return;

    setSubmitting(true);
    setErrorMsg("");
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Please sign in again to verify your identity before deleting your account.");
      }

      const response = await api.deleteCustomerAccount(token);
      const status = response?.status === "pending" ? "pending" : "completed";
      const message =
        response?.message ||
        (status === "pending"
          ? "Your account deletion request has been recorded and is pending final completion."
          : "Your NvFresh account and personal profile data have been permanently deleted.");

      setResult({ status, message });
      setConfirmed(false);
      clearCart();
      await logout().catch(() => {});
    } catch (err) {
      const msg =
        err?.message ||
        "Could not complete account deletion right now. Please try again or contact nvfreshsupport@gmail.com.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const accountLabel = profile?.email || profile?.phone || profile?.name || "Signed-in account";

  return (
    <div className="static-page page-fade">
      <div className="static-page-back">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Delete Account</h2>
      </div>

      <p>
        You can permanently delete your NvFresh account and associated personal
        information directly from the NvFresh Android app (under{" "}
        <strong>Profile &rarr; Delete Account</strong>) or through this webpage after
        verifying your identity.
      </p>

      {result && (
        <div
          className={`delete-status-card ${
            result.status === "pending" ? "delete-status-pending" : "delete-status-success"
          }`}
          role="status"
        >
          {result.status === "pending" ? <HiOutlineClock /> : <HiOutlineCheckCircle />}
          <div>
            <h5>
              {result.status === "pending"
                ? "Account Deletion Pending Final Completion"
                : "Account Deleted"}
            </h5>
            <p>{result.message}</p>
          </div>
        </div>
      )}

      <section className="delete-action-card">
        <h4>Delete Your Account Online</h4>
        <p>
          To protect your account from unauthorized deletion, NvFresh never deletes an
          account based on an unverified phone number or email address alone. Sign in
          below using Google Sign-In or mobile OTP to verify ownership of your account.
        </p>

        {authLoading ? (
          <p className="static-meta" style={{ marginTop: 12 }}>
            Checking sign-in status...
          </p>
        ) : !isLoggedIn ? (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-primary delete-full-btn"
              onClick={() => navigate("/login", { state: { from: "/delete-account" } })}
            >
              Sign In to Verify &amp; Delete Account
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeleteAccount} className="delete-confirm-form">
            <div className="delete-account-pill">
              Verified account: <strong>{accountLabel}</strong>
            </div>

            <div className="delete-warning-box">
              <HiOutlineExclamationTriangle />
              <span>
                This action is permanent and cannot be undone. Your profile, saved
                notification tokens, and login access will be permanently removed.
              </span>
            </div>

            <label className="delete-checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={submitting}
              />
              <span>
                I understand that deleting my NvFresh account is permanent and cannot be
                undone.
              </span>
            </label>

            {errorMsg && (
              <div className="delete-warning-box" role="alert">
                <HiOutlineExclamationTriangle />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary delete-full-btn"
              disabled={!confirmed || submitting}
            >
              <HiOutlineTrash />
              <span>
                {submitting
                  ? "Deleting Account..."
                  : errorMsg
                  ? "Try Again — Delete My Account"
                  : "Permanently Delete My Account"}
              </span>
            </button>
          </form>
        )}
      </section>

      <section>
        <h4>What Personal Data Is Deleted</h4>
        <p>When your verified account deletion request is processed, NvFresh removes:</p>
        <ul className="static-list">
          <li>Your customer profile record (name, mobile number, and saved address).</li>
          <li>Your Firebase Authentication / Google Sign-In account link (revoked and deleted).</li>
          <li>All registered push notification device tokens and in-app notification records.</li>
          <li>Any temporary OTP verification records associated with your mobile number.</li>
          <li>
            Personal contact details (name, phone number, and delivery address) on
            completed historical orders are anonymized and unlinked from your account.
          </li>
        </ul>
      </section>

      <section>
        <h4>Financial &amp; Transaction Records Retained</h4>
        <p>
          To comply with accounting, tax, audit, fraud-prevention, and legal
          obligations, NvFresh does <strong>not</strong> delete underlying financial
          and payment transaction records (such as order IDs, items purchased, totals,
          advance amounts, Razorpay order/payment IDs, transaction references, payment
          status, and timestamps). Where legally permissible, unnecessary personal
          identifiers on completed orders are anonymized.
        </p>
        <p>
          If you have an active undelivered order at the time of deletion, delivery
          contact details for that order are retained strictly until delivery is
          completed.
        </p>
      </section>

      <section>
        <h4>Cannot Access Your Account? Request Deletion by Email</h4>
        <p>
          If you no longer have access to your Google account or registered mobile
          number, you may submit a deletion request by emailing{" "}
          <a
            href="mailto:nvfreshsupport@gmail.com?subject=Account%20Deletion%20Request"
            className="static-link"
          >
            nvfreshsupport@gmail.com
          </a>{" "}
          with the subject line <strong>&ldquo;Account Deletion Request&rdquo;</strong>.
        </p>
        <p>
          Please send the request from your registered email address or include your
          registered 10-digit mobile number and recent order details so our support
          team can verify your identity before processing your request. Verified manual
          requests are processed within a reasonable timeframe and confirmed by email.
        </p>

        <a
          href="mailto:nvfreshsupport@gmail.com?subject=Account%20Deletion%20Request"
          className="btn btn-outline delete-full-btn"
          style={{ marginTop: 12 }}
        >
          <HiOutlineEnvelope />
          <span>Email nvfreshsupport@gmail.com</span>
        </a>
      </section>

      <section>
        <h4>Related Policy</h4>
        <p>
          To learn more about how NvFresh collects, uses, and protects your data, please
          read our{" "}
          <Link to="/privacy" className="static-link">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </div>
  );
}


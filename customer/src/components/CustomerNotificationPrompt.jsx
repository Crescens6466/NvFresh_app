import React, { useState } from "react";
import { HiOutlineBell } from "react-icons/hi2";
import { Link, useLocation } from "react-router-dom";
import { useCustomerNotifications } from "../context/CustomerNotificationContext.jsx";
import { isCustomerPushConfigured } from "../customerPush.js";
import "./CustomerNotificationPrompt.css";

export default function CustomerNotificationPrompt() {
  const { pathname } = useLocation();
  const {
    permission,
    isLoggedIn,
    deviceRegistered,
    deviceRegistrationLoading,
    deviceRegistrationError,
    enableNotifications,
  } = useCustomerNotifications();
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState("");

  if (pathname === "/notifications") return null;
  if (!isCustomerPushConfigured || permission === "unsupported") return null;
  if (permission === "granted" && isLoggedIn && deviceRegistered && !error) return null;

  const blocked = permission === "denied";
  const retryingSetup = permission === "granted";
  const settingUp = enabling || deviceRegistrationLoading;
  const setupError = error || deviceRegistrationError;

  async function handleEnable() {
    setEnabling(true);
    setError("");
    try {
      await enableNotifications();
    } catch (enableError) {
      setError(enableError.message || "Could not enable notifications.");
    } finally {
      setEnabling(false);
    }
  }

  return (
    <aside
      className={`customer-notification-prompt${blocked ? " customer-notification-prompt-blocked" : ""}`}
      aria-live={setupError ? "assertive" : "polite"}
      role={setupError ? "alert" : "status"}
    >
      <span className="customer-notification-prompt-icon" aria-hidden="true">
        <HiOutlineBell />
      </span>
      <div className="customer-notification-prompt-copy">
        <strong>
          {blocked
            ? "Notifications are blocked"
            : retryingSetup
              ? "Finish setting up notifications"
              : "Get NvFresh order updates"}
        </strong>
        <span>
          {blocked
            ? "Allow notifications for NvFresh in your browser site settings."
            : setupError
              ? setupError
              : isLoggedIn
                ? retryingSetup
                  ? "Connecting this device to your account."
                  : "Enable notifications to receive updates about your orders."
                : retryingSetup
                  ? "Notifications are allowed. Sign in to link this device to your account."
                  : "Enable browser notifications now; sign in to link this device to your account."}
        </span>
      </div>
      {!blocked && (permission !== "granted" || (isLoggedIn && !deviceRegistered && !settingUp)) && (
        <button
          className="customer-notification-prompt-button"
          type="button"
          onClick={handleEnable}
          disabled={settingUp}
        >
          {settingUp
            ? "Setting up…"
            : retryingSetup
              ? "Retry setup"
              : "Enable Notifications"}
        </button>
      )}
      {permission === "granted" && !isLoggedIn && (
        <Link className="customer-notification-prompt-link" to="/login">
          Sign in
        </Link>
      )}
    </aside>
  );
}

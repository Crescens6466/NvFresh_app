import React, { useState } from "react";
import { Link } from "react-router-dom";
import { HiOutlineBell, HiOutlineCheck } from "react-icons/hi2";
import { useCustomerNotifications } from "../context/CustomerNotificationContext.jsx";
import { isCustomerPushConfigured } from "../customerPush.js";
import "./CustomerNotifications.css";

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CustomerNotifications() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    permission,
    isLoggedIn,
    deviceRegistered,
    deviceRegistrationLoading,
    deviceRegistrationError,
    enableNotifications,
    markRead,
    markAllRead,
    openNotification,
  } = useCustomerNotifications();
  const [enabling, setEnabling] = useState(false);
  const [actionError, setActionError] = useState("");
  const [savingAll, setSavingAll] = useState(false);

  async function handleEnable() {
    setEnabling(true);
    setActionError("");
    try {
      await enableNotifications();
    } catch (enableError) {
      setActionError(enableError.message || "Could not enable notifications.");
    } finally {
      setEnabling(false);
    }
  }

  async function handleMarkAllRead() {
    setSavingAll(true);
    setActionError("");
    try {
      await markAllRead();
    } catch (markError) {
      setActionError(markError.message || "Could not mark notifications as read.");
    } finally {
      setSavingAll(false);
    }
  }

  async function handleMarkRead(id) {
    setActionError("");
    try {
      await markRead(id);
    } catch (markError) {
      setActionError(markError.message || "Could not mark notification as read.");
    }
  }

  return (
    <section className="notifications-page">
      <div className="notifications-heading">
        <div>
          <p className="eyebrow">Your account</p>
          <h2>Notifications</h2>
          <p className="notifications-subtitle">
            Order updates and important news from NvFresh.
          </p>
        </div>
        {isLoggedIn && unreadCount > 0 && (
          <button
            className="notifications-mark-all"
            onClick={handleMarkAllRead}
            disabled={savingAll}
          >
            <HiOutlineCheck aria-hidden="true" />
            {savingAll ? "Saving…" : "Mark all read"}
          </button>
        )}
      </div>

      {!isLoggedIn ? (
        <div className="notifications-signin">
          <HiOutlineBell aria-hidden="true" />
          <h3>Sign in to view notifications</h3>
          <p>Your order updates will be waiting here.</p>
          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      ) : (
        <>
          {permission === "granted" && deviceRegistered ? (
            <p className="notifications-message notifications-success" role="status">
              Notifications are enabled on this device.
            </p>
          ) : (
            <div className="notifications-push-card">
              <div className="notifications-push-icon">
                <HiOutlineBell aria-hidden="true" />
              </div>
              <div className="notifications-push-copy">
                <h3>Get updates on this device</h3>
                <p>
                  {!isCustomerPushConfigured
                    ? "Web push has not been configured for this site yet."
                    : permission === "denied"
                      ? "Notifications are blocked. Allow them in your browser settings, then try again."
                      : deviceRegistrationLoading
                        ? "Registering this device for order alerts…"
                        : deviceRegistrationError || actionError
                          ? `Could not finish device setup: ${deviceRegistrationError || actionError}`
                          : permission === "granted"
                            ? "Browser notifications are allowed. Finish setting up this device for order alerts."
                            : "Enable browser notifications to see important order updates as they arrive."}
                </p>
              </div>
              {permission !== "denied" && (
                <button
                  className="btn btn-outline notifications-enable"
                  onClick={handleEnable}
                  disabled={
                    enabling ||
                    deviceRegistrationLoading ||
                    permission === "unsupported" ||
                    !isCustomerPushConfigured
                  }
                >
                  {enabling || deviceRegistrationLoading
                    ? "Enabling…"
                    : !isCustomerPushConfigured
                      ? "Unavailable"
                      : permission === "granted" || deviceRegistrationError || actionError
                        ? "Retry setup"
                        : permission === "unsupported"
                          ? "Not supported"
                          : "Enable notifications"}
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="notifications-message notifications-error" role="alert">
              {error}
            </p>
          )}

          <div className="notifications-list-heading">
            <h3>Recent activity</h3>
            {unreadCount > 0 && (
              <span>{unreadCount} unread</span>
            )}
          </div>

          {loading ? (
            <div className="notifications-empty">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">
              <HiOutlineBell aria-hidden="true" />
              <h3>You’re all caught up</h3>
              <p>New order updates will appear here.</p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((item) => (
                <article
                  className={`notification-item${item.isRead ? "" : " notification-item-unread"}`}
                  key={item.id}
                >
                  <button
                    className="notification-item-main"
                    onClick={() => openNotification(item)}
                    aria-label={
                      item.orderId
                        ? `Open notification and order ${item.orderId}`
                        : "Open notification"
                    }
                  >
                    <span className="notification-indicator" aria-hidden="true" />
                    <span className="notification-item-copy">
                      <span className="notification-item-title">{item.title}</span>
                      <span className="notification-item-message">{item.message}</span>
                      <span className="notification-item-time">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </span>
                    {item.orderId && (
                      <span className="notification-order-link" aria-hidden="true">
                        View order
                      </span>
                    )}
                  </button>
                  <div className="notification-item-status">
                    <span>{item.isRead ? "Read" : "Unread"}</span>
                    {!item.isRead && (
                      <button
                        onClick={() => handleMarkRead(item.id)}
                        aria-label={`Mark ${item.title} as read`}
                      >
                        <HiOutlineCheck aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

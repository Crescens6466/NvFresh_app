import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineBell, HiOutlineCheck } from "react-icons/hi2";
import { api } from "../api.js";
import "./Notifications.css";

function formatTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function refresh() {
    return api.getNotifications().then(setNotifications);
  }

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("admin-notifications-updated", {
      detail: { showAlert: false },
    }));
    refresh().finally(() => setLoading(false));
    const handleReceived = (event) => {
      if (event.detail) {
        setNotifications((current) => [
          event.detail,
          ...current.filter((notification) => notification.id !== event.detail.id),
        ]);
      }
    };
    window.addEventListener("admin-notifications-received", handleReceived);
    return () => window.removeEventListener("admin-notifications-received", handleReceived);
  }, []);

  async function openNotification(notification) {
    if (!notification.isRead) {
      await api.markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
      );
      window.dispatchEvent(new CustomEvent("admin-notifications-updated", {
        detail: { showAlert: false },
      }));
    }
    if (notification.orderId) navigate("/orders");
  }

  async function markAllRead() {
    setSaving(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
      window.dispatchEvent(new CustomEvent("admin-notifications-updated", {
        detail: { showAlert: false },
      }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="notifications-page page-fade">
      <div className="notifications-header">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="page-subtitle">Stay up to date with activity in your store.</p>
        </div>
        <button className="btn btn-outline" onClick={markAllRead} disabled={saving}>
          <HiOutlineCheck />
          {saving ? "Updating..." : "Mark all as read"}
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 180, marginTop: 24 }} />
      ) : notifications.length === 0 ? (
        <div className="card empty-state notifications-empty">
          <HiOutlineBell />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <button
              className={`card notification-item${notification.isRead ? "" : " notification-unread"}`}
              key={notification.id}
              onClick={() => openNotification(notification)}
            >
              <span className="notification-icon"><HiOutlineBell /></span>
              <span className="notification-content">
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <small>{formatTime(notification.createdAt)}</small>
              </span>
              {!notification.isRead && <span className="notification-dot" aria-label="Unread" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

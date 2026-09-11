import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { enableAdminNotifications } from "../firebaseMessaging.js";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineClipboardDocumentList,
  HiOutlineUsers,
  HiOutlineCog6Tooth,
  HiOutlineBell,
  HiOutlineArrowLeftOnRectangle,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext.jsx";
import "./Sidebar.css";

const LINKS = [
  { to: "/", label: "Dashboard", Icon: HiOutlineSquares2X2, end: true },
  { to: "/products", label: "Products", Icon: HiOutlineCube },
  { to: "/orders", label: "Orders", Icon: HiOutlineClipboardDocumentList },
  { to: "/customers", label: "Customers", Icon: HiOutlineUsers },
  { to: "/settings", label: "Settings", Icon: HiOutlineCog6Tooth },
  { to: "/notifications", label: "Notifications", Icon: HiOutlineBell },
];

export default function Sidebar() {
  const { logout, username } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [showUnreadAlert, setShowUnreadAlert] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState(
    () => ("Notification" in window ? Notification.permission : "unsupported")
  );
  const [notificationStatus, setNotificationStatus] = React.useState("");
  const [enablingNotifications, setEnablingNotifications] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const refresh = (showAlert = false) => {
      api.getUnreadNotificationCount()
        .then(({ count }) => {
          if (active) {
            setUnreadCount(count);
            if (showAlert && count > 0) setShowUnreadAlert(true);
            if (count === 0) setShowUnreadAlert(false);
          }
        })
        .catch(() => {});
    };
    refresh(true);
    const interval = window.setInterval(refresh, 15000);
    const handleNotificationUpdate = (event) => {
      refresh(event.detail?.showAlert === true);
    };
    window.addEventListener("admin-notifications-updated", handleNotificationUpdate);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("admin-notifications-updated", handleNotificationUpdate);
    };
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleEnableNotifications() {
    setEnablingNotifications(true);
    setNotificationStatus("");
    try {
      const result = await enableAdminNotifications();
      setNotificationPermission(result.permission || "granted");
      if (result.enabled) {
        setNotificationStatus("Notifications enabled");
        window.dispatchEvent(new CustomEvent("admin-notifications-updated", {
          detail: { showAlert: false },
        }));
      } else if (result.permission === "denied") {
        setNotificationStatus("Notifications are blocked in your browser settings.");
      }
    } catch (err) {
      setNotificationStatus(err.message || "Could not enable notifications");
    } finally {
      setEnablingNotifications(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>NvFresh</h1>
        <span>Admin Panel</span>
      </div>

      <nav className="sidebar-nav">
        {notificationPermission === "default" && (
          <div className="sidebar-enable-notifications">
            <span>Get alerts when a new order is placed.</span>
            <button type="button" onClick={handleEnableNotifications} disabled={enablingNotifications}>
              <HiOutlineBell />
              {enablingNotifications ? "Enabling..." : "Enable Notifications"}
            </button>
          </div>
        )}
        {notificationPermission === "denied" && (
          <div className="sidebar-notification-status">
            Notifications are blocked in your browser settings.
          </div>
        )}
        {notificationStatus && (
          <div className="sidebar-notification-status">{notificationStatus}</div>
        )}
        {showUnreadAlert && unreadCount > 0 && (
          <div className="sidebar-notification-alert">
            <span>
              {unreadCount} new notification{unreadCount === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowUnreadAlert(false);
                navigate("/notifications");
              }}
            >
              View notifications
            </button>
            <button
              type="button"
              className="sidebar-notification-dismiss"
              aria-label="Dismiss notification alert"
              onClick={() => setShowUnreadAlert(false)}
            >
              ×
            </button>
          </div>
        )}
        {LINKS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="sidebar-link">
            <Icon />
            <span>{label}</span>
            {to === "/notifications" && unreadCount > 0 && (
              <span className="sidebar-notification-badge">{unreadCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{(username || "A")[0].toUpperCase()}</div>
          <span>{username || "Admin"}</span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <HiOutlineArrowLeftOnRectangle />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

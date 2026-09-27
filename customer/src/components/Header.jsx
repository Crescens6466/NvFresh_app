import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineBell, HiOutlineShoppingBag } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import { useCustomerNotifications } from "../context/CustomerNotificationContext.jsx";
import "./Header.css";

export default function Header() {
  const { itemCount } = useCart();
  const { unreadCount } = useCustomerNotifications();
  const navigate = useNavigate();

  return (
    <header className="header">
      <button
        className="header-bell"
        onClick={() => navigate("/notifications")}
        aria-label={
          unreadCount > 0
            ? `Open notifications, ${unreadCount} unread`
            : "Open notifications"
        }
      >
        <HiOutlineBell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="header-cart-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      <Link to="/" className="header-brand">
        <h1 className="header-logo">NvFresh</h1>
        <p className="header-tagline">Fresh Meat Delivered. Hygienic. Healthy. Trusted.</p>
      </Link>
      <div className="header-actions">
        <button
          className="header-cart"
          onClick={() => navigate("/cart")}
          aria-label="Open cart"
        >
          <HiOutlineShoppingBag />
          {itemCount > 0 && <span className="header-cart-badge">{itemCount}</span>}
        </button>
      </div>
    </header>
  );
}

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { HiOutlineHome, HiHome } from "react-icons/hi2";
import { HiOutlineSquares2X2, HiSquares2X2 } from "react-icons/hi2";
import { HiOutlineShoppingBag, HiShoppingBag } from "react-icons/hi2";
import { HiOutlineUser, HiUser } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import "./BottomNav.css";

const links = [
  { to: "/", label: "Home", Icon: HiOutlineHome, ActiveIcon: HiHome },
  { to: "/categories", label: "Categories", Icon: HiOutlineSquares2X2, ActiveIcon: HiSquares2X2 },
  { to: "/cart", label: "Cart", Icon: HiOutlineShoppingBag, ActiveIcon: HiShoppingBag },
  { to: "/profile", label: "Profile", Icon: HiOutlineUser, ActiveIcon: HiUser },
];

function isDestinationActive(destination, pathname) {
  const norm = (pathname || "").replace(/\/+$/, "") || "/";

  switch (destination) {
    case "/":
      return norm === "/" || norm.startsWith("/product/");
    case "/categories":
      return norm === "/categories" || norm.startsWith("/categories/");
    case "/cart":
      return (
        norm === "/cart" ||
        norm.startsWith("/cart/") ||
        norm === "/payment" ||
        norm.startsWith("/payment/") ||
        norm === "/order-success" ||
        norm.startsWith("/order-success/")
      );
    case "/profile":
      return (
        norm === "/profile" ||
        norm.startsWith("/profile/") ||
        norm === "/orders" ||
        norm.startsWith("/orders/") ||
        norm === "/notifications" ||
        norm.startsWith("/notifications/") ||
        norm === "/about" ||
        norm.startsWith("/about/") ||
        norm === "/contact" ||
        norm.startsWith("/contact/") ||
        norm === "/privacy" ||
        norm.startsWith("/privacy/") ||
        norm === "/terms" ||
        norm.startsWith("/terms/") ||
        norm === "/login" ||
        norm.startsWith("/login/")
      );
    default:
      return false;
  }
}

export default function BottomNav() {
  const { itemCount } = useCart();
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav">
      {links.map(({ to, label, Icon, ActiveIcon }) => {
        const isActive = isDestinationActive(to, pathname);

        return (
          <NavLink
            key={to}
            to={to}
            className={`bottom-nav-link ${isActive ? "active is-active" : ""}`}
          >
            <span className={`bottom-nav-icon-wrap ${isActive ? "is-active" : ""}`}>
              {isActive ? <ActiveIcon /> : <Icon />}
              {label === "Cart" && itemCount > 0 && (
                <span className="bottom-nav-dot">{itemCount}</span>
              )}
            </span>
            <span className={`bottom-nav-label ${isActive ? "is-active" : ""}`}>{label}</span>
            {isActive && <span className="bottom-nav-indicator" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

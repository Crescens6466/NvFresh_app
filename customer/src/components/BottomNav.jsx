import React from "react";
import { NavLink } from "react-router-dom";
import { HiOutlineHome, HiHome } from "react-icons/hi2";
import { HiOutlineSquares2X2, HiSquares2X2 } from "react-icons/hi2";
import { HiOutlineShoppingBag, HiShoppingBag } from "react-icons/hi2";
import { HiOutlineUser, HiUser } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import "./BottomNav.css";

const links = [
  { to: "/", label: "Home", Icon: HiOutlineHome, ActiveIcon: HiHome, end: true },
  { to: "/categories", label: "Categories", Icon: HiOutlineSquares2X2, ActiveIcon: HiSquares2X2 },
  { to: "/cart", label: "Cart", Icon: HiOutlineShoppingBag, ActiveIcon: HiShoppingBag },
  { to: "/profile", label: "Profile", Icon: HiOutlineUser, ActiveIcon: HiUser },
];

export default function BottomNav() {
  const { itemCount } = useCart();

  return (
    <nav className="bottom-nav">
      {links.map(({ to, label, Icon, ActiveIcon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottom-nav-link">
          {({ isActive }) => (
            <>
              <span className="bottom-nav-icon-wrap">
                {isActive ? <ActiveIcon /> : <Icon />}
                {label === "Cart" && itemCount > 0 && (
                  <span className="bottom-nav-dot">{itemCount}</span>
                )}
              </span>
              <span className={`bottom-nav-label ${isActive ? "is-active" : ""}`}>{label}</span>
              {isActive && <span className="bottom-nav-indicator" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineShoppingBag } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import "./Header.css";

export default function Header() {
  const { itemCount } = useCart();
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="header-spacer" />
      <Link to="/" className="header-brand">
        <h1 className="header-logo">NvFresh</h1>
        <p className="header-tagline">Fresh Meat Delivered. Hygienic. Healthy. Trusted.</p>
      </Link>
      <button
        className="header-cart"
        onClick={() => navigate("/cart")}
        aria-label="Open cart"
      >
        <HiOutlineShoppingBag />
        {itemCount > 0 && <span className="header-cart-badge">{itemCount}</span>}
      </button>
    </header>
  );
}

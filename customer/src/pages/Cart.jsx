import React from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineMinus, HiOutlinePlus, HiOutlineTrash, HiOutlineShoppingCart, HiOutlineTruck } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import { resolveImageUrl } from "../api.js";
import "./Cart.css";

export default function Cart() {
  const { items, updateQuantity, removeFromCart, subtotal, deliveryCharge, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="empty-state" style={{ paddingTop: 80 }}>
        <HiOutlineShoppingCart />
        <h3>Your cart is empty</h3>
        <p>Add some fresh picks to get started.</p>
        <button className="btn btn-primary" onClick={() => navigate("/")} style={{ marginTop: 12 }}>
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <div className="cart page-fade">
      <h2 className="cart-title">Your Cart</h2>

      <div className="cart-list">
        {items.map((item) => (
          <div className="cart-item" key={item.key}>
            <img src={resolveImageUrl(item.image)} alt={item.name} className="cart-item-image" />
            <div className="cart-item-info">
              <h4>{item.name}</h4>
              <p className="cart-item-weight">{item.weight}</p>
              <p className="cart-item-price">₹{item.price * item.quantity}</p>
            </div>
            <div className="cart-item-actions">
              <button
                className="cart-item-remove"
                onClick={() => removeFromCart(item.key)}
                aria-label="Remove item"
              >
                <HiOutlineTrash />
              </button>
              <div className="cart-item-stepper">
                <button onClick={() => updateQuantity(item.key, item.quantity - 1)}>
                  <HiOutlineMinus />
                </button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.key, item.quantity + 1)}>
                  <HiOutlinePlus />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <h4>Order Summary</h4>
        <div className="cart-summary-row">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="cart-summary-row">
          <span>Delivery Charge</span>
          <span>{deliveryCharge === 0 ? "Free" : `₹${deliveryCharge}`}</span>
        </div>
        <div className="cart-summary-divider" />
        <div className="cart-summary-row cart-summary-total">
          <span>Total</span>
          <span>₹{total}</span>
        </div>
      </div>

      <div className="schedule-banner" style={{ marginTop: 16 }}>
        <HiOutlineTruck />
        <span>Orders confirmed Saturday, delivered fresh Sunday morning.</span>
      </div>

      <div className="cart-checkout-bar">
        <div>
          <p className="cart-checkout-label">Total</p>
          <p className="cart-checkout-total">₹{total}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/payment")}>
          Checkout
        </button>
      </div>
    </div>
  );
}

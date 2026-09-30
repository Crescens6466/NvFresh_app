import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  HiArrowLeft,
  HiOutlineSparkles,
  HiOutlineShieldCheck,
  HiOutlineTruck,
  HiOutlineNoSymbol,
  HiOutlineMinus,
  HiOutlinePlus,
} from "react-icons/hi2";
import { api, resolveImageUrl } from "../api.js";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { priceForWeight } from "../utils.js";
import "./ProductDetails.css";

const BENEFITS = [
  { icon: HiOutlineSparkles, label: "Freshly Cut" },
  { icon: HiOutlineNoSymbol, label: "No Preservatives" },
  { icon: HiOutlineShieldCheck, label: "Hygienically Packed" },
  { icon: HiOutlineTruck, label: "Sunday Delivery" },
];

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setLoading(true);
    api
      .getProduct(id)
      .then((p) => {
        setProduct(p);
        setWeight(p.weights[1] || p.weights[0]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="pd-loading">
        <div className="skeleton" style={{ aspectRatio: "1/1", borderRadius: 0 }} />
        <div style={{ padding: 16 }}>
          <div className="skeleton skeleton-line" style={{ width: "60%", height: 20 }} />
          <div className="skeleton skeleton-line" style={{ width: "30%", height: 16, marginTop: 10 }} />
          <div className="skeleton skeleton-line" style={{ width: "100%", height: 60, marginTop: 16 }} />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="empty-state">
        <h3>Product not found</h3>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  const isAvailable = product ? product.isAvailable !== false : true;
  const unitPrice = priceForWeight(product.price, weight);
  const totalPrice = unitPrice * qty;

  function handleAdd() {
    if (!isAvailable) return;
    addToCart(product, weight, qty, unitPrice);
    showToast(`${product.name} added to cart`);
  }

  function handleBuyNow() {
    if (!isAvailable) return;
    addToCart(product, weight, qty, unitPrice);
    navigate("/cart");
  }

  return (
    <div className="pd page-fade">
      <div className="pd-image-wrap">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <img src={resolveImageUrl(product.image)} alt={product.name} className="pd-image" />
        {!isAvailable ? (
          <span className="badge pd-badge badge-not-available">Not Available</span>
        ) : product.badge ? (
          <span className="badge pd-badge">{product.badge}</span>
        ) : null}
      </div>

      <div className="pd-body">
        <h2 className="pd-name">{product.name}</h2>
        <p className="pd-price">
          ₹{unitPrice} <span>/ {weight}</span>
        </p>
        <p className="pd-desc">{product.description}</p>

        <div className="pd-row">
          <div className="pd-field">
            <label>Weight</label>
            <select value={weight} onChange={(e) => setWeight(e.target.value)}>
              {product.weights.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div className="pd-field">
            <label>Quantity</label>
            <div className="pd-qty">
              <button
                onClick={() => isAvailable && setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                disabled={!isAvailable}
              >
                <HiOutlineMinus />
              </button>
              <span>{qty}</span>
              <button
                onClick={() => isAvailable && setQty((q) => q + 1)}
                aria-label="Increase quantity"
                disabled={!isAvailable}
              >
                <HiOutlinePlus />
              </button>
            </div>
          </div>
        </div>

        <div className="pd-benefits">
          {BENEFITS.map(({ icon: Icon, label }) => (
            <div key={label} className="pd-benefit">
              <Icon />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="pd-info-card">
          <h4>Storage Instructions</h4>
          <p>Refrigerate at 0–4°C immediately on delivery. Consume fresh within 24 hours, or freeze for up to 30 days.</p>
        </div>

        <div className="pd-info-card">
          <h4>Delivery Information</h4>
          <p>
            We deliver once a week. Orders are confirmed every Saturday and delivered fresh
            on Sunday morning, in insulated, leak-proof hygienic packaging.
          </p>
        </div>
      </div>

      <div className="pd-action-bar">
        <div className="pd-action-total">
          <span>Total</span>
          <strong>₹{totalPrice}</strong>
        </div>
        <div className="pd-action-buttons">
          {isAvailable ? (
            <>
              <button className="btn btn-outline btn-block" onClick={handleAdd}>
                Add To Cart
              </button>
              <button className="btn btn-primary btn-block" onClick={handleBuyNow}>
                Buy Now
              </button>
            </>
          ) : (
            <button className="btn btn-block pd-btn-unavailable" disabled>
              Currently Not Available
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

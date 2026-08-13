import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineHeart, HiHeart } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { priceForWeight } from "../utils.js";
import { resolveImageUrl } from "../api.js";
import "./ProductCard.css";

const badgeClass = {
  "Best Seller": "badge-best-seller",
  "Fresh Today": "badge-fresh-today",
  "Limited Stock": "badge-limited-stock",
};

export default function ProductCard({ product }) {
  const [weight, setWeight] = useState(product.weights[1] || product.weights[0]);
  const [liked, setLiked] = useState(false);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const displayPrice = priceForWeight(product.price, weight);

  function handleAdd(e) {
    e.stopPropagation();
    addToCart(product, weight, 1, displayPrice);
    showToast(`${product.name} added to cart`);
  }

  function handleBuyNow(e) {
    e.stopPropagation();
    addToCart(product, weight, 1, displayPrice);
    navigate("/cart");
  }

  return (
    <div className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
      <div className="product-card-image-wrap">
        <img src={resolveImageUrl(product.image)} alt={product.name} className="product-card-image" loading="lazy" />
        {product.badge && (
          <span className={`badge product-card-badge ${badgeClass[product.badge] || ""}`}>
            {product.badge}
          </span>
        )}
        <button
          className="product-card-wishlist"
          onClick={(e) => {
            e.stopPropagation();
            setLiked((l) => !l);
          }}
          aria-label="Toggle wishlist"
        >
          {liked ? <HiHeart color="#C62828" /> : <HiOutlineHeart />}
        </button>
      </div>

      <div className="product-card-body">
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-price">
          ₹{displayPrice}
          <span className="product-card-unit"> / {weight}</span>
        </p>

        <select
          className="product-card-select"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          {product.weights.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <div className="product-card-actions">
          <button className="btn btn-outline product-card-btn" onClick={handleAdd}>
            Add
          </button>
          <button className="btn btn-primary product-card-btn" onClick={handleBuyNow}>
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

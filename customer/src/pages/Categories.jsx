import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GiChicken, GiMeat, GiFishCorpse, GiShrimp } from "react-icons/gi";
import { api } from "../api.js";
import "./Categories.css";

const CATS = [
  { name: "Chicken", Icon: GiChicken, color: "#EF5350" },
  { name: "Mutton", Icon: GiMeat, color: "#C62828" },
  { name: "Fish", Icon: GiFishCorpse, color: "#0277BD" },
  { name: "Seafood", Icon: GiShrimp, color: "#EF6C00" },
  { name: "Country Chicken", Icon: GiChicken, color: "#AD1457" },
];

export default function Categories() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");
    api
      .getProducts()
      .then((products) => {
        if (!isMounted) return;
        const c = {};
        if (Array.isArray(products)) {
          products.forEach((p) => {
            if (p && p.isAvailable !== false && p.category) {
              c[p.category] = (c[p.category] || 0) + 1;
            }
          });
        }
        setCounts(c);
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setCounts({});
        setError(err?.message || "Could not load categories right now.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  return (
    <div className="categories page-fade">
      <h2 className="categories-title">Shop by Category</h2>
      {error && (
        <div className="empty-state" style={{ marginBottom: 16 }}>
          <h3>Could not load categories</h3>
          <p>We&rsquo;re having trouble reaching our server. Please try again.</p>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 12 }}
            onClick={() => setRetryCount((c) => c + 1)}
          >
            Retry
          </button>
        </div>
      )}
      <div className="categories-grid">
        {CATS.map(({ name, Icon, color }) => {
          const count = counts[name] || 0;
          const isUnavailable = !loading && !error && count === 0;

          return (
            <button
              key={name}
              className={`category-card ${isUnavailable ? "is-unavailable" : ""}`}
              onClick={() => navigate(`/?category=${encodeURIComponent(name)}`)}
              style={{ "--cat-color": color }}
              type="button"
            >
              <div className="category-card-icon">
                <Icon />
              </div>
              <h4>{name}</h4>
              <p className={`category-card-meta ${isUnavailable ? "is-unavailable" : ""}`}>
                {loading
                  ? "…"
                  : error
                  ? "Tap to view"
                  : isUnavailable
                  ? "Currently unavailable"
                  : `${count} ${count === 1 ? "item" : "items"}`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

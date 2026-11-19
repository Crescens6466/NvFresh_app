import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GiChicken, GiMeat, GiFishCorpse, GiShrimp, GiCookingPot } from "react-icons/gi";
import { api } from "../api.js";
import { normalizeCategory } from "../utils/categories.js";
import "./Categories.css";

const DEFAULT_CATS = [
  { name: "Chicken", icon: "chicken" },
  { name: "Mutton", icon: "meat" },
  { name: "Fish", icon: "fish" },
  { name: "Seafood", icon: "seafood" },
];

function getCategoryIcon(catName, catIcon) {
  const key = `${catIcon || ""} ${catName || ""}`.toLowerCase();
  if (key.includes("chicken")) return { Icon: GiChicken, color: "#EF5350" };
  if (key.includes("mutton") || key.includes("meat")) return { Icon: GiMeat, color: "#C62828" };
  if (key.includes("fish")) return { Icon: GiFishCorpse, color: "#0277BD" };
  if (key.includes("seafood") || key.includes("prawn") || key.includes("shrimp")) {
    return { Icon: GiShrimp, color: "#EF6C00" };
  }
  // Sensible fallback icon for admin-created dynamic categories
  return { Icon: GiCookingPot, color: "#7B1FA2" };
}

export default function Categories() {
  const [categories, setCategories] = useState(DEFAULT_CATS);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      api.getCategories().catch(() => DEFAULT_CATS),
      api.getProducts().catch((err) => {
        throw err;
      }),
    ])
      .then(([cats, products]) => {
        if (!isMounted) return;

        // Dynamic categories list from API (filtering out Country Chicken and All)
        if (Array.isArray(cats) && cats.length > 0) {
          const activeCats = cats.filter((c) => {
            const lower = (c.name || "").toLowerCase();
            return lower !== "all" && lower !== "country chicken" && lower !== "country_chicken";
          });
          if (activeCats.length > 0) {
            setCategories(activeCats);
          }
        }

        // Product counts per category
        const c = {};
        const seenIds = new Set();
        if (Array.isArray(products)) {
          products.forEach((p) => {
            const key = p && String(p.id || p._id || "");
            if (key) {
              if (seenIds.has(key)) return;
              seenIds.add(key);
            }
            if (p && p.isAvailable !== false && p.category) {
              const cat = normalizeCategory(p.category);
              if (cat) {
                c[cat] = (c[cat] || 0) + 1;
              }
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
        {categories.map((cat) => {
          const name = cat.name;
          const { Icon, color } = getCategoryIcon(name, cat.icon);
          const count = counts[name] || 0;
          const isUnavailable = !loading && !error && count === 0;

          return (
            <button
              key={cat.id || name}
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

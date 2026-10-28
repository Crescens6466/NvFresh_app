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
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
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
      })
      .catch(() => {
        if (!isMounted) return;
        setCounts({});
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="categories page-fade">
      <h2 className="categories-title">Shop by Category</h2>
      <div className="categories-grid">
        {CATS.map(({ name, Icon, color }) => {
          const count = counts[name] || 0;
          const isUnavailable = !loading && count === 0;

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

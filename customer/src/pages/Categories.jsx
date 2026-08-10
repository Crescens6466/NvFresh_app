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
  const navigate = useNavigate();

  useEffect(() => {
    api.getProducts().then((products) => {
      const c = {};
      products.forEach((p) => {
        c[p.category] = (c[p.category] || 0) + 1;
      });
      setCounts(c);
    });
  }, []);

  return (
    <div className="categories page-fade">
      <h2 className="categories-title">Shop by Category</h2>
      <div className="categories-grid">
        {CATS.map(({ name, Icon, color }) => (
          <button
            key={name}
            className="category-card"
            onClick={() => navigate(`/?category=${encodeURIComponent(name)}`)}
            style={{ "--cat-color": color }}
          >
            <div className="category-card-icon">
              <Icon />
            </div>
            <h4>{name}</h4>
            <p>{counts[name] || 0} items</p>
          </button>
        ))}
      </div>
    </div>
  );
}

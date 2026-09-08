import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HiOutlineTruck, HiOutlineShieldCheck, HiOutlineSparkles } from "react-icons/hi2";
import { HiOutlineSearch } from "react-icons/hi";
import { HiOutlineInboxStack } from "react-icons/hi2";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import { ProductGridSkeleton } from "../components/Skeleton.jsx";
import "./Home.css";

const CATEGORIES = ["All", "Chicken", "Mutton", "Fish", "Seafood", "Country Chicken"];

export default function Home() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get("category") || "All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .getProducts({ category, search })
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [category, search]);

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">Weekly delivery, every Sunday</div>
        <h2 className="hero-title">Fresh Meat Delivered To Your Doorstep</h2>
        <p className="hero-desc">
          We deliver hygienically processed fresh chicken, mutton, fish and seafood
          directly from farm to your home — every Sunday morning.
        </p>
        <div className="hero-search">
          <HiOutlineSearch className="hero-search-icon" />
          <input
            type="text"
            placeholder="Search chicken, mutton, fish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="hero-strip">
          <div className="hero-strip-item">
            <HiOutlineSparkles />
            <span>Freshly Cut</span>
          </div>
          <div className="hero-strip-item">
            <HiOutlineShieldCheck />
            <span>Hygienic Pack</span>
          </div>
          <div className="hero-strip-item">
            <HiOutlineTruck />
            <span>Sunday Delivery</span>
          </div>
        </div>
      </section>

      <div className="schedule-banner" style={{ margin: "16px 16px 0" }}>
        <HiOutlineTruck />
        <span>Orders confirmed every Saturday, delivered fresh Sunday morning.</span>
      </div>

      {/* Category chips */}
      <div className="category-scroll">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`category-chip ${category === c ? "is-active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Featured products */}
      <section className="featured">
        <div className="featured-header">
          <h3>Featured Products</h3>
          <span className="featured-count">{loading ? "" : `${products.length} items`}</span>
        </div>

        {loading ? (
          <ProductGridSkeleton count={6} />
        ) : products.length === 0 ? (
          <div className="empty-state">
            <HiOutlineInboxStack />
            <h3>No products found</h3>
            <p>Try a different category or search term.</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

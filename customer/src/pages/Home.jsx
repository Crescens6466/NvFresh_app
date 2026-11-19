import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HiOutlineTruck, HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineMapPin, HiOutlineExclamationCircle } from "react-icons/hi2";
import { HiOutlineSearch } from "react-icons/hi";
import { HiOutlineInboxStack } from "react-icons/hi2";
import { api } from "../api.js";
import { formatDeliveryLocationsLine } from "../utils/serviceAreas.js";
import ProductCard from "../components/ProductCard.jsx";
import { ProductGridSkeleton } from "../components/Skeleton.jsx";
import {
  WEBSITE_CATEGORIES,
  filterAndMergeProducts,
  normalizeCategory,
} from "../utils/categories.js";
import "./Home.css";

export default function Home() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [category, setCategory] = useState(normalizeCategory(searchParams.get("category")) || "All");
  const [search, setSearch] = useState("");
  const [deliveryAreas, setDeliveryAreas] = useState([]);

  useEffect(() => {
    api
      .getDeliveryAreas()
      .then((data) => setDeliveryAreas(Array.isArray(data) ? data : []))
      .catch(() => setDeliveryAreas([]));
  }, []);

  useEffect(() => {
    const param = searchParams.get("category");
    if (param) {
      setCategory(normalizeCategory(param) || "All");
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    // Country Chicken is merged into Chicken on the customer website, so fetch
    // without a single-category backend filter when Chicken or All is active.
    const requestParams =
      category === "Chicken" || category === "All"
        ? (search ? { search } : {})
        : (search ? { category, search } : { category });

    const timer = setTimeout(() => {
      api
        .getProducts(requestParams)
        .then((data) => {
          if (!active) return;
          setProducts(filterAndMergeProducts(data, category));
          setError("");
        })
        .catch((err) => {
          if (!active) return;
          setProducts([]);
          setError(err?.message || "Could not load products right now.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [category, search, retryCount]);

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

      <div className="home-delivery-line">
        <HiOutlineMapPin className="home-delivery-pin" />
        <span>{formatDeliveryLocationsLine(deliveryAreas)}</span>
      </div>

      {/* Category chips */}
      <div className="category-scroll">
        {WEBSITE_CATEGORIES.map((c) => (
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
          <span className="featured-count">{loading || error ? "" : `${products.length} items`}</span>
        </div>

        {loading ? (
          <ProductGridSkeleton count={6} />
        ) : error ? (
          <div className="empty-state">
            <HiOutlineExclamationCircle />
            <h3>Could not load products</h3>
            <p>We&rsquo;re having trouble reaching our server. Please check your connection and try again.</p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginTop: 12 }}
              onClick={() => setRetryCount((c) => c + 1)}
            >
              Retry
            </button>
          </div>
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

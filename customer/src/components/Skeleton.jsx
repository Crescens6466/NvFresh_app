import React from "react";
import "./Skeleton.css";

export function ProductCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-image" />
      <div className="skeleton skeleton-line" style={{ width: "80%" }} />
      <div className="skeleton skeleton-line" style={{ width: "40%" }} />
      <div className="skeleton skeleton-line" style={{ width: "100%", height: 32 }} />
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

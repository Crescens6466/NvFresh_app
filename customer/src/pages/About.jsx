import React from "react";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import "./StaticPage.css";

export default function About() {
  const navigate = useNavigate();
  return (
    <div className="static-page page-fade">
      <div className="static-page-back">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>About Us</h2>
      </div>

      <p>
        NvFresh was founded with a simple mission: to bring farm-fresh, hygienically
        processed meat and seafood directly to your doorstep, without the middlemen,
        the guesswork, or the uncertainty of a crowded local market.
      </p>

      <section>
        <h4>Our Promise</h4>
        <p>
          Every product is freshly cut the morning of delivery and packed in hygienic,
          leak-proof materials — never sitting in cold storage for days before it reaches
          your kitchen.
        </p>
      </section>

      <section>
        <h4>Our Delivery Day</h4>
        <p>
          NvFresh delivers once a week. Place your order any time, and it's confirmed
          every Saturday for delivery fresh on Sunday morning — timed so nothing sits
          around longer than it needs to.
        </p>
      </section>

      <section>
        <h4>Sourced Responsibly</h4>
        <p>
          We partner with trusted local farms and fisheries who share our standards for
          animal welfare, cleanliness, and freshness — so you can trust what's on your plate.
        </p>
      </section>

      <section>
        <h4>Why Customers Choose Us</h4>
        <p>
          No preservatives. No hidden charges. Just honest pricing, transparent sourcing,
          and a delivery experience built around your convenience.
        </p>
      </section>
    </div>
  );
}

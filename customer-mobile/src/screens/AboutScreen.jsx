// AboutScreen.jsx — ported from customer/src/pages/About.jsx.
import React from "react";
import StaticScreen from "../components/StaticScreen.jsx";

const SECTIONS = [
  {
    heading: "Our Promise",
    text: "Every product is freshly cut the morning of delivery and packed in hygienic, leak-proof materials — never sitting in cold storage for days before it reaches your kitchen.",
  },
  {
    heading: "Our Delivery Day",
    text: "NvFresh delivers once a week. Place your order any time, and it's confirmed every Saturday for delivery fresh on Sunday morning — timed so nothing sits around longer than it needs to.",
  },
  {
    heading: "Sourced Responsibly",
    text: "We partner with trusted local farms and fisheries who share our standards for animal welfare, cleanliness, and freshness — so you can trust what's on your plate.",
  },
  {
    heading: "Why Customers Choose Us",
    text: "No preservatives. No hidden charges. Just honest pricing, transparent sourcing, and a delivery experience built around your convenience.",
  },
];

export default function AboutScreen() {
  return (
    <StaticScreen
      title="About Us"
      intro="NvFresh was founded with a simple mission: to bring farm-fresh, hygienically processed meat and seafood directly to your doorstep, without the middlemen, the guesswork, or the uncertainty of a crowded local market."
      sections={SECTIONS}
    />
  );
}

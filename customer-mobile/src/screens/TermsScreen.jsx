// TermsScreen.jsx — ported from customer/src/pages/Terms.jsx.
import React from "react";
import StaticScreen from "../components/StaticScreen.jsx";

const SECTIONS = [
  {
    heading: "Orders & Advance Payment",
    text: "All orders require a 25% advance payment to be confirmed. The remaining balance is collected on delivery unless stated otherwise.",
  },
  {
    heading: "Delivery",
    text: "NvFresh delivers once a week, every Sunday morning. Orders are confirmed on Saturday for that week's delivery; orders placed after Saturday's cutoff roll over to the following Sunday. Delivery windows may vary slightly based on location.",
  },
  {
    heading: "Cancellations & Refunds",
    text: "Orders can be cancelled before dispatch for a full refund of the advance amount. Once dispatched, fresh meat and seafood orders cannot be cancelled.",
  },
  {
    heading: "Product Quality",
    text: "If a product does not meet our freshness standards on delivery, contact us within 2 hours for a replacement or refund.",
  },
  {
    heading: "Changes to These Terms",
    text: "We may update these terms occasionally; continued use of NvFresh means you accept the latest version.",
  },
];

export default function TermsScreen() {
  return <StaticScreen title="Terms & Conditions" sections={SECTIONS} />;
}

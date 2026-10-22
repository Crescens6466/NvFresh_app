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
    text: "NvFresh currently delivers only to the following areas:\n• Tadepalli\n• Kunchanapalli\n• Undavalli\n• Nulakapeta\n\nOrders should be accepted for delivery only within these service areas.",
  },
  {
    heading: "Cancellations & Refunds",
    text: "Orders can be cancelled until Saturday at 11:59 PM. Cancellations are not allowed from Sunday 12:00 AM onwards through Sunday 11:59 PM. Eligible cancellations made before the cutoff will receive a refund of the advance payment, subject to the applicable refund process.",
  },
  {
    heading: "Product Quality",
    text: "NvFresh is committed to delivering fresh, hygienic, and quality meat products to our customers.",
  },
  {
    heading: "Changes to These Terms",
    text: "We may update these terms occasionally; continued use of NvFresh means you accept the latest version.",
  },
];

export default function TermsScreen() {
  return <StaticScreen title="Terms & Conditions" sections={SECTIONS} />;
}

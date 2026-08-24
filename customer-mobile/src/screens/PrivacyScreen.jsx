// PrivacyScreen.jsx — ported from customer/src/pages/Privacy.jsx.
import React from "react";
import StaticScreen from "../components/StaticScreen.jsx";

const SECTIONS = [
  {
    heading: "Information We Collect",
    text: "We collect your name, phone number, and delivery address only when you place an order, so we can fulfil and deliver it accurately.",
  },
  {
    heading: "How We Use Your Information",
    text: "Your details are used solely for order processing, delivery coordination, and customer support. We never sell your data to third parties.",
  },
  {
    heading: "Payment Information",
    text: "We collect a transaction reference ID for advance payments; we do not store your card, bank, or UPI credentials on our servers.",
  },
  {
    heading: "Data Security",
    text: "We take reasonable technical measures to protect your information from unauthorized access, alteration, or disclosure.",
  },
  {
    heading: "Contact",
    text: "Questions about this policy can be sent to support@nvfresh.in.",
  },
];

export default function PrivacyScreen() {
  return <StaticScreen title="Privacy Policy" sections={SECTIONS} />;
}

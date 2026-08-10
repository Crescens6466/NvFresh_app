import React from "react";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import "./StaticPage.css";

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="static-page page-fade">
      <div className="static-page-back">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Privacy Policy</h2>
      </div>

      <section>
        <h4>Information We Collect</h4>
        <p>
          We collect your name, phone number, and delivery address only when you place
          an order, so we can fulfil and deliver it accurately.
        </p>
      </section>

      <section>
        <h4>How We Use Your Information</h4>
        <p>
          Your details are used solely for order processing, delivery coordination, and
          customer support. We never sell your data to third parties.
        </p>
      </section>

      <section>
        <h4>Payment Information</h4>
        <p>
          We collect a transaction reference ID for advance payments; we do not store
          your card, bank, or UPI credentials on our servers.
        </p>
      </section>

      <section>
        <h4>Data Security</h4>
        <p>
          We take reasonable technical measures to protect your information from
          unauthorized access, alteration, or disclosure.
        </p>
      </section>

      <section>
        <h4>Contact</h4>
        <p>Questions about this policy can be sent to support@nvfresh.in.</p>
      </section>
    </div>
  );
}

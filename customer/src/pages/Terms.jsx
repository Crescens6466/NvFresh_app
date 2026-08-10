import React from "react";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import "./StaticPage.css";

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div className="static-page page-fade">
      <div className="static-page-back">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Terms & Conditions</h2>
      </div>

      <section>
        <h4>Orders & Advance Payment</h4>
        <p>
          All orders require a 25% advance payment to be confirmed. The remaining
          balance is collected on delivery unless stated otherwise.
        </p>
      </section>

      <section>
        <h4>Delivery</h4>
        <p>
          NvFresh delivers once a week, every Sunday morning. Orders are confirmed on
          Saturday for that week's delivery; orders placed after Saturday's cutoff roll
          over to the following Sunday. Delivery windows may vary slightly based on
          location.
        </p>
      </section>

      <section>
        <h4>Cancellations & Refunds</h4>
        <p>
          Orders can be cancelled before dispatch for a full refund of the advance
          amount. Once dispatched, fresh meat and seafood orders cannot be cancelled.
        </p>
      </section>

      <section>
        <h4>Product Quality</h4>
        <p>
          If a product does not meet our freshness standards on delivery, contact us
          within 2 hours for a replacement or refund.
        </p>
      </section>

      <section>
        <h4>Changes to These Terms</h4>
        <p>We may update these terms occasionally; continued use of NvFresh means you accept the latest version.</p>
      </section>
    </div>
  );
}

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
        <p>NvFresh currently delivers only to the following areas:</p>
        <ul className="static-list">
          <li>Tadepalli</li>
          <li>Kunchanapalli</li>
          <li>Undavalli</li>
          <li>Nulakapeta</li>
        </ul>
        <p>Orders should be accepted for delivery only within these service areas.</p>
      </section>

      <section>
        <h4>Cancellations & Refunds</h4>
        <p>
          Orders can be cancelled until Saturday at 11:59 PM. Cancellations are
          not allowed from Sunday 12:00 AM onwards through Sunday 11:59 PM.
          Eligible cancellations made before the cutoff will receive a refund of
          the advance payment, subject to the applicable refund process.
        </p>
      </section>

      <section>
        <h4>Product Quality</h4>
        <p>
          NvFresh is committed to delivering fresh, hygienic, and quality meat products to our customers.
        </p>
      </section>

      <section>
        <h4>Changes to These Terms</h4>
        <p>We may update these terms occasionally; continued use of NvFresh means you accept the latest version.</p>
      </section>
    </div>
  );
}

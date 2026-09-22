import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft, HiOutlineQrCode, HiOutlineTruck } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api } from "../api.js";
import "./Payment.css";

const ADVANCE_OPTIONS = [25, 50, 75, 100];
const PHONEPE_TEST_MODE = true;

function getMobilePaymentUrl(upiUrl) {
  if (!upiUrl || typeof navigator === "undefined") return upiUrl;

  const isAndroidMobile = /Android/i.test(navigator.userAgent)
    && /Mobile/i.test(navigator.userAgent);
  if (!PHONEPE_TEST_MODE || !isAndroidMobile || !upiUrl.startsWith("upi://pay?")) {
    return upiUrl;
  }

  const phonePeUrl = upiUrl.replace(/^upi:\/\/pay\?/, "phonepe://pay?");
  if (phonePeUrl === upiUrl || phonePeUrl.includes("#")) return upiUrl;

  return phonePeUrl;
}

export default function Payment() {
  const { items, clearCart } = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile, isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();

  const [settings, setSettings] = useState(null);
  const [advancePercentage, setAdvancePercentage] = useState(25);
  // Every amount shown (total, advance, remaining) and the QR itself come
  // from this — the backend recomputes totals from the database, never
  // trusting a frontend-calculated number.
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  // Pre-fill from a saved profile (faster checkout for returning customers) —
  // still fully editable.
  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    address: "",
    transactionId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const mobilePaymentUrl = getMobilePaymentUrl(quote?.upiUrl);

  useEffect(() => {
    if (import.meta.env.DEV && mobilePaymentUrl?.startsWith("phonepe://pay?")) {
      console.log("[payment] PhonePe test URL generated:", mobilePaymentUrl);
    }
  }, [mobilePaymentUrl]);

  useEffect(() => {
    if (items.length === 0) {
      navigate("/cart");
      return;
    }
    // Checkout requires a signed-in customer — bounce to login and come
    // straight back here once they're done.
    if (!authLoading && !isLoggedIn) {
      navigate("/login", { state: { from: "/payment" } });
      return;
    }
    api.getSettings().then(setSettings).catch(() => {});
  }, [authLoading, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetches the quote (totals + dynamic QR) whenever the advance % changes
  // — this never creates or touches an order, so switching between
  // 25/50/75/100% can't ever produce duplicate orders.
  useEffect(() => {
    if (items.length === 0 || authLoading || !isLoggedIn) return;
    let cancelled = false;
    setQuoteLoading(true);
    getIdToken()
      .then((token) =>
        api.getOrderQuote(
          items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
          advancePercentage,
          token
        )
      )
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message || "Could not calculate payment amount", "error");
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancePercentage, authLoading, isLoggedIn, items.length]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address || !form.transactionId) {
      showToast("Please fill in all fields", "error");
      return;
    }
    if (!quote) {
      showToast("Please wait for the payment amount to load", "error");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getIdToken();
      await api.placeOrder(
        {
          customerName: form.name,
          phone: form.phone,
          address: form.address,
          items: items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
          advancePercentage,
          transactionId: form.transactionId,
          transactionReference: quote.transactionReference,
        },
        token
      );
      clearCart();
      navigate("/order-success");
    } catch (err) {
      showToast(err.message || "Could not place order", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const isFullyPaid = advancePercentage === 100;

  return (
    <div className="payment page-fade">
      <div className="payment-header">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Advance Payment</h2>
      </div>

      <div className="payment-notice">
        <p>Pay a minimum of 25% advance to confirm your order — or pay more now, less on delivery.</p>
      </div>

      <div className="schedule-banner" style={{ marginBottom: 16 }}>
        <HiOutlineTruck />
        <span>Orders confirmed Saturday, delivered fresh Sunday morning.</span>
      </div>

      <div className="payment-amount-card">
        <div className="payment-amount-row">
          <span>Order Total</span>
          <span>{quoteLoading && !quote ? "…" : `₹${quote?.total ?? 0}`}</span>
        </div>

        <div className="payment-advance-select">
          <p className="payment-advance-label">Choose Advance Payment</p>
          <div className="payment-advance-chips">
            {ADVANCE_OPTIONS.map((pct) => (
              <button
                key={pct}
                type="button"
                className={`payment-advance-chip ${advancePercentage === pct ? "is-active" : ""}`}
                onClick={() => setAdvancePercentage(pct)}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div className="payment-amount-row payment-amount-highlight">
          <span>Advance Amount ({advancePercentage}%)</span>
          <span>{quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`}</span>
        </div>
        <div className="payment-amount-row">
          <span>Remaining Amount</span>
          <span>{quoteLoading ? "…" : `₹${quote?.remainingAmount ?? 0}`}</span>
        </div>

        {!quoteLoading && quote && (
          <p className={`payment-remaining-note ${isFullyPaid ? "is-full" : ""}`}>
            {isFullyPaid
              ? "Fully paid — Nothing due on delivery"
              : `₹${quote.remainingAmount} remaining — Pay on delivery`}
          </p>
        )}
      </div>

      <div className="payment-qr-card">
        <a
          className={`payment-qr-box ${quote?.qrDataUrl ? "has-image" : ""} ${quote?.upiUrl ? "is-tappable" : ""}`}
          href={quote?.upiUrl || undefined}
          aria-disabled={!quote?.upiUrl}
          onClick={(e) => { if (!quote?.upiUrl) e.preventDefault(); }}
        >
          {quote?.qrDataUrl ? (
            <img src={quote.qrDataUrl} alt="Payment QR code" className="payment-qr-image" />
          ) : (
            <HiOutlineQrCode />
          )}
        </a>
        <p className="payment-qr-label">
          Scan to pay {quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`} via any UPI app
        </p>
        {quote?.upiUrl ? (
          <a className="payment-upi payment-upi-link" href={mobilePaymentUrl}>
            {settings?.upi_id || "nvfresh@upi"}
            <span className="payment-upi-hint">Tap to pay in your UPI app</span>
          </a>
        ) : (
          <p className="payment-upi">{settings?.upi_id || "nvfresh@upi"}</p>
        )}
        <p className="payment-phone">Or pay to: {settings?.phone_number || "+91 98765 43210"}</p>
      </div>

      <form className="payment-form" onSubmit={handleSubmit}>
        <h4>Delivery Details</h4>
        <label>
          Full Name
          <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" />
        </label>
        <label>
          Phone Number
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile number" />
        </label>
        <label>
          Delivery Address
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="House no, street, area, city, pincode"
            rows={3}
          />
        </label>
        <label>
          Transaction ID
          <input
            name="transactionId"
            value={form.transactionId}
            onChange={handleChange}
            placeholder="UPI reference / transaction ID"
          />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting || quoteLoading}>
          {submitting ? "Placing Order..." : "Place Order"}
        </button>
      </form>
    </div>
  );
}

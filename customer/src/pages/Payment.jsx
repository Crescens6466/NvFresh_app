import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft, HiOutlineQrCode, HiOutlineTruck } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api, resolveImageUrl } from "../api.js";
import "./Payment.css";

const ADVANCE_OPTIONS = [25, 50, 75, 100];

export default function Payment() {
  const { items, clearCart } = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile, isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();

  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [advancePercentage, setAdvancePercentage] = useState(25);
  // Every amount shown (total, advance, remaining) comes from quote —
  // the backend recomputes totals from the database, never trusting a
  // frontend-calculated number.
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState("");
  // Pre-fill from a saved profile (faster checkout for returning customers) —
  // still fully editable.
  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    address: "",
    transactionId: "",
  });
  const [submitting, setSubmitting] = useState(false);

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
    setSettingsLoading(true);
    api.getSettings()
      .then((s) => {
        setSettings(s);
        setQrLoadFailed(false);
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, [authLoading, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetches the quote (totals + dynamic QR) whenever the advance % changes
  // — this never creates or touches an order, so switching between
  // 25/50/75/100% can't ever produce duplicate orders.
  useEffect(() => {
    if (items.length === 0 || authLoading || !isLoggedIn) return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError("");
    getIdToken()
      .then((token) =>
        api.getOrderQuote(
          items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
          advancePercentage,
          token
        )
      )
      .then((q) => {
        if (!cancelled) {
          setQuote(q);
          setQuoteError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(err.message || "Could not calculate payment amount");
          showToast(err.message || "Could not calculate payment amount", "error");
        }
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

      {quoteError && (
        <div className="cart-unavailable-warning" style={{ marginBottom: 16 }}>
          <strong>{quoteError}</strong>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 8, padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => navigate("/cart")}
          >
            Return to Cart
          </button>
        </div>
      )}

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
        <div className="payment-qr-amount-section">
          <span className="payment-qr-amount-label">Payment Amount</span>
          <div className="payment-qr-amount-value">
            {quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`}
          </div>
        </div>

        {settingsLoading ? (
          <div className="payment-qr-box is-loading">
            <span className="payment-qr-loading-text">Loading QR...</span>
          </div>
        ) : settings?.qr_image && !qrLoadFailed ? (
          <>
            <div className="payment-qr-box has-image">
              <img
                src={resolveImageUrl(settings.qr_image)}
                alt="Payment QR Code"
                className="payment-qr-image"
                onError={() => setQrLoadFailed(true)}
              />
            </div>
            <p className="payment-qr-instruction">
              Screenshot this QR and make the payment using your preferred UPI app.
            </p>
          </>
        ) : (
          <div className="payment-qr-fallback">
            <HiOutlineQrCode className="payment-qr-fallback-icon" />
            <p className="payment-qr-fallback-text">
              Payment QR is currently unavailable. Please contact support.
            </p>
          </div>
        )}

        {settings?.upi_id && (
          <p className="payment-upi">{settings.upi_id}</p>
        )}
        {settings?.phone_number && (
          <p className="payment-phone">Or pay to: {settings.phone_number}</p>
        )}
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

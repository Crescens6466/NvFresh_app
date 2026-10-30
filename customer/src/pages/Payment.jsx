import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiArrowLeft,
  HiOutlineCreditCard,
  HiOutlineQrCode,
  HiOutlineShieldCheck,
  HiOutlineTruck,
} from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api, resolveImageUrl } from "../api.js";
import {
  isDeliveryAreaServiceable,
  formatServiceableAreaMessage,
} from "../utils/serviceAreas.js";
import "./Payment.css";

const ADVANCE_OPTIONS = [25, 50, 75, 100];

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Payment() {
  const { items, clearCart } = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile, isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();

  const [paymentMethod, setPaymentMethod] = useState("razorpay"); // "razorpay" | "qr"
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
  const [deliveryAreas, setDeliveryAreas] = useState([]);

  useEffect(() => {
    api
      .getDeliveryAreas()
      .then((data) => setDeliveryAreas(Array.isArray(data) ? data : []))
      .catch(() => setDeliveryAreas([]));
  }, []);

  // Pre-load Razorpay script in the background
  useEffect(() => {
    loadRazorpayScript();
  }, []);

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

  // Razorpay standard checkout flow
  async function handleRazorpayCheckout() {
    if (submitting) return;
    if (!form.name || !form.phone || !form.address) {
      showToast("Please enter your name, phone number, and delivery address", "error");
      return;
    }
    const activeNames = deliveryAreas.length > 0 ? deliveryAreas.map((a) => a.name) : undefined;
    if (!isDeliveryAreaServiceable(form.address, activeNames)) {
      showToast(formatServiceableAreaMessage(activeNames), "error");
      return;
    }
    if (!quote) {
      showToast("Please wait for the payment amount to load", "error");
      return;
    }

    setSubmitting(true);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error("Razorpay checkout failed to load. Please check your internet connection.");
      }

      const token = await getIdToken();
      const createOrderPayload = {
        items: items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
        advancePercentage,
        customerName: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        amount: Math.round(quote.advanceAmount * 100),
      };

      const razorpayOrder = await api.createRazorpayOrder(createOrderPayload, token);
      const rzpOrderId = razorpayOrder?.order_id || razorpayOrder?.orderId;
      if (!rzpOrderId) {
        throw new Error("Could not initialize payment order.");
      }

      const rzpKey = razorpayOrder?.key_id || razorpayOrder?.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!rzpKey) {
        throw new Error("Razorpay Key ID is not configured on the server.");
      }

      const options = {
        key: rzpKey,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        name: "NvFresh",
        description: isFullyPaid ? "Full Payment (100%)" : `Advance Payment (${advancePercentage}%)`,
        order_id: rzpOrderId,
        prefill: {
          name: form.name ? form.name.trim() : (profile?.name || ""),
          contact: form.phone ? form.phone.trim() : (profile?.phone || ""),
          email: profile?.email || "",
        },
        notes: {
          address: form.address ? form.address.trim() : "",
        },
        theme: {
          color: "#C62828",
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            showToast("Payment window closed. You can retry anytime.", "info");
          },
        },
        handler: async (response) => {
          try {
            setSubmitting(true);
            const verifyToken = await getIdToken();
            await api.verifyRazorpayPayment(
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderData: {
                  customerName: form.name.trim(),
                  phone: form.phone.trim(),
                  address: form.address.trim(),
                  items: items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
                  advancePercentage,
                },
              },
              verifyToken
            );

            clearCart();
            showToast("Payment verified! Order placed successfully.", "success");
            navigate("/order-success");
          } catch (err) {
            console.error("[payment] Verification error:", err);
            showToast(err.message || "Payment verification failed. Please contact support.", "error");
            setSubmitting(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setSubmitting(false);
        const reason = response.error?.description || response.error?.reason || "Payment failed or was cancelled.";
        showToast(`Payment failed: ${reason}`, "error");
      });

      rzp.open();
    } catch (err) {
      setSubmitting(false);
      showToast(err.message || "Could not launch Razorpay checkout", "error");
    }
  }

  // Manual UPI QR flow
  async function handleManualQrSubmit() {
    if (!form.name || !form.phone || !form.address || !form.transactionId) {
      showToast("Please fill in all fields including the UPI reference / transaction ID", "error");
      return;
    }
    const activeNames = deliveryAreas.length > 0 ? deliveryAreas.map((a) => a.name) : undefined;
    if (!isDeliveryAreaServiceable(form.address, activeNames)) {
      showToast(formatServiceableAreaMessage(activeNames), "error");
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

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (paymentMethod === "razorpay") {
      handleRazorpayCheckout();
    } else {
      handleManualQrSubmit();
    }
  }

  const isFullyPaid = advancePercentage === 100;
  const activeAreaNames = deliveryAreas.length > 0 ? deliveryAreas.map((a) => a.name) : undefined;
  const isAddressServiceable = form.address.trim().length >= 3
    ? isDeliveryAreaServiceable(form.address, activeAreaNames)
    : null;

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

      {/* Order Items Preview */}
      <div className="payment-order-items-card">
        <div className="payment-order-items-header">
          <h4>Items in Order ({items.length})</h4>
          <button
            type="button"
            className="payment-edit-cart-btn"
            onClick={() => navigate("/cart")}
          >
            Edit Cart
          </button>
        </div>
        <div className="payment-order-items-list">
          {items.map((item) => (
            <div key={item.key} className="payment-order-item-row">
              <img
                src={resolveImageUrl(item.image)}
                alt={item.name}
                className="payment-order-item-thumb"
              />
              <div className="payment-order-item-info">
                <div className="payment-order-item-name">{item.name}</div>
                <div className="payment-order-item-meta">{item.weight} × {item.quantity}</div>
              </div>
              <div className="payment-order-item-price">₹{item.price * item.quantity}</div>
            </div>
          ))}
        </div>
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

      <div className="payment-method-section">
        <h3 className="payment-method-heading">Payment Method</h3>
        <div className="payment-method-tabs">
          <button
            type="button"
            className={`payment-method-tab ${paymentMethod === "razorpay" ? "is-active" : ""}`}
            onClick={() => setPaymentMethod("razorpay")}
          >
            <span className="payment-method-tab-title">
              <HiOutlineCreditCard className="payment-method-icon" /> Pay Online
            </span>
            <span className="payment-method-tab-sub">UPI Apps, Cards, NetBanking (Razorpay)</span>
          </button>

          <button
            type="button"
            className={`payment-method-tab ${paymentMethod === "qr" ? "is-active" : ""}`}
            onClick={() => setPaymentMethod("qr")}
          >
            <span className="payment-method-tab-title">
              <HiOutlineQrCode className="payment-method-icon" /> UPI QR Code
            </span>
            <span className="payment-method-tab-sub">Scan QR & enter transaction ID</span>
          </button>
        </div>
      </div>

      {paymentMethod === "razorpay" ? (
        <div className="payment-razorpay-info-card">
          <div className="payment-qr-amount-section">
            <span className="payment-qr-amount-label">Payable Advance</span>
            <div className="payment-qr-amount-value">
              {quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`}
            </div>
          </div>
          <div className="payment-razorpay-secure-note">
            <HiOutlineShieldCheck className="payment-secure-icon" />
            <span>Secured with Razorpay 256-bit encryption</span>
          </div>
          <div className="payment-razorpay-badges">
            <span className="payment-razorpay-badge">Google Pay</span>
            <span className="payment-razorpay-badge">PhonePe</span>
            <span className="payment-razorpay-badge">Paytm</span>
            <span className="payment-razorpay-badge">UPI</span>
            <span className="payment-razorpay-badge">Cards & NetBanking</span>
          </div>
        </div>
      ) : (
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
      )}

      <form className="payment-form" onSubmit={handleSubmit}>
        <h4>Delivery Details</h4>
        <label>
          Full Name
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Your name"
            required
          />
        </label>
        <label>
          Phone Number
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="10-digit mobile number"
            required
          />
        </label>
        <label>
          Delivery Address
          <span className="payment-address-service-note">
            Serviceable areas: Tadepalli, Kunchanapalli, Undavalli, Nulakapeta
          </span>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="House no, street, area (Tadepalli / Kunchanapalli / Undavalli / Nulakapeta)"
            rows={3}
            required
          />
        </label>

        {isAddressServiceable === true && (
          <div className="payment-address-badge is-serviceable">
            <HiOutlineShieldCheck />
            <span>Serviceable delivery area detected</span>
          </div>
        )}
        {isAddressServiceable === false && (
          <div className="payment-address-badge is-warning">
            <span>Please include Tadepalli, Kunchanapalli, Undavalli, or Nulakapeta</span>
          </div>
        )}

        {paymentMethod === "qr" && (
          <label>
            Transaction ID / UTR
            <input
              name="transactionId"
              value={form.transactionId}
              onChange={handleChange}
              placeholder="UPI reference / transaction ID (required for QR)"
              required
            />
          </label>
        )}

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={submitting || quoteLoading}
        >
          {submitting
            ? "Processing..."
            : paymentMethod === "razorpay"
            ? `Pay ₹${quote?.advanceAmount ?? 0} with Razorpay`
            : "Place Order (Manual UPI)"}
        </button>
      </form>
    </div>
  );
}

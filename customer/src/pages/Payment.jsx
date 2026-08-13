import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft, HiOutlineQrCode, HiOutlineTruck } from "react-icons/hi2";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api, resolveImageUrl } from "../api.js";
import "./Payment.css";

export default function Payment() {
  const { items, subtotal, deliveryCharge, total, clearCart } = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile, isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();

  const [settings, setSettings] = useState(null);
  // Pre-fill from a saved profile (faster checkout for returning customers) —
  // still fully editable.
  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    address: "",
    transactionId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const advance = Math.round(total * 0.25);

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

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address || !form.transactionId) {
      showToast("Please fill in all fields", "error");
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
          items,
          subtotal,
          deliveryCharge,
          total,
          advancePaid: advance,
          transactionId: form.transactionId,
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

  return (
    <div className="payment page-fade">
      <div className="payment-header">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Advance Payment</h2>
      </div>

      <div className="payment-notice">
        <p>Pay only 25% advance to confirm your order.</p>
      </div>

      <div className="schedule-banner" style={{ marginBottom: 16 }}>
        <HiOutlineTruck />
        <span>Orders confirmed Saturday, delivered fresh Sunday morning.</span>
      </div>

      <div className="payment-amount-card">
        <div className="payment-amount-row">
          <span>Order Total</span>
          <span>₹{total}</span>
        </div>
        <div className="payment-amount-row payment-amount-highlight">
          <span>Advance Amount (25%)</span>
          <span>₹{advance}</span>
        </div>
      </div>

      <div className="payment-qr-card">
        <div className={`payment-qr-box ${settings?.qr_image ? "has-image" : ""}`}>
          {settings?.qr_image ? (
            <img src={resolveImageUrl(settings.qr_image)} alt="Payment QR code" className="payment-qr-image" />
          ) : (
            <HiOutlineQrCode />
          )}
        </div>
        <p className="payment-qr-label">Scan to pay via any UPI app</p>
        <p className="payment-upi">{settings?.upi_id || "nvfresh@upi"}</p>
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

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Placing Order..." : "Place Order"}
        </button>
      </form>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiArrowLeft, HiOutlineClipboardDocumentList } from "react-icons/hi2";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api } from "../api.js";
import "./OrderHistory.css";

export default function OrderHistory() {
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      navigate("/login", { state: { from: "/orders" } });
      return;
    }
    getIdToken()
      .then((token) => api.getMyOrders(token))
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="order-history page-fade">
      <div className="payment-header">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>My Orders</h2>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 120, marginBottom: 12 }} />
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <HiOutlineClipboardDocumentList />
          <h3>No orders yet</h3>
          <p>Your placed orders will show up here.</p>
        </div>
      ) : (
        <div className="order-history-list">
          {orders.map((o) => (
            <div className="order-history-card" key={o.id}>
              <div className="order-history-top">
                <span className="order-history-id">#{o.id.slice(-6)}</span>
                <span className="order-history-pills">
                  <span className={`order-status-pill payment-status-${o.advance_payment_status}`}>
                    {o.advance_payment_status}
                  </span>
                  <span className={`order-status-pill order-status-${o.status}`}>{o.status}</span>
                </span>
              </div>
              {o.status === "Cancelled" && o.cancellation_reason && (
                <p className="order-history-cancel-reason">Reason: {o.cancellation_reason}</p>
              )}
              <ul className="order-history-items">
                {o.items.map((item, i) => (
                  <li key={i}>
                    {item.name} — {item.weight} × {item.quantity}
                  </li>
                ))}
              </ul>
              <div className="order-history-bottom">
                <span>Total: ₹{o.total}</span>
                <span>Advance paid ({o.advance_percentage}%): ₹{o.advance_paid}</span>
              </div>
              <p className={`order-history-remaining ${o.remaining_amount === 0 ? "is-full" : ""}`}>
                {o.remaining_amount === 0
                  ? "Fully paid — Nothing due on delivery"
                  : `₹${o.remaining_amount} remaining — Pay on delivery`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

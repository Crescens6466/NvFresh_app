import React, { useEffect, useState } from "react";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import "./Orders.css";

const STATUSES = ["Pending", "Preparing", "Delivered", "Cancelled"];
const FILTERS = ["All", ...STATUSES];

export default function Orders() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  function loadOrders() {
    setLoading(true);
    api
      .getOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  }

  useEffect(loadOrders, []);

  async function handleStatusChange(id, status) {
    try {
      await api.updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      showToast(`Order #${id} marked ${status}`);
    } catch (err) {
      showToast(err.message || "Could not update status", "error");
    }
  }

  // Only the admin can confirm a payment — never automatic, never
  // customer-triggered. Verify the money actually arrived before clicking.
  async function handleMarkPaid(id) {
    if (!window.confirm("Confirm you've verified this payment in your UPI/bank account?")) return;
    try {
      await api.updatePaymentStatus(id, "Paid");
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, advance_payment_status: "Paid" } : o)));
      showToast(`Order #${id} payment marked Paid`);
    } catch (err) {
      showToast(err.message || "Could not update payment status", "error");
    }
  }

  const filtered = filter === "All" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="orders page-fade">
      <h2 className="page-title">Orders</h2>
      <p className="page-subtitle">Track and manage customer orders.</p>

      <div className="orders-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`orders-filter-chip ${filter === f ? "is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card orders-table-wrap">
        {loading ? (
          <div className="skeleton" style={{ height: 240, margin: 16 }} />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <HiOutlineClipboardDocumentList />
            <h3>No orders found</h3>
            <p>Orders placed by customers will appear here.</p>
          </div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Products</th>
                <th>Amount</th>
                <th>Advance</th>
                <th>Remaining</th>
                <th>Transaction ID</th>
                <th>Payment Status</th>
                <th>Fulfillment Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.customer_name}</td>
                  <td>{o.phone}</td>
                  <td className="orders-products-cell">
                    <ul className="orders-product-list">
                      {o.items.map((i, idx) => (
                        <li key={idx}>
                          <span className="orders-product-name">{i.name}</span>
                          <span className="orders-product-meta">
                            {i.weight} × {i.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>₹{o.total}</td>
                  <td>
                    ₹{o.advance_paid}
                    <br />
                    <span className="orders-product-meta">({o.advance_percentage}%)</span>
                  </td>
                  <td>{o.remaining_amount === 0 ? "Fully paid" : `₹${o.remaining_amount}`}</td>
                  <td>{o.transaction_id}</td>
                  <td>
                    <span className={`payment-status-pill status-${o.advance_payment_status}`}>
                      {o.advance_payment_status}
                    </span>
                    {o.advance_payment_status !== "Paid" && (
                      <button className="btn btn-ghost orders-mark-paid-btn" onClick={() => handleMarkPaid(o.id)}>
                        Mark Paid
                      </button>
                    )}
                  </td>
                  <td>
                    <select
                      className={`status-select status-${o.status}`}
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

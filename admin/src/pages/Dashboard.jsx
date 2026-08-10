import React, { useEffect, useState } from "react";
import {
  HiOutlineCube,
  HiOutlineClipboardDocumentList,
  HiOutlineUsers,
  HiOutlineBanknotes,
  HiOutlineClock,
} from "react-icons/hi2";
import { api } from "../api.js";
import "./Dashboard.css";

const STAT_CARDS = [
  { key: "totalProducts", label: "Total Products", Icon: HiOutlineCube, color: "#C62828" },
  { key: "totalOrders", label: "Total Orders", Icon: HiOutlineClipboardDocumentList, color: "#0277BD" },
  { key: "totalCustomers", label: "Total Customers", Icon: HiOutlineUsers, color: "#2E7D32" },
  { key: "pendingOrders", label: "Pending Orders", Icon: HiOutlineClock, color: "#EF6C00" },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard page-fade">
      <h2 className="page-title">Dashboard</h2>
      <p className="page-subtitle">Welcome back — here's how NvFresh is doing today.</p>

      <div className="dashboard-stats">
        {STAT_CARDS.map(({ key, label, Icon, color }) => (
          <div className="stat-card" key={key}>
            <div className="stat-icon" style={{ background: `${color}1A`, color }}>
              <Icon />
            </div>
            <div>
              <p className="stat-value">{loading ? "—" : stats?.[key] ?? 0}</p>
              <p className="stat-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-revenue">
        <div className="revenue-card">
          <HiOutlineBanknotes />
          <div>
            <p className="stat-label">Total Order Value</p>
            <p className="stat-value">₹{loading ? "—" : stats?.revenue ?? 0}</p>
          </div>
        </div>
        <div className="revenue-card">
          <HiOutlineBanknotes />
          <div>
            <p className="stat-label">Advance Collected</p>
            <p className="stat-value">₹{loading ? "—" : stats?.advanceCollected ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="card dashboard-recent">
        <h3>Recent Orders</h3>
        {loading ? (
          <div className="skeleton" style={{ height: 120, marginTop: 12 }} />
        ) : !stats?.recentOrders?.length ? (
          <p className="dashboard-empty">No orders yet.</p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>{o.customer_name}</td>
                  <td>{o.phone}</td>
                  <td>₹{o.total}</td>
                  <td>
                    <span className={`status-pill status-${o.status}`}>{o.status}</span>
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

import React, { useEffect, useState } from "react";
import { HiOutlineMagnifyingGlass, HiOutlineUsers } from "react-icons/hi2";
import { api } from "../api.js";
import "./Customers.css";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .getCustomers(search)
        .then(setCustomers)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="customers page-fade">
      <h2 className="page-title">Customers</h2>
      <p className="page-subtitle">View and search your customer base.</p>

      <div className="customers-search">
        <HiOutlineMagnifyingGlass />
        <input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card customers-table-wrap">
        {loading ? (
          <div className="skeleton" style={{ height: 240, margin: 16 }} />
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <HiOutlineUsers />
            <h3>No customers found</h3>
            <p>Customers appear automatically when they place an order.</p>
          </div>
        ) : (
          <table className="customers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td className="customers-address-cell">{c.address}</td>
                  <td>
                    <span className="customers-order-count">{c.ordersCount}</span>
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

import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useCustomerAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.phone) {
      showToast("Please enter your name and phone number", "error");
      return;
    }
    login(form);
    showToast(`Welcome, ${form.name}!`);
    navigate(location.state?.from || "/profile", { replace: true });
  }

  return (
    <div className="customer-login page-fade">
      <div className="payment-header">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Sign In</h2>
      </div>

      <p className="customer-login-subtitle">
        Save your details for faster checkout next time — no password needed.
      </p>

      <form className="payment-form" onSubmit={handleSubmit}>
        <label>
          Full Name
          <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" />
        </label>
        <label>
          Phone Number
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="10-digit mobile number"
          />
        </label>
        <label>
          Delivery Address (optional)
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="House no, street, area, city, pincode"
            rows={3}
          />
        </label>
        <button className="btn btn-primary btn-block" type="submit">
          Continue
        </button>
      </form>
    </div>
  );
}

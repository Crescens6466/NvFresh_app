import React from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import "./OrderSuccess.css";

export default function OrderSuccess() {
  const navigate = useNavigate();

  return (
    <div className="order-success page-fade">
      <div className="order-success-icon">
        <HiOutlineCheckCircle />
      </div>
      <h2>Order Placed!</h2>
      <p>
        Thank you! Your advance payment has been recorded. Your order will be confirmed
        this Saturday and delivered fresh on Sunday morning — we'll reach out on your
        registered phone number if we need anything else.
      </p>
      <button className="btn btn-primary" onClick={() => navigate("/")}>
        Continue Shopping
      </button>
    </div>
  );
}

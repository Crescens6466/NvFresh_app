// models/Order.js — Mongoose schema for orders
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    name: String,
    weight: String,
    quantity: Number,
    price: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer_name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    delivery_charge: { type: Number, required: true },
    total: { type: Number, required: true },
    advance_paid: { type: Number, required: true },
    transaction_id: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Preparing", "Delivered", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Order", orderSchema);

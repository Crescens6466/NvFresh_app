// models/Customer.js — Mongoose schema for customers
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    address: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Customer", customerSchema);

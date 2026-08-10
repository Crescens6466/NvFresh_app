// models/Product.js — Mongoose schema for products
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    image: { type: String, default: "" },
    weights: {
      type: [String],
      default: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
    },
    stock: { type: Number, default: 0 },
    badge: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Product", productSchema);

// models/Customer.js — Mongoose schema for customers
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    address: { type: String, default: "" },
    delivery_location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      formatted_address: { type: String, default: null, alias: "formattedAddress" },
      delivery_area: { type: String, default: null, alias: "deliveryArea" },
      place_id: { type: String, default: null, alias: "placeId" },
      verified: { type: Boolean, default: false },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Customer", customerSchema);

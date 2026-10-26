// models/Settings.js — Mongoose schema for the single business-settings document
import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  business_name: { type: String, default: "NvFresh" },
  phone_number: { type: String, default: "+91 98765 43210" },
  upi_id: { type: String, default: "nvfresh@upi" },
  qr_image: { type: String, default: null },
  delivery_charge: { type: Number, default: 0 },
  support_email: { type: String, default: "support@nvfresh.in" },
  business_address: {
    type: String,
    default: "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India",
  },
  support_hours: { type: String, default: "Everyday, 7:00 AM – 9:00 PM" },
  delivery_schedule: {
    type: String,
    default: "Orders confirmed Saturday, delivered fresh every Sunday morning",
  },
});

export default mongoose.model("Settings", settingsSchema);

// models/Settings.js — Mongoose schema for the single business-settings document
import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  business_name: { type: String, default: "NvFresh" },
  phone_number: { type: String, default: "+91 98765 43210" },
  upi_id: { type: String, default: "nvfresh@upi" },
  qr_image: { type: String, default: null },
  delivery_charge: { type: Number, default: 0 },
});

export default mongoose.model("Settings", settingsSchema);

// models/PhoneOtp.js — short-lived OTP codes for customer phone login.
import mongoose from "mongoose";

const phoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// TTL index — MongoDB automatically deletes documents once expiresAt has
// passed, so expired/used codes don't pile up.
phoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PhoneOtp", phoneOtpSchema);

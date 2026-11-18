// models/AccountDeletionRecord.js — tracks authenticated customer account
// deletion requests for idempotency, failure recovery, and auditability.
// Stores no personal contact details (no name, phone, email, or address).
import mongoose from "mongoose";

const accountDeletionRecordSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    auth_provider: { type: String, enum: ["firebase", "phone"], required: true },
    status: {
      type: String,
      enum: ["in_progress", "completed", "pending_manual_review"],
      default: "in_progress",
    },
    requested_at: { type: Date, default: Date.now },
    completed_at: { type: Date, default: null },
    firebase_deleted: { type: Boolean, default: false },
    profile_deleted: { type: Boolean, default: false },
    tokens_deleted_count: { type: Number, default: 0 },
    notifications_deleted_count: { type: Number, default: 0 },
    orders_anonymized_count: { type: Number, default: 0 },
    active_orders_preserved_count: { type: Number, default: 0 },
    last_error: { type: String, default: "" },
    deletion_count: { type: Number },
  },
  { versionKey: false }
);

export default mongoose.model("AccountDeletionRecord", accountDeletionRecordSchema);


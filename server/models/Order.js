// models/Order.js — Mongoose schema for orders
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    name: String,
    weight: String,
    quantity: Number,
    price: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Links the order to the signed-in customer — either a Firebase uid
    // (Google sign-in) or "phone:<digits>" (WhatsApp OTP sign-in) — so they
    // can see it in their order history. Null for orders placed before
    // customer login existed — those just won't appear in "My Orders".
    customer_uid: { type: String, index: true, default: null },
    customer_name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    delivery_charge: { type: Number, required: true },
    total: { type: Number, required: true },
    // The advance amount due (not necessarily yet paid — see
    // advance_payment_status for the actual payment state). Name kept as-is
    // since it already existed and means the same thing.
    advance_paid: { type: Number, required: true },
    advance_percentage: { type: Number, enum: [25, 50, 75, 100], required: true },
    remaining_amount: { type: Number, required: true },
    // transaction_id doubles as the UPI UTR the customer provides as proof
    // of the advance payment.
    transaction_id: { type: String, required: true },
    // Payment verification is manual — admin only, never flips to Paid
    // automatically just because a UTR was submitted.
    advance_payment_status: {
      type: String,
      enum: ["Pending", "Verifying", "Paid"],
      default: "Verifying", // a UTR is already required to create the order
    },
    status: {
      type: String,
      enum: ["Pending", "Preparing", "Delivered", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Order", orderSchema);

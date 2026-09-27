import mongoose from "mongoose";

const customerNotificationSchema = new mongoose.Schema(
  {
    recipientCustomer: { type: String, required: true, index: true },
    eventKey: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: [
        "order_placed",
        "payment_confirmed",
        "order_preparing",
        "order_delivered",
        "order_cancelled",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    isRead: { type: Boolean, default: false },
    deliveryStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "no_tokens"],
      default: "pending",
    },
    deliveryAttempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

customerNotificationSchema.index({ recipientCustomer: 1, createdAt: -1 });

export default mongoose.model("CustomerNotification", customerNotificationSchema);

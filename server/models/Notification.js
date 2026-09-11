import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export default mongoose.model("Notification", notificationSchema);

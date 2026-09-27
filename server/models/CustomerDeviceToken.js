import mongoose from "mongoose";

const customerDeviceTokenSchema = new mongoose.Schema(
  {
    customerUid: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["web", "android"], required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

customerDeviceTokenSchema.index({ customerUid: 1, platform: 1 });

export default mongoose.model("CustomerDeviceToken", customerDeviceTokenSchema);

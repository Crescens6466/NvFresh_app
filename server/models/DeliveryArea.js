// models/DeliveryArea.js — Mongoose schema for serviceable delivery areas
import mongoose from "mongoose";

const deliveryAreaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Area name is required"],
      trim: true,
      minlength: [2, "Area name must be at least 2 characters"],
      maxlength: [100, "Area name cannot exceed 100 characters"],
    },
    normalized_name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export default mongoose.model("DeliveryArea", deliveryAreaSchema);

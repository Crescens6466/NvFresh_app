// models/Admin.js — Mongoose schema for admin accounts
import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fcm_tokens: {
    type: [
      {
        token: { type: String, required: true },
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
});

export default mongoose.model("Admin", adminSchema);

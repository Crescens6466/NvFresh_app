// api/index.js — Vercel serverless entry point.
// vercel.json rewrites every request here; the Express app in ../app.js
// handles routing internally from there, exactly as it does locally.
import "dotenv/config";
import app from "../app.js";
import { connectDB } from "../db.js";

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Database connection failed" }));
    return;
  }
  return app(req, res);
}

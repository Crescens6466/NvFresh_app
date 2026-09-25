// app.js — the Express app itself, with no listener attached.
// server.js and api/index.js wrap it in an HTTP server; api/index.js also
// attaches Socket.IO for Vercel's WebSocket-capable Functions runtime.
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import customersRouter from "./routes/customers.js";
import authRouter from "./routes/auth.js";
import customerAuthRouter from "./routes/customerAuth.js";
import uploadRouter from "./routes/upload.js";
import settingsRouter from "./routes/settings.js";
import dashboardRouter from "./routes/dashboard.js";
import filesRouter from "./routes/files.js";
import adminNotificationsRouter from "./routes/adminNotifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Trust Vercel's proxy so req.ip reflects the real client IP (used for
// OTP request rate limiting) instead of the proxy's own address.
app.set("trust proxy", true);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "NvFresh API" }));

app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/auth", authRouter);
app.use("/api/customer-auth", customerAuthRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/files", filesRouter);
app.use("/api/admin-notifications", adminNotificationsRouter);

// central error handler (e.g. multer file-type errors, Mongoose errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default app;

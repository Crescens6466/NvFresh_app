// server.js — local dev entry point (persistent listener).
// For Vercel's serverless runtime, see api/index.js instead — Vercel invokes
// the Express app directly per-request rather than through app.listen().
import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { connectDB } from "./db.js";
import { setupRealtime } from "./realtime.js";

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    const httpServer = createServer(app);
    setupRealtime(httpServer);
    httpServer.listen(PORT, () => {
      console.log(`NvFresh API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });

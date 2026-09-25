// server.js — local dev entry point (persistent listener).
// Vercel uses api/index.js, which exports the same HTTP + Socket.IO server
// shape for its WebSocket-capable Functions runtime.
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

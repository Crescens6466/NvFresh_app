// api/index.js — Vercel HTTP/WebSocket entry point.
// vercel.json rewrites requests here. The exported HTTP server serves both
// Express REST requests and Socket.IO upgrades on the same Vercel Function.
import "dotenv/config";
import { createServer } from "http";
import app from "../app.js";
import { connectDB } from "../db.js";
import { setupRealtime } from "../realtime.js";

let dbPromise;

function ensureDatabaseConnection() {
  if (!dbPromise) {
    dbPromise = connectDB().catch((err) => {
      dbPromise = undefined;
      throw err;
    });
  }

  return dbPromise;
}

const httpServer = createServer(async (req, res) => {
  try {
    await ensureDatabaseConnection();
    app(req, res);
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Database connection failed" }));
  }
});

setupRealtime(httpServer);

export default httpServer;

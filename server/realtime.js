import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./middleware/auth.js";

let io;

export function setupRealtime(server) {
  io = new Server(server, {
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      socket.admin = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`admin:${socket.admin.id}`);
  });

  return io;
}

export function emitAdminNotification(adminId, notification) {
  if (!io) return;
  io.to(`admin:${adminId}`).emit("new_admin_notification", notification);
}

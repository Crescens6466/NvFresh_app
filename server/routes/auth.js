// routes/auth.js — admin login (MongoDB)
import express from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { JWT_SECRET } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const admin = await Admin.findOne({ username });
    if (!admin || admin.password !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign({ id: admin._id.toString(), username: admin.username }, JWT_SECRET, {
      expiresIn: "8h",
    });
    res.json({ token, username: admin.username });
  } catch (err) {
    next(err);
  }
});

export default router;

// routes/upload.js — image upload handling with Multer, delegated to the
// active storage provider (see server/storage/).
import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { getStorageProvider } from "../storage/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router = express.Router();

router.post("/", requireAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const storage = getStorageProvider();
    const { url } = await storage.upload(req.file.buffer, {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

export default router;

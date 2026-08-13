// routes/upload.js — image upload handling with Multer, delegated to the
// active storage provider (see server/storage/).
import express from "express";
import multer from "multer";
import sharp from "sharp";
import { requireAuth } from "../middleware/auth.js";
import { getStorageProvider } from "../storage/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  // Raw upload cap before compression — phone camera photos can be large;
  // compressImage() shrinks them down before they ever reach storage.
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router = express.Router();

// Longer side capped at this — comfortably larger than any product photo or
// QR image is ever displayed at, so downscaling doesn't cost visible clarity.
const MAX_DIMENSION = 1200;

// PNGs stay PNG (lossless — important for QR codes, where JPEG's block
// artifacts around sharp edges can break scannability). Every other format
// normalizes to JPEG at a high quality setting.
async function compressImage(buffer, mimetype) {
  const image = sharp(buffer).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (mimetype === "image/png") {
    return { buffer: await image.png({ compressionLevel: 9 }).toBuffer(), mimetype: "image/png" };
  }
  return { buffer: await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer(), mimetype: "image/jpeg" };
}

router.post("/", requireAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { buffer, mimetype } = await compressImage(req.file.buffer, req.file.mimetype);
    const storage = getStorageProvider();
    const { url } = await storage.upload(buffer, {
      filename: req.file.originalname,
      mimetype,
    });
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

export default router;

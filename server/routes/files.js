// routes/files.js — streams files back out of the active storage provider.
// Only relevant for providers that don't hand out a public URL directly
// (GridFS, local); S3-style providers return a public URL and never hit this.
import express from "express";
import { getStorageProvider } from "../storage/index.js";

const router = express.Router();

router.get("/:id", async (req, res, next) => {
  try {
    const storage = getStorageProvider();
    if (typeof storage.getStream !== "function") {
      return res.status(404).json({ error: "File not found" });
    }

    const result = await storage.getStream(req.params.id);
    if (!result) return res.status(404).json({ error: "File not found" });

    res.set("Content-Type", result.file.contentType || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    result.stream.once("error", next);
    result.stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;

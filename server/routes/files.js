// routes/files.js — streams files back out of the active storage provider with on-demand image optimization
import express from "express";
import sharp from "sharp";
import { getStorageProvider } from "../storage/index.js";

const router = express.Router();

// In-memory cache for transformed image variants to prevent redundant Sharp processing
// Max 150 items to keep memory bounded in serverless environments
const MAX_CACHE_ENTRIES = 150;
const transformCache = new Map();

function getCacheKey(id, width, format, quality) {
  return `${id}:${width || "orig"}:${format || "orig"}:${quality || "def"}`;
}

function addToCache(key, entry) {
  if (transformCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = transformCache.keys().next().value;
    transformCache.delete(oldestKey);
  }
  transformCache.set(key, entry);
}

router.get("/:id", async (req, res, next) => {
  try {
    const storage = getStorageProvider();
    if (typeof storage.getStream !== "function") {
      return res.status(404).json({ error: "File not found" });
    }

    const { id } = req.params;
    let { w, width, size, format, q, quality } = req.query;

    // Resolve width preset
    let targetWidth = null;
    const sizeParam = (size || "").toLowerCase();
    if (sizeParam === "thumb" || sizeParam === "thumbnail") {
      targetWidth = 400;
    } else if (sizeParam === "detail" || sizeParam === "large" || sizeParam === "hero") {
      targetWidth = 800;
    } else if (w || width) {
      const parsedW = parseInt(w || width, 10);
      if (!isNaN(parsedW) && parsedW > 0) {
        targetWidth = Math.min(Math.max(parsedW, 50), 2000);
      }
    }

    // Resolve format
    let targetFormat = (format || "").toLowerCase();
    const acceptHeader = req.headers.accept || "";
    const clientSupportsWebp = acceptHeader.includes("image/webp");

    // If client requested webp explicitly or accepts webp, default to webp for optimizations
    if (!targetFormat && (targetWidth || clientSupportsWebp)) {
      targetFormat = "webp";
    }

    // Resolve quality
    let targetQuality = 80;
    const qParam = parseInt(q || quality, 10);
    if (!isNaN(qParam) && qParam >= 10 && qParam <= 100) {
      targetQuality = qParam;
    } else if (targetWidth && targetWidth > 600) {
      targetQuality = 82;
    }

    // Generate ETag for the requested variant
    const cacheKey = getCacheKey(id, targetWidth, targetFormat, targetQuality);
    const etag = `W/"${id}-${targetWidth || 'orig'}-${targetFormat || 'orig'}-${targetQuality}"`;

    // Check client conditional caching
    if (req.headers["if-none-match"] === etag) {
      res.set({
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        "Vary": "Accept, Accept-Encoding",
      });
      return res.status(304).end();
    }

    // Check memory cache
    if (transformCache.has(cacheKey)) {
      const cached = transformCache.get(cacheKey);
      res.set({
        "Content-Type": cached.contentType,
        "Content-Length": cached.buffer.length,
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        "Vary": "Accept, Accept-Encoding",
      });
      return res.send(cached.buffer);
    }

    const result = await storage.getStream(id);
    if (!result) return res.status(404).json({ error: "File not found" });

    const originalContentType = result.file.contentType || "application/octet-stream";
    const isImage = originalContentType.startsWith("image/") && !originalContentType.includes("svg");

    // If not an image or no transformation requested and format is original, stream directly
    if (!isImage || (!targetWidth && targetFormat !== "webp")) {
      res.set({
        "Content-Type": originalContentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": `W/"${result.file._id}-orig"`,
        "Vary": "Accept, Accept-Encoding",
      });
      result.stream.once("error", next);
      return result.stream.pipe(res);
    }

    // Read full original stream into buffer for sharp processing
    const chunks = [];
    result.stream.on("data", (chunk) => chunks.push(chunk));
    result.stream.once("error", next);
    result.stream.once("end", async () => {
      try {
        const inputBuffer = Buffer.concat(chunks);
        let transformer = sharp(inputBuffer);

        if (targetWidth) {
          transformer = transformer.resize({
            width: targetWidth,
            withoutEnlargement: true,
          });
        }

        let outputContentType = originalContentType;
        if (targetFormat === "webp") {
          transformer = transformer.webp({ quality: targetQuality });
          outputContentType = "image/webp";
        } else if (targetFormat === "jpeg" || targetFormat === "jpg") {
          transformer = transformer.jpeg({ quality: targetQuality, progressive: true });
          outputContentType = "image/jpeg";
        } else if (targetFormat === "png") {
          transformer = transformer.png({ compressionLevel: 8 });
          outputContentType = "image/png";
        }

        const outputBuffer = await transformer.toBuffer();

        // Save in memory cache
        addToCache(cacheKey, { buffer: outputBuffer, contentType: outputContentType });

        res.set({
          "Content-Type": outputContentType,
          "Content-Length": outputBuffer.length,
          "Cache-Control": "public, max-age=31536000, immutable",
          "ETag": etag,
          "Vary": "Accept, Accept-Encoding",
        });
        return res.send(outputBuffer);
      } catch (transformErr) {
        console.warn("[files] Image transform failed, serving original:", transformErr.message);
        const fallbackBuffer = Buffer.concat(chunks);
        res.set({
          "Content-Type": originalContentType,
          "Content-Length": fallbackBuffer.length,
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        return res.send(fallbackBuffer);
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

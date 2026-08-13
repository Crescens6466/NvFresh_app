// storage/LocalStorageProvider.js — original disk-based behavior, kept as a
// fallback/dev option (STORAGE_PROVIDER=local). Not recommended in production:
// most hosts wipe local disk on redeploy/restart, and it doesn't work at all
// on read-only filesystems (e.g. Vercel serverless).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { StorageProvider } from "./StorageProvider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");

export class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  }

  upload(buffer, { filename }) {
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(filename)}`;
    fs.writeFileSync(path.join(uploadsDir, key), buffer);
    return Promise.resolve({ url: `/uploads/${key}`, key });
  }

  async delete(key) {
    const filePath = path.join(uploadsDir, key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

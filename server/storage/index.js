// storage/index.js — picks the active storage backend from STORAGE_PROVIDER.
// This is the single place that knows which provider is active; everywhere
// else in the app just calls getStorageProvider().upload(...).
import { GridFSStorageProvider } from "./GridFSStorageProvider.js";
import { LocalStorageProvider } from "./LocalStorageProvider.js";
import { S3StorageProvider } from "./S3StorageProvider.js";

let instance = null;

export function getStorageProvider() {
  if (instance) return instance;

  const provider = (process.env.STORAGE_PROVIDER || "gridfs").toLowerCase();

  switch (provider) {
    case "gridfs":
      instance = new GridFSStorageProvider({ bucketName: process.env.GRIDFS_BUCKET || "uploads" });
      break;
    case "local":
      instance = new LocalStorageProvider();
      break;
    case "s3":
      instance = new S3StorageProvider({
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION,
        publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
        endpoint: process.env.S3_ENDPOINT,
      });
      break;
    default:
      throw new Error(`Unknown STORAGE_PROVIDER "${provider}" (expected gridfs, local, or s3)`);
  }

  return instance;
}

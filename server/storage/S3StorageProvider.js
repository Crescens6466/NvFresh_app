// storage/S3StorageProvider.js — skeleton for a future move to Amazon S3, or
// any S3-compatible bucket (Cloudflare R2, Backblaze B2, DigitalOcean Spaces,
// MinIO — they all speak this same API, just with a different `endpoint`).
//
// To activate:
//   1. npm install @aws-sdk/client-s3
//   2. Set STORAGE_PROVIDER=s3 and the S3_* vars in .env (see .env.example)
// The @aws-sdk/client-s3 import below is dynamic (await import(...)), so this
// file loads fine even when the package isn't installed — it only matters if
// STORAGE_PROVIDER is actually set to "s3".
import { StorageProvider } from "./StorageProvider.js";

export class S3StorageProvider extends StorageProvider {
  constructor({ bucket, region, publicBaseUrl, endpoint } = {}) {
    super();
    if (!bucket || !region) {
      throw new Error(
        "S3StorageProvider requires S3_BUCKET and S3_REGION to be set in .env"
      );
    }
    this.bucket = bucket;
    this.region = region;
    this.endpoint = endpoint; // set for R2/Spaces/MinIO; leave unset for real AWS S3
    this.publicBaseUrl = publicBaseUrl || `https://${bucket}.s3.${region}.amazonaws.com`;
    this._client = null;
  }

  async _getClient() {
    if (!this._client) {
      const { S3Client } = await import("@aws-sdk/client-s3");
      this._client = new S3Client({ region: this.region, endpoint: this.endpoint });
    }
    return this._client;
  }

  async upload(buffer, { filename, mimetype }) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this._getClient();
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${filename}`;
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ACL: "public-read",
      })
    );
    return { url: `${this.publicBaseUrl}/${key}`, key };
  }

  async delete(key) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this._getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  // No getStream(): S3 URLs are public/direct, so routes/files.js isn't
  // involved for this provider — the browser loads the S3 URL straight.
}

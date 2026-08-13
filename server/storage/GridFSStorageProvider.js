// storage/GridFSStorageProvider.js — stores files inside the MongoDB Atlas
// cluster using GridFS. No extra service/account needed beyond the Atlas
// cluster you already have for the rest of the data.
import mongoose from "mongoose";
import { StorageProvider } from "./StorageProvider.js";

export class GridFSStorageProvider extends StorageProvider {
  constructor({ bucketName = "uploads" } = {}) {
    super();
    this.bucketName = bucketName;
    this._bucket = null;
  }

  _getBucket() {
    if (!this._bucket) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error("GridFS storage requires an active MongoDB connection");
      }
      this._bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: this.bucketName,
      });
    }
    return this._bucket;
  }

  upload(buffer, { filename, mimetype }) {
    const bucket = this._getBucket();
    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, { contentType: mimetype });
      uploadStream.once("error", reject);
      uploadStream.once("finish", () => {
        const id = String(uploadStream.id);
        resolve({ url: `/api/files/${id}`, key: id });
      });
      uploadStream.end(buffer);
    });
  }

  async delete(key) {
    const bucket = this._getBucket();
    try {
      await bucket.delete(new mongoose.Types.ObjectId(key));
    } catch (err) {
      if (!/file not found/i.test(err.message)) throw err;
    }
  }

  // Used by routes/files.js to stream a file back out.
  async getStream(key) {
    const bucket = this._getBucket();
    let _id;
    try {
      _id = new mongoose.Types.ObjectId(key);
    } catch {
      return null;
    }
    const [file] = await bucket.find({ _id }).toArray();
    if (!file) return null;
    return { stream: bucket.openDownloadStream(_id), file };
  }
}

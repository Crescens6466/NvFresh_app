// storage/StorageProvider.js — the contract every storage backend implements.
//
// Swapping providers (GridFS → S3 → Cloudinary → whatever comes next) means
// writing one new class that satisfies this shape and flipping STORAGE_PROVIDER
// in .env — nothing in routes/models changes, since they only ever see the
// `url` string that upload() returns.
export class StorageProvider {
  /**
   * @param {Buffer} buffer - file contents
   * @param {{ filename: string, mimetype: string }} meta
   * @returns {Promise<{ url: string, key: string }>} url is what gets saved on
   *   the document (Product.image, Settings.qr_image, etc). key is the
   *   provider-internal handle used to delete the file later.
   */
  async upload(buffer, meta) {
    throw new Error("upload() not implemented");
  }

  /**
   * @param {string} key
   */
  async delete(key) {
    throw new Error("delete() not implemented");
  }
}

// tests/files.test.js — Image delivery, optimization, WebP generation and caching suite
import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: new URL("../.env", import.meta.url) });
process.env.NODE_ENV = "test";

import app from "../app.js";
import { connectDB } from "../db.js";
import Product from "../models/Product.js";
import { getStorageProvider } from "../storage/index.js";

test("Image Delivery & Optimization Suite", async (t) => {
  let server;
  let baseUrl;
  let sampleImageId;

  await t.test("Setup test server and database connection", async () => {
    await connectDB();
    const product = await Product.findOne({ image: { $regex: /^\/api\/files\// } });
    assert.ok(product, "Should find at least one product with GridFS image");
    sampleImageId = product.image.replace(/^\/api\/files\//, "");
    assert.ok(sampleImageId, "Extracted sample image GridFS ID");

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  await t.test("1. Returns 404 for non-existent file ID", async () => {
    const res = await fetch(`${baseUrl}/files/000000000000000000000000`);
    assert.equal(res.status, 404);
  });

  await t.test("2. Serves original file without resize parameters when WebP not requested", async () => {
    const res = await fetch(`${baseUrl}/files/${sampleImageId}`, {
      headers: { Accept: "image/png,image/*" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.ok(res.headers.get("etag"), "Should send ETag");
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.ok(buffer.length > 500000, "Original file is uncompressed (>500KB)");
  });

  await t.test("3. Serves optimized WebP thumbnail (?size=thumb)", async () => {
    const res = await fetch(`${baseUrl}/files/${sampleImageId}?size=thumb`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/webp");
    assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
    const etag = res.headers.get("etag");
    assert.ok(etag, "Must include ETag");

    const buffer = Buffer.from(await res.arrayBuffer());
    // Thumbnail should be dramatically smaller (< 50 KB vs ~2.8 MB)
    assert.ok(buffer.length < 60000, `Thumbnail size should be < 60 KB, got ${buffer.length} bytes`);
  });

  await t.test("4. Serves optimized WebP detail (?size=detail)", async () => {
    const res = await fetch(`${baseUrl}/files/${sampleImageId}?size=detail`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/webp");
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.ok(buffer.length < 150000, `Detail image should be < 150 KB, got ${buffer.length} bytes`);
  });

  await t.test("5. Supports custom width query (?w=300)", async () => {
    const res = await fetch(`${baseUrl}/files/${sampleImageId}?w=300`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/webp");
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.ok(buffer.length < 50000, `300w image should be < 50 KB, got ${buffer.length} bytes`);
  });

  await t.test("6. HTTP 304 Not Modified on If-None-Match conditional request", async () => {
    const initialRes = await fetch(`${baseUrl}/files/${sampleImageId}?size=thumb`);
    const etag = initialRes.headers.get("etag");
    assert.ok(etag, "Initial response has ETag");

    const cachedRes = await fetch(`${baseUrl}/files/${sampleImageId}?size=thumb`, {
      headers: { "If-None-Match": etag },
    });
    assert.equal(cachedRes.status, 304, "Must respond 304 Not Modified");
    const text = await cachedRes.text();
    assert.equal(text, "", "304 response body must be empty");
  });

  await t.test("7. In-memory cache serves repeated requests without invoking GridFS or Sharp again", async () => {
    const storage = getStorageProvider();
    const originalGetStream = storage.getStream;
    let getStreamCalls = 0;
    storage.getStream = async (...args) => {
      getStreamCalls++;
      return originalGetStream.apply(storage, args);
    };

    try {
      // Cold request for a fresh width variant populates the in-memory transform cache
      const firstRes = await fetch(`${baseUrl}/files/${sampleImageId}?w=350`);
      assert.equal(firstRes.status, 200);
      assert.equal(firstRes.headers.get("content-type"), "image/webp");
      const firstBuf = Buffer.from(await firstRes.arrayBuffer());
      const firstEtag = firstRes.headers.get("etag");
      assert.equal(getStreamCalls, 1, "First uncached variant request should invoke storage.getStream once");

      // Repeated requests for the same variant must hit transformCache without calling storage/Sharp again
      const secondRes = await fetch(`${baseUrl}/files/${sampleImageId}?w=350`);
      assert.equal(secondRes.status, 200);
      assert.equal(secondRes.headers.get("content-type"), "image/webp");
      assert.equal(secondRes.headers.get("etag"), firstEtag);
      const secondBuf = Buffer.from(await secondRes.arrayBuffer());
      assert.equal(Buffer.compare(firstBuf, secondBuf), 0, "Cached response bytes must match original output");
      assert.equal(getStreamCalls, 1, "Cached variant request must not invoke GridFS/Sharp again");

      // Previously warmed ?size=thumb variant from earlier tests must also be served from cache
      const warmThumbRes = await fetch(`${baseUrl}/files/${sampleImageId}?size=thumb`);
      assert.equal(warmThumbRes.status, 200);
      assert.equal(warmThumbRes.headers.get("content-type"), "image/webp");
      assert.equal(getStreamCalls, 1, "Already-cached thumb variant must not invoke GridFS/Sharp");
    } finally {
      storage.getStream = originalGetStream;
    }
  });

  await t.test("8. Original GridFS file in MongoDB is preserved unchanged", async () => {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
    const _id = new mongoose.Types.ObjectId(sampleImageId);
    const [fileDoc] = await bucket.find({ _id }).toArray();
    assert.ok(fileDoc, "Original file document exists in GridFS");
    assert.equal(fileDoc.contentType, "image/png");
    assert.ok(fileDoc.length > 500000, "Original file length preserved in GridFS");
  });

  await t.test("Teardown test server", async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });
});

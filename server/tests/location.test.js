// tests/location.test.js — Delivery location verification & geocoding suite
import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

dotenv.config({ path: new URL("../.env", import.meta.url) });
process.env.NODE_ENV = "test";

import app from "../app.js";
import { connectDB } from "../db.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import {
  normalizeDeliveryLocation,
  areCoordinatesValid,
  validateAndVerifyLocation,
  parseCoordinate,
  isCoordinateInIndia,
  clearGeocodeCache,
} from "../utils/geocoding.js";
import { toClient } from "../utils/serialize.js";
import { CUSTOMER_JWT_SECRET } from "../routes/customerAuth.js";

test("Delivery Location & Geocoding Architecture Suite", async (t) => {
  let server;
  let baseUrl;
  let customerToken;
  let testProductId;

  await t.test("Setup test server and database connection", async () => {
    await connectDB();

    customerToken = jwt.sign(
      { uid: "phone:9999988888", phone: "+919999988888" },
      CUSTOMER_JWT_SECRET,
      { expiresIn: "1h" }
    );

    const product = await Product.findOne();
    assert.ok(product, "Should find at least one product for order testing");
    testProductId = product._id.toString();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  await t.test("1. normalizeDeliveryLocation normalizes camelCase and snake_case contracts", () => {
    const camel = normalizeDeliveryLocation({
      latitude: 16.48,
      longitude: 80.60,
      formattedAddress: "Tadepalli, AP",
      deliveryArea: "Tadepalli",
      placeId: "test_place_1",
      verified: true,
    });
    assert.equal(camel.latitude, 16.48);
    assert.equal(camel.longitude, 80.60);
    assert.equal(camel.formattedAddress, "Tadepalli, AP");
    assert.equal(camel.deliveryArea, "Tadepalli");
    assert.equal(camel.placeId, "test_place_1");
    assert.equal(camel.verified, true);

    const snake = normalizeDeliveryLocation({
      latitude: "16.485",
      longitude: "80.605",
      formatted_address: "Undavalli Center",
      delivery_area: "Undavalli",
      place_id: "test_place_2",
      verified: true,
    });
    assert.equal(snake.latitude, 16.485);
    assert.equal(snake.longitude, 80.605);
    assert.equal(snake.formattedAddress, "Undavalli Center");
    assert.equal(snake.deliveryArea, "Undavalli");
  });

  await t.test("2. areCoordinatesValid rejects non-numbers and out-of-range coordinates", () => {
    assert.equal(areCoordinatesValid(16.48, 80.60), true);
    assert.equal(areCoordinatesValid(-90, 180), true);
    assert.equal(areCoordinatesValid(91, 80), false);
    assert.equal(areCoordinatesValid(16, -181), false);
    assert.equal(areCoordinatesValid("16.48", 80), false);
    assert.equal(areCoordinatesValid(NaN, 80), false);
  });

  await t.test("3. POST /api/delivery-areas/validate-location validates coordinates in active area", async () => {
    // Tadepalli coordinates: ~16.48, 80.60
    const res = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 16.48,
        longitude: 80.60,
        formattedAddress: "Mahanadu, Tadepalli",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.serviceable, true);
    assert.equal(body.deliveryLocation.verified, true);
    assert.equal(body.deliveryLocation.deliveryArea, "Tadepalli");
  });

  await t.test("4. POST /api/delivery-areas/validate-location rejects out-of-area coordinates", async () => {
    // Hyderabad coordinates: ~17.3850, 78.4867 (far outside Tadepalli region)
    const res = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 17.3850,
        longitude: 78.4867,
        formattedAddress: "Banjara Hills, Hyderabad",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.serviceable, false);
    assert.equal(body.deliveryLocation.verified, false);
    assert.ok(body.error.includes("NvFresh currently delivers only to"));
  });

  await t.test("5. POST /api/delivery-areas/validate-location rejects invalid coordinates with 400", async () => {
    const res = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 195.0,
        longitude: 80.0,
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.serviceable, false);
  });

  await t.test("6. Order placement stores normalized delivery_location and coordinates (and survives Telegram failure)", async () => {
    const orderPayload = {
      customerName: "Location Test Customer",
      phone: "+919999988888",
      address: "Door 4-12, Main Road, Tadepalli",
      advancePercentage: 25,
      transactionId: `loc_test_${Date.now()}`,
      items: [{ productId: testProductId, weight: "500g", quantity: 1 }],
      deliveryLocation: {
        latitude: 16.4812,
        longitude: 80.6015,
        formattedAddress: "Door 4-12, Main Road, Tadepalli, AP 522501",
        deliveryArea: "Tadepalli",
        placeId: "ChIJ_sample_tadepalli",
      },
    };

    const originalFetch = globalThis.fetch;
    let telegramCalls = 0;
    globalThis.fetch = async (url, init) => {
      if (typeof url === "string" && url.includes("api.telegram.org")) {
        telegramCalls++;
        throw new Error("Simulated Telegram outage");
      }
      return originalFetch(url, init);
    };

    let res;
    try {
      res = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify(orderPayload),
      });
      // Give fire-and-forget Telegram task a tick to settle before restoring fetch
      await new Promise((r) => setTimeout(r, 150));
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(res.status, 201);
    const clientOrder = await res.json();
    assert.ok(clientOrder.id);
    assert.ok(clientOrder.deliveryLocation);
    assert.equal(clientOrder.deliveryLocation.latitude, 16.4812);
    assert.equal(clientOrder.deliveryLocation.longitude, 80.6015);
    assert.equal(clientOrder.deliveryLocation.deliveryArea, "Tadepalli");
    assert.equal(clientOrder.deliveryLocation.verified, true);
    assert.ok(telegramCalls <= 1);

    // Verify DB document
    const dbOrder = await Order.findById(clientOrder.id);
    assert.ok(dbOrder.delivery_location);
    assert.equal(dbOrder.delivery_location.latitude, 16.4812);
    assert.equal(dbOrder.delivery_location.longitude, 80.6015);
    assert.equal(dbOrder.delivery_location.verified, true);
  });

  await t.test("7. Order placement without coordinates remains backward-compatible", async () => {
    const orderPayload = {
      customerName: "Legacy Address Customer",
      phone: "+919999988888",
      address: "Flat 101, Undavalli",
      advancePercentage: 50,
      transactionId: `legacy_test_${Date.now()}`,
      items: [{ productId: testProductId, weight: "500g", quantity: 1 }],
    };

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    assert.equal(res.status, 201);
    const clientOrder = await res.json();
    assert.ok(clientOrder.id);
    assert.equal(clientOrder.address, "Flat 101, Undavalli");
  });

  await t.test("8. Order placement rejects out-of-area coordinates with 400", async () => {
    const orderPayload = {
      customerName: "Out of area Customer",
      phone: "+919999988888",
      address: "Some address, Tadepalli", // text claims Tadepalli but coordinates are in Hyderabad
      advancePercentage: 25,
      transactionId: `tamper_test_${Date.now()}`,
      items: [{ productId: testProductId, weight: "500g", quantity: 1 }],
      deliveryLocation: {
        latitude: 17.3850,
        longitude: 78.4867, // Hyderabad
        formattedAddress: "Banjara Hills, Hyderabad",
      },
    };

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("NvFresh currently delivers only to"));
  });

  await t.test("9. Production guard: In production without Google API key, validation fails safely and never uses bounding-box fallback", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.GOOGLE_GEOCODING_API_KEY;
    const originalBackendKey = process.env.GOOGLE_MAPS_BACKEND_API_KEY;
    const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    clearGeocodeCache();
    try {
      process.env.NODE_ENV = "production";
      delete process.env.GOOGLE_GEOCODING_API_KEY;
      delete process.env.GOOGLE_MAPS_BACKEND_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;

      const result = await validateAndVerifyLocation({
        latitude: 16.4812, // within test bounding box, but production must ignore it!
        longitude: 80.6015,
        deliveryArea: "Tadepalli", // spoofed client locality
        verified: true, // spoofed client verified flag
      });

      assert.equal(result.serviceable, false, "Production must not accept unverified location");
      assert.equal(result.deliveryLocation.verified, false, "Verified flag must be false");
      assert.equal(result.deliveryLocation.deliveryArea, null, "Must not trust client deliveryArea");
      assert.ok(result.error.includes("unavailable"), "Should report service unavailable");
    } finally {
      clearGeocodeCache();
      process.env.NODE_ENV = originalEnv;
      if (originalKey !== undefined) process.env.GOOGLE_GEOCODING_API_KEY = originalKey;
      if (originalBackendKey !== undefined) process.env.GOOGLE_MAPS_BACKEND_API_KEY = originalBackendKey;
      if (originalMapsKey !== undefined) process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    }
  });

  await t.test("10. Geocoding cache caches reverse-geocode queries safely", async () => {
    clearGeocodeCache();
    // Tests that repeated identical coordinates do not crash or throw
    const res1 = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 16.4812, longitude: 80.6015 }),
    });
    const res2 = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 16.4812, longitude: 80.6015 }),
    });
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
  });

  await t.test("11. Coordinate parser and validator reject malformed types safely", async () => {
    assert.equal(parseCoordinate(true), null);
    assert.equal(parseCoordinate(false), null);
    assert.equal(parseCoordinate("abc"), null);
    assert.equal(parseCoordinate({}), null);
    assert.equal(parseCoordinate([]), null);
    assert.equal(parseCoordinate(Infinity), null);
    assert.equal(parseCoordinate(NaN), null);
    assert.equal(parseCoordinate(" 16.48 "), 16.48);

    assert.equal(areCoordinatesValid(true, 80.0), false);
    assert.equal(areCoordinatesValid(Infinity, 80.0), false);
    assert.equal(areCoordinatesValid(16.0, NaN), false);

    // Endpoint tests with malformed payloads
    const malformedPayloads = [
      { latitude: true, longitude: 80.0 },
      { latitude: "not-a-number", longitude: 80.0 },
      { latitude: {}, longitude: 80.0 },
      { latitude: null, longitude: null },
    ];

    for (const payload of malformedPayloads) {
      const res = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.serviceable, false);
    }
  });

  await t.test("12. Out-of-region coordinates (outside India) rejected safely without Google API call", async () => {
    // New York: 40.7128, -74.0060
    assert.equal(isCoordinateInIndia(40.7128, -74.006), false);
    // Null Island: 0, 0
    assert.equal(isCoordinateInIndia(0, 0), false);
    // Tadepalli: 16.48, 80.60
    assert.equal(isCoordinateInIndia(16.48, 80.6), true);

    const res = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 40.7128, longitude: -74.006 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.serviceable, false);
    assert.equal(body.deliveryLocation.verified, false);
    assert.ok(body.error.includes("NvFresh currently delivers only to"));
  });

  await t.test("13. Rate limiting throttles excessive requests with HTTP 429 and Retry-After", async () => {
    const testIp = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
    const headers = {
      "Content-Type": "application/json",
      "x-test-ip": testIp,
    };

    // Guest threshold is 25 requests / min
    let throttled = false;

    for (let i = 0; i < 27; i++) {
      const res = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
        method: "POST",
        headers,
        body: JSON.stringify({ latitude: 16.48, longitude: 80.6 }),
      });
      if (res.status === 429) {
        throttled = true;
        const retryAfter = res.headers.get("retry-after");
        assert.ok(retryAfter, "Must include Retry-After header");
        const body = await res.json();
        assert.ok(body.error.includes("Too many location verification requests"));
        assert.equal(body.serviceable, false);
        break;
      }
    }

    assert.ok(throttled, "Should receive HTTP 429 after exceeding request limit");
  });

  await t.test("14. POST /api/delivery-areas/geocode endpoint validation and rate limiting", async () => {
    // Missing coords returns 400
    const emptyRes = await fetch(`${baseUrl}/delivery-areas/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(emptyRes.status, 400);

    // Valid coords return result
    const validRes = await fetch(`${baseUrl}/delivery-areas/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 16.48, longitude: 80.6 }),
    });
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.equal(validData.serviceable, true);
    assert.equal(validData.deliveryLocation.deliveryArea, "Tadepalli");
  });

  await t.test("15. Legitimate guest checkout and authenticated customer requests succeed within quota", async () => {
    const guestIp = `203.0.113.${Math.floor(Math.random() * 200 + 10)}`;

    // Legitimate guest request
    const guestRes = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-ip": guestIp,
      },
      body: JSON.stringify({ latitude: 16.48, longitude: 80.6 }),
    });
    assert.equal(guestRes.status, 200);
    const guestData = await guestRes.json();
    assert.equal(guestData.serviceable, true);

    // Legitimate authenticated customer request
    const custRes = await fetch(`${baseUrl}/delivery-areas/validate-location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ latitude: 16.48, longitude: 80.6 }),
    });
    assert.equal(custRes.status, 200);
    const custData = await custRes.json();
    assert.equal(custData.serviceable, true);
    assert.equal(custData.deliveryLocation.deliveryArea, "Tadepalli");
  });

  await t.test("Teardown test server", async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });
});

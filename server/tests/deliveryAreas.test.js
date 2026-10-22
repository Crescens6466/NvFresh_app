// tests/deliveryAreas.test.js — Verification of delivery area management and dynamic serviceability
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import app from "../app.js";
import { connectDB } from "../db.js";
import { JWT_SECRET } from "../middleware/auth.js";
import DeliveryArea from "../models/DeliveryArea.js";
import {
  DEFAULT_SERVICE_AREAS,
  normalizeAreaName,
  buildAreaRegex,
  formatAreaList,
  formatDeliveryLocationsLine,
  formatServiceableAreaMessage,
  isDeliveryAddressServiceable,
  isDeliveryAreaServiceableAsync,
  getServiceableAreaErrorMessageAsync,
  ensureDefaultDeliveryAreas,
} from "../utils/serviceAreas.js";

import * as webServiceAreas from "../../customer/src/utils/serviceAreas.js";
import * as mobileServiceAreas from "../../customer-mobile/src/utils/serviceAreas.js";

test("Delivery Area Management & Serviceability Suite", async (t) => {
  let server;
  let baseUrl;
  let adminToken;

  await t.test("Setup test server and database connection", async () => {
    await connectDB();
    await ensureDefaultDeliveryAreas();

    adminToken = jwt.sign({ id: "admin_test", username: "admin" }, JWT_SECRET, { expiresIn: "1h" });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
    assert.ok(baseUrl);
  });

  await t.test("1. Initial display and formatting of the four existing areas", () => {
    const formatted = formatDeliveryLocationsLine(DEFAULT_SERVICE_AREAS);
    assert.equal(
      formatted,
      "Delivering to: Tadepalli, Kunchanapalli, Undavalli & Nulakapeta"
    );

    const message = formatServiceableAreaMessage(DEFAULT_SERVICE_AREAS);
    assert.equal(
      message,
      "NvFresh currently delivers only to Tadepalli, Kunchanapalli, Undavalli, and Nulakapeta. Please enter a delivery address within these areas."
    );

    // Fallback when empty
    assert.equal(
      formatDeliveryLocationsLine([]),
      "Delivering to: Tadepalli, Kunchanapalli, Undavalli & Nulakapeta"
    );
  });

  await t.test("2. Safe matching & rejection of substrings (e.g. Tadepalligudem)", () => {
    const areas = ["Tadepalli", "Kunchanapalli", "Undavalli", "Nulakapeta"];

    // Valid locations
    assert.equal(isDeliveryAddressServiceable("Door 12-4, Tadepalli, Guntur", areas), true);
    assert.equal(isDeliveryAddressServiceable("Near Tadepalle railway gate", areas), true);
    assert.equal(isDeliveryAddressServiceable("Kunchanapalli village", areas), true);
    assert.equal(isDeliveryAddressServiceable("Undavalli caves road", areas), true);
    assert.equal(isDeliveryAddressServiceable("Vundavalli center", areas), true);
    assert.equal(isDeliveryAddressServiceable("Nulakapeta main bazar", areas), true);
    assert.equal(isDeliveryAddressServiceable("Nulakapet bypass", areas), true);

    // Unrelated / substring locations that must NOT be accepted
    assert.equal(
      isDeliveryAddressServiceable("Main Road, Tadepalligudem, West Godavari", areas),
      false,
      "Tadepalligudem must be rejected"
    );
    assert.equal(
      isDeliveryAddressServiceable("Tadepalligudem town", areas),
      false
    );
    assert.equal(isDeliveryAddressServiceable("Guntur city", areas), false);
    assert.equal(isDeliveryAddressServiceable("Vijayawada benz circle", areas), false);
    assert.equal(isDeliveryAddressServiceable("Tenali", areas), false);
  });

  await t.test("3. Client-server parity (web, mobile, and server utility consistency)", () => {
    const testCases = [
      { addr: "Flat 2B, Tadepalli", expected: true },
      { addr: "Tadepalligudem", expected: false },
      { addr: "Kunchanapalli", expected: true },
      { addr: "Vundavalli bypass", expected: true },
      { addr: "Hyderabad", expected: false },
    ];

    for (const { addr, expected } of testCases) {
      assert.equal(isDeliveryAddressServiceable(addr), expected, `Server mismatch on ${addr}`);
      assert.equal(
        webServiceAreas.isDeliveryAreaServiceable(addr),
        expected,
        `Web mismatch on ${addr}`
      );
      assert.equal(
        mobileServiceAreas.isDeliveryAreaServiceable(addr),
        expected,
        `Mobile mismatch on ${addr}`
      );
    }
  });

  await t.test("4. Public customer endpoint GET /api/delivery-areas", async () => {
    const res = await fetch(`${baseUrl}/delivery-areas`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 4);

    const names = data.map((d) => d.name);
    for (const def of DEFAULT_SERVICE_AREAS) {
      assert.ok(names.includes(def), `Missing default area ${def} in public response`);
    }
  });

  await t.test("5. Admin CRUD: Add, duplicate check, edit, deactivate, reactivate, delete", async () => {
    const testAreaName = "Test Town Temp";

    // Clean up if already exists
    await DeliveryArea.deleteOne({ normalized_name: normalizeAreaName(testAreaName) });

    // A. Add new area
    const createRes = await fetch(`${baseUrl}/delivery-areas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: testAreaName, is_active: true }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.name, testAreaName);
    assert.equal(created.is_active, true);
    assert.ok(created.id);

    // B. Duplicate check (case-insensitive & whitespace normalized)
    const dupRes = await fetch(`${baseUrl}/delivery-areas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: `   ${testAreaName.toUpperCase()}   ` }),
    });
    assert.equal(dupRes.status, 400);
    const dupErr = await dupRes.json();
    assert.match(dupErr.error, /already exists/i);

    // C. Validation: empty name
    const emptyRes = await fetch(`${baseUrl}/delivery-areas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "   " }),
    });
    assert.equal(emptyRes.status, 400);

    // D. Edit area name
    const renamed = "Test Town Renamed";
    const editRes = await fetch(`${baseUrl}/delivery-areas/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: renamed }),
    });
    assert.equal(editRes.status, 200);
    const edited = await editRes.json();
    assert.equal(edited.name, renamed);

    // E. Deactivate area
    const deactRes = await fetch(`${baseUrl}/delivery-areas/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ is_active: false }),
    });
    assert.equal(deactRes.status, 200);
    const deactivated = await deactRes.json();
    assert.equal(deactivated.is_active, false);

    // Dynamic serviceability check: deactivated area must NOT be accepted for new orders
    const deactCheck = await isDeliveryAreaServiceableAsync(`123 Main St, ${renamed}`);
    assert.equal(deactCheck, false, "Deactivated area must not be serviceable");

    // F. Reactivate area
    const reactRes = await fetch(`${baseUrl}/delivery-areas/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ is_active: true }),
    });
    assert.equal(reactRes.status, 200);
    const reactivated = await reactRes.json();
    assert.equal(reactivated.is_active, true);

    const reactCheck = await isDeliveryAreaServiceableAsync(`123 Main St, ${renamed}`);
    assert.equal(reactCheck, true, "Reactivated area must be serviceable");

    // G. Delete area
    const delRes = await fetch(`${baseUrl}/delivery-areas/${created.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.equal(delData.success, true);

    // Verify deleted area is no longer serviceable
    const postDelCheck = await isDeliveryAreaServiceableAsync(`123 Main St, ${renamed}`);
    assert.equal(postDelCheck, false, "Deleted area must not be serviceable");
  });

  await t.test("6. Security: Unauthorized attempts to change delivery areas are blocked", async () => {
    // Attempt POST without token
    const unauthPost = await fetch(`${baseUrl}/delivery-areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacker Town" }),
    });
    assert.equal(unauthPost.status, 401);

    // Attempt PUT without token
    const unauthPut = await fetch(`${baseUrl}/delivery-areas/anyid`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacker Town" }),
    });
    assert.equal(unauthPut.status, 401);

    // Attempt DELETE without token
    const unauthDel = await fetch(`${baseUrl}/delivery-areas/anyid`, {
      method: "DELETE",
    });
    assert.equal(unauthDel.status, 401);

    // Attempt admin listing without token
    const unauthAdminGet = await fetch(`${baseUrl}/delivery-areas/admin`);
    assert.equal(unauthAdminGet.status, 401);
  });

  await t.test("Teardown", async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });
});


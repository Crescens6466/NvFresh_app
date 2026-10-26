// tests/settings.test.js — Unit and integration tests for Business Settings
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Settings from "../models/Settings.js";
import settingsRouter, { DEFAULT_SETTINGS, formatSettingsResponse, isValidEmail } from "../routes/settings.js";
import { JWT_SECRET } from "../middleware/auth.js";

test("Business Settings Suite", async (t) => {
  await t.test("1. Settings Mongoose Schema Defaults", () => {
    const settingsDoc = new Settings({});

    assert.equal(settingsDoc.business_name, "NvFresh");
    assert.equal(settingsDoc.phone_number, "+91 98765 43210");
    assert.equal(settingsDoc.upi_id, "nvfresh@upi");
    assert.equal(settingsDoc.qr_image, null);
    assert.equal(settingsDoc.delivery_charge, 0);
    assert.equal(settingsDoc.support_email, "support@nvfresh.in");
    assert.equal(
      settingsDoc.business_address,
      "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India"
    );
    assert.equal(settingsDoc.support_hours, "Everyday, 7:00 AM – 9:00 PM");
    assert.equal(
      settingsDoc.delivery_schedule,
      "Orders confirmed Saturday, delivered fresh every Sunday morning"
    );
  });

  await t.test("2. Email Validation Helper", () => {
    // Valid emails
    assert.equal(isValidEmail("support@nvfresh.in"), true);
    assert.equal(isValidEmail("admin.help@domain.co.in"), true);
    assert.equal(isValidEmail("contact@sub.company.org"), true);
    assert.equal(isValidEmail("  spaced@nvfresh.in  "), true);

    // Invalid emails
    assert.equal(isValidEmail(""), false);
    assert.equal(isValidEmail("not-an-email"), false);
    assert.equal(isValidEmail("missing@domain"), false);
    assert.equal(isValidEmail("@nodomain.com"), false);
    assert.equal(isValidEmail("spaces in@email.com"), false);
    assert.equal(isValidEmail(null), false);
    assert.equal(isValidEmail(undefined), false);
    assert.equal(isValidEmail(12345), false);
  });

  await t.test("3. formatSettingsResponse - Full serialization with camelCase aliases", () => {
    const mockDoc = {
      _id: new mongoose.Types.ObjectId("64b8a2e5f1d2c3b4a5968701"),
      business_name: "NvFresh Farm Fresh",
      phone_number: "+91 91234 56789",
      upi_id: "custom@upi",
      qr_image: "/uploads/qr.png",
      delivery_charge: 40,
      support_email: "help@nvfresh.in",
      business_address: "123 Farm Road, Vijayawada",
      support_hours: "Mon-Sat 8:00 AM – 8:00 PM",
      delivery_schedule: "Saturday midnight confirmation, Sunday delivery",
      toObject() {
        return { ...this };
      },
    };

    const formatted = formatSettingsResponse(mockDoc);

    // Id serialized from _id
    assert.equal(formatted.id, "64b8a2e5f1d2c3b4a5968701");

    // Snake_case values
    assert.equal(formatted.business_name, "NvFresh Farm Fresh");
    assert.equal(formatted.phone_number, "+91 91234 56789");
    assert.equal(formatted.upi_id, "custom@upi");
    assert.equal(formatted.qr_image, "/uploads/qr.png");
    assert.equal(formatted.delivery_charge, 40);
    assert.equal(formatted.support_email, "help@nvfresh.in");
    assert.equal(formatted.business_address, "123 Farm Road, Vijayawada");
    assert.equal(formatted.support_hours, "Mon-Sat 8:00 AM – 8:00 PM");
    assert.equal(formatted.delivery_schedule, "Saturday midnight confirmation, Sunday delivery");

    // CamelCase aliases
    assert.equal(formatted.businessName, "NvFresh Farm Fresh");
    assert.equal(formatted.phoneNumber, "+91 91234 56789");
    assert.equal(formatted.upiId, "custom@upi");
    assert.equal(formatted.qrImage, "/uploads/qr.png");
    assert.equal(formatted.deliveryCharge, 40);
    assert.equal(formatted.supportEmail, "help@nvfresh.in");
    assert.equal(formatted.businessAddress, "123 Farm Road, Vijayawada");
    assert.equal(formatted.supportHours, "Mon-Sat 8:00 AM – 8:00 PM");
    assert.equal(formatted.deliverySchedule, "Saturday midnight confirmation, Sunday delivery");
  });

  await t.test("4. formatSettingsResponse - Legacy document fallback defaults", () => {
    // Legacy document created before new fields were added
    const legacyDoc = {
      _id: new mongoose.Types.ObjectId("64b8a2e5f1d2c3b4a5968702"),
      business_name: "NvFresh",
      phone_number: "+91 98765 43210",
      upi_id: "nvfresh@upi",
      delivery_charge: 0,
      toObject() {
        return { ...this };
      },
    };

    const formatted = formatSettingsResponse(legacyDoc);

    assert.equal(formatted.support_email, DEFAULT_SETTINGS.support_email);
    assert.equal(formatted.supportEmail, "support@nvfresh.in");
    assert.equal(formatted.business_address, DEFAULT_SETTINGS.business_address);
    assert.equal(formatted.businessAddress, "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India");
    assert.equal(formatted.support_hours, DEFAULT_SETTINGS.support_hours);
    assert.equal(formatted.supportHours, "Everyday, 7:00 AM – 9:00 PM");
    assert.equal(formatted.delivery_schedule, DEFAULT_SETTINGS.delivery_schedule);
    assert.equal(
      formatted.deliverySchedule,
      "Orders confirmed Saturday, delivered fresh every Sunday morning"
    );
  });

  await t.test("5. HTTP Endpoints - GET & PUT validation and persistence", async () => {
    // Mock the singleton Settings document in-memory for deterministic HTTP testing
    let memorySettings = {
      _id: new mongoose.Types.ObjectId("64b8a2e5f1d2c3b4a5968703"),
      business_name: "NvFresh",
      phone_number: "+91 98765 43210",
      upi_id: "nvfresh@upi",
      qr_image: null,
      delivery_charge: 0,
      support_email: "support@nvfresh.in",
      business_address: "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India",
      support_hours: "Everyday, 7:00 AM – 9:00 PM",
      delivery_schedule: "Orders confirmed Saturday, delivered fresh every Sunday morning",
      async save() {
        return this;
      },
      toObject() {
        return { ...this };
      },
    };

    const originalFindOne = Settings.findOne;
    Settings.findOne = async () => memorySettings;

    try {
      const testApp = express();
      testApp.use(express.json());
      testApp.use("/api/settings", settingsRouter);

      const server = http.createServer(testApp);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}/api/settings`;

      const token = jwt.sign({ id: "admin_test", username: "admin" }, JWT_SECRET, { expiresIn: "1h" });

      // GET /api/settings
      const getRes = await fetch(baseUrl);
      assert.equal(getRes.status, 200);
      const getData = await getRes.json();
      assert.equal(getData.supportEmail, "support@nvfresh.in");
      assert.equal(getData.businessAddress, "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India");
      assert.equal(getData.supportHours, "Everyday, 7:00 AM – 9:00 PM");
      assert.equal(getData.deliverySchedule, "Orders confirmed Saturday, delivered fresh every Sunday morning");

      // PUT /api/settings - Reject invalid email
      const invalidEmailRes = await fetch(baseUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ supportEmail: "invalid-email-format" }),
      });
      assert.equal(invalidEmailRes.status, 400);
      const invalidEmailData = await invalidEmailRes.json();
      assert.equal(invalidEmailData.error, "Invalid support email address");

      // PUT /api/settings - Reject negative delivery charge
      const invalidChargeRes = await fetch(baseUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deliveryCharge: -15 }),
      });
      assert.equal(invalidChargeRes.status, 400);

      // PUT /api/settings - Update all four new fields + existing fields
      const updateRes = await fetch(baseUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessName: "NvFresh Premium Meats",
          phoneNumber: "+91 99999 88888",
          supportEmail: "care@nvfresh.in",
          businessAddress: "Plot 42, APIIC Tech Park, Tadepalli, Guntur Dist",
          supportHours: "Mon – Sun, 6:00 AM – 10:00 PM",
          deliverySchedule: "Book by Saturday night, delivered Sunday by 9 AM",
          upiId: "nvfresh.pay@icici",
          deliveryCharge: 35,
        }),
      });
      assert.equal(updateRes.status, 200);
      const updatedData = await updateRes.json();

      assert.equal(updatedData.businessName, "NvFresh Premium Meats");
      assert.equal(updatedData.phoneNumber, "+91 99999 88888");
      assert.equal(updatedData.supportEmail, "care@nvfresh.in");
      assert.equal(updatedData.businessAddress, "Plot 42, APIIC Tech Park, Tadepalli, Guntur Dist");
      assert.equal(updatedData.supportHours, "Mon – Sun, 6:00 AM – 10:00 PM");
      assert.equal(updatedData.deliverySchedule, "Book by Saturday night, delivered Sunday by 9 AM");
      assert.equal(updatedData.upiId, "nvfresh.pay@icici");
      assert.equal(updatedData.deliveryCharge, 35);

      // Verify GET returns the new updated values
      const getVerifyRes = await fetch(baseUrl);
      assert.equal(getVerifyRes.status, 200);
      const getVerifyData = await getVerifyRes.json();
      assert.equal(getVerifyData.supportEmail, "care@nvfresh.in");
      assert.equal(getVerifyData.deliverySchedule, "Book by Saturday night, delivered Sunday by 9 AM");

      await new Promise((resolve) => server.close(resolve));
    } finally {
      Settings.findOne = originalFindOne;
    }
  });
});


// server/tests/accountDeletion.test.js — Comprehensive tests for authenticated
// customer account deletion, authorization, identity isolation, financial
// record retention, idempotency, failure handling, and compliance checks.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import { CUSTOMER_JWT_SECRET, createAccountDeletionHandler } from "../routes/customerAuth.js";
import { executeCustomerAccountDeletion } from "../utils/accountDeletion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function createInMemoryDeps({
  orders = [],
  customers = [],
  deviceTokens = [],
  notifications = [],
  otps = [],
  deletionRecords = [],
  firebaseBehavior = "ok", // "ok" | "not_found" | "error" | "unconfigured"
  failOnStep = null, // "orders_update" | "tokens_delete"
} = {}) {
  const state = {
    orders: orders.map((o) => ({ ...o })),
    customers: customers.map((c) => ({ ...c })),
    deviceTokens: deviceTokens.map((t) => ({ ...t })),
    notifications: notifications.map((n) => ({ ...n })),
    otps: otps.map((o) => ({ ...o })),
    deletionRecords: deletionRecords.map((r) => ({ ...r })),
    firebaseRevoked: [],
    firebaseDeleted: [],
  };

  const deps = {
    Order: {
      async find(query) {
        return state.orders.filter((o) => o.customer_uid === query.customer_uid);
      },
      async exists(query) {
        return state.orders.some((o) => {
          if (o.phone !== query.phone) return false;
          const excluded = query.customer_uid?.$nin || [];
          return !excluded.includes(o.customer_uid);
        });
      },
      async updateMany(query, update) {
        if (failOnStep === "orders_update") {
          throw new Error("Simulated MongoDB write failure on orders");
        }
        const ids = new Set(query._id.$in);
        let modifiedCount = 0;
        for (const order of state.orders) {
          if (ids.has(order._id) && order.customer_uid === query.customer_uid) {
            Object.assign(order, update.$set);
            modifiedCount += 1;
          }
        }
        return { modifiedCount };
      },
    },
    Customer: {
      async deleteOne(query) {
        const idx = state.customers.findIndex((c) => c.phone === query.phone);
        if (idx === -1) return { deletedCount: 0 };
        state.customers.splice(idx, 1);
        return { deletedCount: 1 };
      },
    },
    CustomerDeviceToken: {
      async deleteMany(query) {
        if (failOnStep === "tokens_delete") {
          throw new Error("Simulated MongoDB failure on device tokens");
        }
        const before = state.deviceTokens.length;
        state.deviceTokens = state.deviceTokens.filter((t) => t.customerUid !== query.customerUid);
        return { deletedCount: before - state.deviceTokens.length };
      },
    },
    CustomerNotification: {
      async deleteMany(query) {
        const before = state.notifications.length;
        state.notifications = state.notifications.filter(
          (n) => n.recipientCustomer !== query.recipientCustomer
        );
        return { deletedCount: before - state.notifications.length };
      },
    },
    PhoneOtp: {
      async deleteMany(query) {
        const before = state.otps.length;
        state.otps = state.otps.filter((o) => o.phone !== query.phone);
        return { deletedCount: before - state.otps.length };
      },
    },
    AccountDeletionRecord: {
      async findOne(query) {
        return state.deletionRecords.find((r) => r.uid === query.uid) || null;
      },
      async findOneAndUpdate(query, update, options = {}) {
        let rec = state.deletionRecords.find((r) => r.uid === query.uid);
        if (!rec && options.upsert) {
          rec = { uid: query.uid, ...(update.$setOnInsert || {}) };
          state.deletionRecords.push(rec);
        }
        if (!rec) return null;
        if (update.$set) Object.assign(rec, update.$set);
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            rec[k] = (rec[k] || 0) + v;
          }
        }
        return { ...rec };
      },
      async updateOne(query, update) {
        const rec = state.deletionRecords.find((r) => r.uid === query.uid);
        if (rec && update.$set) Object.assign(rec, update.$set);
        return { modifiedCount: rec ? 1 : 0 };
      },
    },
    getAdminAuth() {
      if (firebaseBehavior === "unconfigured") return null;
      return {
        async revokeRefreshTokens(uid) {
          if (firebaseBehavior === "not_found") {
            const err = new Error("User not found");
            err.code = "auth/user-not-found";
            throw err;
          }
          if (firebaseBehavior === "error") {
            throw new Error("Firebase transient network error");
          }
          state.firebaseRevoked.push(uid);
        },
        async deleteUser(uid) {
          if (firebaseBehavior === "not_found") {
            const err = new Error("User not found");
            err.code = "auth/user-not-found";
            throw err;
          }
          if (firebaseBehavior === "error") {
            throw new Error("Firebase deleteUser error");
          }
          state.firebaseDeleted.push(uid);
        },
      };
    },
  };

  return { state, deps };
}

describe("Customer Account Deletion — Auth, Security, Data Retention & Reliability", () => {
  it("1. Rejects unauthenticated requests via requireCustomerAuth middleware", async () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requireCustomerAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Not signed in");
  });

  it("2. Rejects forged/invalid Bearer tokens via requireCustomerAuth middleware", async () => {
    const req = { headers: { authorization: "Bearer forged.invalid.token" } };
    const res = createMockRes();
    let nextCalled = false;

    await requireCustomerAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it("3. Requires explicit confirm: true before executing deletion", async () => {
    const { deps } = createInMemoryDeps();
    const handler = createAccountDeletionHandler(deps);
    const req = {
      customer: { uid: "phone:9876543210", phone: "9876543210", authProvider: "phone" },
      body: { confirm: false },
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /confirm/i);
  });

  it("4. Prevents Customer A from deleting Customer B's account via spoofed body uid or phone", async () => {
    const { deps, state } = createInMemoryDeps({
      customers: [
        { name: "Alice", phone: "9876543210", address: "Tadepalli" },
        { name: "Bob", phone: "9123456789", address: "Undavalli" },
      ],
    });
    const handler = createAccountDeletionHandler(deps);

    const spoofUidReq = {
      customer: { uid: "phone:9876543210", phone: "9876543210", authProvider: "phone" },
      body: { confirm: true, uid: "phone:9123456789" },
    };
    const res1 = createMockRes();
    await handler(spoofUidReq, res1);
    assert.equal(res1.statusCode, 403);

    const spoofPhoneReq = {
      customer: { uid: "phone:9876543210", phone: "9876543210", authProvider: "phone" },
      body: { confirm: true, phone: "9123456789" },
    };
    const res2 = createMockRes();
    await handler(spoofPhoneReq, res2);
    assert.equal(res2.statusCode, 403);

    // Neither customer was touched
    assert.equal(state.customers.length, 2);
  });

  it("5. Deletes personal data, revokes/deletes Firebase user, retains financial order records, and anonymizes historical order PII", async () => {
    const { deps, state } = createInMemoryDeps({
      customers: [
        { name: "Suneetha", phone: "9876543210", address: "12-3 Tadepalli" },
        { name: "Other User", phone: "9999999999", address: "Kunchanapalli" },
      ],
      orders: [
        {
          _id: "ord_delivered_1",
          customer_uid: "fb_uid_123",
          customer_name: "Suneetha",
          phone: "9876543210",
          address: "12-3 Tadepalli",
          items: [{ name: "Chicken", weight: "1 kg", quantity: 1, price: 350 }],
          subtotal: 350,
          delivery_charge: 0,
          total: 350,
          advance_paid: 88,
          advance_percentage: 25,
          remaining_amount: 262,
          transaction_id: "pay_Tu43J7s0IHSjW2",
          razorpay_order_id: "order_abc123",
          razorpay_payment_id: "pay_Tu43J7s0IHSjW2",
          advance_payment_status: "Paid",
          status: "Delivered",
        },
        {
          _id: "ord_active_2",
          customer_uid: "fb_uid_123",
          customer_name: "Suneetha",
          phone: "9876543210",
          address: "12-3 Tadepalli",
          total: 500,
          advance_paid: 125,
          razorpay_payment_id: "pay_ActiveOrder99",
          status: "Preparing",
        },
      ],
      deviceTokens: [
        { customerUid: "fb_uid_123", token: "fcm_tok_1", platform: "android" },
        { customerUid: "other_uid", token: "fcm_tok_2", platform: "web" },
      ],
      notifications: [
        { recipientCustomer: "fb_uid_123", title: "Order Delivered" },
        { recipientCustomer: "other_uid", title: "Other" },
      ],
      otps: [{ phone: "9876543210", code: "hashed" }],
    });

    const result = await executeCustomerAccountDeletion({
      customer: { uid: "fb_uid_123", email: "suneetha@example.com", authProvider: "firebase" },
      deps,
    });

    assert.equal(result.httpStatus, 200);
    assert.equal(result.status, "completed");
    assert.equal(result.alreadyDeleted, false);

    // Firebase revoked & deleted
    assert.deepEqual(state.firebaseRevoked, ["fb_uid_123"]);
    assert.deepEqual(state.firebaseDeleted, ["fb_uid_123"]);

    // Customer profile, device token, notification, and OTP removed for this user only
    assert.equal(state.customers.length, 1);
    assert.equal(state.customers[0].phone, "9999999999");
    assert.equal(state.deviceTokens.length, 1);
    assert.equal(state.deviceTokens[0].customerUid, "other_uid");
    assert.equal(state.notifications.length, 1);
    assert.equal(state.notifications[0].recipientCustomer, "other_uid");
    assert.equal(state.otps.length, 0);

    // Financial records NEVER deleted
    assert.equal(state.orders.length, 2);

    // Completed order: financial fields preserved, PII anonymized
    const delivered = state.orders.find((o) => o._id === "ord_delivered_1");
    assert.equal(delivered.total, 350);
    assert.equal(delivered.advance_paid, 88);
    assert.equal(delivered.razorpay_payment_id, "pay_Tu43J7s0IHSjW2");
    assert.equal(delivered.advance_payment_status, "Paid");
    assert.equal(delivered.customer_uid, null);
    assert.equal(delivered.customer_name, "Deleted User");
    assert.equal(delivered.phone, "DELETED");
    assert.equal(delivered.address, "Removed upon account deletion");

    // Active undelivered order: unlinked from account, delivery address retained strictly for fulfilment
    const active = state.orders.find((o) => o._id === "ord_active_2");
    assert.equal(active.customer_uid, null);
    assert.equal(active.customer_name, "Suneetha");
    assert.equal(active.phone, "9876543210");
    assert.equal(active.address, "12-3 Tadepalli");
    assert.equal(result.summary.activeOrdersPreservedForDelivery, 1);
    assert.equal(result.summary.financialRecordsRetained, true);
  });

  it("6. Handles repeat/idempotent deletion requests safely using real signed phone JWT", async () => {
    const token = jwt.sign({ uid: "phone:9876543210", phone: "9876543210" }, CUSTOMER_JWT_SECRET, {
      expiresIn: "30d",
    });

    const reqAuth = { headers: { authorization: `Bearer ${token}` } };
    const resAuth = createMockRes();
    let authed = false;
    await requireCustomerAuth(reqAuth, resAuth, () => {
      authed = true;
    });
    assert.equal(authed, true);
    assert.equal(reqAuth.customer.uid, "phone:9876543210");

    const { deps } = createInMemoryDeps({
      customers: [{ name: "Ravi", phone: "9876543210", address: "Nulakapeta" }],
    });
    const handler = createAccountDeletionHandler(deps);

    // First deletion
    const res1 = createMockRes();
    await handler({ customer: reqAuth.customer, body: { confirm: true } }, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.status, "completed");
    assert.equal(res1.body.alreadyDeleted, false);

    // Repeat deletion with same token — idempotent
    const res2 = createMockRes();
    await handler({ customer: reqAuth.customer, body: { confirm: true } }, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.status, "completed");
    assert.equal(res2.body.alreadyDeleted, true);
  });

  it("7. Handles database failures safely without deleting Firebase account or reporting misleading success", async () => {
    const { deps, state } = createInMemoryDeps({
      orders: [{ _id: "ord_1", customer_uid: "fb_uid_fail", status: "Delivered", phone: "9876543210" }],
      failOnStep: "orders_update",
    });
    const handler = createAccountDeletionHandler(deps);
    const res = createMockRes();

    await handler(
      { customer: { uid: "fb_uid_fail", authProvider: "firebase" }, body: { confirm: true } },
      res
    );

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.ok, false);
    // Firebase user MUST NOT have been deleted since DB step failed
    assert.equal(state.firebaseDeleted.length, 0);
    const rec = state.deletionRecords.find((r) => r.uid === "fb_uid_fail");
    assert.equal(rec.status, "in_progress");
    assert.match(rec.last_error, /Simulated MongoDB write failure/);
  });

  it("8. Reports honest pending (202) status when Firebase Admin deletion fails transiently", async () => {
    const { deps, state } = createInMemoryDeps({
      deviceTokens: [{ customerUid: "fb_uid_pending", token: "tok1", platform: "android" }],
      firebaseBehavior: "error",
    });
    const handler = createAccountDeletionHandler(deps);
    const res = createMockRes();

    await handler(
      { customer: { uid: "fb_uid_pending", authProvider: "firebase" }, body: { confirm: true } },
      res
    );

    assert.equal(res.statusCode, 202);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.status, "pending");
    assert.equal(res.body.summary.firebaseDeleted, false);
    assert.equal(state.deviceTokens.length, 0);
    assert.equal(state.deletionRecords[0].status, "pending_manual_review");
  });

  it("9. Treats Firebase auth/user-not-found as already deleted (idempotent completion)", async () => {
    const { deps } = createInMemoryDeps({ firebaseBehavior: "not_found" });
    const result = await executeCustomerAccountDeletion({
      customer: { uid: "fb_uid_gone", authProvider: "firebase" },
      deps,
    });

    assert.equal(result.httpStatus, 200);
    assert.equal(result.status, "completed");
    assert.equal(result.summary.firebaseDeleted, true);
  });

  it("10. Compliance verification: Terms pages contain zero cancellation/refund promises, public delete route exists, Android Profile has Delete Account", () => {
    const webTerms = fs.readFileSync(path.join(repoRoot, "customer/src/pages/Terms.jsx"), "utf8");
    const mobileTerms = fs.readFileSync(
      path.join(repoRoot, "customer-mobile/src/screens/TermsScreen.jsx"),
      "utf8"
    );
    const webApp = fs.readFileSync(path.join(repoRoot, "customer/src/App.jsx"), "utf8");
    const mobileProfile = fs.readFileSync(
      path.join(repoRoot, "customer-mobile/src/screens/ProfileScreen.jsx"),
      "utf8"
    );

    assert.equal(/cancel|refund/i.test(webTerms), false, "Web Terms must not mention cancellations or refunds");
    assert.equal(/cancel|refund/i.test(mobileTerms), false, "Mobile Terms must not mention cancellations or refunds");
    assert.match(webApp, /path="\/delete-account"/, "Website App.jsx must expose public /delete-account route");
    assert.match(mobileProfile, /Delete Account/, "Android ProfileScreen must provide Delete Account action");
    assert.match(mobileProfile, /Delete Account Permanently/, "Android ProfileScreen must require permanent deletion confirmation");
  });
});


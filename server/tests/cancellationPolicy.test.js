// tests/cancellationPolicy.test.js — Deterministic verification of Sunday cutoff and cancellation policy
import test from "node:test";
import assert from "node:assert/strict";
import {
  isSundayInIndia,
  canCancelOrder,
  SUNDAY_CANCELLATION_ERROR_MESSAGE,
} from "../utils/cancellationPolicy.js";

test("Cancellation Cutoff Policy - Deterministic Clock Verification", async (t) => {
  const pendingOrder = { id: "ord_101", status: "Pending" };
  const preparingOrder = { id: "ord_102", status: "Preparing" };
  const deliveredOrder = { id: "ord_103", status: "Delivered" };
  const cancelledOrder = { id: "ord_104", status: "Cancelled" };

  // Weekend: Oct 24 (Sat) - Oct 26 (Mon), 2026
  // India Standard Time (IST) is UTC+05:30.
  // Sat 23:58:00 IST = UTC 18:28:00
  // Sat 23:59:00 IST = UTC 18:29:00
  // Sat 23:59:59.999 IST = UTC 18:29:59.999
  // Sun 00:00:00 IST = UTC 18:30:00
  // Sun 12:00:00 IST = UTC 06:30:00 (Oct 25)
  // Sun 23:59:00 IST = UTC 18:29:00 (Oct 25)
  // Sun 23:59:59.999 IST = UTC 18:29:59.999 (Oct 25)
  // Mon 00:00:00 IST = UTC 18:30:00 (Oct 25)

  await t.test("Saturday 11:58 PM IST: Allowed", () => {
    const clock = new Date("2026-10-24T18:28:00.000Z");
    assert.equal(isSundayInIndia(clock), false, "Saturday 11:58 PM IST must not be Sunday");

    const result = canCancelOrder(pendingOrder, clock);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  await t.test("Saturday 11:59 PM IST (23:59:00): Allowed", () => {
    const clock = new Date("2026-10-24T18:29:00.000Z");
    assert.equal(isSundayInIndia(clock), false, "Saturday 11:59:00 PM IST must not be Sunday");

    const result = canCancelOrder(pendingOrder, clock);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  await t.test("Saturday 11:59:59 PM IST (last second before cutoff): Allowed", () => {
    const clock = new Date("2026-10-24T18:29:59.999Z");
    assert.equal(isSundayInIndia(clock), false, "Saturday 11:59:59.999 PM IST must not be Sunday");

    const result = canCancelOrder(pendingOrder, clock);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  await t.test("Sunday 12:00 AM IST (00:00:00 exact start of Sunday): Blocked", () => {
    const clock = new Date("2026-10-24T18:30:00.000Z");
    assert.equal(isSundayInIndia(clock), true, "Sunday 12:00:00 AM IST must be recognized as Sunday");

    const result = canCancelOrder(pendingOrder, clock);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, SUNDAY_CANCELLATION_ERROR_MESSAGE);
    assert.equal(
      result.reason,
      "Orders cannot be cancelled on Sunday. The cancellation window closes on Saturday at 11:59 PM."
    );
  });

  await t.test("Sunday daytime (12:00 PM noon IST): Blocked", () => {
    const clock = new Date("2026-10-25T06:30:00.000Z");
    assert.equal(isSundayInIndia(clock), true, "Sunday noon IST must be recognized as Sunday");

    const resultPending = canCancelOrder(pendingOrder, clock);
    assert.equal(resultPending.allowed, false);
    assert.equal(resultPending.reason, SUNDAY_CANCELLATION_ERROR_MESSAGE);

    const resultPreparing = canCancelOrder(preparingOrder, clock);
    assert.equal(resultPreparing.allowed, false);
    assert.equal(resultPreparing.reason, SUNDAY_CANCELLATION_ERROR_MESSAGE);
  });

  await t.test("Sunday 11:59 PM IST (23:59:00): Blocked", () => {
    const clock = new Date("2026-10-25T18:29:00.000Z");
    assert.equal(isSundayInIndia(clock), true, "Sunday 11:59:00 PM IST must be recognized as Sunday");

    const result = canCancelOrder(pendingOrder, clock);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, SUNDAY_CANCELLATION_ERROR_MESSAGE);
  });

  await t.test("Sunday 11:59:59 PM IST (23:59:59.999 last millisecond of Sunday): Blocked", () => {
    const clock = new Date("2026-10-25T18:29:59.999Z");
    assert.equal(isSundayInIndia(clock), true, "Sunday 11:59:59.999 PM IST must be recognized as Sunday");

    const result = canCancelOrder(pendingOrder, clock);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, SUNDAY_CANCELLATION_ERROR_MESSAGE);
  });

  await t.test("Monday 12:00 AM IST (00:00:00 cutoff ended): Allowed", () => {
    const clock = new Date("2026-10-25T18:30:00.000Z");
    assert.equal(isSundayInIndia(clock), false, "Monday 12:00:00 AM IST must not be Sunday");

    const result = canCancelOrder(pendingOrder, clock);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  await t.test("Status validation: Delivered orders cannot be cancelled even on Monday", () => {
    const clock = new Date("2026-10-25T18:30:00.000Z"); // Monday
    const result = canCancelOrder(deliveredOrder, clock);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "Delivered orders cannot be cancelled.");
  });

  await t.test("Status validation: Already cancelled orders return already cancelled", () => {
    const clock = new Date("2026-10-24T18:28:00.000Z"); // Saturday
    const result = canCancelOrder(cancelledOrder, clock);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "Order is already cancelled.");
  });
});


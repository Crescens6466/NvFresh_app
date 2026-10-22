// tests/cancellationPolicyParity.test.js — Ensures exact parity between server, customer web, and customer mobile policies
import test from "node:test";
import assert from "node:assert/strict";

import * as serverPolicy from "../utils/cancellationPolicy.js";
import * as webPolicy from "../../customer/src/utils/cancellationPolicy.js";
import * as mobilePolicy from "../../customer-mobile/src/utils/cancellationPolicy.js";

const modules = [
  { name: "Server Policy", mod: serverPolicy },
  { name: "Customer Web Policy", mod: webPolicy },
  { name: "Customer Mobile Policy", mod: mobilePolicy },
];

for (const { name, mod } of modules) {
  test(`${name} - verifies all cutoff deadlines and messages`, () => {
    assert.equal(
      mod.SUNDAY_CANCELLATION_ERROR_MESSAGE,
      "Orders cannot be cancelled on Sunday. The cancellation window closes on Saturday at 11:59 PM."
    );

    // 1. Saturday 11:58 PM IST
    const sat1158 = new Date("2026-10-24T18:28:00.000Z");
    assert.equal(mod.isSundayInIndia(sat1158), false);
    assert.equal(mod.canCancelOrder({ status: "Pending" }, sat1158).allowed, true);

    // 2. Saturday 11:59 PM IST
    const sat1159 = new Date("2026-10-24T18:29:00.000Z");
    assert.equal(mod.isSundayInIndia(sat1159), false);
    assert.equal(mod.canCancelOrder({ status: "Pending" }, sat1159).allowed, true);

    // 3. Saturday 11:59:59 PM IST
    const sat115959 = new Date("2026-10-24T18:29:59.999Z");
    assert.equal(mod.isSundayInIndia(sat115959), false);
    assert.equal(mod.canCancelOrder({ status: "Pending" }, sat115959).allowed, true);

    // 4. Sunday 12:00 AM IST
    const sun0000 = new Date("2026-10-24T18:30:00.000Z");
    assert.equal(mod.isSundayInIndia(sun0000), true);
    const resSun0000 = mod.canCancelOrder({ status: "Pending" }, sun0000);
    assert.equal(resSun0000.allowed, false);
    assert.equal(resSun0000.reason, mod.SUNDAY_CANCELLATION_ERROR_MESSAGE);

    // 5. Sunday daytime (e.g. 15:30 IST)
    const sun1530 = new Date("2026-10-25T10:00:00.000Z");
    assert.equal(mod.isSundayInIndia(sun1530), true);
    const resSun1530 = mod.canCancelOrder({ status: "Pending" }, sun1530);
    assert.equal(resSun1530.allowed, false);
    assert.equal(resSun1530.reason, mod.SUNDAY_CANCELLATION_ERROR_MESSAGE);

    // 6. Sunday 11:59 PM IST
    const sun2359 = new Date("2026-10-25T18:29:00.000Z");
    assert.equal(mod.isSundayInIndia(sun2359), true);
    const resSun2359 = mod.canCancelOrder({ status: "Pending" }, sun2359);
    assert.equal(resSun2359.allowed, false);
    assert.equal(resSun2359.reason, mod.SUNDAY_CANCELLATION_ERROR_MESSAGE);

    // 7. Sunday 11:59:59 PM IST
    const sun235959 = new Date("2026-10-25T18:29:59.999Z");
    assert.equal(mod.isSundayInIndia(sun235959), true);
    const resSun235959 = mod.canCancelOrder({ status: "Pending" }, sun235959);
    assert.equal(resSun235959.allowed, false);
    assert.equal(resSun235959.reason, mod.SUNDAY_CANCELLATION_ERROR_MESSAGE);

    // 8. Monday 12:00 AM IST
    const mon0000 = new Date("2026-10-25T18:30:00.000Z");
    assert.equal(mod.isSundayInIndia(mon0000), false);
    assert.equal(mod.canCancelOrder({ status: "Pending" }, mon0000).allowed, true);
  });
}


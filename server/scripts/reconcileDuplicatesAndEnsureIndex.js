// server/scripts/reconcileDuplicatesAndEnsureIndex.js
// Safe data reconciliation and unique index enforcement for Razorpay orders in MongoDB.
// Usage:
//   Dry run (inspect only): node server/scripts/reconcileDuplicatesAndEnsureIndex.js
//   Execute reconciliation: node server/scripts/reconcileDuplicatesAndEnsureIndex.js --execute

import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const isExecute = process.argv.includes("--execute");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI is not set in server/.env");
    process.exit(1);
  }

  console.log(`=== Razorpay Duplicate Reconciliation & Unique Index Utility ===`);
  console.log(`Mode: ${isExecute ? "EXECUTE (applying changes)" : "DRY RUN (inspecting only, no changes)"}\n`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const ordersCol = db.collection("orders");

  // 1. Inspect all duplicate razorpay_payment_id groups
  const duplicates = await ordersCol
    .aggregate([
      {
        $match: {
          razorpay_payment_id: { $type: "string", $nin: ["", null] },
        },
      },
      {
        $group: {
          _id: "$razorpay_payment_id",
          count: { $sum: 1 },
          orders: {
            $push: {
              _id: "$_id",
              customer_name: "$customer_name",
              phone: "$phone",
              total: "$total",
              advance_paid: "$advance_paid",
              razorpay_signature: "$razorpay_signature",
              created_at: "$created_at",
              status: "$status",
            },
          },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ])
    .toArray();

  console.log(`Found ${duplicates.length} payment ID(s) with duplicate orders.`);

  for (const group of duplicates) {
    const paymentId = group._id;
    console.log(`\nPayment ID: ${paymentId} (${group.count} orders):`);

    // Determine canonical order: prefer order with verified razorpay_signature or earlier created_at
    const sorted = [...group.orders].sort((a, b) => {
      if (a.razorpay_signature && !b.razorpay_signature) return -1;
      if (!a.razorpay_signature && b.razorpay_signature) return 1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const canonical = sorted[0];
    const dups = sorted.slice(1);

    console.log(`  -> Canonical Order: #${canonical._id}`);
    console.log(`     Customer: ${canonical.customer_name} (${canonical.phone})`);
    console.log(`     Created: ${canonical.created_at}`);
    console.log(`     Signature: ${canonical.razorpay_signature ? "Present (verified)" : "None"}`);
    console.log(`     Status: ${canonical.status}`);

    for (const dup of dups) {
      console.log(`  -> Duplicate Order to Reconcile: #${dup._id}`);
      console.log(`     Customer: ${dup.customer_name} (${dup.phone})`);
      console.log(`     Created: ${dup.created_at}`);
      console.log(`     Signature: ${dup.razorpay_signature ? "Present" : "None"}`);
      console.log(`     Status: ${dup.status}`);

      if (isExecute) {
        const archivedPaymentId = `${paymentId}_duplicate_${canonical._id}`;
        await ordersCol.updateOne(
          { _id: dup._id },
          {
            $set: {
              status: "Cancelled",
              cancellation_reason: `Duplicate webhook creation of canonical order #${canonical._id} (${paymentId})`,
              razorpay_payment_id: archivedPaymentId,
              transaction_id: archivedPaymentId,
              "admin_telegram_notification.status": "sent",
            },
          }
        );
        console.log(`     [APPLIED] Order #${dup._id} marked Cancelled, archived payment/transaction ID to '${archivedPaymentId}', and marked telegram notification as sent.`);
      } else {
        console.log(`     [DRY RUN] Would mark Cancelled, set razorpay_payment_id and transaction_id to '${paymentId}_duplicate_${canonical._id}', and mark telegram notification as sent.`);
      }
    }
  }

  // 2. Inspect indexes on orders collection
  console.log(`\n--- Inspecting Collection Indexes ---`);
  const indexes = await ordersCol.indexes();
  console.log("Current indexes on orders:", indexes.map((idx) => ({ name: idx.name, key: idx.key, unique: Boolean(idx.unique) })));

  const oldNonUniqueIndex = indexes.find(
    (idx) => idx.name === "razorpay_payment_id_1" && !idx.unique
  );

  if (oldNonUniqueIndex) {
    console.log(`Found legacy non-unique index 'razorpay_payment_id_1'.`);
    if (isExecute) {
      await ordersCol.dropIndex("razorpay_payment_id_1");
      console.log(`[APPLIED] Dropped legacy non-unique index 'razorpay_payment_id_1'.`);
    } else {
      console.log(`[DRY RUN] Would drop legacy non-unique index 'razorpay_payment_id_1'.`);
    }
  }

  const hasUniqueIndex = indexes.some(
    (idx) => idx.key.razorpay_payment_id && idx.unique
  );

  if (!hasUniqueIndex) {
    if (isExecute) {
      console.log("Building unique partial index on razorpay_payment_id...");
      await ordersCol.createIndex(
        { razorpay_payment_id: 1 },
        {
          unique: true,
          partialFilterExpression: { razorpay_payment_id: { $type: "string" } },
          name: "uniq_razorpay_payment_id",
        }
      );
      console.log("[APPLIED] Unique partial index 'uniq_razorpay_payment_id' created successfully!");
    } else {
      console.log("[DRY RUN] Would create unique partial index 'uniq_razorpay_payment_id'.");
    }
  } else {
    console.log("Unique index on razorpay_payment_id already exists.");
  }

  const finalIndexes = await ordersCol.indexes();
  console.log("\nFinal indexes:", finalIndexes.map((idx) => ({ name: idx.name, key: idx.key, unique: Boolean(idx.unique) })));

  await mongoose.disconnect();
  console.log("\nCompleted successfully.");
}

main().catch((err) => {
  console.error("Reconciliation error:", err);
  process.exit(1);
});


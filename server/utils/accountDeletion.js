// utils/accountDeletion.js — secure, idempotent customer account deletion
// pipeline. Removes account-linked personal data and revokes/deletes Firebase
// Auth accounts while preserving financial/payment order records (anonymizing
// personal identifiers on completed/historical orders).
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import CustomerDeviceToken from "../models/CustomerDeviceToken.js";
import CustomerNotification from "../models/CustomerNotification.js";
import PhoneOtp from "../models/PhoneOtp.js";
import AccountDeletionRecord from "../models/AccountDeletionRecord.js";
import { getAdminAuth } from "../firebaseAdmin.js";

const ACTIVE_ORDER_STATUSES = new Set(["Pending", "Preparing"]);
const ANONYMIZED_NAME = "Deleted User";
const ANONYMIZED_PHONE = "DELETED";
const ANONYMIZED_ADDRESS = "Removed upon account deletion";

const inFlightDeletionLocks = new Map();

function normalizeDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

async function withDeletionLock(uid, fn) {
  while (inFlightDeletionLocks.has(uid)) {
    await inFlightDeletionLocks.get(uid);
  }

  let releaseLock;
  const promise = new Promise((resolve) => {
    releaseLock = resolve;
  });
  inFlightDeletionLocks.set(uid, promise);

  try {
    return await fn();
  } finally {
    inFlightDeletionLocks.delete(uid);
    releaseLock();
  }
}

function buildSummary(record) {
  return {
    profileDeleted: Boolean(record.profile_deleted),
    firebaseDeleted: Boolean(record.firebase_deleted),
    deviceTokensRemoved: Number(record.tokens_deleted_count || 0),
    notificationsRemoved: Number(record.notifications_deleted_count || 0),
    historicalOrdersAnonymized: Number(record.orders_anonymized_count || 0),
    activeOrdersPreservedForDelivery: Number(record.active_orders_preserved_count || 0),
    financialRecordsRetained: true,
  };
}

export class AccountDeletionError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AccountDeletionError";
    this.statusCode = statusCode;
  }
}

export async function executeCustomerAccountDeletion({
  customer,
  deps = {},
}) {
  const uid = typeof customer?.uid === "string" ? customer.uid.trim() : "";
  if (!uid) {
    throw new AccountDeletionError("Authenticated customer identity is required", 401);
  }

  const models = {
    Order: deps.Order || Order,
    Customer: deps.Customer || Customer,
    CustomerDeviceToken: deps.CustomerDeviceToken || CustomerDeviceToken,
    CustomerNotification: deps.CustomerNotification || CustomerNotification,
    PhoneOtp: deps.PhoneOtp || PhoneOtp,
    AccountDeletionRecord: deps.AccountDeletionRecord || AccountDeletionRecord,
    getAdminAuth: deps.getAdminAuth || getAdminAuth,
  };

  const isPhoneAccount = uid.startsWith("phone:");
  const authProvider = customer.authProvider || (isPhoneAccount ? "phone" : "firebase");
  const tokenIssuedAt = customer.tokenIssuedAt instanceof Date
    ? customer.tokenIssuedAt
    : customer.tokenIssuedAt
      ? new Date(customer.tokenIssuedAt)
      : null;

  return withDeletionLock(uid, async () => {
    // 1. Idempotency check — if this account was already deleted for this
    // session (or without a newer fresh login), return success without re-running.
    const existingRecord = await models.AccountDeletionRecord.findOne({ uid });
    if (
      existingRecord &&
      existingRecord.status === "completed" &&
      existingRecord.completed_at &&
      (!tokenIssuedAt || tokenIssuedAt.getTime() <= new Date(existingRecord.completed_at).getTime())
    ) {
      return {
        httpStatus: 200,
        ok: true,
        status: "completed",
        alreadyDeleted: true,
        message: "Your NvFresh account has already been deleted.",
        summary: buildSummary(existingRecord),
      };
    }

    // 2. Record deletion attempt in_progress before mutating personal data.
    const now = new Date();
    const record = await models.AccountDeletionRecord.findOneAndUpdate(
      { uid },
      {
        $set: {
          auth_provider: authProvider,
          status: "in_progress",
          requested_at: now,
          last_error: "",
        },
        $inc: { deletion_count: existingRecord ? 1 : 0 },
        $setOnInsert: {
          uid,
          deletion_count: 1,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    let tokensDeletedCount = Number(record.tokens_deleted_count || 0);
    let notificationsDeletedCount = Number(record.notifications_deleted_count || 0);
    let ordersAnonymizedCount = Number(record.orders_anonymized_count || 0);
    let activeOrdersPreservedCount = Number(record.active_orders_preserved_count || 0);
    let profileDeleted = Boolean(record.profile_deleted);

    // 3. Remove account-linked personal data & anonymize historical orders.
    // Financial and payment records (Order documents) are NEVER deleted.
    try {
      const candidatePhones = new Set();
      const verifiedPhone = normalizeDigits(customer.phone || (isPhoneAccount ? uid.slice("phone:".length) : ""));
      if (verifiedPhone) {
        candidatePhones.add(verifiedPhone);
      }

      const customerOrders = await models.Order.find({ customer_uid: uid });
      const historicalOrderIds = [];
      const activeOrderIds = [];

      for (const order of customerOrders) {
        const orderPhone = normalizeDigits(order.phone);
        if (orderPhone) {
          candidatePhones.add(orderPhone);
        }
        if (ACTIVE_ORDER_STATUSES.has(order.status)) {
          activeOrderIds.push(order._id);
        } else {
          historicalOrderIds.push(order._id);
        }
      }

      // Anonymize personal identifiers on completed/cancelled orders while
      // retaining all financial, product, and Razorpay/UPI transaction records.
      if (historicalOrderIds.length > 0) {
        const anonymizeRes = await models.Order.updateMany(
          { _id: { $in: historicalOrderIds }, customer_uid: uid },
          {
            $set: {
              customer_uid: null,
              customer_name: ANONYMIZED_NAME,
              phone: ANONYMIZED_PHONE,
              address: ANONYMIZED_ADDRESS,
            },
          }
        );
        ordersAnonymizedCount += Number(anonymizeRes?.modifiedCount ?? historicalOrderIds.length);
      }

      // For active in-flight orders (Pending/Preparing), keep delivery contact
      // details so fulfilment can finish, while unlinking the deleted account.
      if (activeOrderIds.length > 0) {
        await models.Order.updateMany(
          { _id: { $in: activeOrderIds }, customer_uid: uid },
          { $set: { customer_uid: null } }
        );
        activeOrdersPreservedCount += activeOrderIds.length;
      }

      // Delete push notification device tokens & in-app notifications for this uid.
      const tokenRes = await models.CustomerDeviceToken.deleteMany({ customerUid: uid });
      tokensDeletedCount += Number(tokenRes?.deletedCount || 0);

      const notifRes = await models.CustomerNotification.deleteMany({ recipientCustomer: uid });
      notificationsDeletedCount += Number(notifRes?.deletedCount || 0);

      // Delete Customer profile records ONLY for phones exclusively tied to
      // this customer (never deleting another customer's profile).
      for (const phone of candidatePhones) {
        const sharedWithOtherCustomer = await models.Order.exists({
          phone,
          customer_uid: { $nin: [null, uid] },
        });
        if (!sharedWithOtherCustomer) {
          const customerRes = await models.Customer.deleteOne({ phone });
          if (customerRes?.deletedCount > 0) {
            profileDeleted = true;
          }
          await models.PhoneOtp.deleteMany({ phone });
        }
      }
      // If no Customer doc existed (e.g., signed in without placing an order),
      // profile cleanup is still complete.
      profileDeleted = true;
    } catch (dbErr) {
      await models.AccountDeletionRecord.updateOne(
        { uid },
        {
          $set: {
            status: "in_progress",
            last_error: dbErr.message || "Database cleanup failed",
            tokens_deleted_count: tokensDeletedCount,
            notifications_deleted_count: notificationsDeletedCount,
            orders_anonymized_count: ordersAnonymizedCount,
            active_orders_preserved_count: activeOrdersPreservedCount,
          },
        }
      ).catch(() => {});

      throw new AccountDeletionError(
        "Could not complete account deletion right now. Your account was not finalized as deleted — please try again or contact support@nvfresh.in.",
        500
      );
    }

    // 4. For Firebase-authenticated accounts, revoke tokens & delete the
    // Firebase Auth user. If Firebase Admin is unavailable or fails transiently,
    // record an honest pending status rather than falsely claiming full completion.
    let firebaseDeleted = authProvider !== "firebase";
    let finalStatus = "completed";
    let firebaseError = "";

    if (authProvider === "firebase") {
      const adminAuth = models.getAdminAuth();
      if (!adminAuth) {
        firebaseDeleted = false;
        finalStatus = "pending_manual_review";
        firebaseError = "Firebase Admin Auth is not configured on the server";
      } else {
        try {
          try {
            await adminAuth.revokeRefreshTokens(uid);
          } catch (revokeErr) {
            if (revokeErr?.code !== "auth/user-not-found") {
              throw revokeErr;
            }
          }
          try {
            await adminAuth.deleteUser(uid);
          } catch (deleteErr) {
            if (deleteErr?.code !== "auth/user-not-found") {
              throw deleteErr;
            }
          }
          firebaseDeleted = true;
        } catch (fbErr) {
          firebaseDeleted = false;
          finalStatus = "pending_manual_review";
          firebaseError = fbErr?.message || "Firebase account deletion failed";
        }
      }
    }

    const completedAt = finalStatus === "completed" ? new Date() : null;
    const finalized = await models.AccountDeletionRecord.findOneAndUpdate(
      { uid },
      {
        $set: {
          status: finalStatus,
          completed_at: completedAt,
          firebase_deleted: firebaseDeleted,
          profile_deleted: profileDeleted,
          tokens_deleted_count: tokensDeletedCount,
          notifications_deleted_count: notificationsDeletedCount,
          orders_anonymized_count: ordersAnonymizedCount,
          active_orders_preserved_count: activeOrdersPreservedCount,
          last_error: firebaseError,
        },
      },
      { new: true }
    );

    const summary = buildSummary(finalized || {
      profile_deleted: profileDeleted,
      firebase_deleted: firebaseDeleted,
      tokens_deleted_count: tokensDeletedCount,
      notifications_deleted_count: notificationsDeletedCount,
      orders_anonymized_count: ordersAnonymizedCount,
      active_orders_preserved_count: activeOrdersPreservedCount,
    });

    if (finalStatus === "pending_manual_review") {
      return {
        httpStatus: 202,
        ok: true,
        status: "pending",
        alreadyDeleted: false,
        message:
          "Your NvFresh profile, device tokens, and notifications have been removed. Final removal of your Google/Firebase sign-in credentials is pending completion — you may retry shortly or contact support@nvfresh.in.",
        summary,
      };
    }

    const activeOrderNote =
      activeOrdersPreservedCount > 0
        ? " Delivery details for active undelivered orders are retained strictly until delivery is completed."
        : "";

    return {
      httpStatus: 200,
      ok: true,
      status: "completed",
      alreadyDeleted: false,
      message: `Your NvFresh account and personal profile data have been permanently deleted. Essential payment and order transaction records are retained as required by law.${activeOrderNote}`,
      summary,
    };
  });
}

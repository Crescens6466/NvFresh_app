// utils/cancellationPolicy.js — Cancellation cutoff and policy helper for customer mobile.
//
// Policy:
// - Orders can be cancelled until Saturday at 11:59 PM IST.
// - Cancellations are strictly not allowed from Sunday 12:00 AM onwards through Sunday 11:59 PM IST.
// - Evaluated using Asia/Kolkata timezone (UTC+05:30).

export const SUNDAY_CANCELLATION_ERROR_MESSAGE =
  "Orders cannot be cancelled on Sunday. The cancellation window closes on Saturday at 11:59 PM.";

/**
 * Returns date and time breakdown in Asia/Kolkata (IST, UTC+05:30).
 * India does not have daylight saving time, so IST is strictly UTC + 5h 30m.
 *
 * @param {Date|number|string} [date=new Date()]
 * @returns {{ year: number, month: number, date: number, day: number, hours: number, minutes: number, seconds: number, istDate: Date }}
 */
export function getIndiaTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date provided to cancellation policy");
  }
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth(),
    date: istDate.getUTCDate(),
    day: istDate.getUTCDay(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
    seconds: istDate.getUTCSeconds(),
    istDate,
  };
}

/**
 * Checks whether the given date/time falls on Sunday in Asia/Kolkata.
 * Sunday cutoff window: Sunday 12:00:00 AM (00:00:00) through Sunday 11:59:59.999 PM (23:59:59.999) IST.
 *
 * @param {Date|number|string} [date=new Date()]
 * @returns {boolean}
 */
export function isSundayInIndia(date = new Date()) {
  return getIndiaTime(date).day === 0;
}

/**
 * Evaluates whether an order can be cancelled at a given point in time.
 *
 * @param {object} order
 * @param {Date|number|string} [now=new Date()]
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function canCancelOrder(order, now = new Date()) {
  if (!order) {
    return { allowed: false, reason: "Order not found." };
  }
  if (order.status === "Cancelled") {
    return { allowed: false, reason: "Order is already cancelled." };
  }
  if (isSundayInIndia(now)) {
    return {
      allowed: false,
      reason: SUNDAY_CANCELLATION_ERROR_MESSAGE,
    };
  }
  if (order.status === "Delivered") {
    return { allowed: false, reason: "Delivered orders cannot be cancelled." };
  }
  return { allowed: true, reason: null };
}


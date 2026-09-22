// utils/upiPayment.js — builds a UPI deep link for a given amount and
// renders it as a QR code (data URI). The amount always comes from
// server-computed totals (see pricing.js) — never from the client.
import { randomBytes } from "crypto";
import QRCode from "qrcode";

export function createPaymentReference() {
  return `NVF${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function buildUpiUrl({ upiId, businessName, transactionReference, amount, note }) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: businessName,
    tr: transactionReference,
    am: Number(amount).toFixed(2),
    cu: "INR",
    tn: note,
  });
  const upiUrl = `upi://pay?${params.toString()}`;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[payment] Generated UPI transaction reference: ${transactionReference}`);
    console.info(`[payment] Generated UPI URI: ${upiUrl}`);
  }
  return upiUrl;
}

export async function generateQrDataUrl(upiUrl) {
  return QRCode.toDataURL(upiUrl, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}

// utils/upiPayment.js — builds a UPI deep link for a given amount and
// renders it as a QR code (data URI). The amount always comes from
// server-computed totals (see pricing.js) — never from the client.
import QRCode from "qrcode";

export function buildUpiUrl({ upiId, businessName, amount, note }) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: businessName,
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

export async function generateQrDataUrl(upiUrl) {
  return QRCode.toDataURL(upiUrl, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}

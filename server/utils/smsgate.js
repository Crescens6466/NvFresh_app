// utils/smsgate.js — OTP delivery via SMS Gateway for Android (SMSGate),
// routed through a physical Android phone + SIM rather than a registered
// enterprise SMS/DLT sender. Chosen because it needs no GST/Udyam/DLT
// registration — the tradeoff is that delivery depends entirely on that one
// phone staying powered on, connected, and online; there's no fallback if
// it goes offline. See server/routes/testSmsGate.js history for the
// connectivity proof (that isolated test route has since been removed).
// Docs: https://docs.sms-gate.app/getting-started/public-cloud-server/

function apiBase() {
  return process.env.SMSGATE_API_URL || "https://api.sms-gate.app";
}

function authHeader() {
  const { SMSGATE_USERNAME, SMSGATE_PASSWORD } = process.env;
  return "Basic " + Buffer.from(`${SMSGATE_USERNAME}:${SMSGATE_PASSWORD}`).toString("base64");
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `+${withCountryCode}`;
}

// The customer is actively waiting on this, so — same contract as every
// OTP sender before it (WhatsApp, then MSG91) — failure must be surfaced
// (thrown), not swallowed. This only confirms SMSGate Cloud ACCEPTED the
// request (state "Pending"); it does not wait for final delivery — doing
// that synchronously in the request path risks the customer's request
// timing out, since actual delivery can take anywhere from ~2s to a minute.
export async function sendOtpSms(phone, code) {
  if (process.env.SMS_ENABLED === "false") {
    throw new Error("SMS delivery is not configured");
  }
  const { SMSGATE_USERNAME, SMSGATE_PASSWORD } = process.env;
  if (!SMSGATE_USERNAME || !SMSGATE_PASSWORD) {
    throw new Error("SMS delivery is not configured");
  }

  const res = await fetch(`${apiBase()}/3rdparty/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textMessage: { text: `Your NvFresh OTP is ${code}. Valid for 5 minutes. Do not share it with anyone.` },
      phoneNumbers: [normalizePhone(phone)],
      // Pinned explicitly — this device has 2 SIM slots, and slot 2's radio
      // is deactivated (RESULT_ERROR_RADIO_OFF). Without this, SMSGate's
      // auto-selection intermittently picks slot 2 and every other send
      // fails. Slot 1 is the confirmed-working SIM; override via env if
      // that ever changes (e.g. the SIMs get swapped).
      simNumber: Number(process.env.SMSGATE_SIM_NUMBER) || 1,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`SMSGate send failed: ${data.message || res.statusText}`);
  }
  return data.id; // SMSGate's message id, for logging
}

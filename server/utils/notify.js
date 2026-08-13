// utils/notify.js — sends order-related and OTP messages via WhatsApp (Meta
// Cloud API). Order/admin notifications are best-effort (never block the
// caller); OTP delivery is not — the customer is waiting on it, so
// sendOtpWhatsApp() throws on failure instead of swallowing it.

const WHATSAPP_API_VERSION = "v20.0";

function normalizePhone(phone) {
  // Meta expects the number with country code, no "+", no spaces.
  // Assumes 10-digit numbers are Indian mobiles and prefixes 91.
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// All of these are business-initiated messages, so WhatsApp requires a
// pre-approved template for each (create + approve these in Meta Business
// Manager first — see README).
async function sendWhatsAppMessage({ to, templateName, templateLang, parameters }) {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp is not configured");
  }

  const recipient = normalizePhone(to);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed: ${await res.text()}`);
  }
  return recipient;
}

// Best-effort variant for order notifications — never throws, since a
// failure here should never block order placement or status updates.
async function sendWhatsAppTemplate({ to, templateName, templateLang, parameters, logLabel }) {
  try {
    const recipient = await sendWhatsAppMessage({ to, templateName, templateLang, parameters });
    console.log(`[notify] ${logLabel} sent to ${recipient}`);
  } catch (err) {
    if (err.message === "WhatsApp is not configured") {
      console.log(`[notify] WhatsApp not configured — skipping ${logLabel}`);
    } else {
      console.error(`[notify] ${logLabel} failed:`, err.message);
    }
  }
}

export function sendOrderConfirmation(order) {
  const { WHATSAPP_TEMPLATE_NAME = "order_confirmation", WHATSAPP_TEMPLATE_LANG = "en" } = process.env;
  return sendWhatsAppTemplate({
    to: order.phone,
    templateName: WHATSAPP_TEMPLATE_NAME,
    templateLang: WHATSAPP_TEMPLATE_LANG,
    parameters: [order.customer_name, String(order.id), `Rs.${order.total}`, `Rs.${order.advance_paid}`],
    logLabel: `order confirmation for order #${order.id}`,
  });
}

// adminPhone comes from Settings (the same number shown on the customer
// site's Contact Us page) — passed in by the caller rather than read here,
// since it's a DB-backed value and this module has no DB access of its own.
export function sendAdminOrderAlert(order, adminPhone) {
  if (!adminPhone) {
    console.log(`[notify] No admin phone number configured — skipping admin alert for order #${order.id}`);
    return;
  }
  const {
    WHATSAPP_ADMIN_TEMPLATE_NAME = "order_alert_admin",
    WHATSAPP_ADMIN_TEMPLATE_LANG = "en",
  } = process.env;
  return sendWhatsAppTemplate({
    to: adminPhone,
    templateName: WHATSAPP_ADMIN_TEMPLATE_NAME,
    templateLang: WHATSAPP_ADMIN_TEMPLATE_LANG,
    parameters: [order.customer_name, String(order.id), `Rs.${order.total}`, order.phone],
    logLabel: `admin order alert for order #${order.id}`,
  });
}

// Customer phone-login OTP — the customer is actively waiting on this, so
// unlike the notifications above, failure here must be surfaced (thrown),
// not swallowed.
export async function sendOtpWhatsApp(phone, code) {
  const { WHATSAPP_OTP_TEMPLATE_NAME = "customer_otp", WHATSAPP_OTP_TEMPLATE_LANG = "en" } = process.env;
  await sendWhatsAppMessage({
    to: phone,
    templateName: WHATSAPP_OTP_TEMPLATE_NAME,
    templateLang: WHATSAPP_OTP_TEMPLATE_LANG,
    parameters: [code],
  });
}

// utils/notify.js — sends order-related messages via WhatsApp (Meta Cloud API).
// Safe no-op if WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID aren't set,
// so the app works fine without WhatsApp configured.

const WHATSAPP_API_VERSION = "v20.0";

function normalizePhone(phone) {
  // Meta expects the number with country code, no "+", no spaces.
  // Assumes 10-digit numbers are Indian mobiles and prefixes 91.
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// Both order confirmations (to the customer) and order alerts (to the admin)
// are business-initiated, so WhatsApp requires a pre-approved message
// template for each (create + approve these in Meta Business Manager first
// — see README).
async function sendWhatsAppTemplate({ to, templateName, templateLang, parameters, logLabel }) {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[notify] WhatsApp not configured — skipping ${logLabel}`);
    return;
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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[notify] ${logLabel} failed:`, errText);
    } else {
      console.log(`[notify] ${logLabel} sent to ${recipient}`);
    }
  } catch (err) {
    console.error(`[notify] ${logLabel} error:`, err.message);
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

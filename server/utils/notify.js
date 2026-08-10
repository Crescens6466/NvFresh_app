// utils/notify.js — sends an order confirmation via WhatsApp (Meta Cloud API).
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

export async function sendOrderConfirmation(order) {
  const {
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_TEMPLATE_NAME = "order_confirmation",
    WHATSAPP_TEMPLATE_LANG = "en",
  } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log("[notify] WhatsApp not configured — skipping order notification");
    return;
  }

  const to = normalizePhone(order.phone);
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // Order confirmations are business-initiated, so WhatsApp requires a
  // pre-approved message template (create + approve this in Meta Business
  // Manager first — see README). Adjust the parameters below to match
  // whatever placeholders your approved template actually has.
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: WHATSAPP_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: order.customer_name },
            { type: "text", text: String(order.id) },
            { type: "text", text: `Rs.${order.total}` },
            { type: "text", text: `Rs.${order.advance_paid}` },
          ],
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
      console.error(`[notify] WhatsApp send failed for order #${order.id}:`, errText);
    } else {
      console.log(`[notify] WhatsApp confirmation sent to ${to} for order #${order.id}`);
    }
  } catch (err) {
    console.error(`[notify] WhatsApp send error for order #${order.id}:`, err.message);
  }
}

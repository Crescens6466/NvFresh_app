// utils/notify.js — sends order/admin notifications via WhatsApp (Meta
// Cloud API). All best-effort — a failure here must never block order
// placement or a status update (see sendWhatsAppTemplate below). OTP
// delivery is handled separately, via SMS — see utils/smsgate.js.

function apiVersion() {
  return process.env.WHATSAPP_API_VERSION || "v20.0";
}

function normalizePhone(phone) {
  // Meta expects the number with country code, no "+", no spaces.
  // Assumes 10-digit numbers are Indian mobiles and prefixes 91.
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// All of these are business-initiated messages, so WhatsApp requires a
// pre-approved template for each (create + approve these in Meta Business
// Manager first — see README). Returns the Meta message id on success, so
// callers can record it for notification-history/duplicate-audit purposes.
async function sendWhatsAppMessage({ to, templateName, templateLang, parameters }) {
  // Lets the app run without real WhatsApp credentials (e.g. local dev) —
  // defaults to enabled so production behavior is unchanged when unset.
  if (process.env.WHATSAPP_ENABLED === "false") {
    throw new Error("WhatsApp is not configured");
  }
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error("WhatsApp is not configured");
  }

  const recipient = normalizePhone(to);
  const url = `https://graph.facebook.com/${apiVersion()}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
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
  const data = await res.json();
  return { recipient, messageId: data?.messages?.[0]?.id || null };
}

// Best-effort variant for order notifications — never throws, since a
// failure here should never block order placement or status updates.
// Returns { type, success, messageId, sentAt, error? } so callers can push
// it onto Order.whatsapp_notifications as a durable send record.
async function sendWhatsAppTemplate({ type, to, templateName, templateLang, parameters, logLabel }) {
  const sentAt = new Date();
  try {
    const { recipient, messageId } = await sendWhatsAppMessage({ to, templateName, templateLang, parameters });
    console.log(`[notify] ${logLabel} sent to ${recipient}`);
    return { type, success: true, messageId, sentAt };
  } catch (err) {
    if (err.message === "WhatsApp is not configured") {
      console.log(`[notify] WhatsApp not configured — skipping ${logLabel}`);
    } else {
      console.error(`[notify] ${logLabel} failed:`, err.message);
    }
    return { type, success: false, messageId: null, sentAt, error: err.message };
  }
}

export function sendOrderConfirmation(order) {
  const { WHATSAPP_TEMPLATE_NAME = "order_confirmation", WHATSAPP_TEMPLATE_LANG = "en" } = process.env;
  return sendWhatsAppTemplate({
    type: "order_received",
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
    type: "admin_new_order",
    to: adminPhone,
    templateName: WHATSAPP_ADMIN_TEMPLATE_NAME,
    templateLang: WHATSAPP_ADMIN_TEMPLATE_LANG,
    parameters: [order.customer_name, String(order.id), `Rs.${order.total}`, order.phone],
    logLabel: `admin order alert for order #${order.id}`,
  });
}

export function sendPaymentConfirmedNotification(order) {
  const {
    WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE_NAME = "payment_confirmed",
    WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE_LANG = "en",
  } = process.env;
  return sendWhatsAppTemplate({
    type: "payment_confirmed",
    to: order.phone,
    templateName: WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE_NAME,
    templateLang: WHATSAPP_PAYMENT_CONFIRMED_TEMPLATE_LANG,
    parameters: [`Rs.${order.advance_paid}`, String(order.id)],
    logLabel: `payment confirmed notification for order #${order.id}`,
  });
}

export function sendOrderPreparingNotification(order) {
  const {
    WHATSAPP_PREPARING_TEMPLATE_NAME = "order_preparing",
    WHATSAPP_PREPARING_TEMPLATE_LANG = "en",
  } = process.env;
  return sendWhatsAppTemplate({
    type: "order_preparing",
    to: order.phone,
    templateName: WHATSAPP_PREPARING_TEMPLATE_NAME,
    templateLang: WHATSAPP_PREPARING_TEMPLATE_LANG,
    parameters: [String(order.id)],
    logLabel: `preparing notification for order #${order.id}`,
  });
}

export function sendOrderDeliveredNotification(order) {
  const {
    WHATSAPP_DELIVERED_TEMPLATE_NAME = "order_delivered",
    WHATSAPP_DELIVERED_TEMPLATE_LANG = "en",
  } = process.env;
  return sendWhatsAppTemplate({
    type: "order_delivered",
    to: order.phone,
    templateName: WHATSAPP_DELIVERED_TEMPLATE_NAME,
    templateLang: WHATSAPP_DELIVERED_TEMPLATE_LANG,
    parameters: [String(order.id)],
    logLabel: `delivered notification for order #${order.id}`,
  });
}

export function sendOrderCancelledNotification(order) {
  const {
    WHATSAPP_CANCELLED_TEMPLATE_NAME = "order_cancelled",
    WHATSAPP_CANCELLED_TEMPLATE_LANG = "en",
  } = process.env;
  return sendWhatsAppTemplate({
    type: "order_cancelled",
    to: order.phone,
    templateName: WHATSAPP_CANCELLED_TEMPLATE_NAME,
    templateLang: WHATSAPP_CANCELLED_TEMPLATE_LANG,
    parameters: [String(order.id), order.cancellation_reason || "Not specified"],
    logLabel: `cancellation notification for order #${order.id}`,
  });
}

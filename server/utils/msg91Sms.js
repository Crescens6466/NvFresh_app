const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow";
const REQUEST_TIMEOUT_MS = 10000;

function normalizeMobile(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  throw new Error("MSG91 SMS mobile number is invalid");
}

export function buildAdminOrderSmsPayload({ templateId, mobile, orderId, amount, customerName }) {
  if (!templateId) throw new Error("MSG91 SMS template ID is not configured");

  return {
    template_id: templateId,
    short_url: "0",
    recipients: [
      {
        mobiles: normalizeMobile(mobile),
        VAR1: String(orderId),
        VAR2: Number(amount).toFixed(2),
        VAR3: String(customerName || "Customer"),
      },
    ],
  };
}

function getMsg91Error(responseBody, status) {
  const message =
    responseBody?.message ||
    responseBody?.error ||
    responseBody?.msg ||
    `HTTP ${status}`;
  const normalized = String(message).toLowerCase();

  if (normalized.includes("auth")) return "invalid authkey";
  if (normalized.includes("template") || normalized.includes("dlt")) {
    return "invalid template or DLT/template mismatch";
  }
  if (normalized.includes("mobile") || normalized.includes("number")) {
    return "invalid mobile number";
  }
  if (normalized.includes("balance") || normalized.includes("credit")) {
    return "insufficient or unavailable SMS balance";
  }
  return String(message);
}

export async function sendAdminOrderSms({ orderId, amount, customerName }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_ADMIN_SMS_TEMPLATE_ID;
  const mobile = process.env.ADMIN_NOTIFICATION_MOBILE;

  if (!authKey || !templateId || !mobile) {
    throw new Error("MSG91 SMS is not configured");
  }

  const payload = buildAdminOrderSmsPayload({
    templateId,
    mobile,
    orderId,
    amount,
    customerName,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin-sms] MSG91 SMS request attempted");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  let responseBody;
  try {
    response = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    responseBody = await response.json().catch(() => ({}));
  } catch (err) {
    const message = err.name === "AbortError" ? "API timeout" : "network error";
    console.error(`[admin-sms] MSG91 SMS failed: ${message}`);
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || responseBody?.type === "error" || responseBody?.status === false) {
    const message = getMsg91Error(responseBody, response.status);
    console.error(`[admin-sms] MSG91 SMS failed: ${message}`);
    throw new Error(message);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin-sms] MSG91 SMS response succeeded");
  }
  return responseBody;
}

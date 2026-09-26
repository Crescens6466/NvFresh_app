const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const REQUEST_TIMEOUT_MS = 10000;

export function buildAdminOrderTelegramPayload({ chatId, orderId, customerName, phone, amount }) {
  if (!chatId) throw new Error("Telegram order chat ID is not configured");

  return {
    chat_id: chatId,
    text: [
      "🔔 NEW NVFRESH ORDER",
      "",
      `Order: #${orderId}`,
      `Customer: ${customerName}`,
      `Phone: ${phone}`,
      `Amount: ₹${Number(amount).toFixed(2)}`,
      "",
      "📦 New order received.",
      "Please open the Admin panel to process the order.",
      "",
      '<a href="https://admin.nvfresh.in">🔗 Open Admin Panel</a>',
    ].join("\n"),
    parse_mode: "HTML",
  };
}

export async function sendAdminOrderTelegram({ orderId, customerName, phone, amount }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ORDER_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("Telegram order notification is not configured");
  }

  const payload = buildAdminOrderTelegramPayload({
    chatId,
    orderId,
    customerName,
    phone,
    amount,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin-telegram] Telegram notification attempted");
  }

  let response;
  let responseBody;
  try {
    response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    responseBody = await response.json().catch(() => ({}));
  } catch (err) {
    const message = err.name === "AbortError" ? "API timeout" : "network error";
    console.error(`[admin-telegram] Telegram notification failed: ${message}`);
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || responseBody?.ok !== true) {
    const description = responseBody?.description || `HTTP ${response.status}`;
    console.error(`[admin-telegram] Telegram notification failed: ${description}`);
    throw new Error(description);
  }

  if (process.env.NODE_ENV !== "production") {
    const messageId = responseBody.result?.message_id;
    console.info(
      `[admin-telegram] Telegram notification succeeded${messageId ? ` (message ${messageId})` : ""}`
    );
  }

  return responseBody;
}

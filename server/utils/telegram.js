const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_TELEGRAM_MESSAGE_LENGTH = 4000;

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function splitTelegramMessage(text, maxLength = MAX_TELEGRAM_MESSAGE_LENGTH) {
  if (!text || text.length <= maxLength) {
    return [text || ""];
  }

  const lines = text.split("\n");
  const chunks = [];
  let currentChunk = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      let remainingLine = line;
      while (remainingLine.length > maxLength) {
        let splitIdx = remainingLine.lastIndexOf(" ", maxLength);
        if (splitIdx === -1 || splitIdx < maxLength / 2) {
          splitIdx = maxLength;
        }
        chunks.push(remainingLine.slice(0, splitIdx));
        remainingLine = remainingLine.slice(splitIdx).trimStart();
      }
      if (remainingLine) {
        currentChunk = remainingLine;
      }
      continue;
    }

    const nextChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    if (nextChunk.length <= maxLength) {
      currentChunk = nextChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function buildAdminOrderTelegramPayload(params) {
  const { chatId } = params || {};
  if (!chatId) throw new Error("Telegram order chat ID is not configured");

  const orderId = params.orderId || params.order_id || params.id || "";
  const cleanOrderId = String(orderId).replace(/^#/, "");

  const customerName = params.customerName || params.customer_name || "Customer";
  const phone = params.phone || "N/A";
  const address = params.address || "No address provided";

  const rawItems = params.items || [];
  const formattedItems = Array.isArray(rawItems) && rawItems.length > 0
    ? rawItems.map((item) => {
        const name = escapeHtml(item.name || item.product_name || item.productName || "Item");
        const weight = escapeHtml(item.weight || item.variant || "");
        const quantity = item.quantity ?? 1;
        return weight
          ? `• ${name} — ${weight} × ${quantity}`
          : `• ${name} × ${quantity}`;
      })
    : ["• No items specified"];

  const totalNum = Math.max(0, Number(params.total ?? params.amount ?? 0));
  const advanceNum = Math.max(
    0,
    Number(
      params.advancePaid ??
      params.advance_paid ??
      (params.total !== undefined ? 0 : (params.amount ?? 0))
    )
  );
  const remainingNum = Math.max(0, totalNum - advanceNum);
  const isFullyPaid = totalNum > 0 && remainingNum === 0 && advanceNum >= totalNum;

  const paymentLines = [
    "💰 PAYMENT SUMMARY:",
    `Order Total: ₹${totalNum.toFixed(2)}`,
    `Advance Paid: ₹${advanceNum.toFixed(2)}`,
    `Remaining on Delivery: ₹${remainingNum.toFixed(2)}`,
  ];
  if (isFullyPaid) {
    paymentLines.push("Fully paid — nothing to collect on delivery.");
  }

  const rawInstruction = (
    params.deliveryInstruction ||
    params.delivery_instruction ||
    params.notes ||
    ""
  ).trim().replace(/^📦\s*/, "");

  const sections = [
    [
      "🔔 NEW NVFRESH ORDER",
      "",
      `Order: #${escapeHtml(cleanOrderId)}`,
      `Customer: ${escapeHtml(customerName)}`,
      `Phone: ${escapeHtml(phone)}`,
    ].join("\n"),

    [
      "📦 ORDER ITEMS:",
      ...formattedItems,
    ].join("\n"),

    [
      "📍 DELIVERY ADDRESS:",
      escapeHtml(address.trim()),
    ].join("\n"),

    paymentLines.join("\n"),
  ];

  if (rawInstruction) {
    sections.push(`📦 ${escapeHtml(rawInstruction)}`);
  }

  sections.push('<a href="https://admin.nvfresh.in">🔗 Open Admin Panel</a>');

  return {
    chat_id: chatId,
    text: sections.join("\n\n"),
    parse_mode: "HTML",
  };
}

export async function sendAdminOrderTelegram(params) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ORDER_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("Telegram order notification is not configured");
  }

  const payload = buildAdminOrderTelegramPayload({
    chatId,
    ...params,
  });

  const chunks = splitTelegramMessage(payload.text);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[admin-telegram] Telegram notification attempted (${chunks.length} message${chunks.length > 1 ? "s" : ""})`
    );
  }

  let lastResponseBody;
  try {
    for (const chunk of chunks) {
      let response;
      let responseBody;
      try {
        response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            text: chunk,
          }),
          signal: controller.signal,
        });
        responseBody = await response.json().catch(() => ({}));
      } catch (err) {
        const message = err.name === "AbortError" ? "API timeout" : "network error";
        console.error(`[admin-telegram] Telegram notification failed: ${message}`);
        throw new Error(message);
      }

      if (!response.ok || responseBody?.ok !== true) {
        const description = responseBody?.description || `HTTP ${response.status}`;
        console.error(`[admin-telegram] Telegram notification failed: ${description}`);
        throw new Error(description);
      }
      lastResponseBody = responseBody;
    }
  } finally {
    clearTimeout(timeout);
  }

  if (process.env.NODE_ENV !== "production") {
    const messageId = lastResponseBody?.result?.message_id;
    console.info(
      `[admin-telegram] Telegram notification succeeded${messageId ? ` (message ${messageId})` : ""}`
    );
  }

  return lastResponseBody;
}

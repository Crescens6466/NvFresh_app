import { parseCoordinate, areCoordinatesValid } from "./geocoding.js";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_TELEGRAM_MESSAGE_LENGTH = 4000;
export const TELEGRAM_MAPS_BUTTON_TEXT = "📍 Open Delivery Location in Google Maps";
export const TELEGRAM_MAPS_SEARCH_BUTTON_TEXT = "🔍 Search Address in Google Maps (Approximate)";

/**
 * Extracts normalized delivery coordinates and formatted address from order params.
 */
export function extractOrderDeliveryLocation(params) {
  const candidates = [params?.deliveryLocation, params?.delivery_location].filter(
    (loc) => loc && typeof loc === "object" && !Array.isArray(loc)
  );

  for (const loc of candidates) {
    const lat = parseCoordinate(loc.latitude ?? loc.lat);
    const lng = parseCoordinate(loc.longitude ?? loc.lng);
    if (areCoordinatesValid(lat, lng)) {
      const formattedAddress =
        typeof loc.formattedAddress === "string"
          ? loc.formattedAddress.trim()
          : typeof loc.formatted_address === "string"
          ? loc.formatted_address.trim()
          : "";
      return {
        hasValidCoordinates: true,
        latitude: lat,
        longitude: lng,
        formattedAddress,
      };
    }
  }

  const firstLoc = candidates[0] || null;
  const formattedAddress =
    typeof firstLoc?.formattedAddress === "string"
      ? firstLoc.formattedAddress.trim()
      : typeof firstLoc?.formatted_address === "string"
      ? firstLoc.formatted_address.trim()
      : "";

  return {
    hasValidCoordinates: false,
    latitude: null,
    longitude: null,
    formattedAddress,
  };
}

/**
 * Builds a Google Maps driving directions URL from validated coordinates (no API key).
 */
export function buildGoogleMapsDirectionsUrl(latitude, longitude) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (!areCoordinatesValid(lat, lng)) {
    return null;
  }
  const destination = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/**
 * Builds an approximate Google Maps address search URL for legacy orders without coordinates.
 */
export function buildGoogleMapsAddressSearchUrl(address) {
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  if (!trimmed || trimmed === "No address provided") return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed.slice(0, 500))}`;
}

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
  const deliveryLoc = extractOrderDeliveryLocation(params);
  const address =
    typeof params.address === "string" && params.address.trim()
      ? params.address.trim()
      : deliveryLoc.formattedAddress || "No address provided";

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

  const addressLines = [
    "📍 DELIVERY ADDRESS:",
    escapeHtml(address),
  ];

  if (
    deliveryLoc.formattedAddress &&
    deliveryLoc.formattedAddress.toLowerCase() !== address.toLowerCase()
  ) {
    addressLines.push(`Pinned Address: ${escapeHtml(deliveryLoc.formattedAddress)}`);
  }

  let replyMarkup = null;
  if (deliveryLoc.hasValidCoordinates) {
    const directionsUrl = buildGoogleMapsDirectionsUrl(deliveryLoc.latitude, deliveryLoc.longitude);
    if (directionsUrl) {
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: TELEGRAM_MAPS_BUTTON_TEXT,
              url: directionsUrl,
            },
          ],
        ],
      };
    }
  } else {
    const searchUrl = buildGoogleMapsAddressSearchUrl(address);
    if (searchUrl) {
      addressLines.push("<i>(Approximate address only — no GPS pin saved)</i>");
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: TELEGRAM_MAPS_SEARCH_BUTTON_TEXT,
              url: searchUrl,
            },
          ],
        ],
      };
    }
  }

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

    addressLines.join("\n"),

    paymentLines.join("\n"),
  ];

  if (rawInstruction) {
    sections.push(`📦 ${escapeHtml(rawInstruction)}`);
  }

  sections.push('<a href="https://admin.nvfresh.in">🔗 Open Admin Panel</a>');

  const payload = {
    chat_id: chatId,
    text: sections.join("\n\n"),
    parse_mode: "HTML",
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return payload;
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
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;
      const requestBody = {
        chat_id: payload.chat_id,
        text: chunk,
        parse_mode: payload.parse_mode,
        ...(isLastChunk && payload.reply_markup ? { reply_markup: payload.reply_markup } : {}),
      };

      let response;
      let responseBody;
      try {
        response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
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

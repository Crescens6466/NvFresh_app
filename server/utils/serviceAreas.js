// utils/serviceAreas.js — NvFresh serviceable delivery area validation
import DeliveryArea from "../models/DeliveryArea.js";

export const DEFAULT_SERVICE_AREAS = [
  "Tadepalli",
  "Kunchanapalli",
  "Undavalli",
  "Nulakapeta",
];

export function normalizeAreaName(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase();
}

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildAreaRegex(name) {
  const norm = normalizeAreaName(name);
  let core;
  if (norm === "tadepalli" || norm === "tadepalle") {
    core = "tadepall[ie]";
  } else if (norm === "kunchanapalli" || norm === "kunchanapalle") {
    core = "kunchanapall[ie]";
  } else if (
    norm === "undavalli" ||
    norm === "vundavalli" ||
    norm === "undavalle" ||
    norm === "vundavalle"
  ) {
    core = "(?:u|vu)ndavall[ie]";
  } else if (norm === "nulakapeta" || norm === "nulakapet") {
    core = "nulakapet[a]?";
  } else {
    core = name.trim().split(/\s+/).map(escapeRegex).join("\\s+");
  }
  // Word boundaries prevent substrings (e.g. Tadepalligudem must not match Tadepalli)
  return new RegExp(`\\b${core}\\b`, "i");
}

export function formatAreaList(names = [], conjunction = "&") {
  const clean = (Array.isArray(names) ? names : [])
    .map((n) => (typeof n === "string" ? n.trim() : n?.name?.trim()))
    .filter(Boolean);

  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;
  const separator = conjunction === "and" ? ", and " : " & ";
  return `${clean.slice(0, -1).join(", ")}${separator}${clean[clean.length - 1]}`;
}

export function formatDeliveryLocationsLine(names = []) {
  const list = formatAreaList(names, "&");
  if (!list) return "Delivering to: Tadepalli, Kunchanapalli, Undavalli & Nulakapeta";
  return `Delivering to: ${list}`;
}

export function formatServiceableAreaMessage(names = []) {
  const list = formatAreaList(names, "and");
  if (!list) {
    return "NvFresh is currently not accepting deliveries to this location. Please check back later.";
  }
  return `NvFresh currently delivers only to ${list}. Please enter a delivery address within these areas.`;
}

export function isDeliveryAddressServiceable(address, activeAreaNames = DEFAULT_SERVICE_AREAS) {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();
  if (!trimmed) return false;

  const names = (Array.isArray(activeAreaNames) ? activeAreaNames : [])
    .map((a) => (typeof a === "string" ? a : a?.name))
    .filter(Boolean);

  if (names.length === 0) return false;

  return names.some((name) => {
    const regex = buildAreaRegex(name);
    return regex.test(trimmed);
  });
}

// Ensure default service areas exist in persistent storage (idempotent migration)
export async function ensureDefaultDeliveryAreas() {
  try {
    for (const name of DEFAULT_SERVICE_AREAS) {
      const normalized_name = normalizeAreaName(name);
      await DeliveryArea.updateOne(
        { normalized_name },
        {
          $setOnInsert: {
            name: name.trim(),
            normalized_name,
            is_active: true,
          },
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("[serviceAreas] Error ensuring default delivery areas in DB:", err.message);
  }
}

// Fetch active delivery areas directly from the database (no stale cache)
export async function getActiveDeliveryAreaNames() {
  try {
    const docs = await DeliveryArea.find({ is_active: true }).lean();
    if (docs.length > 0) {
      return docs.map((d) => d.name);
    }
    return DEFAULT_SERVICE_AREAS;
  } catch (err) {
    console.error("[serviceAreas] Error loading active delivery areas from DB:", err.message);
    return DEFAULT_SERVICE_AREAS;
  }
}

export async function isDeliveryAreaServiceableAsync(address) {
  const names = await getActiveDeliveryAreaNames();
  return isDeliveryAddressServiceable(address, names);
}

export async function getServiceableAreaErrorMessageAsync() {
  const names = await getActiveDeliveryAreaNames();
  return formatServiceableAreaMessage(names);
}

// Synchronous backward-compatible fallback
export function isDeliveryAreaServiceable(address) {
  return isDeliveryAddressServiceable(address, DEFAULT_SERVICE_AREAS);
}

export const SERVICEABLE_AREA_ERROR_MESSAGE = formatServiceableAreaMessage(DEFAULT_SERVICE_AREAS);

// utils/categories.js — Android category display and category merge helpers.

export const MOBILE_CATEGORIES = ["All", "Chicken", "Mutton", "Seafood"];

const CHICKEN_SOURCE_CATEGORIES = new Set([
  "chicken",
  "country chicken",
  "country_chicken",
  "countrychicken",
]);
const SEAFOOD_SOURCE_CATEGORIES = new Set(["fish", "seafood", "prawns"]);

/**
 * Maps backend category names to the Android app's displayed category name.
 * Country Chicken products are displayed under Chicken.
 * Fish (and legacy Prawns) products are displayed under Seafood in Android.
 */
export function normalizeMobileCategory(category) {
  if (typeof category !== "string") return "";
  const trimmed = category.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (CHICKEN_SOURCE_CATEGORIES.has(lower)) {
    return "Chicken";
  }
  if (SEAFOOD_SOURCE_CATEGORIES.has(lower)) {
    return "Seafood";
  }
  return trimmed;
}

/**
 * Returns a shallow copy of a product with its category normalized for Android display.
 */
export function normalizeProductForMobile(product) {
  if (!product || typeof product !== "object") return product;
  const normalizedCategory = normalizeMobileCategory(product.category);
  if (!normalizedCategory || normalizedCategory === product.category) {
    return product;
  }
  return { ...product, category: normalizedCategory };
}

/**
 * Normalizes product categories, removes duplicates by id, and applies the
 * selected Android category filter (merging Country Chicken under Chicken, and Fish + Seafood under Seafood).
 */
export function filterAndMergeMobileProducts(products, selectedCategory = "All") {
  if (!Array.isArray(products)) return [];
  const targetCategory = normalizeMobileCategory(selectedCategory) || "All";
  const seenIds = new Set();
  const result = [];

  for (const item of products) {
    if (!item || typeof item !== "object") continue;
    const key = String(item.id || item._id || "");
    if (key) {
      if (seenIds.has(key)) continue;
      seenIds.add(key);
    }
    const normalized = normalizeProductForMobile(item);
    if (
      targetCategory === "All" ||
      normalizeMobileCategory(normalized.category).toLowerCase() === targetCategory.toLowerCase()
    ) {
      result.push(normalized);
    }
  }

  return result;
}

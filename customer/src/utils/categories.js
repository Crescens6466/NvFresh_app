// utils/categories.js — Website category display and Country Chicken -> Chicken merge helpers.

export const WEBSITE_CATEGORIES = ["All", "Chicken", "Mutton", "Fish", "Seafood"];

const CHICKEN_SOURCE_CATEGORIES = new Set([
  "chicken",
  "country chicken",
  "country_chicken",
  "countrychicken",
]);

/**
 * Maps backend category names to the customer website's displayed category name.
 * Country Chicken products are displayed under Chicken.
 */
export function normalizeCategory(category) {
  if (typeof category !== "string") return "";
  const trimmed = category.trim();
  if (!trimmed) return "";
  if (CHICKEN_SOURCE_CATEGORIES.has(trimmed.toLowerCase())) {
    return "Chicken";
  }
  if (trimmed.toLowerCase() === "prawns") {
    return "Seafood";
  }
  return trimmed;
}

/**
 * Returns a shallow copy of a product with its category normalized for customer display.
 */
export function normalizeProductForCustomer(product) {
  if (!product || typeof product !== "object") return product;
  const normalizedCategory = normalizeCategory(product.category);
  if (!normalizedCategory || normalizedCategory === product.category) {
    return product;
  }
  return { ...product, category: normalizedCategory };
}

/**
 * Normalizes product categories, removes duplicates by id, and applies the
 * selected category filter (merging Country Chicken under Chicken).
 */
export function filterAndMergeProducts(products, selectedCategory = "All") {
  if (!Array.isArray(products)) return [];
  const targetCategory = normalizeCategory(selectedCategory) || "All";
  const seenIds = new Set();
  const result = [];

  for (const item of products) {
    if (!item || typeof item !== "object") continue;
    const key = String(item.id || item._id || "");
    if (key) {
      if (seenIds.has(key)) continue;
      seenIds.add(key);
    }
    const normalized = normalizeProductForCustomer(item);
    if (
      targetCategory === "All" ||
      normalizeCategory(normalized.category).toLowerCase() === targetCategory.toLowerCase()
    ) {
      result.push(normalized);
    }
  }

  return result;
}

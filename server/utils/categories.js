// utils/categories.js — Category helpers and initial database seeding
import Category from "../models/Category.js";
import Product from "../models/Product.js";

export const DEFAULT_CATEGORIES = [
  { name: "Chicken", slug: "chicken", icon: "chicken", sortOrder: 1 },
  { name: "Mutton", slug: "mutton", icon: "meat", sortOrder: 2 },
  { name: "Fish", slug: "fish", icon: "fish", sortOrder: 3 },
  { name: "Seafood", slug: "seafood", icon: "seafood", sortOrder: 4 },
];

export function escapeRegex(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugifyCategory(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ensures initial default categories exist in the database without creating duplicates.
 * Also scans existing products to ensure any distinct category already in use is present.
 */
export async function ensureDefaultCategories() {
  try {
    for (const cat of DEFAULT_CATEGORIES) {
      await Category.findOneAndUpdate(
        { slug: cat.slug },
        {
          $setOnInsert: {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon || "",
            sortOrder: cat.sortOrder || 0,
            isActive: true,
          },
        },
        { upsert: true, new: true }
      );
    }

    // Inspect existing products in MongoDB.
    // If any product uses a category that is not yet in Category (and not Country Chicken or All),
    // seed it so that existing products are never orphaned.
    const distinctCategories = await Product.distinct("category");
    let nextSortOrder = 10;
    for (const catName of distinctCategories) {
      if (!catName || typeof catName !== "string" || !catName.trim()) continue;
      const trimmed = catName.trim();
      const lower = trimmed.toLowerCase();
      if (lower === "all" || lower === "country chicken" || lower === "country_chicken" || lower === "countrychicken") {
        continue;
      }
      const slug = slugifyCategory(trimmed);
      if (!slug) continue;
      const existing = await Category.findOne({ slug });
      if (!existing) {
        await Category.create({
          name: trimmed,
          slug,
          icon: "",
          sortOrder: nextSortOrder++,
          isActive: true,
        });
      }
    }
  } catch (err) {
    console.error("[categories] Error ensuring default categories:", err.message);
  }
}

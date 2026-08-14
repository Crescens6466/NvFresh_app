// utils/pricing.js — authoritative order pricing. Mirrors the formula in
// customer/src/utils.js (priceForWeight), but this is the version that
// actually counts: totals are always recomputed here from the database,
// never trusted from the frontend.
import Product from "../models/Product.js";
import Settings from "../models/Settings.js";

const ADVANCE_PERCENTAGES = [25, 50, 75, 100];

// Thrown for bad client input (invalid cart, unknown product) — routes
// catch this specifically via instanceof and respond 400, vs. letting a
// genuinely unexpected error fall through to the generic 500 handler.
export class OrderValidationError extends Error {}

function weightMultiplier(weightLabel) {
  const match = String(weightLabel).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 1;
}

function priceForWeight(pricePerKg, weightLabel) {
  return Math.round(pricePerKg * weightMultiplier(weightLabel));
}

export function isValidAdvancePercentage(value) {
  return ADVANCE_PERCENTAGES.includes(Number(value));
}

// items: [{ productId, weight, quantity }] — only these three fields are
// trusted from the client; price is always looked up fresh here.
export async function computeOrderTotals(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderValidationError("Order must include at least one item");
  }

  // Cart items are read straight from the client's localStorage, which can
  // outlive a backend migration (e.g. old numeric IDs from before this app
  // moved to MongoDB) — validate the format before ever handing it to
  // Mongoose, which otherwise throws an unhandled CastError and 500s.
  // Note: mongoose.Types.ObjectId.isValid() is NOT sufficient here — it
  // returns true for plain numbers (e.g. 1) even though the ObjectId
  // constructor then rejects them, so check the real 24-char hex format.
  const isValidObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
  const invalid = items.find((i) => !isValidObjectId(i.productId));
  if (invalid) {
    throw new OrderValidationError(
      "Your cart has an outdated item that no longer exists — please remove it from your cart and try again."
    );
  }

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const resolvedItems = items.map(({ productId, weight, quantity }) => {
    const product = productMap.get(String(productId));
    if (!product) {
      throw new OrderValidationError(`Product not found: ${productId}`);
    }
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const unitPrice = priceForWeight(product.price, weight);
    return {
      productId: product._id.toString(),
      name: product.name,
      weight,
      quantity: qty,
      price: unitPrice,
      lineTotal: unitPrice * qty,
    };
  });

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  // Admin-controlled — set in the admin panel's Settings page, defaults to 0.
  const settings = await Settings.findOne();
  const deliveryCharge = subtotal > 0 ? settings?.delivery_charge ?? 0 : 0;
  const total = subtotal + deliveryCharge;

  return { resolvedItems, subtotal, deliveryCharge, total };
}

export function computeAdvance(total, advancePercentage) {
  const advanceAmount = Math.round((total * advancePercentage) / 100);
  const remainingAmount = total - advanceAmount;
  return { advanceAmount, remainingAmount };
}

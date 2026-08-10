// utils.js — shared helpers for the customer app

// Product prices are stored per kg. Weight options look like "0.5 kg", "1 kg", etc.
// This pulls out the numeric multiplier so we can scale the price shown to the user.
export function weightMultiplier(weightLabel) {
  const match = String(weightLabel).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 1;
}

// Price for a given weight selection, rounded to the nearest rupee.
export function priceForWeight(pricePerKg, weightLabel) {
  return Math.round(pricePerKg * weightMultiplier(weightLabel));
}

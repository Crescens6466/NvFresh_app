// db.js — MongoDB (Atlas) connection + first-run seed data
import mongoose from "mongoose";
import Product from "./models/Product.js";
import Admin from "./models/Admin.js";
import Settings from "./models/Settings.js";

// In a serverless runtime (Vercel), connectDB() is called on every
// invocation — a warm instance should reuse its existing connection rather
// than reconnecting, and concurrent cold-start invocations should share one
// in-flight connection attempt rather than racing.
let connectingPromise = null;

export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (connectingPromise) return connectingPromise;

  connectingPromise = doConnect().catch((err) => {
    connectingPromise = null;
    throw err;
  });
  return connectingPromise;
}

async function doConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy server/.env.example to server/.env and add your MongoDB Atlas connection string."
    );
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log("Connected to MongoDB");

  await seedIfEmpty();
}

async function seedIfEmpty() {
  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany([
      {
        name: "Chicken Curry Cut",
        description:
          "Farm-fresh chicken, hand-cut into curry pieces. Cleaned, washed, and hygienically packed within hours of processing — ready for your favorite curry recipe.",
        price: 220,
        category: "Chicken",
        image: "/uploads/seed/chicken-curry-cut.svg",
        weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
        stock: 40,
        badge: "Fresh Today",
      },
      {
        name: "Chicken Boneless",
        description:
          "Tender, skinless, boneless chicken breast cubes — perfect for grilling, stir-fry, or quick weeknight dinners. Zero waste, all flavor.",
        price: 280,
        category: "Chicken",
        image: "/uploads/seed/chicken-boneless.svg",
        weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
        stock: 35,
        badge: "Best Seller",
      },
      {
        name: "Mutton Curry Cut",
        description:
          "Premium goat mutton, freshly cut and trimmed. Rich in flavor, sourced from trusted local farms and delivered fresh every Sunday.",
        price: 650,
        category: "Mutton",
        image: "/uploads/seed/mutton-curry-cut.svg",
        weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
        stock: 20,
        badge: "Best Seller",
      },
      {
        name: "Fresh Fish (Rohu)",
        description:
          "Whole Rohu fish, scaled, gutted, and cleaned to your preference. Sourced fresh for maximum quality.",
        price: 320,
        category: "Fish",
        image: "/uploads/seed/fresh-fish.svg",
        weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
        stock: 25,
        badge: "Fresh Today",
      },
      {
        name: "Prawns",
        description:
          "Deveined, cleaned jumbo prawns — succulent and ready to cook. Packed on ice to lock in freshness until they reach your door.",
        price: 480,
        category: "Seafood",
        image: "/uploads/seed/prawns.svg",
        weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
        stock: 18,
        badge: "Limited Stock",
      },
      {
        name: "Country Chicken",
        description:
          "Naturally raised free-range country chicken, known for its firm texture and authentic flavor. A favorite for traditional recipes.",
        price: 380,
        category: "Country Chicken",
        image: "/uploads/seed/country-chicken.svg",
        weights: ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
        stock: 15,
        badge: null,
      },
    ]);
    console.log("Seeded 6 sample products");
  }

  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    await Admin.create({ username: "admin", password: "nvfresh123" });
    console.log("Seeded default admin account (admin / nvfresh123)");
  }

  const settingsCount = await Settings.countDocuments();
  if (settingsCount === 0) {
    await Settings.create({});
    console.log("Seeded default settings");
  }
}

// routes/products.js — product CRUD API (MongoDB)
import express from "express";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";
import { toClient, toClientList } from "../utils/serialize.js";

const router = express.Router();

// GET /api/products — list, with optional ?category= and ?search=
router.get("/", async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const query = {};
    if (category && category !== "All") query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    const products = await Product.find(query).sort({ created_at: -1 });
    res.json(toClientList(products));
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(toClient(product));
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Product not found" });
    next(err);
  }
});

// POST /api/products — create (admin only)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, description, price, category, image, weights, stock, badge } = req.body;
    if (!name || !price || !category) {
      return res.status(400).json({ error: "name, price, and category are required" });
    }
    const product = await Product.create({
      name,
      description: description || "",
      price,
      category,
      image: image || "",
      weights: weights && weights.length ? weights : undefined,
      stock: stock || 0,
      badge: badge || null,
    });
    res.status(201).json(toClient(product));
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id — update (admin only)
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { name, description, price, category, image, weights, stock, badge } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = price;
    if (category !== undefined) update.category = category;
    if (image !== undefined) update.image = image;
    if (weights && weights.length) update.weights = weights;
    if (stock !== undefined) update.stock = stock;
    if (badge !== undefined) update.badge = badge;

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(toClient(product));
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Product not found" });
    next(err);
  }
});

// DELETE /api/products/:id — (admin only)
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    if (err.name === "CastError") return res.status(404).json({ error: "Product not found" });
    next(err);
  }
});

export default router;

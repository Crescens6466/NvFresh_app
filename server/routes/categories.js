// routes/categories.js — Product category CRUD and safe removal API
import express from "express";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";
import { toClient, toClientList } from "../utils/serialize.js";
import {
  escapeRegex,
  slugifyCategory,
  ensureDefaultCategories,
} from "../utils/categories.js";

const router = express.Router();

// GET /api/categories — public customer endpoint (active categories only)
router.get("/", async (req, res, next) => {
  try {
    let categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    if (categories.length === 0) {
      const total = await Category.countDocuments();
      if (total === 0) {
        await ensureDefaultCategories();
        categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
      }
    }
    res.json(toClientList(categories));
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/admin — admin endpoint to view categories with product counts
router.get("/admin", requireAuth, async (req, res, next) => {
  try {
    let categories = await Category.find().sort({ isActive: -1, sortOrder: 1, name: 1 });
    if (categories.length === 0) {
      await ensureDefaultCategories();
      categories = await Category.find().sort({ isActive: -1, sortOrder: 1, name: 1 });
    }

    const categoryList = await Promise.all(
      categories.map(async (cat) => {
        const query = { category: { $regex: new RegExp(`^${escapeRegex(cat.name)}$`, "i") } };
        if (cat.name.toLowerCase() === "chicken") {
          query.category = {
            $in: [
              new RegExp(`^${escapeRegex(cat.name)}$`, "i"),
              /^country chicken$/i,
              /^country_chicken$/i,
              /^countrychicken$/i,
            ],
          };
        }
        const productCount = await Product.countDocuments(query);
        return {
          ...toClient(cat),
          productCount,
        };
      })
    );

    res.json(categoryList);
  } catch (err) {
    next(err);
  }
});

// POST /api/categories — admin creates a new category
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, icon, sortOrder } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      return res.status(400).json({ error: "Category name must be between 2 and 60 characters" });
    }

    if (trimmed.toLowerCase() === "all") {
      return res.status(400).json({ error: '"All" is a reserved filter name and cannot be created as a category' });
    }

    const slug = slugifyCategory(trimmed);
    if (!slug) {
      return res.status(400).json({ error: "Invalid category name" });
    }

    const existing = await Category.findOne({
      $or: [
        { slug },
        { name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") } },
      ],
    });

    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ error: "Category with this name already exists" });
      }
      // Reactivate previously soft-deleted category
      existing.isActive = true;
      existing.name = trimmed;
      if (icon !== undefined) existing.icon = String(icon).trim();
      if (sortOrder !== undefined) existing.sortOrder = Number(sortOrder) || 0;
      await existing.save();
      return res.status(201).json(toClient(existing));
    }

    const category = await Category.create({
      name: trimmed,
      slug,
      icon: typeof icon === "string" ? icon.trim() : "",
      sortOrder: Number(sortOrder) || 0,
      isActive: true,
    });

    res.status(201).json(toClient(category));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Category with this name already exists" });
    }
    next(err);
  }
});

// PUT /api/categories/:id — admin updates a category
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { name, icon, sortOrder, isActive } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    let oldName = category.name;
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Category name cannot be blank" });
      }
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 60) {
        return res.status(400).json({ error: "Category name must be between 2 and 60 characters" });
      }
      if (trimmed.toLowerCase() === "all") {
        return res.status(400).json({ error: '"All" is a reserved filter name and cannot be used as a category' });
      }
      const newSlug = slugifyCategory(trimmed);
      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        $or: [
          { slug: newSlug },
          { name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") } },
        ],
      });
      if (duplicate) {
        return res.status(400).json({ error: "Category with this name already exists" });
      }
      category.name = trimmed;
      category.slug = newSlug;

      // If category name was updated, update existing product records using oldName
      if (oldName !== trimmed) {
        await Product.updateMany(
          { category: { $regex: new RegExp(`^${escapeRegex(oldName)}$`, "i") } },
          { $set: { category: trimmed } }
        );
      }
    }

    if (icon !== undefined) {
      category.icon = typeof icon === "string" ? icon.trim() : "";
    }

    if (sortOrder !== undefined) {
      category.sortOrder = Number(sortOrder) || 0;
    }

    if (isActive !== undefined) {
      category.isActive = Boolean(isActive);
    }

    await category.save();
    res.json(toClient(category));
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Category not found" });
    }
    if (err.code === 11000) {
      return res.status(400).json({ error: "Category with this name already exists" });
    }
    next(err);
  }
});

// DELETE /api/categories/:id — admin removes a category with safe transactional product reassignment
router.delete("/:id", requireAuth, async (req, res, next) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    let resultPayload = null;

    await session.withTransaction(async () => {
      const category = await Category.findById(req.params.id).session(session);
      if (!category) {
        const err = new Error("Category not found");
        err.statusCode = 404;
        throw err;
      }

      // Check how many products are currently assigned to this category
      const productQuery = { category: { $regex: new RegExp(`^${escapeRegex(category.name)}$`, "i") } };
      if (category.name.toLowerCase() === "chicken") {
        productQuery.category = {
          $in: [
            new RegExp(`^${escapeRegex(category.name)}$`, "i"),
            /^country chicken$/i,
            /^country_chicken$/i,
            /^countrychicken$/i,
          ],
        };
      }

      const assignedCount = await Product.countDocuments(productQuery).session(session);
      const replacementInput = req.body?.replacementCategory || req.query?.replacementCategory;
      let replacement = null;

      if (assignedCount > 0) {
        if (!replacementInput || (typeof replacementInput === "string" && !replacementInput.trim())) {
          const err = new Error(`Category "${category.name}" has ${assignedCount} assigned product(s). Please select a replacement category.`);
          err.statusCode = 400;
          err.details = {
            productCount: assignedCount,
            requiresReplacement: true,
          };
          throw err;
        }

        const repVal = String(replacementInput).trim();
        if (mongoose.isValidObjectId(repVal)) {
          replacement = await Category.findOne({ _id: repVal, isActive: true }).session(session);
        }
        if (!replacement) {
          replacement = await Category.findOne({
            $or: [
              { name: { $regex: new RegExp(`^${escapeRegex(repVal)}$`, "i") } },
              { slug: slugifyCategory(repVal) },
            ],
            isActive: true,
          }).session(session);
        }

        if (!replacement || String(replacement._id) === String(category._id)) {
          const err = new Error("A valid, active replacement category (different from the category being removed) is required");
          err.statusCode = 400;
          throw err;
        }

        // Safe reassignment of products within transaction session
        await Product.updateMany(
          productQuery,
          { $set: { category: replacement.name } },
          { session }
        );
      }

      // Test-only hook to simulate failure during deactivation after product reassignment
      // Strictly restricted to NODE_ENV === "test" so it cannot be triggered in production
      if (
        process.env.NODE_ENV === "test" &&
        (req.headers["x-test-simulate-deactivation-failure"] === "true" ||
          req.body?.simulateDeactivationFailure === true)
      ) {
        throw new Error("Simulated category deactivation failure for rollback verification");
      }

      // Soft-delete: mark category as inactive within transaction session
      category.isActive = false;
      await category.save({ session });

      resultPayload = {
        success: true,
        message: `Category "${category.name}" removed successfully`,
        id: req.params.id,
        reassignedCount: assignedCount,
        replacementCategory: replacement?.name || null,
      };
    });

    res.json(resultPayload);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.details || {}),
      });
    }
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Category not found" });
    }
    next(err);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

export default router;

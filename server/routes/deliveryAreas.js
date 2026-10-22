// routes/deliveryAreas.js — delivery area management and customer listing
import express from "express";
import DeliveryArea from "../models/DeliveryArea.js";
import { requireAuth } from "../middleware/auth.js";
import { toClient, toClientList } from "../utils/serialize.js";
import {
  normalizeAreaName,
  ensureDefaultDeliveryAreas,
} from "../utils/serviceAreas.js";

const router = express.Router();

// GET /api/delivery-areas — public customer endpoint (active areas only)
router.get("/", async (req, res, next) => {
  try {
    let areas = await DeliveryArea.find({ is_active: true }).sort({ name: 1 });
    if (areas.length === 0) {
      const totalCount = await DeliveryArea.countDocuments();
      if (totalCount === 0) {
        // First run seed
        await ensureDefaultDeliveryAreas();
        areas = await DeliveryArea.find({ is_active: true }).sort({ name: 1 });
      }
    }
    res.json(toClientList(areas));
  } catch (err) {
    next(err);
  }
});

// GET /api/delivery-areas/admin — admin endpoint to view all areas (active & inactive)
router.get("/admin", requireAuth, async (req, res, next) => {
  try {
    let areas = await DeliveryArea.find().sort({ created_at: -1 });
    if (areas.length === 0) {
      await ensureDefaultDeliveryAreas();
      areas = await DeliveryArea.find().sort({ created_at: -1 });
    }
    res.json(toClientList(areas));
  } catch (err) {
    next(err);
  }
});

// POST /api/delivery-areas — admin creates a new delivery area
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, is_active } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Delivery area name is required" });
    }

    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return res.status(400).json({ error: "Area name must be between 2 and 100 characters" });
    }

    const normalized_name = normalizeAreaName(trimmed);
    const existing = await DeliveryArea.findOne({ normalized_name });
    if (existing) {
      return res.status(400).json({ error: "Delivery area already exists" });
    }

    const area = await DeliveryArea.create({
      name: trimmed,
      normalized_name,
      is_active: is_active !== false,
    });

    res.status(201).json(toClient(area));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Delivery area already exists" });
    }
    next(err);
  }
});

// PUT /api/delivery-areas/:id — admin updates area name or toggles active state
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { name, is_active } = req.body;
    const area = await DeliveryArea.findById(req.params.id);
    if (!area) {
      return res.status(404).json({ error: "Delivery area not found" });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Delivery area name cannot be blank" });
      }
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return res.status(400).json({ error: "Area name must be between 2 and 100 characters" });
      }
      const normalized_name = normalizeAreaName(trimmed);
      const duplicate = await DeliveryArea.findOne({
        normalized_name,
        _id: { $ne: area._id },
      });
      if (duplicate) {
        return res.status(400).json({ error: "Delivery area with this name already exists" });
      }
      area.name = trimmed;
      area.normalized_name = normalized_name;
    }

    if (is_active !== undefined) {
      area.is_active = Boolean(is_active);
    }

    await area.save();
    res.json(toClient(area));
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Delivery area not found" });
    }
    if (err.code === 11000) {
      return res.status(400).json({ error: "Delivery area with this name already exists" });
    }
    next(err);
  }
});

// DELETE /api/delivery-areas/:id — admin deletes a delivery area
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const area = await DeliveryArea.findByIdAndDelete(req.params.id);
    if (!area) {
      return res.status(404).json({ error: "Delivery area not found" });
    }
    res.json({ success: true, message: "Delivery area deleted successfully", id: req.params.id });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Delivery area not found" });
    }
    next(err);
  }
});

export default router;


// tests/categories.test.js — Dynamic Category Management Complete Suite
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: new URL("../.env", import.meta.url) });
process.env.NODE_ENV = "test";

import app from "../app.js";
import { connectDB } from "../db.js";
import { JWT_SECRET } from "../middleware/auth.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { ensureDefaultCategories, slugifyCategory } from "../utils/categories.js";
import { filterAndMergeProducts, normalizeCategory } from "../../customer/src/utils/categories.js";
import { filterAndMergeMobileProducts, normalizeMobileCategory } from "../../customer-mobile/src/utils/categories.js";

test("Dynamic Category Management Suite", async (t) => {
  let server;
  let baseUrl;
  let adminToken;

  await t.test("Setup test server and database connection", async () => {
    await connectDB();
    await ensureDefaultCategories();

    adminToken = jwt.sign({ id: "admin_test", username: "admin" }, JWT_SECRET, { expiresIn: "1h" });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
    assert.ok(baseUrl);
  });

  await t.test("1. Public GET /api/categories returns active categories", async () => {
    const res = await fetch(`${baseUrl}/categories`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 4);

    const names = data.map((c) => c.name);
    assert.ok(names.includes("Chicken"));
    assert.ok(names.includes("Mutton"));
    assert.ok(names.includes("Fish"));
    assert.ok(names.includes("Seafood"));
    assert.ok(!names.includes("All"), '"All" must not be a database category');
  });

  await t.test("2. Admin endpoints reject unauthorized requests", async () => {
    const postRes = await fetch(`${baseUrl}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauth Category" }),
    });
    assert.equal(postRes.status, 401);

    const getAdminRes = await fetch(`${baseUrl}/categories/admin`);
    assert.equal(getAdminRes.status, 401);
  });

  await t.test("3. Admin GET /api/categories/admin returns categories with productCount", async () => {
    const res = await fetch(`${baseUrl}/categories/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    for (const cat of data) {
      assert.ok(typeof cat.productCount === "number");
      assert.ok(cat.name);
      assert.ok(cat.slug);
    }
  });

  await t.test("4. Rejects reserved name 'All' and duplicate category names", async () => {
    const resAll = await fetch(`${baseUrl}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "All" }),
    });
    assert.equal(resAll.status, 400);

    const resDup = await fetch(`${baseUrl}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "chicken" }), // case-insensitive duplicate
    });
    assert.equal(resDup.status, 400);
  });

  let createdCatId = null;

  await t.test("5. Step 1-4: Admin creates Test Category & it appears in listings", async () => {
    const res = await fetch(`${baseUrl}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Test Category", icon: "sparkles" }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.name, "Test Category");
    assert.equal(data.slug, "test-category");
    assert.equal(data.icon, "sparkles");
    assert.equal(data.isActive, true);
    createdCatId = data.id;

    // Verify it appears in public GET /api/categories
    const pubRes = await fetch(`${baseUrl}/categories`);
    const pubCats = await pubRes.json();
    assert.ok(pubCats.some((c) => c.name === "Test Category"));

    // Verify it appears in Admin GET /api/categories/admin
    const adminRes = await fetch(`${baseUrl}/categories/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminCats = await adminRes.json();
    const foundInAdmin = adminCats.find((c) => c.name === "Test Category");
    assert.ok(foundInAdmin);
    assert.equal(foundInAdmin.productCount, 0);
  });

  let existingProduct = null;

  await t.test("6. Step 5-6: Existing product is assigned to Test Category and appears when filtered", async () => {
    // Create an initial product in Mutton
    const prodRes = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Dynamic Test Meat Cut",
        price: 520,
        category: "Mutton",
        description: "Fresh premium cut",
        stock: 25,
      }),
    });
    assert.equal(prodRes.status, 201);
    existingProduct = await prodRes.json();
    assert.equal(existingProduct.category, "Mutton");

    // Reassign existing product to "Test Category" via PUT /api/products/:id
    const updateRes = await fetch(`${baseUrl}/products/${existingProduct.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ category: "Test Category" }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.category, "Test Category");

    // Product appears when GET /api/products?category=Test+Category is called
    const listRes = await fetch(`${baseUrl}/products?category=Test+Category`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.some((p) => p.id === existingProduct.id && p.category === "Test Category"));

    // Product count in Admin categories for Test Category is now 1
    const adminRes = await fetch(`${baseUrl}/categories/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminCats = await adminRes.json();
    const testCat = adminCats.find((c) => c.name === "Test Category");
    assert.equal(testCat.productCount, 1);
  });

  await t.test("7. Step 7: Removing category with products requires replacement category", async () => {
    const resWithout = await fetch(`${baseUrl}/categories/${createdCatId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(resWithout.status, 400);
    const errData = await resWithout.json();
    assert.equal(errData.requiresReplacement, true);
    assert.equal(errData.productCount, 1);

    // Verify category remains active on failed removal
    const cat = await Category.findById(createdCatId);
    assert.equal(cat.isActive, true);
  });

  await t.test("8. Step 8-10: Admin removes Test Category with replacement 'Chicken' — product reassigned & intact", async () => {
    const removeRes = await fetch(`${baseUrl}/categories/${createdCatId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ replacementCategory: "Chicken" }),
    });
    assert.equal(removeRes.status, 200);
    const removeData = await removeRes.json();
    assert.equal(removeData.success, true);
    assert.equal(removeData.reassignedCount, 1);
    assert.equal(removeData.replacementCategory, "Chicken");

    // Test Category disappears from public active categories
    const pubRes = await fetch(`${baseUrl}/categories`);
    const pubCats = await pubRes.json();
    assert.ok(!pubCats.some((c) => c.name === "Test Category"));

    // Product is now reassigned to Chicken and all fields intact
    const prodRes = await fetch(`${baseUrl}/products/${existingProduct.id}`);
    assert.equal(prodRes.status, 200);
    const prod = await prodRes.json();
    assert.equal(prod.category, "Chicken");
    assert.equal(prod.name, "Dynamic Test Meat Cut");
    assert.equal(prod.price, 520);
    assert.equal(prod.description, "Fresh premium cut");
    assert.equal(prod.stock, 25);

    // Clean up test product and category record
    await Product.findByIdAndDelete(existingProduct.id);
    await Category.findByIdAndDelete(createdCatId);
  });

  await t.test("9. Transactional rollback: failure during deactivation rolls back product reassignment", async () => {
    // 1. Create a category specifically for testing transactional rollback
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Rollback Test Category" }),
    });
    assert.equal(catRes.status, 201);
    const rollbackCat = await catRes.json();

    // 2. Create a product assigned to Rollback Test Category
    const prodRes = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Rollback Test Product",
        price: 350,
        category: "Rollback Test Category",
      }),
    });
    assert.equal(prodRes.status, 201);
    const rollbackProd = await prodRes.json();
    assert.equal(rollbackProd.category, "Rollback Test Category");

    // 3. Attempt removal with x-test-simulate-deactivation-failure header
    const failRes = await fetch(`${baseUrl}/categories/${rollbackCat.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        "x-test-simulate-deactivation-failure": "true",
      },
      body: JSON.stringify({ replacementCategory: "Chicken" }),
    });
    assert.equal(failRes.status, 500);

    // 4. VERIFY TRANSACTION ROLLBACK:
    // Product MUST still be in "Rollback Test Category" (NOT reassigned to Chicken)
    const freshProd = await Product.findById(rollbackProd.id);
    assert.equal(freshProd.category, "Rollback Test Category");

    // Category MUST still be active (isActive: true)
    const freshCat = await Category.findById(rollbackCat.id);
    assert.equal(freshCat.isActive, true);

    // 5. Clean up test records
    await Product.findByIdAndDelete(rollbackProd.id);
    await Category.findByIdAndDelete(rollbackCat.id);

    // 6. VERIFY PRODUCTION SAFETY: In production (NODE_ENV !== "test"), simulation header is ignored
    const prodModeCat = await Category.create({ name: "Prod Guard Category", slug: "prod-guard-category", isActive: true });
    try {
      process.env.NODE_ENV = "production";
      const ignoredRes = await fetch(`${baseUrl}/categories/${prodModeCat._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
          "x-test-simulate-deactivation-failure": "true",
        },
      });
      assert.equal(ignoredRes.status, 200, "Header must be ignored outside test environment");
      const deactivated = await Category.findById(prodModeCat._id);
      assert.equal(deactivated.isActive, false, "Category successfully deactivated despite simulation header");
    } finally {
      process.env.NODE_ENV = "test";
      await Category.findByIdAndDelete(prodModeCat._id);
    }
  });

  await t.test("10. Backend Chicken filtering includes both Chicken and Country Chicken", async () => {
    // Create temporary Chicken and Country Chicken test products
    const p1 = await Product.create({
      name: "Test Standard Broiler Chicken",
      price: 240,
      category: "Chicken",
      stock: 10,
    });
    const p2 = await Product.create({
      name: "Test Country Chicken (Natu Kodi)",
      price: 480,
      category: "Country Chicken",
      stock: 10,
    });

    try {
      // Query GET /api/products?category=Chicken
      const res1 = await fetch(`${baseUrl}/products?category=Chicken`);
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      const ids1 = data1.map((p) => p.id);
      assert.ok(ids1.includes(String(p1._id)), "Should include standard Chicken product");
      assert.ok(ids1.includes(String(p2._id)), "Should include Country Chicken product");

      // Query case-insensitively: category=chicken
      const res2 = await fetch(`${baseUrl}/products?category=chicken`);
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      const ids2 = data2.map((p) => p.id);
      assert.ok(ids2.includes(String(p1._id)));
      assert.ok(ids2.includes(String(p2._id)));
    } finally {
      await Product.findByIdAndDelete(p1._id);
      await Product.findByIdAndDelete(p2._id);
    }
  });

  await t.test("11. Client-side category normalization parity for dynamic categories", () => {
    // Custom/dynamic categories are preserved as-is
    assert.equal(normalizeCategory("Eggs"), "Eggs");
    assert.equal(normalizeCategory("Marinades"), "Marinades");
    assert.equal(normalizeMobileCategory("Eggs"), "Eggs");

    // Country Chicken aliases to Chicken
    assert.equal(normalizeCategory("Country Chicken"), "Chicken");
    assert.equal(normalizeMobileCategory("Country Chicken"), "Chicken");

    // Android Fish aliases to Seafood
    assert.equal(normalizeMobileCategory("Fish"), "Seafood");

    // Dynamic filtering works
    const sample = [
      { id: "p1", name: "Farm Eggs", category: "Eggs" },
      { id: "p2", name: "Country Chicken Curry Cut", category: "Country Chicken" },
      { id: "p3", name: "Fresh Rohu", category: "Fish" },
    ];

    const eggsWeb = filterAndMergeProducts(sample, "Eggs");
    assert.equal(eggsWeb.length, 1);
    assert.equal(eggsWeb[0].name, "Farm Eggs");

    const eggsMob = filterAndMergeMobileProducts(sample, "Eggs");
    assert.equal(eggsMob.length, 1);
    assert.equal(eggsMob[0].name, "Farm Eggs");

    const chickenWeb = filterAndMergeProducts(sample, "Chicken");
    assert.equal(chickenWeb.length, 1);
    assert.equal(chickenWeb[0].category, "Chicken");
  });

  await t.test("Teardown test server", async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });
});

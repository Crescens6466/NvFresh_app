import React, { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlinePencilSquare, HiOutlineTrash, HiOutlineCube, HiOutlineXMark } from "react-icons/hi2";
import { api, resolveImageUrl } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import "./Products.css";

const CATEGORIES = ["Chicken", "Mutton", "Fish", "Seafood", "Country Chicken"];
const BADGES = ["", "Best Seller", "Fresh Today", "Limited Stock"];
const DEFAULT_WEIGHTS = ["0.5 kg", "1 kg", "1.5 kg", "2 kg"];

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: CATEGORIES[0],
  image: "",
  stock: "",
  badge: "",
};

export default function Products() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function loadProducts() {
    setLoading(true);
    api
      .getProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }

  useEffect(loadProducts, []);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      category: product.category,
      image: product.image || "",
      stock: product.stock,
      badge: product.badge || "",
    });
    setModalOpen(true);
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      setForm((f) => ({ ...f, image: res.url }));
    } catch (err) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) {
      showToast("Please fill in name, price and category", "error");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock) || 0,
      weights: DEFAULT_WEIGHTS,
      badge: form.badge || null,
    };
    try {
      if (editingId) {
        await api.updateProduct(editingId, payload);
        showToast("Product updated");
      } else {
        await api.createProduct(payload);
        showToast("Product added");
      }
      setModalOpen(false);
      loadProducts();
    } catch (err) {
      showToast(err.message || "Could not save product", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await api.deleteProduct(id);
      showToast("Product deleted");
      loadProducts();
    } catch (err) {
      showToast(err.message || "Could not delete product", "error");
    }
  }

  return (
    <div className="products page-fade">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Products</h2>
          <p className="page-subtitle">Manage your product catalog.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <HiOutlinePlus /> Add Product
        </button>
      </div>

      {loading ? (
        <div className="products-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 220 }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <HiOutlineCube />
          <h3>No products yet</h3>
          <p>Add your first product to get started.</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((p) => (
            <div className="product-admin-card" key={p.id}>
              <img src={resolveImageUrl(p.image)} alt={p.name} />
              <div className="product-admin-body">
                <div className="product-admin-top">
                  <h4>{p.name}</h4>
                  {p.badge && <span className="status-pill status-Preparing">{p.badge}</span>}
                </div>
                <p className="product-admin-cat">{p.category}</p>
                <div className="product-admin-meta">
                  <span className="product-admin-price">₹{p.price}/kg</span>
                  <span className="product-admin-stock">Stock: {p.stock}</span>
                </div>
                <div className="product-admin-actions">
                  <button className="btn btn-ghost" onClick={() => openEditModal(p)}>
                    <HiOutlinePencilSquare /> Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(p.id)}>
                    <HiOutlineTrash /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <div className="modal-header">
              <h3>{editingId ? "Edit Product" : "Add Product"}</h3>
              <button type="button" className="modal-close" onClick={() => setModalOpen(false)}>
                <HiOutlineXMark />
              </button>
            </div>

            <div className="modal-body">
              <div className="field">
                <label>Product Image</label>
                <div className="image-upload">
                  {form.image ? (
                    <img src={resolveImageUrl(form.image)} alt="preview" />
                  ) : (
                    <div className="image-upload-placeholder">
                      <HiOutlineCube />
                    </div>
                  )}
                  <label className="btn btn-ghost image-upload-btn">
                    {uploading ? "Uploading..." : "Choose Image"}
                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                  </label>
                </div>
              </div>

              <div className="field">
                <label>Product Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Chicken Curry Cut"
                />
              </div>

              <div className="field">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short product description"
                />
              </div>

              <div className="modal-row">
                <div className="field">
                  <label>Price (₹/kg)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="field">
                  <label>Stock (kg)</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="modal-row">
                <div className="field">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Badge</label>
                  <select
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  >
                    {BADGES.map((b) => (
                      <option key={b} value={b}>
                        {b || "None"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineTag,
  HiOutlineXMark,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import "./Categories.css";

const emptyForm = {
  name: "",
  icon: "",
  sortOrder: "0",
};

export default function Categories() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [replacementCategory, setReplacementCategory] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function loadCategories() {
    setLoading(true);
    api
      .getAdminCategories()
      .then((data) => {
        // Show active categories primarily
        const activeOnly = (Array.isArray(data) ? data : []).filter((c) => c.isActive !== false);
        setCategories(activeOnly);
      })
      .catch((err) => {
        showToast(err.message || "Failed to load categories", "error");
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadCategories, []);

  function openAddModal() {
    setForm(emptyForm);
    setAddModalOpen(true);
  }

  function openDeleteModal(cat) {
    setSelectedCategory(cat);
    // Find first other active category as default replacement
    const otherActive = categories.filter((c) => c.id !== cat.id);
    setReplacementCategory(otherActive[0]?.name || "");
    setDeleteModalOpen(true);
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    const trimmed = form.name?.trim();
    if (!trimmed) {
      showToast("Please enter a category name", "error");
      return;
    }
    if (trimmed.toLowerCase() === "all") {
      showToast('"All" is a reserved filter name and cannot be used as a category', "error");
      return;
    }
    if (trimmed.length < 2) {
      showToast("Category name must be at least 2 characters", "error");
      return;
    }

    setSaving(true);
    try {
      await api.createCategory({
        name: trimmed,
        icon: form.icon?.trim() || "",
        sortOrder: Number(form.sortOrder) || 0,
      });
      showToast(`Category "${trimmed}" added successfully`);
      setAddModalOpen(false);
      loadCategories();
    } catch (err) {
      showToast(err.message || "Failed to add category", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!selectedCategory) return;
    const hasProducts = (selectedCategory.productCount || 0) > 0;

    if (hasProducts && !replacementCategory) {
      showToast("Please select a replacement category", "error");
      return;
    }

    setDeleting(true);
    try {
      const res = await api.deleteCategory(
        selectedCategory.id,
        hasProducts ? replacementCategory : undefined
      );
      showToast(
        res.reassignedCount > 0
          ? `Category "${selectedCategory.name}" removed. ${res.reassignedCount} product(s) reassigned to "${res.replacementCategory}".`
          : `Category "${selectedCategory.name}" removed successfully.`
      );
      setDeleteModalOpen(false);
      setSelectedCategory(null);
      loadCategories();
    } catch (err) {
      showToast(err.message || "Failed to remove category", "error");
    } finally {
      setDeleting(false);
    }
  }

  const otherCategories = categories.filter(
    (c) => selectedCategory && c.id !== selectedCategory.id
  );

  return (
    <div className="categories-admin page-fade">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Category Management</h2>
          <p className="page-subtitle">
            Manage product categories across the Admin panel, customer website, and Android app.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost" onClick={loadCategories} title="Refresh">
            <HiOutlineArrowPath /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <HiOutlinePlus /> Add Category
          </button>
        </div>
      </div>

      {loading ? (
        <div className="categories-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 140 }} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <HiOutlineTag />
          <h3>No categories found</h3>
          <p>Create your first category to get started.</p>
        </div>
      ) : (
        <div className="categories-grid">
          {categories.map((cat) => (
            <div className="category-admin-card" key={cat.id}>
              <div className="category-admin-top">
                <div className="category-admin-header">
                  <div className="category-admin-icon-wrap">
                    <HiOutlineTag />
                  </div>
                  <div>
                    <h4 className="category-admin-name">{cat.name}</h4>
                    <span className="category-admin-slug">slug: {cat.slug}</span>
                  </div>
                </div>
                <span
                  className={`status-pill ${
                    (cat.productCount || 0) > 0 ? "status-Confirmed" : "status-Preparing"
                  }`}
                >
                  {cat.productCount || 0} product{(cat.productCount || 0) === 1 ? "" : "s"}
                </span>
              </div>

              {cat.icon ? (
                <div className="category-admin-meta">
                  <span>Icon: <code>{cat.icon}</code></span>
                  <span>Order: {cat.sortOrder || 0}</span>
                </div>
              ) : (
                <div className="category-admin-meta">
                  <span>Default icon</span>
                  <span>Order: {cat.sortOrder || 0}</span>
                </div>
              )}

              <div className="category-admin-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ width: "100%" }}
                  onClick={() => openDeleteModal(cat)}
                >
                  <HiOutlineTrash /> Remove Category
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Category Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <form
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddCategory}
          >
            <div className="modal-header">
              <h3>Add Category</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAddModalOpen(false)}
              >
                <HiOutlineXMark />
              </button>
            </div>

            <div className="modal-body">
              <div className="field">
                <label>Category Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Seafood, Eggs, Marinades"
                  autoFocus
                />
                <span className="field-hint">
                  The name will appear as a category filter across website and Android app.
                </span>
              </div>

              <div className="modal-row">
                <div className="field">
                  <label>Icon Identifier (Optional)</label>
                  <input
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="e.g. chicken, meat, fish, shrimp"
                  />
                </div>
                <div className="field">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Remove Category Modal with Safe Product Reassignment */}
      {deleteModalOpen && selectedCategory && (
        <div className="modal-overlay" onClick={() => setDeleteModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: "var(--danger)" }}>Remove Category</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteModalOpen(false)}
              >
                <HiOutlineXMark />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "0.95rem", lineHeight: "1.5", color: "var(--text)" }}>
                Are you sure you want to remove <strong>&ldquo;{selectedCategory.name}&rdquo;</strong>?
              </p>

              {(selectedCategory.productCount || 0) > 0 ? (
                <div className="category-reassignment-box">
                  <div className="reassignment-warning-header">
                    <HiOutlineExclamationTriangle size={20} color="#B45309" />
                    <strong>
                      {selectedCategory.productCount} product
                      {selectedCategory.productCount === 1 ? "" : "s"} currently assigned
                    </strong>
                  </div>
                  <p className="reassignment-warning-text">
                    NvFresh never deletes products when removing categories. You must select an
                    active replacement category. All assigned products will be safely reassigned
                    with their pricing, stock, images, and availability preserved.
                  </p>

                  <div className="field" style={{ marginTop: "14px" }}>
                    <label>Select Replacement Category *</label>
                    {otherCategories.length === 0 ? (
                      <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                        No other active categories are available. Please create or keep another
                        category before removing this one.
                      </p>
                    ) : (
                      <select
                        value={replacementCategory}
                        onChange={(e) => setReplacementCategory(e.target.value)}
                        required
                      >
                        {otherCategories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ) : (
                <div className="category-empty-safe-box">
                  <p>
                    This category currently has <strong>0 assigned products</strong>. It will be
                    safely deactivated and removed from active navigation.
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={
                  deleting ||
                  ((selectedCategory.productCount || 0) > 0 &&
                    (!replacementCategory || otherCategories.length === 0))
                }
              >
                {deleting
                  ? "Reassigning & Removing..."
                  : (selectedCategory.productCount || 0) > 0
                  ? `Reassign & Remove "${selectedCategory.name}"`
                  : `Remove "${selectedCategory.name}"`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

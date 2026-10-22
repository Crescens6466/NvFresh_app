import React, { useEffect, useState } from "react";
import {
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineMapPin,
  HiOutlineXMark,
  HiOutlineCheck,
  HiOutlineNoSymbol,
} from "react-icons/hi2";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import "./DeliveryAreas.css";

const emptyForm = {
  name: "",
  is_active: true,
};

export default function DeliveryAreas() {
  const { showToast } = useToast();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function loadAreas() {
    setLoading(true);
    api
      .getDeliveryAreas()
      .then((data) => setAreas(Array.isArray(data) ? data : []))
      .catch((err) => {
        showToast(err.message || "Failed to load delivery areas", "error");
        setAreas([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadAreas, []);

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(area) {
    setEditingId(area.id);
    setForm({
      name: area.name,
      is_active: area.is_active !== false,
    });
    setModalOpen(true);
  }

  async function handleToggleActive(area) {
    const nextActive = !area.is_active;
    // Optimistic UI update
    setAreas((prev) =>
      prev.map((a) => (a.id === area.id ? { ...a, is_active: nextActive } : a))
    );
    try {
      await api.updateDeliveryArea(area.id, { is_active: nextActive });
      showToast(`"${area.name}" marked ${nextActive ? "Active" : "Inactive"}`);
    } catch (err) {
      // Revert on failure
      setAreas((prev) =>
        prev.map((a) => (a.id === area.id ? { ...a, is_active: area.is_active } : a))
      );
      showToast(err.message || "Failed to update area status", "error");
    }
  }

  async function handleDelete(area) {
    const confirmed = window.confirm(
      `Are you sure you want to delete delivery area "${area.name}"?\n\nNew orders for this area will no longer be accepted. Existing orders will be preserved.`
    );
    if (!confirmed) return;

    try {
      await api.deleteDeliveryArea(area.id);
      setAreas((prev) => prev.filter((a) => a.id !== area.id));
      showToast(`Delivery area "${area.name}" deleted`);
    } catch (err) {
      showToast(err.message || "Failed to delete delivery area", "error");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = form.name?.trim();
    if (!trimmed) {
      showToast("Please enter an area name", "error");
      return;
    }
    if (trimmed.length < 2) {
      showToast("Area name must be at least 2 characters", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await api.updateDeliveryArea(editingId, {
          name: trimmed,
          is_active: form.is_active,
        });
        setAreas((prev) =>
          prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a))
        );
        showToast(`Delivery area "${trimmed}" updated`);
      } else {
        const created = await api.createDeliveryArea({
          name: trimmed,
          is_active: form.is_active,
        });
        setAreas((prev) => [created, ...prev]);
        showToast(`Delivery area "${trimmed}" added`);
      }
      setModalOpen(false);
    } catch (err) {
      showToast(err.message || "Failed to save delivery area", "error");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = areas.filter((a) => a.is_active).length;

  return (
    <div className="delivery-areas-page page-fade">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Delivery Areas</h2>
          <p className="page-subtitle">
            Configure serviceable locations where customers can receive Sunday orders. (
            {activeCount} of {areas.length} active)
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <HiOutlinePlus /> Add Area
        </button>
      </div>

      <div className="card delivery-areas-table-wrap">
        {loading ? (
          <div className="skeleton" style={{ height: 200, margin: 16 }} />
        ) : areas.length === 0 ? (
          <div className="empty-state">
            <HiOutlineMapPin />
            <h3>No delivery areas configured</h3>
            <p>Add a delivery area to start accepting customer orders.</p>
          </div>
        ) : (
          <table className="delivery-areas-table">
            <thead>
              <tr>
                <th>Area Name</th>
                <th>Status</th>
                <th>Date Added</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id}>
                  <td className="area-name-cell">
                    <HiOutlineMapPin className="area-pin-icon" />
                    <strong>{area.name}</strong>
                  </td>
                  <td>
                    <button
                      className={`area-status-pill ${
                        area.is_active ? "is-active" : "is-inactive"
                      }`}
                      onClick={() => handleToggleActive(area)}
                      title={`Click to mark ${area.is_active ? "Inactive" : "Active"}`}
                    >
                      {area.is_active ? (
                        <>
                          <HiOutlineCheck /> Active
                        </>
                      ) : (
                        <>
                          <HiOutlineNoSymbol /> Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className="area-date-cell">
                    {area.created_at
                      ? new Date(area.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Default"}
                  </td>
                  <td>
                    <div className="area-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(area)}
                        title="Edit area name"
                      >
                        <HiOutlinePencilSquare /> Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(area)}
                        title="Delete delivery area"
                      >
                        <HiOutlineTrash /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? "Edit Delivery Area" : "Add Delivery Area"}</h3>
              <button
                className="modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <HiOutlineXMark />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="field">
                  <label>Area / Town Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tadepalli"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                  <small style={{ color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                    Matches delivery addresses containing this area name (case-insensitive, whole words).
                  </small>
                </div>

                <div className="field-checkbox" style={{ marginTop: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    <span>Active (Accept orders for this location)</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Area"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


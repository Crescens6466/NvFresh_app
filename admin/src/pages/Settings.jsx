import React, { useEffect, useState } from "react";
import { HiOutlineQrCode } from "react-icons/hi2";
import { api } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import "./Settings.css";

export default function Settings() {
  const { showToast } = useToast();
  const [form, setForm] = useState({ businessName: "", phoneNumber: "", upiId: "", qrImage: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) =>
        setForm({
          businessName: s.business_name,
          phoneNumber: s.phone_number,
          upiId: s.upi_id,
          qrImage: s.qr_image || "",
        })
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleQrUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      setForm((f) => ({ ...f, qrImage: res.url }));
    } catch (err) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings(form);
      showToast("Settings saved");
    } catch (err) {
      showToast(err.message || "Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="skeleton" style={{ height: 300, marginTop: 24 }} />;
  }

  return (
    <div className="settings page-fade">
      <h2 className="page-title">Settings</h2>
      <p className="page-subtitle">Manage your business details and payment info.</p>

      <form className="card settings-card" onSubmit={handleSave}>
        <div className="field">
          <label>Business Name</label>
          <input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Phone Number</label>
          <input
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
          />
        </div>

        <div className="field">
          <label>UPI ID</label>
          <input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
        </div>

        <div className="field">
          <label>Payment QR Code</label>
          <div className="settings-qr-upload">
            {form.qrImage ? (
              <img src={form.qrImage} alt="QR" />
            ) : (
              <div className="settings-qr-placeholder">
                <HiOutlineQrCode />
              </div>
            )}
            <label className="btn btn-ghost">
              {uploading ? "Uploading..." : "Upload QR Image"}
              <input type="file" accept="image/*" hidden onChange={handleQrUpload} />
            </label>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}

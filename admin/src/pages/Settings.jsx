import React, { useEffect, useState } from "react";
import { HiOutlineQrCode } from "react-icons/hi2";
import { api, resolveImageUrl } from "../api.js";
import { useToast } from "../context/ToastContext.jsx";
import "./Settings.css";

const DEFAULT_SUPPORT_EMAIL = "support@nvfresh.in";
const DEFAULT_BUSINESS_ADDRESS = "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India";
const DEFAULT_SUPPORT_HOURS = "Everyday, 7:00 AM – 9:00 PM";
const DEFAULT_DELIVERY_SCHEDULE = "Orders confirmed Saturday, delivered fresh every Sunday morning";

export default function Settings() {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    businessName: "",
    phoneNumber: "",
    upiId: "",
    qrImage: "",
    deliveryCharge: 0,
    supportEmail: "",
    businessAddress: "",
    supportHours: "",
    deliverySchedule: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) =>
        setForm({
          businessName: s.business_name || s.businessName || "",
          phoneNumber: s.phone_number || s.phoneNumber || "",
          upiId: s.upi_id || s.upiId || "",
          qrImage: s.qr_image || s.qrImage || "",
          deliveryCharge: s.delivery_charge ?? s.deliveryCharge ?? 0,
          supportEmail: s.support_email || s.supportEmail || DEFAULT_SUPPORT_EMAIL,
          businessAddress: s.business_address || s.businessAddress || DEFAULT_BUSINESS_ADDRESS,
          supportHours: s.support_hours || s.supportHours || DEFAULT_SUPPORT_HOURS,
          deliverySchedule: s.delivery_schedule || s.deliverySchedule || DEFAULT_DELIVERY_SCHEDULE,
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

    if (form.supportEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.supportEmail.trim())) {
        showToast("Please enter a valid support email address", "error");
        return;
      }
    }

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
      <p className="page-subtitle">Manage your business details, contact information, and payment info.</p>

      <form className="card settings-card" onSubmit={handleSave}>
        <div className="field">
          <label>Business Name</label>
          <input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            placeholder="NvFresh"
          />
        </div>

        <div className="field">
          <label>Phone Number</label>
          <input
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            placeholder="+91 98765 43210"
          />
        </div>

        <div className="field">
          <label>Support Email</label>
          <input
            type="email"
            value={form.supportEmail}
            onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
            placeholder="support@nvfresh.in"
          />
        </div>

        <div className="field">
          <label>Business Address</label>
          <textarea
            rows={3}
            value={form.businessAddress}
            onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
            placeholder="NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India"
          />
        </div>

        <div className="field">
          <label>Support Hours</label>
          <input
            value={form.supportHours}
            onChange={(e) => setForm({ ...form, supportHours: e.target.value })}
            placeholder="Everyday, 7:00 AM – 9:00 PM"
          />
        </div>

        <div className="field">
          <label>Delivery Day / Schedule</label>
          <input
            value={form.deliverySchedule}
            onChange={(e) => setForm({ ...form, deliverySchedule: e.target.value })}
            placeholder="Orders confirmed Saturday, delivered fresh every Sunday morning"
          />
        </div>

        <div className="field">
          <label>UPI ID</label>
          <input
            value={form.upiId}
            onChange={(e) => setForm({ ...form, upiId: e.target.value })}
            placeholder="nvfresh@upi"
          />
        </div>

        <div className="field">
          <label>Delivery Charge (₹)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.deliveryCharge}
            onChange={(e) => setForm({ ...form, deliveryCharge: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Payment QR Code</label>
          <div className="settings-qr-upload">
            {form.qrImage ? (
              <img src={resolveImageUrl(form.qrImage)} alt="QR" />
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

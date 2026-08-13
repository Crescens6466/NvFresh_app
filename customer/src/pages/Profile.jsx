import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HiOutlineUserCircle,
  HiOutlineClipboardDocumentList,
  HiOutlineMapPin,
  HiOutlineInformationCircle,
  HiOutlinePhone,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineArrowRightOnRectangle,
  HiChevronRight,
} from "react-icons/hi2";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import "./Profile.css";

const LINKS = [
  { to: "/about", label: "About Us", Icon: HiOutlineInformationCircle },
  { to: "/contact", label: "Contact Us", Icon: HiOutlinePhone },
  { to: "/privacy", label: "Privacy Policy", Icon: HiOutlineShieldCheck },
  { to: "/terms", label: "Terms & Conditions", Icon: HiOutlineDocumentText },
];

export default function Profile() {
  const navigate = useNavigate();
  const { profile, isLoggedIn, loading, logout } = useCustomerAuth();
  const { showToast } = useToast();

  if (loading) {
    return <div className="skeleton" style={{ height: 300, margin: "18px 16px" }} />;
  }

  async function handleLogout() {
    await logout();
    showToast("Signed out");
  }

  return (
    <div className="profile page-fade">
      <div
        className={`profile-header ${isLoggedIn ? "" : "profile-header-guest"}`}
        onClick={isLoggedIn ? undefined : () => navigate("/login")}
        role={isLoggedIn ? undefined : "button"}
      >
        <div className="profile-avatar">
          <HiOutlineUserCircle />
        </div>
        {isLoggedIn ? (
          <div>
            <h3>{profile.name || profile.phone || profile.email || "Signed in"}</h3>
            <p>{profile.phone || profile.email || ""}</p>
          </div>
        ) : (
          <div>
            <h3>Guest User</h3>
            <p>Sign in to track your orders</p>
          </div>
        )}
        {isLoggedIn && (
          <button
            className="profile-logout"
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <HiOutlineArrowRightOnRectangle />
          </button>
        )}
      </div>

      <div className="profile-quick">
        {isLoggedIn ? (
          <Link to="/orders" className="profile-quick-item">
            <HiOutlineClipboardDocumentList />
            <span>My Orders</span>
          </Link>
        ) : (
          <div
            className="profile-quick-item"
            onClick={() => navigate("/login")}
            role="button"
          >
            <HiOutlineClipboardDocumentList />
            <span>My Orders</span>
          </div>
        )}
        <div className="profile-quick-item">
          <HiOutlineMapPin />
          <span>Addresses</span>
        </div>
      </div>

      <div className="profile-links">
        {LINKS.map(({ to, label, Icon }) => (
          <Link to={to} key={to} className="profile-link">
            <Icon />
            <span>{label}</span>
            <HiChevronRight className="profile-link-chevron" />
          </Link>
        ))}
      </div>

      <p className="profile-version">NvFresh v1.0.0</p>
    </div>
  );
}

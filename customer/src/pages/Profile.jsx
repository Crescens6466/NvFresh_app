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
  const { profile, isLoggedIn, logout } = useCustomerAuth();
  const { showToast } = useToast();

  function handleLogout() {
    logout();
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
            <h3>{profile.name}</h3>
            <p>{profile.phone}</p>
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
        <div className="profile-quick-item">
          <HiOutlineClipboardDocumentList />
          <span>My Orders</span>
        </div>
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

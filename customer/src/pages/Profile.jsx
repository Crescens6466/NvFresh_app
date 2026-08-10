import React from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineUserCircle,
  HiOutlineClipboardDocumentList,
  HiOutlineMapPin,
  HiOutlineInformationCircle,
  HiOutlinePhone,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiChevronRight,
} from "react-icons/hi2";
import "./Profile.css";

const LINKS = [
  { to: "/about", label: "About Us", Icon: HiOutlineInformationCircle },
  { to: "/contact", label: "Contact Us", Icon: HiOutlinePhone },
  { to: "/privacy", label: "Privacy Policy", Icon: HiOutlineShieldCheck },
  { to: "/terms", label: "Terms & Conditions", Icon: HiOutlineDocumentText },
];

export default function Profile() {
  return (
    <div className="profile page-fade">
      <div className="profile-header">
        <div className="profile-avatar">
          <HiOutlineUserCircle />
        </div>
        <div>
          <h3>Guest User</h3>
          <p>Sign in to track your orders</p>
        </div>
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

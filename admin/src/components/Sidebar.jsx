import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineClipboardDocumentList,
  HiOutlineUsers,
  HiOutlineCog6Tooth,
  HiOutlineArrowLeftOnRectangle,
} from "react-icons/hi2";
import { useAuth } from "../context/AuthContext.jsx";
import "./Sidebar.css";

const LINKS = [
  { to: "/", label: "Dashboard", Icon: HiOutlineSquares2X2, end: true },
  { to: "/products", label: "Products", Icon: HiOutlineCube },
  { to: "/orders", label: "Orders", Icon: HiOutlineClipboardDocumentList },
  { to: "/customers", label: "Customers", Icon: HiOutlineUsers },
  { to: "/settings", label: "Settings", Icon: HiOutlineCog6Tooth },
];

export default function Sidebar() {
  const { logout, username } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>NvFresh</h1>
        <span>Admin Panel</span>
      </div>

      <nav className="sidebar-nav">
        {LINKS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="sidebar-link">
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{(username || "A")[0].toUpperCase()}</div>
          <span>{username || "Admin"}</span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <HiOutlineArrowLeftOnRectangle />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

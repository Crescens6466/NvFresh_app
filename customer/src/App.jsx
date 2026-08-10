import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Home from "./pages/Home.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import Cart from "./pages/Cart.jsx";
import Payment from "./pages/Payment.jsx";
import Categories from "./pages/Categories.jsx";
import Profile from "./pages/Profile.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import OrderSuccess from "./pages/OrderSuccess.jsx";

export default function App() {
  const location = useLocation();
  // Payment & order-success get a focused flow without the bottom nav.
  const hideNav = ["/payment", "/order-success"].includes(location.pathname);

  return (
    <div className="app-shell">
      <Header />
      <main className="page-fade">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

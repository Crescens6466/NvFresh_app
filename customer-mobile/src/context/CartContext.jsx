// CartContext.jsx — ported from customer/src/context/CartContext.jsx.
// Same public API (addToCart, updateQuantity, removeFromCart, clearCart,
// subtotal, deliveryCharge, total, itemCount) — only the persistence layer
// changes: AsyncStorage instead of localStorage.
import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api.js";

const CartContext = createContext(null);

const STORAGE_KEY = "nvfresh_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  // Admin-controlled — set in the admin panel's Settings page, defaults to 0.
  // This is only for display before checkout; the backend recomputes the
  // authoritative delivery charge from the same Settings document at order time.
  const [deliveryChargeSetting, setDeliveryChargeSetting] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setItems(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated]);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setDeliveryChargeSetting(s.delivery_charge ?? 0))
      .catch(() => {});
  }, []);

  // unitPrice is the price already scaled for the chosen weight (e.g. ₹110 for
  // "0.5 kg" of a ₹220/kg product) — computed by the caller via priceForWeight().
  function addToCart(product, weight, quantity = 1, unitPrice = product.price) {
    setItems((prev) => {
      const key = `${product.id}-${weight}`;
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          image: product.image,
          price: unitPrice,
          weight,
          quantity,
        },
      ];
    });
  }

  function updateQuantity(key, quantity) {
    if (quantity <= 0) {
      removeFromCart(key);
      return;
    }
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity } : i)));
  }

  function removeFromCart(key) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function clearCart() {
    setItems([]);
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryCharge = subtotal > 0 ? deliveryChargeSetting : 0;
  const total = subtotal + deliveryCharge;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        subtotal,
        deliveryCharge,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

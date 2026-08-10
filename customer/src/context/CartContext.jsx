import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "nvfresh_cart";

function loadCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

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
  const deliveryCharge = subtotal > 0 && subtotal < 500 ? 40 : 0;
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

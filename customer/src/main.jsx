import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { CartProvider } from "./context/CartContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { CustomerAuthProvider } from "./context/CustomerAuthContext.jsx";
import { CustomerNotificationProvider } from "./context/CustomerNotificationContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <CustomerAuthProvider>
          <CustomerNotificationProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </CustomerNotificationProvider>
        </CustomerAuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

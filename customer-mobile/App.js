// App.js — assembles the providers + navigator, mirroring customer/src/App.jsx's
// shell (Header always on top, Routes/Stack below).
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { CartProvider } from "./src/context/CartContext.jsx";
import { ToastProvider } from "./src/context/ToastContext.jsx";
import { CustomerAuthProvider } from "./src/context/CustomerAuthContext.jsx";
import { navigationRef } from "./src/navigation/navigationRef.js";
import RootNavigator from "./src/navigation/RootNavigator.jsx";
import AppHeader from "./src/components/AppHeader.jsx";

export default function App() {
  return (
    <SafeAreaProvider>
      <CartProvider>
        <ToastProvider>
          <CustomerAuthProvider>
            <NavigationContainer ref={navigationRef}>
              <AppHeader />
              <RootNavigator />
            </NavigationContainer>
          </CustomerAuthProvider>
        </ToastProvider>
      </CartProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

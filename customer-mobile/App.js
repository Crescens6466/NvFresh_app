// App.js — assembles the providers + navigator, mirroring customer/src/App.jsx's
// shell (Header always on top, Routes/Stack below).
import React from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { useFonts, Baloo2_700Bold, Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { CartProvider } from "./src/context/CartContext.jsx";
import { ToastProvider } from "./src/context/ToastContext.jsx";
import { CustomerAuthProvider } from "./src/context/CustomerAuthContext.jsx";
import { navigationRef } from "./src/navigation/navigationRef.js";
import RootNavigator from "./src/navigation/RootNavigator.jsx";
import AppHeader from "./src/components/AppHeader.jsx";
import { colors } from "./src/theme.js";

// Match the website's default body font everywhere a Text/TextInput doesn't
// explicitly opt into the display face — mirrors index.css's `body { font-family: var(--font-body) }`.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [{ fontFamily: "Inter_400Regular" }, Text.defaultProps.style];
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = [{ fontFamily: "Inter_400Regular" }, TextInput.defaultProps.style];

export default function App() {
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

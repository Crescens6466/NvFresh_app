// RootNavigator.jsx — mirrors customer/src/App.jsx's route table. MainTabs
// covers Home/Categories/Cart/Profile; everything else is a stack screen on
// top, which naturally hides the bottom tab bar for Payment/OrderSuccess/Login
// — the same effect as the web app's `hideNav` list.
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MainTabs from "./MainTabs.jsx";
import ProductDetailsScreen from "../screens/ProductDetailsScreen.jsx";
import LoginScreen from "../screens/LoginScreen.jsx";
import PaymentScreen from "../screens/PaymentScreen.jsx";
import OrderSuccessScreen from "../screens/OrderSuccessScreen.jsx";
import OrderHistoryScreen from "../screens/OrderHistoryScreen.jsx";
import CustomerNotificationsScreen from "../screens/CustomerNotificationsScreen.jsx";
import AboutScreen from "../screens/AboutScreen.jsx";
import ContactScreen from "../screens/ContactScreen.jsx";
import PrivacyScreen from "../screens/PrivacyScreen.jsx";
import TermsScreen from "../screens/TermsScreen.jsx";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const insets = useSafeAreaInsets();
  // MainTabs handles its own bottom inset via the tab bar height, so it's
  // excluded here — every other stack screen (including ones with a floating
  // bottom action bar, e.g. ProductDetails) gets the safe-area gap added so
  // content/buttons never sit under the Android gesture/3-button nav area.
  const insetScreenOptions = { headerShown: false, contentStyle: { paddingBottom: insets.bottom } };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} options={insetScreenOptions} />
      <Stack.Screen name="Login" component={LoginScreen} options={insetScreenOptions} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={insetScreenOptions} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={insetScreenOptions} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={insetScreenOptions} />
      <Stack.Screen name="CustomerNotifications" component={CustomerNotificationsScreen} options={insetScreenOptions} />
      <Stack.Screen name="About" component={AboutScreen} options={insetScreenOptions} />
      <Stack.Screen name="Contact" component={ContactScreen} options={insetScreenOptions} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={insetScreenOptions} />
      <Stack.Screen name="Terms" component={TermsScreen} options={insetScreenOptions} />
    </Stack.Navigator>
  );
}

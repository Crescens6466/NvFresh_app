// RootNavigator.jsx — mirrors customer/src/App.jsx's route table. MainTabs
// covers Home/Categories/Cart/Profile; everything else is a stack screen on
// top, which naturally hides the bottom tab bar for Payment/OrderSuccess/Login
// — the same effect as the web app's `hideNav` list.
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs.jsx";
import ProductDetailsScreen from "../screens/ProductDetailsScreen.jsx";
import LoginScreen from "../screens/LoginScreen.jsx";
import PaymentScreen from "../screens/PaymentScreen.jsx";
import OrderSuccessScreen from "../screens/OrderSuccessScreen.jsx";
import OrderHistoryScreen from "../screens/OrderHistoryScreen.jsx";
import AboutScreen from "../screens/AboutScreen.jsx";
import ContactScreen from "../screens/ContactScreen.jsx";
import PrivacyScreen from "../screens/PrivacyScreen.jsx";
import TermsScreen from "../screens/TermsScreen.jsx";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
    </Stack.Navigator>
  );
}

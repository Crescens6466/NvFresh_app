// MainTabs.jsx — ported from customer/src/components/BottomNav.jsx: the
// 4-tab bottom nav (Home, Categories, Cart, Profile) with a cart badge.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext.jsx";
import { colors } from "../theme.js";
import HomeScreen from "../screens/HomeScreen.jsx";
import CategoriesScreen from "../screens/CategoriesScreen.jsx";
import CartScreen from "../screens/CartScreen.jsx";
import ProfileScreen from "../screens/ProfileScreen.jsx";

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: ["home-outline", "home"],
  Categories: ["grid-outline", "grid"],
  Cart: ["bag-handle-outline", "bag-handle"],
  Profile: ["person-outline", "person"],
};

function TabIcon({ route, focused, itemCount }) {
  const [outline, filled] = ICONS[route.name];
  return (
    <View>
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? colors.primary : colors.textMuted} />
      {route.name === "Cart" && itemCount > 0 && (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{itemCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function MainTabs() {
  const { itemCount } = useCart();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon route={route} focused={focused} itemCount={itemCount} />,
        tabBarStyle: { borderTopColor: colors.border, height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: -4,
    right: -8,
    bottom: 2,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  dotText: { color: colors.white, fontSize: 9, fontWeight: "700" },
});

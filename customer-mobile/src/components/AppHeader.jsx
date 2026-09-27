// AppHeader.jsx — ported from customer/src/components/Header.jsx: brand
// logo/tagline plus notification and cart badges, always visible above screens
// (like the web app's sticky header).
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../context/CartContext.jsx";
import { useCustomerNotifications } from "../context/CustomerNotificationsContext.jsx";
import { navigate } from "../navigation/navigationRef.js";
import { colors, radius, spacing, typography } from "../theme.js";

export default function AppHeader() {
  const { itemCount } = useCart();
  const { unreadCount } = useCustomerNotifications();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => navigate("CustomerNotifications")}
        accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <Ionicons name={unreadCount > 0 ? "notifications" : "notifications-outline"} size={22} color={colors.text} />
        {unreadCount > 0 && (
          <View style={[styles.badge, styles.notificationBadge]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.brand}
        onPress={() => navigate("Main", { screen: "Home" })}
      >
        <Text style={styles.logo}>NvFresh</Text>
        <Text style={styles.tagline}>Fresh Meat Delivered. Hygienic. Healthy. Trusted.</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cartButton}
        onPress={() => navigate("Main", { screen: "Cart" })}
        accessibilityLabel="Open cart"
      >
        <Ionicons name="bag-outline" size={22} color={colors.text} />
        {itemCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  notificationBadge: { top: -3, right: -5, minWidth: 17, height: 17 },
  brand: { flex: 1, alignItems: "center" },
  logo: { fontSize: 22, fontFamily: typography.display.extrabold, color: colors.primary, letterSpacing: 0.2 },
  tagline: { fontSize: 10, fontFamily: typography.body.medium, color: colors.textMuted, marginTop: 2, textAlign: "center" },
  cartButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 10, fontFamily: typography.body.bold },
});

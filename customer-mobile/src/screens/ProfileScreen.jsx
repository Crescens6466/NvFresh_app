// ProfileScreen.jsx — ported from customer/src/pages/Profile.jsx.
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { colors, radius, shadow, spacing } from "../theme.js";

const LINKS = [
  { screen: "About", label: "About Us", icon: "information-circle-outline" },
  { screen: "Contact", label: "Contact Us", icon: "call-outline" },
  { screen: "Privacy", label: "Privacy Policy", icon: "shield-checkmark-outline" },
  { screen: "Terms", label: "Terms & Conditions", icon: "document-text-outline" },
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { profile, isLoggedIn, loading, logout } = useCustomerAuth();
  const { showToast } = useToast();

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  async function handleLogout() {
    await logout();
    showToast("Signed out");
  }

  return (
    <View style={styles.screen}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={isLoggedIn ? 1 : 0.7}
        onPress={isLoggedIn ? undefined : () => navigation.navigate("Login")}
      >
        <View style={styles.avatar}>
          <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
        </View>
        {isLoggedIn ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name || profile.phone || profile.email || "Signed in"}</Text>
            <Text style={styles.sub}>{profile.phone || profile.email || ""}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>Guest User</Text>
            <Text style={styles.sub}>Sign in to track your orders</Text>
          </View>
        )}
        {isLoggedIn && (
          <TouchableOpacity onPress={handleLogout} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickItem}
          onPress={() => navigation.navigate(isLoggedIn ? "OrderHistory" : "Login", isLoggedIn ? undefined : { from: { name: "OrderHistory" } })}
        >
          <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
          <Text style={styles.quickLabel}>My Orders</Text>
        </TouchableOpacity>
        <View style={styles.quickItem}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <Text style={styles.quickLabel}>Addresses</Text>
        </View>
      </View>

      <View style={styles.links}>
        {LINKS.map(({ screen, label, icon }) => (
          <TouchableOpacity key={screen} style={styles.link} onPress={() => navigation.navigate(screen)}>
            <Ionicons name={icon} size={18} color={colors.text} />
            <Text style={styles.linkLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.version}>NvFresh v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow.sm },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  quickRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  quickItem: { flex: 1, alignItems: "center", gap: 6, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.lg, ...shadow.sm },
  quickLabel: { fontSize: 12, fontWeight: "600", color: colors.text },
  links: { marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md, ...shadow.sm },
  link: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  version: { textAlign: "center", fontSize: 11, color: colors.textMuted, marginTop: spacing.xl },
});

// ProfileScreen.jsx — ported from customer/src/pages/Profile.jsx.
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Button from "../components/Button.jsx";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const DELETE_ACCOUNT_URL = "https://www.nvfresh.in/delete-account";

const LINKS = [
  { screen: "About", label: "About Us", icon: "information-circle-outline" },
  { screen: "Contact", label: "Contact Us", icon: "call-outline" },
  { screen: "Privacy", label: "Privacy Policy", icon: "shield-checkmark-outline" },
  { screen: "Terms", label: "Terms & Conditions", icon: "document-text-outline" },
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { profile, isLoggedIn, loading, logout, deleteAccount } = useCustomerAuth();
  const { clearCart } = useCart();
  const { showToast } = useToast();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  function handleDeletePress() {
    if (!isLoggedIn) {
      Alert.alert(
        "Sign In Required",
        "To protect your account, please sign in to verify your identity before deleting your account. If you cannot sign in, you can request deletion online.",
        [
          { text: "Close", style: "cancel" },
          {
            text: "Open Web Page",
            onPress: () =>
              Linking.openURL(DELETE_ACCOUNT_URL).catch(() =>
                showToast(`Open ${DELETE_ACCOUNT_URL} in your browser`, "info")
              ),
          },
          {
            text: "Sign In",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
      return;
    }
    setDeleteModalVisible(true);
  }

  async function handleConfirmDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    try {
      const response = await deleteAccount();
      clearCart();
      setDeleteModalVisible(false);

      const isPending = response?.status === "pending";
      const message =
        response?.message ||
        (isPending
          ? "Your NvFresh profile and notification data have been deleted. Final removal of your authentication account is pending completion."
          : "Your NvFresh account and personal profile data have been permanently deleted.");

      showToast(
        isPending ? "Account deletion pending completion" : "Account deleted",
        isPending ? "info" : "success"
      );
      Alert.alert(
        isPending ? "Account Deletion Pending" : "Account Deleted",
        message
      );
    } catch (err) {
      const message =
        err?.message || "Could not delete your account right now. Please try again or contact support@nvfresh.in.";
      showToast(message, "error");
      Alert.alert("Account Deletion Failed", message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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

      <TouchableOpacity
        style={styles.ordersCard}
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate(
            isLoggedIn ? "OrderHistory" : "Login",
            isLoggedIn ? undefined : { from: { name: "OrderHistory" } }
          )
        }
      >
        <View style={styles.ordersIconWrap}>
          <Ionicons name="clipboard-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.ordersInfo}>
          <Text style={styles.ordersTitle}>My Orders</Text>
          <Text style={styles.ordersSubtitle}>View past orders & track status</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.links}>
        {LINKS.map(({ screen, label, icon }, index) => (
          <TouchableOpacity
            key={screen}
            style={[styles.link, index === LINKS.length - 1 && styles.linkLast]}
            onPress={() => navigation.navigate(screen)}
          >
            <Ionicons name={icon} size={18} color={colors.text} />
            <Text style={styles.linkLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.deleteCard}
        activeOpacity={0.8}
        onPress={handleDeletePress}
        accessibilityRole="button"
        accessibilityLabel="Delete Account"
      >
        <Ionicons name="trash-outline" size={18} color={colors.primary} />
        <Text style={styles.deleteLabel}>Delete Account</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </TouchableOpacity>

      <Text style={styles.version}>NvFresh v1.0.0</Text>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setDeleteModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Delete Account Permanently?</Text>
            <Text style={styles.modalBody}>
              This action is permanent and cannot be undone. Your NvFresh profile,
              push notification tokens, in-app notifications, and sign-in access will
              be permanently removed.
            </Text>
            <Text style={styles.modalSubBody}>
              Essential financial and payment transaction records will be retained as
              required by law, with unnecessary personal details anonymized on
              completed orders.
            </Text>

            <Button
              title="Delete Account Permanently"
              onPress={handleConfirmDeleteAccount}
              loading={deleting}
              disabled={deleting}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Keep My Account"
              variant="outline"
              onPress={() => setDeleteModalVisible(false)}
              disabled={deleting}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow.sm },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontFamily: typography.display.bold, color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  ordersCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.sm,
  },
  ordersIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
  },
  ordersInfo: {
    flex: 1,
  },
  ordersTitle: {
    fontSize: 15,
    fontFamily: typography.display.bold,
    color: colors.text,
  },
  ordersSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  links: { marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, ...shadow.sm },
  link: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkLast: { borderBottomWidth: 0 },
  linkLabel: { flex: 1, fontSize: 14, fontFamily: typography.body.semibold, color: colors.text },
  deleteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#F5C6CB",
    ...shadow.sm,
  },
  deleteLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.body.bold,
    color: colors.primary,
  },
  version: { textAlign: "center", fontSize: 11, color: colors.textMuted, marginTop: spacing.xl },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(42, 27, 24, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    ...shadow.md,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: "#FDE7E7",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: typography.display.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontSize: 13,
    fontFamily: typography.body.regular,
    color: colors.text,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  modalSubBody: {
    fontSize: 12,
    fontFamily: typography.body.regular,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});

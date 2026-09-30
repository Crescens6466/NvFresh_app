// CartScreen.jsx — ported from customer/src/pages/Cart.jsx.
import React, { useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../context/CartContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api, resolveImageUrl } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import Button from "../components/Button.jsx";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

export default function CartScreen() {
  const { items, updateQuantity, removeFromCart, subtotal, deliveryCharge, total } = useCart();
  const { isLoggedIn } = useCustomerAuth();
  const navigation = useNavigation();

  const [unavailableProductIds, setUnavailableProductIds] = useState(new Set());

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    api
      .getProducts()
      .then((products) => {
        if (cancelled) return;
        const unavailable = new Set(
          products.filter((p) => p.isAvailable === false).map((p) => String(p.id))
        );
        setUnavailableProductIds(unavailable);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [items]);

  const hasUnavailableItems = items.some((item) =>
    unavailableProductIds.has(String(item.productId))
  );

  function handleCheckout() {
    if (hasUnavailableItems) return;
    if (isLoggedIn) navigation.navigate("Payment");
    else navigation.navigate("Login", { from: { name: "Payment" } });
  }

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon={<Ionicons name="bag-handle-outline" size={40} color={colors.textMuted} />}
          title="Your cart is empty"
          message="Add some fresh picks to get started."
        >
          <Button title="Browse Products" onPress={() => navigation.navigate("Main", { screen: "Home" })} style={{ marginTop: spacing.md, width: 200 }} />
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        ListHeaderComponent={<Text style={styles.title}>Your Cart</Text>}
        renderItem={({ item }) => {
          const isItemUnavailable = unavailableProductIds.has(String(item.productId));
          return (
            <View style={[styles.item, isItemUnavailable && styles.itemUnavailable]}>
              <Image source={{ uri: resolveImageUrl(item.image) }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {isItemUnavailable && (
                    <View style={styles.unavailableBadge}>
                      <Text style={styles.unavailableBadgeText}>Unavailable</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemWeight}>{item.weight}</Text>
                <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity onPress={() => removeFromCart(item.key)} accessibilityLabel="Remove item">
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => updateQuantity(item.key, item.quantity - 1)}>
                    <Ionicons name="remove" size={14} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.stepText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => updateQuantity(item.key, item.quantity + 1)}>
                    <Ionicons name="add" size={14} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{subtotal}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Charge</Text>
              <Text style={styles.summaryValue}>{deliveryCharge === 0 ? "Free" : `₹${deliveryCharge}`}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>₹{total}</Text>
            </View>
            <View style={styles.banner}>
              <Ionicons name="car-outline" size={16} color={colors.primary} />
              <Text style={styles.bannerText}>Orders confirmed Saturday, delivered fresh Sunday morning.</Text>
            </View>

            {hasUnavailableItems && (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Some items in your cart are currently unavailable.</Text>
                <Text style={styles.warningText}>Please remove them to proceed with checkout.</Text>
              </View>
            )}
          </View>
        }
      />

      <View style={styles.checkoutBar}>
        <View>
          <Text style={styles.checkoutLabel}>Total</Text>
          <Text style={styles.checkoutTotal}>₹{total}</Text>
        </View>
        <Button
          title="Checkout"
          onPress={handleCheckout}
          disabled={hasUnavailableItems}
          style={{ width: 160 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 20, fontFamily: typography.display.extrabold, color: colors.text, marginBottom: spacing.lg },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow.sm,
  },
  itemUnavailable: {
    borderWidth: 1.5,
    borderColor: "#F5C6CB",
    backgroundColor: "#FFF5F5",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  unavailableBadge: {
    backgroundColor: "#FDE7E7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  unavailableBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: typography.body.bold,
  },
  warningCard: {
    backgroundColor: "#FDE7E7",
    borderWidth: 1,
    borderColor: "#F5C6CB",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warningTitle: {
    fontSize: 13,
    fontFamily: typography.body.bold,
    color: colors.primary,
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    color: colors.text,
  },
  itemImage: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontFamily: typography.body.bold, color: colors.text },
  itemWeight: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontFamily: typography.display.bold, color: colors.primary, marginTop: 4 },
  itemActions: { alignItems: "flex-end", gap: spacing.sm },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stepBtn: { padding: 4 },
  stepText: { fontSize: 13, fontFamily: typography.body.bold, color: colors.text, minWidth: 16, textAlign: "center" },
  summary: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm, ...shadow.sm },
  summaryTitle: { fontSize: 15, fontFamily: typography.display.bold, color: colors.text, marginBottom: spacing.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, fontFamily: typography.body.semibold },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  summaryTotalLabel: { fontSize: 15, fontFamily: typography.display.bold, color: colors.text },
  summaryTotalValue: { fontSize: 16, fontFamily: typography.display.bold, color: colors.primary },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF1EC", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  bannerText: { flex: 1, fontSize: 11, color: colors.primaryDark, fontFamily: typography.body.semibold },
  checkoutBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkoutLabel: { fontSize: 11, color: colors.textMuted },
  checkoutTotal: { fontSize: 19, fontFamily: typography.display.extrabold, color: colors.text },
});

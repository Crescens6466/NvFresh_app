// ProductDetailsScreen.jsx — ported from customer/src/pages/ProductDetails.jsx.
import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { api, resolveImageUrl } from "../api.js";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { priceForWeight } from "../utils.js";
import { Skeleton } from "../components/Skeleton.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Button from "../components/Button.jsx";
import WeightSelector from "../components/WeightSelector.jsx";
import { colors, radius, spacing, typography } from "../theme.js";

const BENEFITS = [
  { icon: "sparkles-outline", label: "Freshly Cut" },
  { icon: "close-circle-outline", label: "No Preservatives" },
  { icon: "shield-checkmark-outline", label: "Hygienically Packed" },
  { icon: "car-outline", label: "Sunday Delivery" },
];

export default function ProductDetailsScreen({ route }) {
  const { productId } = route.params;
  const navigation = useNavigation();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setLoading(true);
    api
      .getProduct(productId)
      .then((p) => {
        setProduct(p);
        setWeight(p.weights[1] || p.weights[0]);
      })
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Skeleton style={{ aspectRatio: 1 }} />
        <View style={{ padding: spacing.lg }}>
          <Skeleton style={{ width: "60%", height: 20 }} />
          <Skeleton style={{ width: "30%", height: 16, marginTop: 10 }} />
          <Skeleton style={{ width: "100%", height: 60, marginTop: 16 }} />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.notFound}>Product not found</Text>
        <Button title="Back to Home" onPress={() => navigation.navigate("Main", { screen: "Home" })} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  const unitPrice = priceForWeight(product.price, weight);
  const totalPrice = unitPrice * qty;

  function handleAdd() {
    addToCart(product, weight, qty, unitPrice);
    showToast(`${product.name} added to cart`);
  }

  function handleBuyNow() {
    addToCart(product, weight, qty, unitPrice);
    navigation.navigate("Main", { screen: "Cart" });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View>
          <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Image source={{ uri: resolveImageUrl(product.image) }} style={styles.image} />
          {product.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{product.badge}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            ₹{unitPrice} <Text style={styles.unit}>/ {weight}</Text>
          </Text>
          <Text style={styles.desc}>{product.description}</Text>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Weight</Text>
              <WeightSelector options={product.weights} value={weight} onChange={setWeight} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Quantity</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                  <Ionicons name="remove" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
                  <Ionicons name="add" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map(({ icon, label }) => (
              <View key={label} style={styles.benefit}>
                <Ionicons name={icon} size={18} color={colors.primary} />
                <Text style={styles.benefitLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Storage Instructions</Text>
            <Text style={styles.infoText}>
              Refrigerate at 0–4°C immediately on delivery. Consume fresh within 24 hours, or
              freeze for up to 30 days.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Delivery Information</Text>
            <Text style={styles.infoText}>
              We deliver once a week. Orders are confirmed every Saturday and delivered fresh on
              Sunday morning, in insulated, leak-proof hygienic packaging.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <View>
          <Text style={styles.actionLabel}>Total</Text>
          <Text style={styles.actionTotal}>₹{totalPrice}</Text>
        </View>
        <View style={styles.actionButtons}>
          <Button title="Add To Cart" variant="outline" onPress={handleAdd} style={{ flex: 1 }} />
          <Button title="Buy Now" onPress={handleBuyNow} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 16, fontWeight: "700", color: colors.text },
  back: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.border },
  badge: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: colors.white, fontSize: 11, fontFamily: typography.body.bold },
  body: { padding: spacing.lg },
  name: { fontSize: 20, fontFamily: typography.display.extrabold, color: colors.text },
  price: { fontSize: 20, fontFamily: typography.display.bold, color: colors.primary, marginTop: 6 },
  unit: { fontSize: 12, fontFamily: typography.body.medium, color: colors.textMuted },
  desc: { fontSize: 13, color: colors.textMuted, marginTop: spacing.md, lineHeight: 19 },
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  field: { flex: 1 },
  label: { fontSize: 12, fontFamily: typography.body.bold, color: colors.textMuted, marginBottom: 6 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  qtyBtn: { padding: 4 },
  qtyText: { fontSize: 15, fontFamily: typography.body.bold, color: colors.text },
  benefits: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  benefit: { alignItems: "center", width: "22%", gap: 4 },
  benefitLabel: { fontSize: 10, color: colors.textMuted, textAlign: "center", fontFamily: typography.body.semibold },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: { fontSize: 13, fontFamily: typography.body.bold, color: colors.text, marginBottom: 4 },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  actionBar: {
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
    gap: spacing.md,
  },
  actionLabel: { fontSize: 11, color: colors.textMuted },
  actionTotal: { fontSize: 18, fontFamily: typography.display.bold, color: colors.text },
  actionButtons: { flexDirection: "row", gap: spacing.sm, flex: 1, marginLeft: spacing.md },
});

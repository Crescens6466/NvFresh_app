// ProductCard.jsx — ported from customer/src/components/ProductCard.jsx.
import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { priceForWeight } from "../utils.js";
import { resolveImageUrl } from "../api.js";
import { colors, radius, shadow, spacing } from "../theme.js";

const BADGE_COLOR = {
  "Best Seller": colors.accent,
  "Fresh Today": colors.success,
  "Limited Stock": colors.primary,
};

export default function ProductCard({ product }) {
  const [weight, setWeight] = useState(product.weights[1] || product.weights[0]);
  const [liked, setLiked] = useState(false);
  const navigation = useNavigation();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const displayPrice = priceForWeight(product.price, weight);

  function handleAdd() {
    addToCart(product, weight, 1, displayPrice);
    showToast(`${product.name} added to cart`);
  }

  function handleBuyNow() {
    addToCart(product, weight, 1, displayPrice);
    navigation.navigate("Main", { screen: "Cart" });
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate("ProductDetails", { productId: product.id })}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: resolveImageUrl(product.image) }} style={styles.image} />
        {product.badge && (
          <View style={[styles.badge, { backgroundColor: BADGE_COLOR[product.badge] || colors.primary }]}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.wishlist}
          onPress={(e) => {
            e.stopPropagation?.();
            setLiked((l) => !l);
          }}
          accessibilityLabel="Toggle wishlist"
        >
          <Ionicons name={liked ? "heart" : "heart-outline"} size={16} color={liked ? colors.primary : colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.price}>
          ₹{displayPrice} <Text style={styles.unit}>/ {weight}</Text>
        </Text>

        <View style={styles.pickerWrap}>
          <Picker selectedValue={weight} onValueChange={setWeight} style={styles.picker}>
            {product.weights.map((w) => (
              <Picker.Item key={w} label={w} value={w} />
            ))}
          </Picker>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleAdd}>
            <Text style={styles.btnOutlineText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleBuyNow}>
            <Text style={styles.btnPrimaryText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadow.sm,
  },
  imageWrap: { aspectRatio: 1, backgroundColor: colors.border },
  image: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  wishlist: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.md },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  price: { fontSize: 15, fontWeight: "800", color: colors.primary, marginTop: 4 },
  unit: { fontSize: 11, fontWeight: "500", color: colors.textMuted },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  picker: { height: 40 },
  actions: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  btn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: "center" },
  btnOutline: { borderWidth: 1, borderColor: colors.primary },
  btnOutlineText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: 12 },
});

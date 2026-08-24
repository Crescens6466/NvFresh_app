// HomeScreen.jsx — ported from customer/src/pages/Home.jsx.
import React, { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import { ProductGridSkeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const CATEGORIES = ["All", "Chicken", "Mutton", "Fish", "Seafood", "Country Chicken"];

export default function HomeScreen({ route }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(route.params?.category || "All");
  const [search, setSearch] = useState("");

  // Categories screen navigates here with a `category` param (mirrors the
  // web app's navigate(`/?category=X`)) — apply it whenever it changes.
  useEffect(() => {
    if (route.params?.category) setCategory(route.params.category);
  }, [route.params?.category]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .getProducts({ category, search })
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [category, search]);

  const ListHeader = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>Weekly delivery, every Sunday</Text>
        <Text style={styles.heroTitle}>Fresh Meat Delivered To Your Doorstep</Text>
        <Text style={styles.heroDesc}>
          We deliver hygienically processed fresh chicken, mutton, fish and seafood directly
          from farm to your home — every Sunday morning.
        </Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chicken, mutton, fish..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.strip}>
          <View style={styles.stripItem}>
            <Ionicons name="sparkles-outline" size={14} color="#fff" />
            <Text style={styles.stripText}>Freshly Cut</Text>
          </View>
          <View style={styles.stripItem}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
            <Text style={styles.stripText}>Hygienic Pack</Text>
          </View>
          <View style={styles.stripItem}>
            <Ionicons name="car-outline" size={14} color="#fff" />
            <Text style={styles.stripText}>Sunday Delivery</Text>
          </View>
        </View>
      </View>

      <View style={styles.scheduleBanner}>
        <Ionicons name="car-outline" size={16} color={colors.primary} />
        <Text style={styles.scheduleText}>
          Orders confirmed every Saturday, delivered fresh Sunday morning.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}>
        {CATEGORIES.map((c) => (
          <Text
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}
          >
            {c}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.featuredHeader}>
        <Text style={styles.featuredTitle}>Featured Products</Text>
        <Text style={styles.featuredCount}>{loading ? "" : `${products.length} items`}</Text>
      </View>

      {loading && <ProductGridSkeleton count={6} />}
    </View>
  );

  if (!loading && products.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {ListHeader}
        <EmptyState
          icon={<Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />}
          title="No products found"
          message="Try a different category or search term."
        />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={loading ? [] : products}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: spacing.lg }}
      contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
      ListHeaderComponent={ListHeader}
      renderItem={({ item }) => <ProductCard product={item} />}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.primary,
  },
  heroGlow: {
    position: "absolute",
    right: -40,
    bottom: -60,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  eyebrow: { color: "#FFE1B3", fontFamily: typography.body.bold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
  heroTitle: { fontSize: 24, fontFamily: typography.display.extrabold, color: "#fff", marginTop: 8, lineHeight: 30, maxWidth: 280 },
  heroDesc: { fontSize: 13, fontFamily: typography.body.regular, color: "rgba(255,255,255,0.92)", marginTop: 8, lineHeight: 19, maxWidth: 320 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: spacing.lg,
    gap: 8,
    ...shadow.md,
  },
  searchInput: { flex: 1, fontFamily: typography.body.regular, color: colors.text, fontSize: 14 },
  strip: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  stripItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  stripText: { fontSize: 11, fontFamily: typography.body.semibold, color: "#fff" },
  scheduleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF3CD",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  scheduleText: { flex: 1, fontSize: 12, fontFamily: typography.body.semibold, color: "#8A5A00" },
  chipRow: { marginTop: spacing.lg, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: typography.body.semibold,
    color: colors.textMuted,
    overflow: "hidden",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary, color: "#fff", ...shadow.sm },
  featuredHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  featuredTitle: { fontSize: 17, fontFamily: typography.display.bold, color: colors.text },
  featuredCount: { fontSize: 12, fontFamily: typography.body.medium, color: colors.textMuted },
});

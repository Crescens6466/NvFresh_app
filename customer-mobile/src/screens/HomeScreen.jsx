// HomeScreen.jsx — ported from customer/src/pages/Home.jsx.
import React, { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import { ProductGridSkeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { colors, radius, shadow, spacing } from "../theme.js";

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
            <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            <Text style={styles.stripText}>Freshly Cut</Text>
          </View>
          <View style={styles.stripItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
            <Text style={styles.stripText}>Hygienic Pack</Text>
          </View>
          <View style={styles.stripItem}>
            <Ionicons name="car-outline" size={16} color={colors.primary} />
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
  hero: { padding: spacing.lg },
  eyebrow: { color: colors.primary, fontWeight: "700", fontSize: 12, marginBottom: 6 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.text, lineHeight: 30 },
  heroDesc: { fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 19 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: spacing.lg,
    gap: 8,
    ...shadow.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  strip: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  stripItem: { alignItems: "center", gap: 4 },
  stripText: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  scheduleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF1EC",
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  scheduleText: { flex: 1, fontSize: 12, color: colors.primaryDark, fontWeight: "600" },
  chipRow: { marginTop: spacing.lg, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    overflow: "hidden",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.white },
  featuredHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  featuredTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  featuredCount: { fontSize: 12, color: colors.textMuted },
});

// CategoriesScreen.jsx — ported from customer/src/pages/Categories.jsx.
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api.js";
import { navigate } from "../navigation/navigationRef.js";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const CATS = [
  { name: "Chicken", icon: "food-drumstick", color: "#EF5350" },
  { name: "Mutton", icon: "food-steak", color: "#C62828" },
  { name: "Fish", icon: "fish", color: "#0277BD" },
  { name: "Seafood", icon: "shrimp", color: "#EF6C00" },
  { name: "Country Chicken", icon: "food-drumstick-outline", color: "#AD1457" },
];

export default function CategoriesScreen() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  // Balanced 2-column card width accounting for screen horizontal padding (12px * 2) and grid gap (10px)
  const screenWidth = width || 360;
  const cardWidth = Math.floor((screenWidth - spacing.md * 2 - 10) / 2);

  const loadCounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const products = await api.getProducts();
      if (Array.isArray(products)) {
        const c = {};
        products.forEach((p) => {
          // Count only products available for purchase (isAvailable !== false)
          if (p && p.isAvailable !== false && p.category) {
            const cat = p.category === "Prawns" ? "Seafood" : p.category;
            c[cat] = (c[cat] || 0) + 1;
          }
        });
        setCounts(c);
      }
    } catch (err) {
      console.warn("[CategoriesScreen] Failed to load category product counts:", err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  function handleCategoryPress(categoryName) {
    if (navigation?.navigate) {
      navigation.navigate("Home", { category: categoryName });
    } else {
      navigate("Main", { screen: "Home", params: { category: categoryName } });
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadCounts(true)}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Shop by Category</Text>
      <View style={styles.grid}>
        {CATS.map(({ name, icon, color }) => {
          const count = counts[name] || 0;
          const isUnavailable = !loading && count === 0;

          return (
            <TouchableOpacity
              key={name}
              style={[
                styles.card,
                { width: cardWidth },
                isUnavailable && styles.cardUnavailable,
              ]}
              activeOpacity={0.7}
              onPress={() => handleCategoryPress(name)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
                {icon === "shrimp" ? (
                  <FontAwesome6 name="shrimp" size={22} color={color} />
                ) : (
                  <MaterialCommunityIcons name={icon} size={22} color={color} />
                )}
              </View>
              <Text style={styles.cardTitle}>{name}</Text>
              <Text
                style={[
                  styles.cardCount,
                  isUnavailable && styles.cardUnavailableText,
                ]}
              >
                {loading
                  ? "…"
                  : isUnavailable
                  ? "Currently unavailable"
                  : `${count} ${count === 1 ? "item" : "items"}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.display.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  cardUnavailable: {
    opacity: 0.9,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: typography.body.bold,
    color: colors.text,
    textAlign: "center",
    lineHeight: 18,
  },
  cardCount: {
    fontSize: 12,
    fontFamily: typography.body.medium,
    color: colors.textMuted,
    marginTop: 3,
    textAlign: "center",
  },
  cardUnavailableText: {
    color: colors.primary,
    fontFamily: typography.body.semibold,
    fontSize: 11,
  },
});

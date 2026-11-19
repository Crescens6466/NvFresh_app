// CategoriesScreen.jsx — dynamic category list with product counts.
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
import { normalizeMobileCategory } from "../utils/categories.js";

const DEFAULT_MOBILE_CATS = [
  { name: "Chicken", icon: "food-drumstick", color: "#EF5350" },
  { name: "Mutton", icon: "food-steak", color: "#C62828" },
  { name: "Seafood", icon: "shrimp", color: "#EF6C00" },
];

function getCategoryIconMeta(name, icon) {
  const key = `${icon || ""} ${name || ""}`.toLowerCase();
  if (key.includes("chicken")) {
    return { iconType: "material", icon: "food-drumstick", color: "#EF5350" };
  }
  if (key.includes("mutton") || key.includes("meat") || key.includes("steak")) {
    return { iconType: "material", icon: "food-steak", color: "#C62828" };
  }
  if (key.includes("fish")) {
    return { iconType: "material", icon: "fish", color: "#0277BD" };
  }
  if (key.includes("seafood") || key.includes("shrimp") || key.includes("prawn")) {
    return { iconType: "fa6", icon: "shrimp", color: "#EF6C00" };
  }
  // Sensible default icon and color for admin-created dynamic categories
  return { iconType: "material", icon: "silverware-fork-knife", color: "#7B1FA2" };
}

export default function CategoriesScreen() {
  const [categories, setCategories] = useState(DEFAULT_MOBILE_CATS);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  // Balanced 2-column card width accounting for screen horizontal padding (12px * 2) and grid gap (10px)
  const screenWidth = width || 360;
  const cardWidth = Math.floor((screenWidth - spacing.md * 2 - 10) / 2);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [catsRes, productsRes] = await Promise.all([
        api.getCategories().catch(() => DEFAULT_MOBILE_CATS),
        api.getProducts().catch(() => []),
      ]);

      // Normalize and deduplicate dynamic categories for mobile
      if (Array.isArray(catsRes) && catsRes.length > 0) {
        const uniqueNames = [];
        const dynamicCats = [];

        for (const cat of catsRes) {
          const rawName = cat.name || "";
          const lower = rawName.toLowerCase();
          if (lower === "all" || lower === "country chicken" || lower === "country_chicken") {
            continue;
          }
          // On Android, Fish products are merged into Seafood; only show Seafood card
          if (lower === "fish") {
            continue;
          }

          const normalizedName = normalizeMobileCategory(rawName);
          if (normalizedName && !uniqueNames.includes(normalizedName)) {
            uniqueNames.push(normalizedName);
            const { iconType, icon, color } = getCategoryIconMeta(normalizedName, cat.icon);
            dynamicCats.push({
              name: normalizedName,
              iconType,
              icon,
              color,
            });
          }
        }

        if (dynamicCats.length > 0) {
          setCategories(dynamicCats);
        }
      }

      // Compute product counts using normalized categories
      if (Array.isArray(productsRes)) {
        const c = {};
        const seenIds = new Set();
        productsRes.forEach((p) => {
          const key = p && String(p.id || p._id || "");
          if (key) {
            if (seenIds.has(key)) return;
            seenIds.add(key);
          }
          // Count only products available for purchase (isAvailable !== false)
          if (p && p.isAvailable !== false && p.category) {
            const cat = normalizeMobileCategory(p.category);
            if (cat) {
              c[cat] = (c[cat] || 0) + 1;
            }
          }
        });
        setCounts(c);
      }
    } catch (err) {
      console.warn("[CategoriesScreen] Failed to load categories or product counts:", err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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
          onRefresh={() => loadData(true)}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Shop by Category</Text>
      <View style={styles.grid}>
        {categories.map(({ name, iconType, icon, color }) => {
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
                {iconType === "fa6" || icon === "shrimp" ? (
                  <FontAwesome6 name="shrimp" size={22} color={color} />
                ) : (
                  <MaterialCommunityIcons name={icon || "silverware-fork-knife"} size={22} color={color} />
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

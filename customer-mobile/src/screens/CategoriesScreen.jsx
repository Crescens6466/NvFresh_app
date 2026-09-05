// CategoriesScreen.jsx — ported from customer/src/pages/Categories.jsx.
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons, FontAwesome6} from "@expo/vector-icons";
import { api } from "../api.js";
import { navigate } from "../navigation/navigationRef.js";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const CATS = [
  { name: "Chicken", icon: "food-drumstick", color: "#EF5350" },
  { name: "Mutton", icon: "food-steak", color: "#C62828" },
  { name: "Fish", icon: "fish", color: "#0277BD" },
  { name: "Prawns", icon: "shrimp", color: "#EF6C00" },
  { name: "Country Chicken", icon: "food-drumstick-outline", color: "#AD1457" },
];

export default function CategoriesScreen() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    api.getProducts().then((products) => {
      const c = {};
      products.forEach((p) => {
        c[p.category] = (c[p.category] || 0) + 1;
      });
      setCounts(c);
    });
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Shop by Category</Text>
      <View style={styles.grid}>
        {CATS.map(({ name, icon, color }) => (
          <TouchableOpacity
            key={name}
            style={styles.card}
            onPress={() => navigate("Main", { screen: "Home", params: { category: name } })}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
               {icon === "shrimp" ? (
                <FontAwesome6 name="shrimp" size={26} color={color} />
                          ) : (
                   <MaterialCommunityIcons name={icon} size={26} color={color} />
            )}
            </View>
            <Text style={styles.cardTitle}>{name}</Text>
            <Text style={styles.cardCount}>{counts[name] || 0} items</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  title: { fontSize: 20, fontFamily: typography.display.extrabold, color: colors.text, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    ...shadow.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 14, fontFamily: typography.body.bold, color: colors.text, textAlign: "center" },
  cardCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

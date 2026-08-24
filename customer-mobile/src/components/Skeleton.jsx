// Skeleton.jsx — ported from customer/src/components/Skeleton.jsx: simple
// pulsing placeholders for loading states.
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius } from "../theme.js";

export function Skeleton({ style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.base, { opacity }, style]} />;
}

export function ProductGridSkeleton({ count = 6 }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton style={styles.image} />
          <Skeleton style={styles.line} />
          <Skeleton style={[styles.line, { width: "50%" }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.border, borderRadius: radius.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 12 },
  card: { width: "47%", marginBottom: 12 },
  image: { width: "100%", aspectRatio: 1, borderRadius: radius.md, marginBottom: 8 },
  line: { height: 14, width: "80%", marginTop: 6 },
});

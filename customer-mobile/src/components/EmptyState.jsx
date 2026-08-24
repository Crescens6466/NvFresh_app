// EmptyState.jsx — ported from the web app's repeated ".empty-state" blocks.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme.js";

export default function EmptyState({ icon, title, message, children }) {
  return (
    <View style={styles.wrap}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 64, paddingHorizontal: spacing.xl },
  title: { fontSize: 16, fontFamily: typography.display.bold, color: colors.text, marginTop: spacing.md },
  message: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});

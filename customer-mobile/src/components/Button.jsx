// Button.jsx — ported from the web app's .btn/.btn-primary/.btn-outline/.btn-ghost classes.
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const VARIANTS = {
  primary: { backgroundColor: colors.primary, borderWidth: 0, textColor: colors.white, shadow: shadow.md },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary, textColor: colors.primary },
  ghost: { backgroundColor: "transparent", borderWidth: 0, textColor: colors.textMuted },
};

export default function Button({ title, onPress, variant = "primary", disabled, loading, style, icon }) {
  const v = VARIANTS[variant] || VARIANTS.primary;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        { backgroundColor: v.backgroundColor, borderWidth: v.borderWidth, borderColor: v.borderColor },
        v.shadow,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={v.textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: v.textColor }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.sm,
    width: "100%",
  },
  disabled: { opacity: 0.6 },
  text: { fontFamily: typography.body.bold, fontSize: 15 },
});

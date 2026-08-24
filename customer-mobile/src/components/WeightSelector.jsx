// WeightSelector.jsx — styled replacement for the bare @react-native-picker/picker
// control, matching the website's `.product-card-select` pill styling. Purely a UI
// swap: it still just calls onChange(weight) so callers (ProductCard, ProductDetailsScreen)
// keep driving the existing addToCart/Buy Now flow unchanged.
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, typography } from "../theme.js";

export default function WeightSelector({ options, value, onChange, label = "Weight", size = "md" }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const compact = size === "sm";

  return (
    <>
      <Pressable
        style={[styles.trigger, compact && styles.triggerCompact]}
        onPress={(e) => {
          e.stopPropagation?.();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        <Text style={[styles.triggerText, compact && styles.triggerTextCompact]} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-down" size={compact ? 14 : 16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select {label}</Text>
            {options.map((opt) => {
              const active = opt === value;
              return (
                <Pressable
                  key={opt}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt}</Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  triggerCompact: { minHeight: 38, paddingVertical: 8 },
  triggerText: { flex: 1, fontFamily: typography.body.semibold, fontSize: 14, color: colors.text },
  triggerTextCompact: { fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(42, 27, 24, 0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontFamily: typography.display.bold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionActive: { borderBottomColor: colors.border },
  optionText: { fontFamily: typography.body.semibold, fontSize: 16, color: colors.text },
  optionTextActive: { color: colors.primary, fontFamily: typography.body.bold },
});

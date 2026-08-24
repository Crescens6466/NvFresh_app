// OrderSuccessScreen.jsx — ported from customer/src/pages/OrderSuccess.jsx.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Button from "../components/Button.jsx";
import { colors, spacing } from "../theme.js";

export default function OrderSuccessScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.screen}>
      <Ionicons name="checkmark-circle-outline" size={72} color={colors.success} />
      <Text style={styles.title}>Order Placed!</Text>
      <Text style={styles.message}>
        Thank you! Your advance payment has been recorded. Your order will be confirmed this
        Saturday and delivered fresh on Sunday morning — we'll reach out on your registered phone
        number if we need anything else.
      </Text>
      <Button
        title="Continue Shopping"
        onPress={() => navigation.reset({ index: 0, routes: [{ name: "Main" }] })}
        style={{ marginTop: spacing.xl, width: 220 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: spacing.lg },
  message: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: spacing.md, lineHeight: 19 },
});

// TermsScreen.jsx — opens the single official NvFresh Terms & Conditions on the website.
import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Button from "../components/Button.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

export const TERMS_URL = "https://www.nvfresh.in/terms";

export default function TermsScreen() {
  const { showToast } = useToast();
  const [opening, setOpening] = useState(false);

  async function handleOpenTerms() {
    if (opening) return;
    setOpening(true);
    try {
      await Linking.openURL(TERMS_URL);
    } catch {
      showToast("Unable to open the Terms & Conditions link.", "error");
      Alert.alert(
        "Unable to Open Link",
        `Please open the official NvFresh Terms & Conditions in your browser:\n\n${TERMS_URL}`
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Terms & Conditions" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="document-text-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.heading}>NvFresh Terms &amp; Conditions</Text>
          <Text style={styles.description}>
            The official NvFresh Terms &amp; Conditions are published online so you can
            always read the latest version covering our website and Android app.
          </Text>
          <Text style={styles.urlText} selectable>
            {TERMS_URL}
          </Text>
          <Button
            title="Read Terms & Conditions"
            onPress={handleOpenTerms}
            loading={opening}
            icon={<Ionicons name="open-outline" size={18} color={colors.white} />}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingTop: 0 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    ...shadow.sm,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: "#FFF1EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  heading: {
    fontSize: 17,
    fontFamily: typography.display.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 13,
    fontFamily: typography.body.regular,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  urlText: {
    fontSize: 12,
    fontFamily: typography.body.semibold,
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  button: {
    marginTop: spacing.xs,
  },
});

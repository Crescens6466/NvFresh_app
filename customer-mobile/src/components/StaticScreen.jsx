// StaticScreen.jsx — shared renderer for the plain-text policy pages
// (About/Privacy/Terms), ported from customer/src/pages/StaticPage.css's
// shared layout.
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenHeader from "./ScreenHeader.jsx";
import { colors, spacing } from "../theme.js";

export default function StaticScreen({ title, intro, sections }) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} />
      <ScrollView contentContainerStyle={styles.body}>
        {intro ? <Text style={styles.paragraph}>{intro}</Text> : null}
        {sections.map(({ heading, text }) => (
          <View key={heading} style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.paragraph}>{text}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingTop: 0 },
  section: { marginTop: spacing.lg },
  heading: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 6 },
  paragraph: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
});

// ContactScreen.jsx — ported from customer/src/pages/Contact.jsx.
import React, { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { api } from "../api.js";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Button from "../components/Button.jsx";
import { colors, radius, shadow, spacing } from "../theme.js";

const DEFAULT_SETTINGS = {
  phone: "+91 98765 43210",
  email: "support@nvfresh.in",
  address: "NvFresh Fulfilment Center, Vijayawada, Andhra Pradesh, India",
  supportHours: "Everyday, 7:00 AM – 9:00 PM",
  deliverySchedule: "Orders confirmed Saturday, delivered fresh every Sunday morning",
};
const WHATSAPP_MESSAGE = "Hi NvFresh, I have a question about my order.";

const ITEMS = [
  {
    icon: "call-outline",
    label: "Call Us",
    value: (s) => s.phone,
    getAction: (s) => (s.phone ? () => Linking.openURL(`tel:${s.phone}`) : undefined),
  },
  {
    icon: "mail-outline",
    label: "Email",
    value: (s) => s.email,
    getAction: (s) => (s.email ? () => Linking.openURL(`mailto:${s.email}`) : undefined),
  },
  {
    icon: "location-outline",
    label: "Address",
    value: (s) => s.address,
    getAction: () => undefined,
  },
  {
    icon: "time-outline",
    label: "Support Hours",
    value: (s) => s.supportHours,
    getAction: () => undefined,
  },
  {
    icon: "car-outline",
    label: "Delivery Day",
    value: (s) => s.deliverySchedule,
    getAction: () => undefined,
  },
];

export default function ContactScreen() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    api
      .getSettings()
      .then((s) => {
        if (active && s) {
          setSettings({
            phone: s.phone_number || s.phoneNumber || DEFAULT_SETTINGS.phone,
            email: s.support_email || s.supportEmail || DEFAULT_SETTINGS.email,
            address: s.business_address || s.businessAddress || DEFAULT_SETTINGS.address,
            supportHours: s.support_hours || s.supportHours || DEFAULT_SETTINGS.supportHours,
            deliverySchedule: s.delivery_schedule || s.deliverySchedule || DEFAULT_SETTINGS.deliverySchedule,
          });
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const whatsappNumber = settings.phone.replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Contact Us" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>Have a question about your order or our products? We're here to help.</Text>

        <Button
          title="Chat with us on WhatsApp"
          onPress={() => Linking.openURL(whatsappLink)}
          icon={<FontAwesome name="whatsapp" size={18} color={colors.white} />}
          style={{ marginBottom: spacing.lg }}
        />

        <View style={styles.list}>
          {ITEMS.map(({ icon, label, value, getAction }) => {
            const action = getAction(settings);
            return (
              <TouchableOpacity
                key={label}
                style={styles.item}
                activeOpacity={action ? 0.7 : 1}
                onPress={action}
              >
                <Ionicons name={icon} size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLabel}>{label}</Text>
                  <Text style={styles.itemValue}>{value(settings)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingTop: 0 },
  intro: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 19 },
  list: { backgroundColor: colors.card, borderRadius: radius.md, ...shadow.sm },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  itemValue: { fontSize: 14, color: colors.text, marginTop: 2 },
});

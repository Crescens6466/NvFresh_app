// PaymentScreen.jsx — ported from customer/src/pages/Payment.jsx.
import React, { useEffect, useState } from "react";
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api } from "../api.js";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Button from "../components/Button.jsx";
import { colors, radius, shadow, spacing } from "../theme.js";

const ADVANCE_OPTIONS = [25, 50, 75, 100];

export default function PaymentScreen() {
  const { items, clearCart } = useCart();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { profile, isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();

  const [settings, setSettings] = useState(null);
  const [advancePercentage, setAdvancePercentage] = useState(25);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    address: "",
    transactionId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      navigation.replace("Main", { screen: "Cart" });
      return;
    }
    if (!authLoading && !isLoggedIn) {
      navigation.replace("Login", { from: { name: "Payment" } });
      return;
    }
    api.getSettings().then(setSettings).catch(() => {});
  }, [authLoading, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (items.length === 0 || authLoading || !isLoggedIn) return;
    let cancelled = false;
    setQuoteLoading(true);
    getIdToken()
      .then((token) =>
        api.getOrderQuote(
          items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
          advancePercentage,
          token
        )
      )
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message || "Could not calculate payment amount", "error");
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancePercentage, authLoading, isLoggedIn, items.length]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.name || !form.phone || !form.address || !form.transactionId) {
      showToast("Please fill in all fields", "error");
      return;
    }
    if (!quote) {
      showToast("Please wait for the payment amount to load", "error");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getIdToken();
      await api.placeOrder(
        {
          customerName: form.name,
          phone: form.phone,
          address: form.address,
          items: items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
          advancePercentage,
          transactionId: form.transactionId,
        },
        token
      );
      clearCart();
      navigation.replace("OrderSuccess");
    } catch (err) {
      showToast(err.message || "Could not place order", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const isFullyPaid = advancePercentage === 100;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Advance Payment" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Pay a minimum of 25% advance to confirm your order — or pay more now, less on delivery.
          </Text>
        </View>

        <View style={styles.banner}>
          <Ionicons name="car-outline" size={16} color={colors.primary} />
          <Text style={styles.bannerText}>Orders confirmed Saturday, delivered fresh Sunday morning.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Order Total</Text>
            <Text style={styles.rowValue}>{quoteLoading && !quote ? "…" : `₹${quote?.total ?? 0}`}</Text>
          </View>

          <Text style={styles.chipLabel}>Choose Advance Payment</Text>
          <View style={styles.chipRow}>
            {ADVANCE_OPTIONS.map((pct) => (
              <TouchableOpacity
                key={pct}
                style={[styles.chip, advancePercentage === pct && styles.chipActive]}
                onPress={() => setAdvancePercentage(pct)}
              >
                <Text style={[styles.chipText, advancePercentage === pct && styles.chipTextActive]}>{pct}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.row, styles.rowHighlight]}>
            <Text style={styles.rowLabel}>Advance Amount ({advancePercentage}%)</Text>
            <Text style={styles.rowValueBig}>{quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Remaining Amount</Text>
            <Text style={styles.rowValue}>{quoteLoading ? "…" : `₹${quote?.remainingAmount ?? 0}`}</Text>
          </View>

          {!quoteLoading && quote && (
            <Text style={[styles.remainingNote, isFullyPaid && styles.remainingNoteFull]}>
              {isFullyPaid ? "Fully paid — Nothing due on delivery" : `₹${quote.remainingAmount} remaining — Pay on delivery`}
            </Text>
          )}
        </View>

        <View style={styles.qrCard}>
          <TouchableOpacity
            style={styles.qrBox}
            disabled={!quote?.upiUrl}
            onPress={() => quote?.upiUrl && Linking.openURL(quote.upiUrl)}
          >
            {quote?.qrDataUrl ? (
              <Image source={{ uri: quote.qrDataUrl }} style={styles.qrImage} />
            ) : (
              <Ionicons name="qr-code-outline" size={48} color={colors.textMuted} />
            )}
          </TouchableOpacity>
          <Text style={styles.qrLabel}>Scan to pay {quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`} via any UPI app</Text>
          {quote?.upiUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(quote.upiUrl)}>
              <Text style={styles.upiLink}>{settings?.upi_id || "nvfresh@upi"}</Text>
              <Text style={styles.upiHint}>Tap to pay in your UPI app</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.upiLink}>{settings?.upi_id || "nvfresh@upi"}</Text>
          )}
          <Text style={styles.phone}>Or pay to: {settings?.phone_number || "+91 98765 43210"}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Delivery Details</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={(v) => setField("name", v)} placeholder="Your name" placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setField("phone", v)} placeholder="10-digit mobile number" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
          <Text style={styles.label}>Delivery Address</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.address}
            onChangeText={(v) => setField("address", v)}
            placeholder="House no, street, area, city, pincode"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.label}>Transaction ID</Text>
          <TextInput style={styles.input} value={form.transactionId} onChangeText={(v) => setField("transactionId", v)} placeholder="UPI reference / transaction ID" placeholderTextColor={colors.textMuted} />

          <Button
            title={submitting ? "Placing Order..." : "Place Order"}
            onPress={handleSubmit}
            disabled={submitting || quoteLoading}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  notice: { backgroundColor: "#FFF1EC", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  noticeText: { fontSize: 12, color: colors.primaryDark, fontWeight: "600" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF1EC", padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  bannerText: { flex: 1, fontSize: 11, color: colors.primaryDark, fontWeight: "600" },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowHighlight: { marginTop: spacing.sm },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  rowValueBig: { fontSize: 16, fontWeight: "800", color: colors.primary },
  chipLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, alignItems: "center" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.white },
  remainingNote: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: spacing.sm, textAlign: "center" },
  remainingNoteFull: { color: colors.success },
  qrCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg, alignItems: "center", ...shadow.sm },
  qrBox: { width: 180, height: 180, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  qrImage: { width: "100%", height: "100%" },
  qrLabel: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, textAlign: "center" },
  upiLink: { fontSize: 14, fontWeight: "800", color: colors.primary, marginTop: spacing.sm, textAlign: "center" },
  upiHint: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
  phone: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  formCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg, ...shadow.sm },
  formTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 46, fontSize: 14, color: colors.text },
  textarea: { height: 80, paddingTop: 10, textAlignVertical: "top" },
});

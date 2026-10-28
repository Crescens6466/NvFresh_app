// PaymentScreen.jsx — ported from customer/src/pages/Payment.jsx.
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api, resolveImageUrl } from "../api.js";
import {
  isDeliveryAreaServiceable,
  formatServiceableAreaMessage,
  SERVICEABLE_AREA_ERROR_MESSAGE,
} from "../utils/serviceAreas.js";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Button from "../components/Button.jsx";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const ADVANCE_OPTIONS = [25, 50, 75, 100];

// Toggle to temporarily disable visible payment options while waiting for
// Razorpay / Cashfree merchant account approval. Set to false to restore.
const ONLINE_PAYMENTS_DISABLED = true;

export default function PaymentScreen() {
  const { items, clearCart } = useCart();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { profile, isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();

  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [advancePercentage, setAdvancePercentage] = useState(25);
  // Every amount shown (total, advance, remaining) comes from quote —
  // the backend recomputes totals from the database, never trusting a
  // frontend-calculated number.
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState("");
  // Pre-fill from a saved profile (faster checkout for returning customers) —
  // still fully editable.
  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    address: "",
    transactionId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    api
      .getDeliveryAreas()
      .then((data) => setDeliveryAreas(Array.isArray(data) ? data : []))
      .catch(() => setDeliveryAreas([]));
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      navigation.replace("Main", { screen: "Cart" });
      return;
    }
    // Checkout requires a signed-in customer — bounce to login and come
    // straight back here once they're done.
    if (!authLoading && !isLoggedIn) {
      navigation.replace("Login", { from: { name: "Payment" } });
      return;
    }
    setSettingsLoading(true);
    api.getSettings()
      .then((s) => {
        setSettings(s);
        setQrLoadFailed(false);
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, [authLoading, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetches the quote (totals + dynamic QR) whenever the advance % changes
  // — this never creates or touches an order, so switching between
  // 25/50/75/100% can't ever produce duplicate orders.
  useEffect(() => {
    if (items.length === 0 || authLoading || !isLoggedIn) return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError("");
    getIdToken()
      .then((token) =>
        api.getOrderQuote(
          items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
          advancePercentage,
          token
        )
      )
      .then((q) => {
        if (!cancelled) {
          setQuote(q);
          setQuoteError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(err.message || "Could not calculate payment amount");
          showToast(err.message || "Could not calculate payment amount", "error");
        }
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
    if (ONLINE_PAYMENTS_DISABLED) {
      showToast("We're working on secure online payments. Please check back soon.", "info");
      return;
    }
    if (!form.name || !form.phone || !form.address || !form.transactionId) {
      showToast("Please fill in all fields", "error");
      return;
    }
    const activeNames = deliveryAreas.length > 0 ? deliveryAreas.map((a) => a.name) : undefined;
    if (!isDeliveryAreaServiceable(form.address, activeNames)) {
      showToast(formatServiceableAreaMessage(activeNames), "error");
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
          transactionReference: quote.transactionReference,
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
  const activeAreaNames = deliveryAreas.length > 0 ? deliveryAreas.map((a) => a.name) : undefined;
  const isAddressServiceable = form.address.trim().length >= 3
    ? isDeliveryAreaServiceable(form.address, activeAreaNames)
    : null;

  function scrollToBottom() {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Advance Payment" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.container,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 40 },
          ]}
        >
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Pay a minimum of 25% advance to confirm your order — or pay more now, less on delivery.
          </Text>
        </View>

        <View style={styles.banner}>
          <Ionicons name="car-outline" size={16} color="#8A5A00" />
          <Text style={styles.bannerText}>
            Orders confirmed Saturday, delivered fresh Sunday morning.
          </Text>
        </View>

        <View style={styles.orderSummaryCard}>
          <View style={styles.orderSummaryHeader}>
            <Text style={styles.orderSummaryTitle}>Items in Order ({items.length})</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "Cart" })}>
              <Text style={styles.orderSummaryEdit}>Edit Cart</Text>
            </TouchableOpacity>
          </View>
          {items.map((item) => (
            <View key={item.key} style={styles.orderItemRow}>
              <Image source={{ uri: resolveImageUrl(item.image) }} style={styles.orderItemThumb} />
              <View style={styles.orderItemInfo}>
                <Text style={styles.orderItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.orderItemMeta}>{item.weight} × {item.quantity}</Text>
              </View>
              <Text style={styles.orderItemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
        </View>

        {quoteError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{quoteError}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => navigation.navigate("Main", { screen: "Cart" })}
            >
              <Text style={styles.errorButtonText}>Return to Cart</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Order Total</Text>
            <Text style={styles.rowValue}>{quoteLoading && !quote ? "…" : `₹${quote?.total ?? 0}`}</Text>
          </View>

          <View style={styles.advanceSelect}>
            <Text style={styles.advanceLabel}>Choose Advance Payment</Text>
            <View style={styles.advanceChips}>
              {ADVANCE_OPTIONS.map((pct) => {
                const isActive = advancePercentage === pct;
                return (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.advanceChip, isActive && styles.advanceChipActive]}
                    onPress={() => setAdvancePercentage(pct)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.advanceChipText, isActive && styles.advanceChipTextActive]}>
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.row, styles.rowHighlight]}>
            <Text style={styles.rowHighlightLabel}>Advance Amount ({advancePercentage}%)</Text>
            <Text style={styles.rowHighlightValue}>{quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Remaining Amount</Text>
            <Text style={styles.rowValue}>{quoteLoading ? "…" : `₹${quote?.remainingAmount ?? 0}`}</Text>
          </View>

          {!quoteLoading && quote && (
            <View style={styles.remainingNoteContainer}>
              <Text style={[styles.remainingNote, isFullyPaid && styles.remainingNoteFull]}>
                {isFullyPaid
                  ? "Fully paid — Nothing due on delivery"
                  : `₹${quote.remainingAmount} remaining — Pay on delivery`}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Section: Temporarily replaced with "Online Payments Coming Soon" while preserving original payment UI */}
        {ONLINE_PAYMENTS_DISABLED ? (
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonIconWrap}>
              <Ionicons name="card-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.comingSoonTitle}>Online Payments Coming Soon</Text>
            <Text style={styles.comingSoonMessage}>
              We're working on secure online payments. Please check back soon.
            </Text>
          </View>
        ) : (
          <View style={styles.qrCard}>
          <View style={styles.qrAmountSection}>
            <Text style={styles.qrAmountLabel}>Payment Amount</Text>
            <Text style={styles.qrAmountValue}>
              {quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`}
            </Text>
          </View>

          {settingsLoading ? (
            <View style={[styles.qrBox, styles.qrBoxLoading]}>
              <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 6 }} />
              <Text style={styles.qrLoadingText}>Loading QR...</Text>
            </View>
          ) : settings?.qr_image && !qrLoadFailed ? (
            <>
              <View style={[styles.qrBox, styles.qrBoxImage]}>
                <Image
                  source={{ uri: resolveImageUrl(settings.qr_image) }}
                  alt="Payment QR Code"
                  style={styles.qrImage}
                  resizeMode="contain"
                  onError={() => setQrLoadFailed(true)}
                />
              </View>
              <Text style={styles.qrInstruction}>
                Screenshot this QR and make the payment using your preferred UPI app.
              </Text>
            </>
          ) : (
            <View style={styles.qrFallback}>
              <Ionicons name="qr-code-outline" size={40} color={colors.textMuted} />
              <Text style={styles.qrFallbackText}>
                Payment QR is currently unavailable. Please contact support.
              </Text>
            </View>
          )}

          {settings?.upi_id ? (
            <Text style={styles.paymentUpi}>{settings.upi_id}</Text>
          ) : null}
          {settings?.phone_number ? (
            <Text style={styles.paymentPhone}>Or pay to: {settings.phone_number}</Text>
          ) : null}
        </View>

        )}

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Delivery Details</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={(v) => setField("phone", v)}
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            onFocus={scrollToBottom}
          />

          <Text style={styles.label}>Delivery Address</Text>
          <Text style={styles.serviceAreaNote}>
            Delivering only to Tadepalli, Kunchanapalli, Undavalli, and Nulakapeta
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.address}
            onChangeText={(v) => setField("address", v)}
            placeholder="House no, street, area (Tadepalli, Kunchanapalli, Undavalli, Nulakapeta)"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            scrollEnabled={false}
            returnKeyType="default"
            onFocus={scrollToBottom}
          />

          {isAddressServiceable === true && (
            <View style={styles.serviceableTagSuccess}>
              <Ionicons name="checkmark-circle" size={14} color="#2E7D32" />
              <Text style={styles.serviceableTagSuccessText}>Serviceable delivery area detected</Text>
            </View>
          )}
          {isAddressServiceable === false && (
            <View style={styles.serviceableTagWarning}>
              <Ionicons name="alert-circle-outline" size={14} color="#C62828" />
              <Text style={styles.serviceableTagWarningText}>
                Please include Tadepalli, Kunchanapalli, Undavalli, or Nulakapeta
              </Text>
            </View>
          )}

          {!ONLINE_PAYMENTS_DISABLED && (
            <>
              <Text style={styles.label}>Transaction ID</Text>
              <TextInput
                style={styles.input}
                value={form.transactionId}
                onChangeText={(v) => setField("transactionId", v)}
                placeholder="UPI reference / transaction ID"
                placeholderTextColor={colors.textMuted}
                onFocus={scrollToBottom}
              />
            </>
          )}

          {ONLINE_PAYMENTS_DISABLED ? (
            <>
              <Button
                title="Online Payments Coming Soon"
                disabled={true}
                style={{ marginTop: spacing.md }}
              />
              <Button
                title="Return to Cart"
                variant="outline"
                onPress={() => navigation.navigate("Main", { screen: "Cart" })}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : (
            <Button
              title={submitting ? "Placing Order..." : "Place Order"}
              onPress={handleSubmit}
              disabled={submitting || quoteLoading}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  notice: {
    backgroundColor: "#FFF3CD",
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  noticeText: {
    fontSize: 13,
    color: "#8A5A00",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF3CD",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  bannerText: {
    fontSize: 12,
    color: "#8A5A00",
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  errorCard: {
    backgroundColor: "#FDE7E7",
    borderWidth: 1,
    borderColor: "#F5C6CB",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 13,
    fontFamily: typography.body.bold,
    color: colors.primary,
    marginBottom: 8,
  },
  errorButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    backgroundColor: colors.card,
  },
  errorButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: typography.body.bold,
    color: colors.text,
  },
  advanceSelect: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: "dashed",
    marginTop: 4,
    paddingTop: 12,
  },
  advanceLabel: {
    fontSize: 11,
    fontFamily: typography.body.bold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  advanceChips: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  advanceChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  advanceChipActive: {
    backgroundColor: colors.primary,
    borderColor: "transparent",
    ...shadow.sm,
  },
  advanceChipText: {
    fontSize: 13,
    fontFamily: typography.body.bold,
    color: colors.text,
  },
  advanceChipTextActive: {
    color: colors.white,
  },
  rowHighlight: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: "dashed",
    marginTop: 4,
    paddingTop: 10,
  },
  rowHighlightLabel: {
    fontSize: 14,
    fontFamily: typography.body.bold,
    color: colors.primary,
  },
  rowHighlightValue: {
    fontSize: 16,
    fontFamily: typography.display.bold,
    color: colors.primary,
  },
  remainingNoteContainer: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
  },
  remainingNote: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  remainingNoteFull: {
    color: colors.success,
  },
  qrCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 20,
    marginBottom: spacing.xl,
    alignItems: "center",
    ...shadow.sm,
  },
  qrAmountSection: {
    width: "100%",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
  },
  qrAmountLabel: {
    fontSize: 12,
    fontFamily: typography.body.bold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  qrAmountValue: {
    fontSize: 28,
    fontFamily: typography.display.bold,
    color: colors.primary,
    lineHeight: 34,
  },
  qrBox: {
    width: 210,
    height: 210,
    maxWidth: "100%",
    marginBottom: 12,
    backgroundColor: "#ffffff",
    padding: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadow.sm,
  },
  qrBoxLoading: {
    backgroundColor: colors.bg,
    borderStyle: "dashed",
    elevation: 0,
    shadowOpacity: 0,
  },
  qrBoxImage: {},
  qrLoadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  qrImage: {
    width: "100%",
    height: "100%",
    borderRadius: radius.md - 6,
  },
  qrInstruction: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  qrFallback: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: 24,
    paddingHorizontal: 16,
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  qrFallbackText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  paymentUpi: {
    fontWeight: "800",
    fontSize: 16,
    fontFamily: typography.display.bold,
    color: colors.text,
    marginTop: 4,
    textAlign: "center",
  },
  paymentPhone: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 18,
    paddingHorizontal: 16,
    ...shadow.sm,
  },
  formTitle: {
    fontSize: 15,
    fontFamily: typography.display.bold,
    color: colors.text,
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontFamily: typography.body.bold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  serviceAreaNote: {
    fontSize: 11,
    fontFamily: typography.body.medium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  textarea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  comingSoonCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 24,
    marginBottom: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  comingSoonIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontFamily: typography.display.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  comingSoonMessage: {
    fontSize: 13,
    fontFamily: typography.body.medium,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  orderSummaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  orderSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderSummaryTitle: {
    fontSize: 13,
    fontFamily: typography.body.bold,
    color: colors.text,
  },
  orderSummaryEdit: {
    fontSize: 12,
    fontFamily: typography.body.semibold,
    color: colors.primary,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: spacing.sm,
  },
  orderItemThumb: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 13,
    fontFamily: typography.body.semibold,
    color: colors.text,
  },
  orderItemMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  orderItemPrice: {
    fontSize: 13,
    fontFamily: typography.body.bold,
    color: colors.text,
  },
  serviceableTagSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  serviceableTagSuccessText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2E7D32",
  },
  serviceableTagWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDE7E7",
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  serviceableTagWarningText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#C62828",
    flexShrink: 1,
  },
});

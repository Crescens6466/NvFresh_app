// PaymentScreen.jsx — Native Razorpay Standard Checkout
import React, { useEffect, useRef, useState } from "react";
import {
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
import RazorpayCheckout from "react-native-razorpay";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api, resolveImageUrl } from "../api.js";
import {
  isDeliveryAreaServiceable,
  formatServiceableAreaMessage,
} from "../utils/serviceAreas.js";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Button from "../components/Button.jsx";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const ADVANCE_OPTIONS = [25, 50, 75, 100];

export default function PaymentScreen() {
  const { items, clearCart } = useCart();
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { profile, isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();

  const [advancePercentage, setAdvancePercentage] = useState(25);

  // Authoritative quote recomputed by backend from database prices
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef(null);

  // Sync saved profile details when loaded
  useEffect(() => {
    if (profile) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || profile.name || "",
        phone: prev.phone || profile.phone || "",
      }));
    }
  }, [profile]);

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
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("CartMain");
      return;
    }
    // Checkout requires a signed-in customer
    if (!authLoading && !isLoggedIn) {
      const rootNav = navigation.getParent()?.getParent();
      if (rootNav?.navigate) {
        rootNav.navigate("Login", { from: { name: "Main", params: { screen: "Cart", params: { screen: "Payment" } } } });
      } else {
        navigation.navigate("Login", { from: { name: "Main", params: { screen: "Cart", params: { screen: "Payment" } } } });
      }
    }
  }, [authLoading, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetches the quote (totals + advance amount) whenever the advance % changes
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

  // --- Native Razorpay Standard Checkout ---
  async function handleRazorpayCheckout() {
    if (submitting) return;

    const trimmedName = (form.name || "").trim();
    const trimmedPhone = (form.phone || "").trim();
    const trimmedAddress = (form.address || "").trim();

    if (!trimmedName || !trimmedPhone || !trimmedAddress) {
      showToast("Please enter your name, phone number, and delivery address", "error");
      return;
    }
    if (trimmedPhone.length < 10) {
      showToast("Please enter a valid 10-digit mobile number", "error");
      return;
    }

    const activeNames = deliveryAreas.length > 0 ? deliveryAreas.map((a) => a.name) : undefined;
    if (!isDeliveryAreaServiceable(trimmedAddress, activeNames)) {
      showToast(formatServiceableAreaMessage(activeNames), "error");
      return;
    }
    if (!quote || quoteLoading) {
      showToast("Please wait for the payment amount to load", "error");
      return;
    }

    setSubmitting(true);
    setPaymentError("");
    try {
      const token = await getIdToken();
      const createOrderPayload = {
        items: items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
        advancePercentage,
        customerName: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
        amount: Math.round(quote.advanceAmount * 100),
      };

      const razorpayOrder = await api.createRazorpayOrder(createOrderPayload, token);
      const rzpOrderId = razorpayOrder?.order_id || razorpayOrder?.orderId;
      if (!rzpOrderId) {
        throw new Error("Could not initialize payment order.");
      }

      let rzpKey = razorpayOrder?.key_id || razorpayOrder?.keyId;
      if (!rzpKey) {
        const config = await api.getRazorpayConfig();
        rzpKey = config?.key_id || config?.keyId;
      }
      if (!rzpKey) {
        throw new Error("Payment gateway Key ID is not configured on the server.");
      }

      const options = {
        key: rzpKey,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        name: "NvFresh",
        description: advancePercentage === 100 ? "Full Payment (100%)" : `Advance Payment (${advancePercentage}%)`,
        order_id: rzpOrderId,
        prefill: {
          name: trimmedName,
          contact: trimmedPhone,
          email: profile?.email || "",
        },
        notes: {
          address: trimmedAddress,
        },
        theme: {
          color: "#C62828",
        },
      };

      RazorpayCheckout.open(options)
        .then(async (response) => {
          try {
            setSubmitting(true);
            setPaymentError("");
            const verifyToken = await getIdToken();
            await api.verifyRazorpayPayment(
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderData: {
                  customerName: trimmedName,
                  phone: trimmedPhone,
                  address: trimmedAddress,
                  items: items.map((i) => ({ productId: i.productId, weight: i.weight, quantity: i.quantity })),
                  advancePercentage,
                },
              },
              verifyToken
            );

            clearCart();
            showToast("Payment verified! Order placed successfully.", "success");
            const rootNav = navigation.getParent()?.getParent();
            if (rootNav?.navigate) {
              navigation.goBack();
              rootNav.navigate("OrderSuccess");
            } else {
              navigation.navigate("OrderSuccess");
            }
          } catch (verifyErr) {
            console.error("[payment] Native verification failed:", verifyErr);
            const msg = verifyErr.message || "Payment verification failed. Please contact support.";
            setPaymentError(msg);
            showToast(msg, "error");
            setSubmitting(false);
          }
        })
        .catch((error) => {
          setSubmitting(false);
          const description = error?.description || error?.reason || error?.message || "";
          const isDismissed =
            error?.code === 0 ||
            error?.code === 2 ||
            /cancelled|dismissed|closed/i.test(description);

          if (isDismissed) {
            const msg = "Payment window closed. Tap below to retry your payment.";
            setPaymentError(msg);
            showToast(msg, "info");
          } else {
            const msg = description
              ? `Payment failed: ${description}`
              : "Payment was not completed. Please try again.";
            setPaymentError(msg);
            showToast(msg, "error");
          }
        });
    } catch (err) {
      setSubmitting(false);
      const msg = err.message || "Could not launch Razorpay checkout. Please try again.";
      setPaymentError(msg);
      showToast(msg, "error");
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
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 80 },
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

          {/* Items in order */}
          <View style={styles.orderSummaryCard}>
            <View style={styles.orderSummaryHeader}>
              <Text style={styles.orderSummaryTitle}>Items in Order ({items.length})</Text>
              <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("CartMain"))}>
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
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("CartMain"))}
              >
                <Text style={styles.errorButtonText}>Return to Cart</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Pricing & Advance Selector */}
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

          {/* Razorpay Online Payment Summary */}
          <View style={styles.onlinePaymentCard}>
            <View style={styles.onlinePaymentBadge}>
              <Ionicons name="shield-checkmark" size={18} color="#2E7D32" />
              <Text style={styles.onlinePaymentBadgeText}>Pay Online via Razorpay</Text>
            </View>

            <Text style={styles.onlinePaymentAmount}>
              {quoteLoading ? "…" : `₹${quote?.advanceAmount ?? 0}`}
            </Text>
            <Text style={styles.onlinePaymentSub}>
              {isFullyPaid
                ? "Full Payment (100%)"
                : `${advancePercentage}% Advance Payment`}
            </Text>

            <View style={styles.onlinePaymentMethodsRow}>
              <View style={styles.paymentPill}>
                <Ionicons name="flash-outline" size={12} color="#8A5A00" />
                <Text style={styles.paymentPillText}>UPI / GPay / PhonePe</Text>
              </View>
              <View style={styles.paymentPill}>
                <Ionicons name="card-outline" size={12} color="#1565C0" />
                <Text style={styles.paymentPillText}>Cards & NetBanking</Text>
              </View>
            </View>

            <Text style={styles.onlinePaymentSecurityNote}>
              Secured by Razorpay 256-bit encryption. Tap below to complete your payment.
            </Text>
          </View>

          {/* Delivery Details Form */}
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

            {paymentError ? (
              <View style={styles.paymentErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#C62828" />
                <Text style={styles.paymentErrorText}>{paymentError}</Text>
              </View>
            ) : null}

            <Button
              title={
                submitting
                  ? "Processing..."
                  : quoteLoading
                  ? "Calculating..."
                  : paymentError
                  ? `Retry Payment — ₹${quote?.advanceAmount ?? 0}`
                  : `Pay ₹${quote?.advanceAmount ?? 0} Online`
              }
              onPress={handleRazorpayCheckout}
              disabled={submitting || quoteLoading}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: 0, paddingBottom: 80 },
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
  onlinePaymentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 20,
    marginBottom: spacing.xl,
    alignItems: "center",
    ...shadow.sm,
  },
  onlinePaymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  onlinePaymentBadgeText: {
    fontSize: 12,
    fontFamily: typography.body.bold,
    color: "#2E7D32",
  },
  onlinePaymentAmount: {
    fontSize: 32,
    fontFamily: typography.display.bold,
    color: colors.primary,
    lineHeight: 38,
  },
  onlinePaymentSub: {
    fontSize: 13,
    fontFamily: typography.body.medium,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  onlinePaymentMethodsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  paymentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  paymentPillText: {
    fontSize: 11,
    fontFamily: typography.body.semibold,
    color: colors.text,
  },
  onlinePaymentSecurityNote: {
    fontSize: 11,
    fontFamily: typography.body.medium,
    color: colors.textMuted,
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
  paymentErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE7E7",
    borderWidth: 1,
    borderColor: "#F5C6CB",
    borderRadius: radius.sm,
    padding: 10,
    marginTop: spacing.md,
  },
  paymentErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.body.semibold,
    color: "#C62828",
    lineHeight: 17,
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

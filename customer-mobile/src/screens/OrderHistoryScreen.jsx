// OrderHistoryScreen.jsx — ported from customer/src/pages/OrderHistory.jsx.
import React, { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api } from "../api.js";
import { Skeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import {
  isSundayInIndia,
  SUNDAY_CANCELLATION_ERROR_MESSAGE,
} from "../utils/cancellationPolicy.js";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

const STATUS_COLORS = {
  Pending: colors.accent,
  Confirmed: colors.primary,
  Delivered: colors.success,
  Cancelled: colors.textMuted,
  Paid: colors.success,
  Unpaid: colors.accent,
};

export default function OrderHistoryScreen() {
  const navigation = useNavigation();
  const { isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      navigation.replace("Login", { from: { name: "OrderHistory" } });
      return;
    }
    getIdToken()
      .then((token) => api.getMyOrders(token))
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelOrder = (orderId) => {
    if (isSundayInIndia()) {
      Alert.alert("Cancellation Unavailable", SUNDAY_CANCELLATION_ERROR_MESSAGE);
      return;
    }
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order? Eligible cancellations before the cutoff will receive a refund of the advance payment.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCancellingId(orderId);
              const token = await getIdToken();
              const updated = await api.cancelOrder(orderId, "Cancelled by customer", token);
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === orderId
                    ? {
                        ...o,
                        ...updated,
                        status: "Cancelled",
                        cancellation_reason: updated.cancellation_reason || "Cancelled by customer",
                        can_cancel: false,
                      }
                    : o
                )
              );
            } catch (err) {
              Alert.alert("Cancellation Error", err.message || "Failed to cancel order.");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const isSunday = isSundayInIndia();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="My Orders" />
      {loading ? (
        <Skeleton style={{ height: 120, marginHorizontal: spacing.lg }} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="clipboard-outline" size={40} color={colors.textMuted} />}
          title="No orders yet"
          message="Your placed orders will show up here."
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          renderItem={({ item: o }) => {
            const isActive = o.status !== "Cancelled" && o.status !== "Delivered";
            return (
              <View style={styles.card}>
                <View style={styles.top}>
                  <Text style={styles.id}>#{o.id.slice(-6)}</Text>
                  <View style={styles.pills}>
                    <Text style={[styles.pill, { backgroundColor: `${STATUS_COLORS[o.advance_payment_status] || colors.textMuted}22`, color: STATUS_COLORS[o.advance_payment_status] || colors.textMuted }]}>
                      {o.advance_payment_status}
                    </Text>
                    <Text style={[styles.pill, { backgroundColor: `${STATUS_COLORS[o.status] || colors.textMuted}22`, color: STATUS_COLORS[o.status] || colors.textMuted }]}>
                      {o.status}
                    </Text>
                  </View>
                </View>
                {o.status === "Cancelled" && o.cancellation_reason && (
                  <Text style={styles.cancelReason}>Reason: {o.cancellation_reason}</Text>
                )}
                {o.items.map((item, i) => (
                  <Text key={i} style={styles.itemLine}>
                    {item.name} — {item.weight} × {item.quantity}
                  </Text>
                ))}
                <View style={styles.bottom}>
                  <Text style={styles.bottomText}>Total: ₹{o.total}</Text>
                  <Text style={styles.bottomText}>
                    Advance paid ({o.advance_percentage}%): ₹{o.advance_paid}
                  </Text>
                </View>
                <Text style={[styles.remaining, o.remaining_amount === 0 && styles.remainingFull]}>
                  {o.remaining_amount === 0 ? "Fully paid — Nothing due on delivery" : `₹${o.remaining_amount} remaining — Pay on delivery`}
                </Text>

                {isActive && (
                  <View style={styles.actionContainer}>
                    {isSunday ? (
                      <View style={styles.cutoffNoteBox}>
                        <Ionicons name="information-circle-outline" size={16} color="#92400E" />
                        <Text style={styles.cutoffNoteText}>
                          Orders cannot be cancelled on Sunday. The cancellation window closes on Saturday at 11:59 PM.
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelOrder(o.id)}
                        disabled={cancellingId === o.id}
                      >
                        <Text style={styles.cancelButtonText}>
                          {cancellingId === o.id ? "Cancelling..." : "Cancel Order"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow.sm },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  id: { fontSize: 13, fontFamily: typography.body.bold, color: colors.text },
  pills: { flexDirection: "row", gap: 6 },
  pill: { fontSize: 10, fontFamily: typography.body.bold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  cancelReason: { fontSize: 12, color: colors.primary, marginTop: spacing.sm },
  itemLine: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  bottomText: { fontSize: 12, fontFamily: typography.body.semibold, color: colors.text },
  remaining: { fontSize: 12, fontFamily: typography.body.bold, color: colors.primary, marginTop: spacing.sm },
  remainingFull: { color: colors.success },
  actionContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  cancelButtonText: {
    color: "#B91C1C",
    fontSize: 12,
    fontFamily: typography.body.bold,
  },
  cutoffNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 6,
  },
  cutoffNoteText: {
    fontSize: 11,
    color: "#92400E",
    fontFamily: typography.body.medium,
    flex: 1,
    lineHeight: 15,
  },
});

// OrderHistoryScreen.jsx — ported from customer/src/pages/OrderHistory.jsx.
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { api } from "../api.js";
import { Skeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
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
          renderItem={({ item: o }) => (
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
            </View>
          )}
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
});

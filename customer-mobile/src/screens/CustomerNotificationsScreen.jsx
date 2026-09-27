import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useCustomerNotifications } from "../context/CustomerNotificationsContext.jsx";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import { colors, radius, shadow, spacing, typography } from "../theme.js";

export default function CustomerNotificationsScreen() {
  const navigation = useNavigation();
  const { isLoggedIn, loading: authLoading, getIdToken } = useCustomerAuth();
  const { refreshUnreadCount, requestNotificationPermission } = useCustomerNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const result = await api.getCustomerNotifications(token);
      setNotifications(Array.isArray(result) ? result : []);
      refreshUnreadCount();
    } catch (loadError) {
      setError(loadError.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, refreshUnreadCount]);

  useFocusEffect(useCallback(() => {
    if (authLoading) return undefined;
    if (!isLoggedIn) {
      navigation.replace("Login", { from: { name: "CustomerNotifications" } });
      return undefined;
    }
    loadNotifications();
    return undefined;
  }, [authLoading, isLoggedIn, loadNotifications, navigation]));

  const markRead = useCallback(async (notification) => {
    if (notification.isRead) return;
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      await api.markCustomerNotificationRead(notification.id, token);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, isRead: true } : item
      )));
      refreshUnreadCount();
    } catch (markError) {
      setError(markError.message || "Could not mark this notification as read.");
    }
  }, [getIdToken, refreshUnreadCount]);

  const markAllRead = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      await api.markAllCustomerNotificationsRead(token);
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      refreshUnreadCount();
    } catch (markError) {
      setError(markError.message || "Could not mark notifications as read.");
    }
  }, [getIdToken, refreshUnreadCount]);

  const enableNotifications = useCallback(async () => {
    setPermissionBusy(true);
    setError("");
    try {
      const granted = await requestNotificationPermission();
      if (!granted) setError("Notifications are disabled. Allow them in Android settings to receive order updates.");
    } catch (permissionError) {
      setError(permissionError.message || "Could not enable notifications.");
    } finally {
      setPermissionBusy(false);
    }
  }, [requestNotificationPermission]);

  const openNotification = useCallback(async (notification) => {
    await markRead(notification);
    if (notification.orderId != null && notification.orderId !== "") {
      navigation.navigate("OrderHistory", { orderId: notification.orderId });
    }
  }, [markRead, navigation]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifications" />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.permissionButton} onPress={enableNotifications} disabled={permissionBusy} accessibilityRole="button">
          {permissionBusy ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="notifications-outline" size={17} color={colors.white} />}
          <Text style={styles.permissionText}>{permissionBusy ? "Enabling…" : "Enable push notifications"}</Text>
        </TouchableOpacity>
        {notifications.some((item) => !item.isRead) && (
          <TouchableOpacity onPress={markAllRead} style={styles.readAllButton} accessibilityRole="button">
            <Text style={styles.readAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />}
          title="No notifications yet"
          message="Order updates and other alerts will appear here."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.isRead && styles.unreadCard]}>
              <TouchableOpacity onPress={() => openNotification(item)} accessibilityRole="button" accessibilityLabel={item.orderId ? `${item.title}. Open order history` : item.title}>
                <View style={styles.titleRow}>
                  <View style={[styles.indicator, item.isRead && styles.readIndicator]} />
                  <Text style={styles.title}>{item.title}</Text>
                </View>
                {item.type ? <Text style={styles.type}>{item.type}</Text> : null}
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
                {item.orderId != null && item.orderId !== "" && (
                  <Text style={styles.orderLink}>View order updates</Text>
                )}
              </TouchableOpacity>
              {!item.isRead && (
                <TouchableOpacity onPress={() => markRead(item)} style={styles.markReadButton} accessibilityRole="button" accessibilityLabel="Mark notification as read">
                  <Text style={styles.markReadText}>Mark read</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  permissionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, minHeight: 40, paddingHorizontal: spacing.md },
  permissionText: { color: colors.white, fontSize: 12, fontFamily: typography.body.semibold },
  readAllButton: { padding: spacing.sm },
  readAllText: { fontSize: 12, color: colors.primary, fontFamily: typography.body.semibold },
  error: { color: colors.primary, fontSize: 12, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  loader: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow.sm },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  indicator: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  readIndicator: { backgroundColor: colors.border },
  title: { flex: 1, fontSize: 14, fontFamily: typography.body.bold, color: colors.text },
  type: { fontSize: 10, textTransform: "uppercase", color: colors.primary, marginLeft: spacing.lg, marginTop: 2 },
  message: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: spacing.sm },
  timestamp: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  orderLink: { fontSize: 12, color: colors.primary, fontFamily: typography.body.semibold, marginTop: spacing.sm },
  markReadButton: { alignSelf: "flex-end", paddingVertical: spacing.sm, paddingLeft: spacing.md },
  markReadText: { fontSize: 12, color: colors.primary, fontFamily: typography.body.semibold },
});

import { navigationRef } from "./navigationRef.js";

let pendingOrderId = null;

export function openOrderHistoryFromNotification(orderId) {
  if (orderId == null || orderId === "") return;
  if (!navigationRef.isReady()) {
    pendingOrderId = orderId;
    return;
  }
  navigationRef.navigate("OrderHistory", { orderId });
}

export function flushPendingNotificationNavigation() {
  if (pendingOrderId == null || !navigationRef.isReady()) return;
  const orderId = pendingOrderId;
  pendingOrderId = null;
  navigationRef.navigate("OrderHistory", { orderId });
}

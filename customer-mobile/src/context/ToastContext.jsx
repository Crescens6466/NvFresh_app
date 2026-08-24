// ToastContext.jsx — same showToast(message, type) API as
// customer/src/context/ToastContext.jsx, rendered as an Animated toast stack
// instead of a DOM toast stack.
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing } from "../theme.js";

const ToastContext = createContext(null);

const TYPE_COLORS = {
  success: colors.success,
  error: colors.primary,
};

function Toast({ message, type }) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: TYPE_COLORS[type] || colors.text, opacity },
      ]}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.stack} pointerEvents="none">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  stack: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 100,
    alignItems: "center",
  },
  toast: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    ...shadow.md,
  },
  toastText: {
    color: colors.white,
    fontWeight: "600",
    textAlign: "center",
  },
});

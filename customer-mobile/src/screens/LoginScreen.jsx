// LoginScreen.jsx — ported from customer/src/pages/Login.jsx.
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import Button from "../components/Button.jsx";
import { colors, radius, spacing } from "../theme.js";

export default function LoginScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { loginWithGoogle, sendOtp, verifyOtp } = useCustomerAuth();
  const { showToast } = useToast();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function afterLogin() {
    showToast("Signed in successfully");
    const from = route.params?.from;
    if (from) navigation.replace(from.name, from.params);
    else navigation.replace("Main", { screen: "Profile" });
  }

  async function handleSendOtp() {
    if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
      showToast("Enter a valid 10-digit mobile number", "error");
      return;
    }
    setSending(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
      showToast("OTP sent via SMS");
    } catch (err) {
      showToast(err.message || "Could not send OTP", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp) {
      showToast("Enter the OTP", "error");
      return;
    }
    setVerifying(true);
    try {
      await verifyOtp(phone, otp);
      afterLogin();
    } catch (err) {
      showToast(err.message || "Invalid OTP", "error");
    } finally {
      setVerifying(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      afterLogin();
    } catch (err) {
      showToast(err.message || "Google sign-in failed", "error");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Sign In" />
      <Text style={styles.subtitle}>Sign in to place orders and track your order status.</Text>

      <Button
        title={googleLoading ? "Signing in..." : "Continue with Google"}
        variant="outline"
        onPress={handleGoogle}
        disabled={googleLoading}
        icon={<Ionicons name="logo-google" size={18} color={colors.primary} />}
        style={styles.section}
      />

      <View style={[styles.divider, styles.section]}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {!otpSent ? (
        <View style={styles.section}>
          <Text style={styles.label}>Mobile Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={10}
          />
          <Button
            title={sending ? "Sending OTP..." : "Send OTP via SMS"}
            onPress={handleSendOtp}
            disabled={sending}
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.label}>Enter OTP (sent via SMS)</Text>
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            placeholder="6-digit code"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button title={verifying ? "Verifying..." : "Verify OTP"} onPress={handleVerifyOtp} disabled={verifying} style={{ marginTop: spacing.md }} />
          <Button title="Change number" variant="ghost" onPress={() => setOtpSent(false)} style={{ marginTop: spacing.sm }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  subtitle: { paddingHorizontal: spacing.lg, color: colors.textMuted, fontSize: 13 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
  },
});

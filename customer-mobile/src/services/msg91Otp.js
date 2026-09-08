import { OTPWidget } from "@msg91comm/sendotp-react-native";

let initializationPromise = null;
let currentReqId = null;

function getConfig() {
  const widgetId = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID;
  const tokenAuth = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH;

  if (!widgetId || !tokenAuth) {
    throw new Error("Phone sign-in isn't set up yet — please check back soon.");
  }

  return { widgetId, tokenAuth };
}

async function ensureInitialized() {
  if (!initializationPromise) {
    const { widgetId, tokenAuth } = getConfig();
    initializationPromise = OTPWidget.initializeWidget(widgetId, tokenAuth).catch((err) => {
      initializationPromise = null;
      throw err;
    });
  }

  await initializationPromise;
}

function reqIdFrom(result) {
  const reqId =
    result?.message ||
    result?.reqId ||
    result?.data?.message ||
    result?.data?.reqId;

  if (!reqId || typeof reqId !== "string") {
    throw new Error("Could not send OTP right now — please try again shortly");
  }

  return reqId;
}

function accessTokenFrom(result) {
  const token =
    result?.accessToken ||
    result?.access_token ||
    result?.token ||
    result?.message ||
    result?.data?.accessToken ||
    result?.data?.access_token ||
    result?.data?.token ||
    result?.data?.message;

  if (!token || typeof token !== "string") {
    throw new Error("Invalid OTP");
  }

  return token;
}

export async function sendMsg91Otp(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    throw new Error("Enter a valid 10-digit mobile number");
  }

  await ensureInitialized();
  const result = await OTPWidget.sendOTP({ identifier: `91${digits}` });
  currentReqId = reqIdFrom(result);
  return result;
}

export async function retryMsg91Otp() {
  if (!currentReqId) {
    throw new Error("Phone sign-in is unavailable right now — please try again shortly");
  }

  await ensureInitialized();
  const result = await OTPWidget.retryOTP({ reqId: currentReqId, retryChannel: 11 });

  if (result?.message || result?.reqId || result?.data?.message || result?.data?.reqId) {
    currentReqId = reqIdFrom(result);
  }

  return result;
}

export async function verifyMsg91Otp(code) {
  const otp = String(code || "").trim();
  if (!currentReqId || !otp) {
    throw new Error("Invalid OTP");
  }

  await ensureInitialized();
  const result = await OTPWidget.verifyOTP({ reqId: currentReqId, otp });
  return accessTokenFrom(result);
}

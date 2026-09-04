const MSG91_SCRIPT_SRC = "https://verify.msg91.com/otp-provider.js";
const SDK_TIMEOUT_MS = 20_000;

let sdkPromise = null;
let currentReqId = null;

function phoneIdentifier(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    throw new Error("Enter a valid 10-digit mobile number");
  }
  return `91${digits}`;
}

function sdkError(action) {
  if (action === "send") return new Error("Could not send OTP right now — please try again shortly");
  if (action === "verify") return new Error("Invalid OTP");
  return new Error("Phone sign-in is unavailable right now — please try again shortly");
}

function getConfig() {
  const widgetId = import.meta.env.VITE_MSG91_WIDGET_ID;
  const tokenAuth = import.meta.env.VITE_MSG91_TOKEN_AUTH;
  if (!widgetId || !tokenAuth) {
    throw new Error("Phone sign-in isn't set up yet — please check back soon.");
  }
  return { widgetId, tokenAuth };
}

function loadSdk() {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const { widgetId, tokenAuth } = getConfig();
    const loadTimeout = window.setTimeout(() => reject(sdkError()), SDK_TIMEOUT_MS);
    const fail = () => {
      window.clearTimeout(loadTimeout);
      reject(sdkError());
    };
    const initialize = () => {
      if (typeof window.initSendOTP !== "function") {
        fail();
        return;
      }
      try {
        window.initSendOTP({
          widgetId,
          tokenAuth,
          exposeMethods: true,
          captchaRenderId: "",
          // The exposed methods below still receive their own callbacks.
          // These no-ops satisfy the SDK's configuration callback contract
          // without exposing any verification data in the console.
          success: () => {},
          failure: () => {},
        });
        const waitForWidget = () => {
          const widgetData = typeof window.getWidgetData === "function"
            ? window.getWidgetData()
            : null;
          if (widgetData?.widgetId) {
            window.clearTimeout(loadTimeout);
            resolve();
            return;
          }
          if (typeof window.getWidgetData !== "function") {
            window.setTimeout(waitForWidget, 25);
            return;
          }
          window.setTimeout(waitForWidget, 25);
        };
        waitForWidget();
      } catch {
        fail();
      }
    };

    const existing = document.querySelector(`script[src="${MSG91_SCRIPT_SRC}"]`);
    if (existing) {
      if (typeof window.initSendOTP === "function") initialize();
      else {
        existing.addEventListener("load", initialize, { once: true });
        existing.addEventListener("error", fail, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = MSG91_SCRIPT_SRC;
    script.async = true;
    script.onload = initialize;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((err) => {
    sdkPromise = null;
    throw err;
  });

  return sdkPromise;
}

async function callSdk(method, invoke, action) {
  await loadSdk();
  if (typeof window[method] !== "function") throw sdkError();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(sdkError(action)), SDK_TIMEOUT_MS);
    const succeed = (data) => {
      window.clearTimeout(timeout);
      resolve(data);
    };
    const fail = () => {
      window.clearTimeout(timeout);
      reject(sdkError(action));
    };

    try {
      invoke(succeed, fail);
    } catch {
      fail();
    }
  });
}

function accessTokenFrom(result) {
  const token =
    result?.accessToken ||
    result?.access_token ||
    result?.token ||
    result?.message ||
    result?.data?.accessToken ||
    result?.data?.access_token ||
    result?.data?.token;
  if (!token || typeof token !== "string") throw sdkError("verify");
  return token;
}

function reqIdFrom(result) {
  const reqId =
    result?.message ||
    result?.reqId ||
    result?.data?.message ||
    result?.data?.reqId;
  if (!reqId || typeof reqId !== "string") throw sdkError("send");
  return reqId;
}

export async function sendMsg91Otp(phone) {
  const identifier = phoneIdentifier(phone);
  const result = await callSdk(
    "sendOtp",
    (success, failure) => window.sendOtp(identifier, success, failure),
    "send"
  );
  currentReqId = reqIdFrom(result);
  return result;
}

export async function retryMsg91Otp() {
  if (!currentReqId) throw sdkError("send");
  const result = await callSdk(
    "retryOtp",
    (success, failure) => window.retryOtp("11", success, failure, currentReqId),
    "send"
  );
  if (result?.message || result?.reqId || result?.data?.message || result?.data?.reqId) {
    currentReqId = reqIdFrom(result);
  }
  return result;
}

export async function verifyMsg91Otp(code) {
  const otp = String(code || "").trim();
  if (!currentReqId) throw sdkError("verify");
  const result = await callSdk(
    "verifyOtp",
    (success, failure) => window.verifyOtp(otp, success, failure, currentReqId),
    "verify"
  );
  return accessTokenFrom(result);
}

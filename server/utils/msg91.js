const VERIFY_ACCESS_TOKEN_URL = "https://api.msg91.com/api/v5/widget/verifyAccessToken";
const REQUEST_TIMEOUT_MS = 10_000;

function verificationFailed() {
  return new Error("MSG91 access token verification failed");
}

function verifiedPhone(response) {
  const values = [
    response?.mobile,
    response?.phone,
    response?.identifier,
    response?.message,
    response?.data?.mobile,
    response?.data?.phone,
    response?.data?.identifier,
    response?.data?.phoneNumber,
  ];
  return values.find((value) => typeof value === "string" || typeof value === "number") || null;
}

// MSG91 OTP Widget's server-side Verify Access Token API. The Authkey stays
// server-only; the client-provided access token is never logged or returned.
export async function verifyMsg91AccessToken(accessToken) {
  const authkey = process.env.MSG91_AUTHKEY;
  if (!authkey) throw new Error("MSG91 is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body = JSON.stringify({ "access-token": accessToken });
    const response = await fetch(VERIFY_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        authkey,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    const successful = data?.type === "success" || data?.status === "success" || data?.success === true;
    const phone = verifiedPhone(data);

    if (!response.ok || !successful || !phone) throw verificationFailed();
    return phone;
  } catch (err) {
    if (err.message === "MSG91 is not configured") throw err;
    throw verificationFailed();
  } finally {
    clearTimeout(timeout);
  }
}

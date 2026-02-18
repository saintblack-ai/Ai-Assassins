import crypto from "node:crypto";

const MAX_SKEW_SECONDS = 300;

export function signPayload(secret, timestamp, rawBody) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

function safeEqualHex(a, b) {
  const aBuf = Buffer.from(String(a || ""), "hex");
  const bBuf = Buffer.from(String(b || ""), "hex");
  if (!aBuf.length || aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifySitrepSignature({
  secret,
  timestampHeader,
  signatureHeader,
  rawBody,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!secret) return { ok: false, error: "missing_secret" };
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, error: "invalid_timestamp" };
  if (Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, error: "timestamp_skew" };
  }
  const expected = signPayload(secret, String(ts), rawBody || "");
  if (!safeEqualHex(expected, signatureHeader)) {
    return { ok: false, error: "bad_signature" };
  }
  return { ok: true };
}

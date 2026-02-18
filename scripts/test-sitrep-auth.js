#!/usr/bin/env node
import { signPayload, verifySitrepSignature } from "../src/lib/sitrep/auth.js";

const secret = "test-secret";
const body = JSON.stringify({ hello: "world" });
const ts = String(Math.floor(Date.now() / 1000));
const sig = signPayload(secret, ts, body);

const valid = verifySitrepSignature({
  secret,
  timestampHeader: ts,
  signatureHeader: sig,
  rawBody: body,
});
const invalid = verifySitrepSignature({
  secret,
  timestampHeader: ts,
  signatureHeader: "deadbeef",
  rawBody: body,
});

if (!valid.ok) {
  console.error("Expected valid signature");
  process.exit(1);
}
if (invalid.ok) {
  console.error("Expected invalid signature");
  process.exit(1);
}
console.log("sitrep auth test passed");

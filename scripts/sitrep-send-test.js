#!/usr/bin/env node
import "dotenv/config";
import crypto from "node:crypto";

const secret = process.env.SITREP_INGEST_SECRET || "";
const apiBase = (process.env.SITREP_API_BASE || "http://localhost:8788").replace(/\/+$/, "");
const appName = process.env.SITREP_APP_NAME || "ai-assassins";
const envName = process.env.SITREP_ENV || "dev";

if (!secret) {
  console.error("Missing SITREP_INGEST_SECRET in environment.");
  process.exit(1);
}

const payload = {
  source: "sitrep",
  type: "heartbeat",
  app: appName,
  severity: "info",
  message: `SITREP test event from ${envName}`,
  tags: { env: envName, source: "cli" },
  meta: { test: true },
  ts: new Date().toISOString(),
};

const rawBody = JSON.stringify(payload);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = crypto
  .createHmac("sha256", secret)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");

const res = await fetch(`${apiBase}/api/sitrep/ingest`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-SITREP-TIMESTAMP": timestamp,
    "X-SITREP-SIGNATURE": signature,
  },
  body: rawBody,
});

const text = await res.text();
console.log(`status=${res.status}`);
console.log(text);

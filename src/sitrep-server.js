import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSitrepStore } from "./lib/sitrep/store.js";
import { computeInsights } from "./lib/sitrep/insights.js";
import { verifySitrepSignature } from "./lib/sitrep/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const app = express();
const port = Number(process.env.SITREP_PORT || 8788);
const ingestSecret = String(process.env.SITREP_INGEST_SECRET || "");

const RATE_LIMIT_PER_MINUTE = 60;
const BUCKETS = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const current = BUCKETS.get(ip) || { count: 0, start: now };
  if (now - current.start >= windowMs) {
    BUCKETS.set(ip, { count: 1, start: now });
    return false;
  }
  current.count += 1;
  BUCKETS.set(ip, current);
  return current.count > RATE_LIMIT_PER_MINUTE;
}

function validateEvent(event) {
  const validTypes = new Set(["agent_run", "agent_error", "deploy", "metric", "heartbeat"]);
  const validSeverity = new Set(["info", "warn", "error"]);
  if (!event || typeof event !== "object") return "body must be object";
  if (event.source !== "sitrep") return "source must be 'sitrep'";
  if (!validTypes.has(String(event.type || ""))) return "invalid type";
  if (!validSeverity.has(String(event.severity || ""))) return "invalid severity";
  if (!String(event.app || "").trim()) return "app required";
  if (!String(event.ts || "").trim()) return "ts required";
  if (Number.isNaN(Date.parse(event.ts))) return "ts must be ISO timestamp";
  return null;
}

app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (rateLimit(ip)) return res.status(429).json({ ok: false, error: "rate_limited" });
  return next();
});

app.use(express.json({
  limit: "128kb",
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString("utf8");
  },
}));

app.get("/healthz", async (_req, res) => {
  res.json({ ok: true, service: "sitrep", ts: new Date().toISOString() });
});

app.post("/api/sitrep/ingest", async (req, res) => {
  try {
    const timestamp = req.header("X-SITREP-TIMESTAMP") || "";
    const signature = req.header("X-SITREP-SIGNATURE") || "";
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    const verified = verifySitrepSignature({
      secret: ingestSecret,
      timestampHeader: timestamp,
      signatureHeader: signature,
      rawBody,
    });
    if (!verified.ok) return res.status(401).json({ ok: false, error: verified.error });

    const validationError = validateEvent(req.body);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const store = await createSitrepStore(process.env);
    const id = await store.insertEvent(req.body);
    await store.close();
    return res.status(201).json({ ok: true, id, storage: store.mode });
  } catch (error) {
    console.error("[sitrep][ingest] failure", error?.message || error);
    return res.status(500).json({ ok: false, error: "ingest_failed" });
  }
});

app.get("/api/sitrep/insights", async (_req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const store = await createSitrepStore(process.env);
    const events24h = await store.listEventsSince(since, 2000);
    const latestErrors = await store.listLatestErrors(20);
    await store.close();
    const insights = computeInsights(events24h, latestErrors);
    return res.json({ ok: true, generated_at: new Date().toISOString(), storage: store.mode, ...insights });
  } catch (error) {
    console.error("[sitrep][insights] failure", error?.message || error);
    return res.status(500).json({ ok: false, error: "insights_failed" });
  }
});

app.use("/docs", express.static(path.join(root, "docs")));
app.get("/sitrep", (_req, res) => {
  res.sendFile(path.join(root, "docs", "sitrep.html"));
});

app.listen(port, () => {
  console.log(`[sitrep] listening on http://localhost:${port}`);
});

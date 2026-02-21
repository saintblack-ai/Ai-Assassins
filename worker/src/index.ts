import legacy from "./legacy.js";
import { getAuthContext } from "./middleware/auth";
import { isRateLimited } from "./middleware/rateLimit";
import { handleBrief } from "./handlers/brief";
import { generateBrief, shouldSendNow } from "./briefing";
import {
  ensureTodayDailyBrief,
  listRecentDailyBriefs,
  todayIsoDateUTC,
} from "./services/dailyBrief";
import {
  buildCommandBrief,
  ensureTodayCommandBrief,
  getMetricsSnapshot,
  listCommandHistory,
} from "./services/commandIntel";
import {
  getTier,
  setTier,
  tierLimit,
  tierFromRevenueCatPayload,
  validateRevenueCatSecret,
  type Tier
} from "./services/subscription";
import {
  getUsage,
  logDailyBriefSent,
  logRevenueEvent,
  logSystemBriefGenerated,
  saveLead,
} from "./services/usage";
import { resolveBriefUserId } from "./identity";
import { getAgentHistory, parseAgentName, runAgent } from "./agents";
import {
  deleteSupabaseBrief,
  getSupabaseTier,
  listSupabaseBriefs,
  saveSupabaseBrief,
  upsertSupabaseUsage,
  upsertSupabaseSubscription,
  upsertSupabaseUser,
} from "./services/supabase";
import { buildIntelligencePayload, recommendedActions, scoreIntelligence } from "./services/intel";
import { sendEmail } from "./services/email";

type Env = {
  ALLOWED_ORIGINS?: string;
  USER_STATE?: KVNamespace;
  USAGE_STATE?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  DAILY_BRIEF_LOG?: KVNamespace;
  COMMAND_LOG?: KVNamespace;
  BRIEF_LOG?: KVNamespace;
  LEADS?: KVNamespace;
  AGENT_LOG?: KVNamespace;
  REVENUECAT_WEBHOOK_SECRET?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ADMIN_TOKEN?: string;
  BRIEF_TIMEZONE?: string;
  BRIEF_SEND_HHMM?: string;
  BRIEF_EMAIL_TO?: string;
  DAILY_ALERT_TO?: string;
  FROM_EMAIL?: string;
  RESEND_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID_PRO?: string;
  STRIPE_PRICE_ID_ELITE?: string;
  STRIPE_PRICE_ID_ENTERPRISE?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ELITE?: string;
  STRIPE_PRICE_ENTERPRISE?: string;
  ENTERPRISE_DAILY_LIMIT?: string;
  PUBLIC_APP_URL?: string;
  REQUIRE_AUTH?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type BriefCfg = {
  userId: string;
  BRIEF_TIMEZONE: string;
  BRIEF_SEND_HHMM: string;
  BRIEF_EMAIL_TO: string;
  updatedAt: string;
};

const DEFAULT_ALLOWED_ORIGIN = "https://saintblack-ai.github.io";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'",
};

function allowedOrigin(env: Env): string {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGIN).split(",")[0].trim() || DEFAULT_ALLOWED_ORIGIN;
}

function json(data: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowedOrigin(env || {}),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...SECURITY_HEADERS
    }
  });
}

function blocked(status = 403, env?: Env): Response {
  return json({ success: false, error: "Request blocked" }, status, env);
}

function stripeNotConfigured(env?: Env): Response {
  return json({ success: false, error: "Stripe not configured" }, 503, env);
}

function stripePriceId(env: Env, plan: "pro" | "elite" | "enterprise"): string {
  if (plan === "pro") return String(env.STRIPE_PRICE_ID_PRO || env.STRIPE_PRICE_PRO || "").trim();
  if (plan === "enterprise") {
    return String(env.STRIPE_PRICE_ID_ENTERPRISE || env.STRIPE_PRICE_ENTERPRISE || "").trim();
  }
  return String(env.STRIPE_PRICE_ID_ELITE || env.STRIPE_PRICE_ELITE || "").trim();
}

function withSecurityHeaders(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigin(env));
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function requireAdmin(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization") || "";
  const token = String(env.ADMIN_TOKEN || "").trim();
  if (!token) return false;
  return auth === `Bearer ${token}`;
}

function authRejected(auth: { tokenProvided: boolean; invalidToken: boolean }, env: Env): Response | null {
  if (auth.tokenProvided && auth.invalidToken) {
    return json({ success: false, error: "invalid_token" }, 401, env);
  }
  return null;
}

function defaultBriefCfg(env: Env, userId: string): BriefCfg {
  return {
    userId,
    BRIEF_TIMEZONE: env.BRIEF_TIMEZONE || "America/Chicago",
    BRIEF_SEND_HHMM: String(env.BRIEF_SEND_HHMM || "0700").replace(":", ""),
    BRIEF_EMAIL_TO: env.BRIEF_EMAIL_TO || "",
    updatedAt: new Date().toISOString(),
  };
}

async function readBriefCfg(env: Env, userId: string): Promise<BriefCfg> {
  const fallback = defaultBriefCfg(env, userId);
  if (!env.USER_STATE) return fallback;
  const raw = await env.USER_STATE.get(`briefcfg:${userId}`);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return {
      userId,
      BRIEF_TIMEZONE: parsed.BRIEF_TIMEZONE || fallback.BRIEF_TIMEZONE,
      BRIEF_SEND_HHMM: String(parsed.BRIEF_SEND_HHMM || fallback.BRIEF_SEND_HHMM).replace(":", ""),
      BRIEF_EMAIL_TO: parsed.BRIEF_EMAIL_TO || fallback.BRIEF_EMAIL_TO,
      updatedAt: parsed.updatedAt || fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

type StrategicBrief = {
  date: string;
  system_health: {
    worker_version: string;
    kv_bindings: string[];
  };
  top_actions: string[];
  revenue_summary: {
    total_events: number;
    enterprise_leads: number;
  };
  usage_summary: {
    active_users: number;
    free_count: number;
    pro_count: number;
    elite_count: number;
    enterprise_count: number;
  };
  brief_summary: string;
};

type CommanderDaily = {
  date: string;
  mission: string;
  revenue_status: string;
  brand_growth: string;
  priority_1: string;
  priority_2: string;
  priority_3: string;
  is_premium_locked: boolean;
};

type RevenueFortressBrief = {
  date: string;
  top_priorities: string[];
  revenue_actions: string[];
  marketing_actions: string[];
  build_actions: string[];
  risks_alerts: string[];
};

function commandBriefKey(date: string): string {
  return `command:${date}`;
}

function commanderDailyKey(date: string): string {
  return `daily_logs:${date}`;
}

function revenueBriefKey(date: string): string {
  return `brief:${date}`;
}

const revenueBriefLatestKey = "brief:latest";

function isCommanderDaily(value: unknown): value is CommanderDaily {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.date === "string" &&
    typeof obj.mission === "string" &&
    typeof obj.revenue_status === "string" &&
    typeof obj.brand_growth === "string" &&
    typeof obj.priority_1 === "string" &&
    typeof obj.priority_2 === "string" &&
    typeof obj.priority_3 === "string" &&
    typeof obj.is_premium_locked === "boolean";
}

function requiredEnvWarnings(env: Env): string[] {
  const warnings: string[] = [];
  if (!env.OPENAI_API_KEY) warnings.push("OPENAI_API_KEY is missing");
  if (!env.RESEND_API_KEY) warnings.push("RESEND_API_KEY is missing");
  if (!env.FROM_EMAIL) warnings.push("FROM_EMAIL is missing");
  if (!env.DAILY_ALERT_TO) warnings.push("DAILY_ALERT_TO is missing");
  if (!env.STRIPE_SECRET_KEY) warnings.push("STRIPE_SECRET_KEY is missing");
  return warnings;
}

function parseStripePlan(payload: any, env: Env): Tier {
  const eventType = String(payload?.type || "").toLowerCase();
  const stripeObject = payload?.data?.object || {};
  const metadataPlan = String(
    stripeObject?.metadata?.tier ||
    stripeObject?.metadata?.plan ||
    ""
  ).toLowerCase();

  if (eventType.includes("deleted") || eventType.includes("expired") || eventType.includes("canceled")) {
    return "free";
  }
  if (metadataPlan === "enterprise" || metadataPlan === "elite" || metadataPlan === "pro") {
    return metadataPlan as Tier;
  }

  const itemPriceId = String(
    stripeObject?.items?.data?.[0]?.price?.id ||
    stripeObject?.lines?.data?.[0]?.price?.id ||
    ""
  );

  if (itemPriceId && itemPriceId === stripePriceId(env, "elite")) return "elite";
  if (itemPriceId && itemPriceId === stripePriceId(env, "pro")) return "pro";

  return "pro";
}

async function buildRevenueSummary(env: Env): Promise<{
  total_revenue: number;
  total_subscriptions: number;
  daily_revenue: Record<string, number>;
  tier_breakdown: Record<string, number>;
}> {
  if (!env.REVENUE_LOG) {
    return { total_revenue: 0, total_subscriptions: 0, daily_revenue: {}, tier_breakdown: {} };
  }

  const listed = await env.REVENUE_LOG.list({ prefix: "revenue_log:", limit: 1000 });
  const dailyRevenue: Record<string, number> = {};
  const tierBreakdown: Record<string, number> = { free: 0, pro: 0, elite: 0, enterprise: 0 };
  let totalSubscriptions = 0;

  for (const key of listed.keys) {
    const raw = await env.REVENUE_LOG.get(key.name);
    if (!raw) continue;
    try {
      const evt = JSON.parse(raw);
      const day = String(evt?.timestamp || "").slice(0, 10) || "unknown";
      const tier = String(evt?.tier || "free");
      if (tierBreakdown[tier] == null) tierBreakdown[tier] = 0;
      tierBreakdown[tier] += 1;
      if (String(evt?.event || "").includes("checkout") || String(evt?.event || "").includes("webhook_stripe")) {
        totalSubscriptions += 1;
      }
      const amount = Number(evt?.amount);
      const fallback = tier === "elite" ? 14.99 : tier === "enterprise" ? 49.99 : tier === "pro" ? 4.99 : 0;
      dailyRevenue[day] = (dailyRevenue[day] || 0) + (Number.isFinite(amount) && amount > 0 ? amount : fallback);
    } catch {
      // ignore malformed event
    }
  }

  const totalRevenue = Object.values(dailyRevenue).reduce((sum, n) => sum + n, 0);
  return {
    total_revenue: Number(totalRevenue.toFixed(2)),
    total_subscriptions: totalSubscriptions,
    daily_revenue: dailyRevenue,
    tier_breakdown: tierBreakdown,
  };
}

function jsonArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.map((x) => String(x || "").trim()).filter(Boolean);
  return out.length ? out : fallback;
}

function deterministicRevenueBrief(date: string): RevenueFortressBrief {
  return {
    date,
    top_priorities: [
      "Ship one high-impact product improvement before noon.",
      "Run one monetization action tied to upgrade conversion.",
      "Close one reliability item blocking daily execution.",
    ],
    revenue_actions: [
      "Review checkout conversion drop-offs and patch one friction point.",
      "Send Pro/Elite upgrade nudge to active free users.",
      "Follow up on fresh enterprise leads from last 24 hours.",
    ],
    marketing_actions: [
      "Publish one command-centered social proof post.",
      "Distribute one short-form clip with pricing CTA.",
      "Update landing copy based on yesterday's conversion behavior.",
    ],
    build_actions: [
      "Verify cron-generated brief persisted in KV.",
      "Run endpoint smoke tests for /api/status and /api/brief/latest.",
      "Review error logs and close one production risk.",
    ],
    risks_alerts: [
      "Watch for Stripe webhook delivery failures.",
      "Monitor rate-limit spikes that may indicate abuse traffic.",
    ],
  };
}

async function maybeOpenAIBrief(env: Env, date: string): Promise<RevenueFortressBrief | null> {
  if (!env.OPENAI_API_KEY) return null;
  const payload = {
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "Return strict JSON only." }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: `Generate daily operations brief for ${date}.` }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "revenue_brief",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            top_priorities: { type: "array", items: { type: "string" } },
            revenue_actions: { type: "array", items: { type: "string" } },
            marketing_actions: { type: "array", items: { type: "string" } },
            build_actions: { type: "array", items: { type: "string" } },
            risks_alerts: { type: "array", items: { type: "string" } },
          },
          required: [
            "top_priorities",
            "revenue_actions",
            "marketing_actions",
            "build_actions",
            "risks_alerts",
          ],
        },
      },
    },
  };

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    const data: any = await r.json();
    const raw = typeof data?.output_text === "string" ? data.output_text : "";
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      date,
      top_priorities: jsonArray(parsed?.top_priorities, deterministicRevenueBrief(date).top_priorities),
      revenue_actions: jsonArray(parsed?.revenue_actions, deterministicRevenueBrief(date).revenue_actions),
      marketing_actions: jsonArray(parsed?.marketing_actions, deterministicRevenueBrief(date).marketing_actions),
      build_actions: jsonArray(parsed?.build_actions, deterministicRevenueBrief(date).build_actions),
      risks_alerts: jsonArray(parsed?.risks_alerts, deterministicRevenueBrief(date).risks_alerts),
    };
  } catch {
    return null;
  }
}

async function ensureRevenueBrief(
  env: Env,
  date: string
): Promise<{ brief: RevenueFortressBrief; key: string; created: boolean }> {
  if (!env.DAILY_BRIEF_LOG) throw new Error("DAILY_BRIEF_LOG KV binding is missing");
  const key = revenueBriefKey(date);
  const existingRaw = await env.DAILY_BRIEF_LOG.get(key);
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw);
      if (parsed?.date && parsed?.top_priorities) {
        await env.DAILY_BRIEF_LOG.put(revenueBriefLatestKey, JSON.stringify(parsed), {
          expirationTtl: 60 * 60 * 24 * 90,
        });
        return { brief: parsed as RevenueFortressBrief, key, created: false };
      }
    } catch {
      // regenerate malformed entry
    }
  }

  const openAIBrief = await maybeOpenAIBrief(env, date);
  const brief = openAIBrief || deterministicRevenueBrief(date);
  await env.DAILY_BRIEF_LOG.put(key, JSON.stringify(brief), { expirationTtl: 60 * 60 * 24 * 90 });
  await env.DAILY_BRIEF_LOG.put(revenueBriefLatestKey, JSON.stringify(brief), { expirationTtl: 60 * 60 * 24 * 90 });
  return { brief, key, created: true };
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!secret) return true;
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",").map((x) => x.trim());
  const t = parts.find((x) => x.startsWith("t="))?.slice(2);
  const v1 = parts.find((x) => x.startsWith("v1="))?.slice(3);
  if (!t || !v1) return false;

  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  return expected === v1;
}

async function createCheckoutSession(
  env: Env,
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ ok: boolean; status: number; data?: any }> {
  if (!env.STRIPE_SECRET_KEY) return { ok: false, status: 503 };
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  if (userId) form.set("client_reference_id", userId);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function handleStripeWebhook(request: Request, env: Env, rawBody: string): Promise<Response> {
  return handleUnifiedWebhook(request, env, rawBody);
}

async function buildCommanderDaily(
  env: Env,
  date: string,
  isPremiumLocked: boolean
): Promise<CommanderDaily> {
  const metrics = await getMetricsSnapshot(env);
  const nowHourUtc = new Date().getUTCHours();
  const morningTimestampCheck = nowHourUtc < 12;
  const dailyFocusPriority = morningTimestampCheck
    ? "Morning offensive: ship one hard feature and one monetization move before 12:00."
    : "Recovery mode: stabilize systems, close outstanding revenue blockers, and queue next launch.";

  const revenueMetricSnapshot = `events=${metrics.revenue_events_count}, leads=${metrics.enterprise_leads_count}`;
  const brandMetricSnapshot = `active_users=${metrics.tier_distribution.active_users}, pro+ tiers=${metrics.tier_distribution.pro_count + metrics.tier_distribution.elite_count + metrics.tier_distribution.enterprise_count}`;

  return {
    date,
    mission: dailyFocusPriority,
    revenue_status: `Revenue metric snapshot (${revenueMetricSnapshot})`,
    brand_growth: `Brand metric snapshot (${brandMetricSnapshot})`,
    priority_1: "Execute one high-conversion content drop linked to a pricing CTA.",
    priority_2: "Review usage and tier transitions, then trigger direct outreach to top leads.",
    priority_3: "Lock one infrastructure reliability improvement and verify alert pipelines.",
    is_premium_locked: isPremiumLocked,
    // Stripe enforcement hook to be implemented next phase
  };
}

async function ensureCommanderDaily(
  env: Env,
  date: string,
  isPremiumLocked: boolean
): Promise<{ daily: CommanderDaily; key: string; created: boolean }> {
  if (!env.DAILY_BRIEF_LOG) throw new Error("DAILY_BRIEF_LOG KV binding is missing");
  const key = commanderDailyKey(date);
  const existing = await env.DAILY_BRIEF_LOG.get(key);
  if (existing) {
    try {
      const parsedRaw = JSON.parse(existing);
      if (isCommanderDaily(parsedRaw)) {
        const parsed: CommanderDaily = {
          ...parsedRaw,
          is_premium_locked: isPremiumLocked,
        };
        return { daily: parsed, key, created: false };
      }
    } catch {
      // fall through and regenerate
    }
  }
  const daily = await buildCommanderDaily(env, date, isPremiumLocked);
  await env.DAILY_BRIEF_LOG.put(key, JSON.stringify(daily), {
    expirationTtl: 60 * 60 * 24 * 90,
  });
  return { daily, key, created: true };
}

async function sendDailyAlertEmail(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; error?: string }> {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !to) {
    return { sent: false, error: "missing_email_env" };
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { sent: false, error: `resend_${resp.status}:${text}` };
  }

  return { sent: true };
}

async function buildStrategicBrief(env: Env, date: string): Promise<StrategicBrief> {
  const base = await buildCommandBrief(env, date);
  const generated = await generateBrief(env, { timezone: env.BRIEF_TIMEZONE || "America/Chicago" });

  return {
    date,
    system_health: base.system_health,
    top_actions: base.top_actions,
    revenue_summary: base.revenue_summary,
    usage_summary: base.usage_summary,
    brief_summary: generated.sections.overnight_overview.slice(0, 2).join(" "),
  };
}

function strategicBriefToHtml(brief: StrategicBrief): string {
  return `
    <h2>Archaios Daily Brief — ${brief.date}</h2>
    <h3>Brief Summary</h3>
    <p>${brief.brief_summary}</p>
    <h3>Top Actions</h3>
    <ul>${brief.top_actions.map((x) => `<li>${x}</li>`).join("")}</ul>
    <h3>Usage Summary</h3>
    <ul>
      <li>Active users: ${brief.usage_summary.active_users}</li>
      <li>Free: ${brief.usage_summary.free_count}</li>
      <li>Pro: ${brief.usage_summary.pro_count}</li>
      <li>Elite: ${brief.usage_summary.elite_count}</li>
      <li>Enterprise: ${brief.usage_summary.enterprise_count}</li>
    </ul>
    <h3>Revenue Summary</h3>
    <ul>
      <li>Total events: ${brief.revenue_summary.total_events}</li>
      <li>Enterprise leads: ${brief.revenue_summary.enterprise_leads}</li>
    </ul>
  `;
}

const AUTO_BRIEF_LATEST_KEY = "brief:auto:latest";

function renderAutoBriefHtml(brief: { date?: string; [key: string]: unknown }): string {
  const rows = Object.entries(brief)
    .filter(([k]) => k !== "date")
    .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${typeof v === "string" ? v : JSON.stringify(v)}</td></tr>`)
    .join("");
  return `
    <h2>Your Daily Brief</h2>
    <p><b>Date:</b> ${String(brief.date || todayIsoDateUTC())}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
      ${rows}
    </table>
  `;
}

async function handleAutoBrief(
  env: Env,
  opts?: { authUserId?: string | null; authEmail?: string | null; source?: "scheduled" | "api" }
): Promise<{ success: boolean; created: boolean; key: string; brief: any; email_sent: boolean; email_error?: string }> {
  if (!env.DAILY_BRIEF_LOG) throw new Error("DAILY_BRIEF_LOG KV not bound");

  const source = opts?.source || "api";
  const today = todayIsoDateUTC();
  const todayBrief = await ensureTodayDailyBrief(env, today);
  const key = todayBrief.key;
  const brief = todayBrief.brief;

  await env.DAILY_BRIEF_LOG.put(AUTO_BRIEF_LATEST_KEY, JSON.stringify(brief), {
    expirationTtl: 60 * 60 * 24 * 90,
  });

  if (opts?.authUserId) {
    await saveSupabaseBrief(env, {
      user_id: opts.authUserId,
      brief_json: brief,
      focus: "daily-auto",
      tone: "strategic",
      location: null,
    });
  }

  let emailSent = false;
  let emailError: string | undefined;
  const emailTo = String(env.DAILY_ALERT_TO || "").trim();
  if (String(env.RESEND_API_KEY || "").trim()) {
    const emailResult = await sendEmail(
      env,
      emailTo,
      "Your Daily Brief",
      renderAutoBriefHtml(brief)
    );
    emailSent = emailResult.success;
    emailError = emailResult.error;
    console.log(
      JSON.stringify({
        event: "EMAIL_SENT",
        success: emailResult.success,
        to: emailTo || null,
        source,
        error: emailResult.error || null,
      })
    );
  } else {
    emailError = "email_not_configured";
  }

  console.log(
    JSON.stringify({
      event: "AUTO_BRIEF_SENT",
      date: today,
      key,
      created: todayBrief.created,
      source,
      email_sent: emailSent,
    })
  );

  return { success: true, created: todayBrief.created, key, brief, email_sent: emailSent, email_error: emailError };
}

async function runDailyNotifier(
  env: Env,
  source: "scheduled" | "api",
  opts?: { sendIfExisting?: boolean }
): Promise<{
  date: string;
  created: boolean;
  brief_key: string;
  command_brief: StrategicBrief;
  email_sent: boolean;
  email_to: string | null;
  error?: string;
}> {
  if (!env.COMMAND_LOG) throw new Error("COMMAND_LOG KV not bound");

  const sendContext = shouldSendNow(env);
  const date = sendContext.ymd || todayIsoDateUTC();
  const existing = await env.COMMAND_LOG.get(commandBriefKey(date));

  let brief: StrategicBrief;
  let created = false;
  const sendIfExisting = opts?.sendIfExisting ?? true;

  if (existing) {
    try {
      brief = JSON.parse(existing);
    } catch {
      brief = await buildStrategicBrief(env, date);
      await env.COMMAND_LOG.put(commandBriefKey(date), JSON.stringify(brief), {
        expirationTtl: 60 * 60 * 24 * 120,
      });
      created = true;
    }
  } else {
    brief = await buildStrategicBrief(env, date);
    await env.COMMAND_LOG.put(commandBriefKey(date), JSON.stringify(brief), {
      expirationTtl: 60 * 60 * 24 * 120,
    });
    created = true;
  }

  const brief_key = commandBriefKey(date);
  const emailTo = String(env.DAILY_ALERT_TO || "").trim() || null;
  const shouldSend = created || sendIfExisting;
  const emailResult = shouldSend
    ? await sendDailyAlertEmail(
      env,
      emailTo || "",
      `Archaios Daily Brief — ${date}`,
      strategicBriefToHtml(brief)
    )
    : { sent: false, error: "brief_exists" };

  await logDailyBriefSent(env, {
    source,
    brief_key,
    email_sent: emailResult.sent,
    email_to: emailTo,
    error: emailResult.error || null,
  });

  return {
    date,
    created,
    brief_key,
    command_brief: brief,
    email_sent: emailResult.sent,
    email_to: emailTo,
    error: emailResult.error,
  };
}

async function handleUnifiedWebhook(
  request: Request,
  env: Env,
  rawBody: string
): Promise<Response> {
  let payload: any = null;
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return blocked(400, env);
  }
  if (!payload || typeof payload !== "object") return blocked(400, env);

  const webhookType = String((payload as any)?.type || "").toLowerCase();
  const isRevenueCat = Boolean((payload as any)?.event || webhookType.includes("revenuecat"));
  const secretConfigured = Boolean(String(env.REVENUECAT_WEBHOOK_SECRET || "").trim());
  const stripeSecretConfigured = Boolean(String(env.STRIPE_WEBHOOK_SECRET || "").trim());
  const secretValid = validateRevenueCatSecret(request, env);
  const stripeSig = request.headers.get("Stripe-Signature") || "";
  const stripeSecretValid = await verifyStripeSignature(
    rawBody,
    stripeSig,
    String(env.STRIPE_WEBHOOK_SECRET || "").trim()
  );

  if (secretConfigured && !secretValid) return blocked(401, env);
  if (!isRevenueCat && stripeSecretConfigured && !stripeSecretValid) return blocked(401, env);

  if (isRevenueCat) {
    const userId = String((payload as any)?.event?.app_user_id || (payload as any)?.app_user_id || "").trim();
    if (!userId) return blocked(400, env);
    const tier = tierFromRevenueCatPayload(payload);
    await setTier(env, userId, tier);
    await logRevenueEvent(
      env,
      userId,
      tier,
      secretConfigured ? "webhook_revenuecat" : "webhook_revenuecat_unverified",
      true
    );
    return json({ success: true, source: "revenuecat", user_id: userId, tier }, 200, env);
  }

  const stripeObject = (payload as any)?.data?.object || {};
  const eventType = String((payload as any)?.type || "").toLowerCase();
  const userId = String(
    stripeObject?.client_reference_id ||
    stripeObject?.metadata?.userId ||
    stripeObject?.metadata?.user_id ||
    ""
  ).trim();
  const userEmail = String(stripeObject?.customer_email || stripeObject?.metadata?.email || "").trim() || null;
  if (!userId) return blocked(400, env);

  let tier: Tier = parseStripePlan(payload, env);
  if (
    !eventType.includes("checkout.session.completed") &&
    !eventType.includes("customer.subscription.updated") &&
    !eventType.includes("invoice.payment_succeeded")
  ) {
    return json({ success: true, source: "stripe", ignored: true }, 200, env);
  }

  await setTier(env, userId, tier);
  const amount = Number(stripeObject?.amount_total || stripeObject?.amount_subtotal || 0);
  await logRevenueEvent(
    env,
    userId,
    tier,
    "webhook_stripe",
    true,
    userEmail,
    amount > 0 ? Number((amount / 100).toFixed(2)) : null
  );
  return json({ success: true, source: "stripe", user_id: userId, tier }, 200, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const envWarnings = requiredEnvWarnings(env);
    if (envWarnings.length) {
      console.warn("[config-warning]", envWarnings.join("; "));
    }

    if (!request.url.startsWith("https://")) return blocked(400, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin(env),
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          ...SECURITY_HEADERS
        }
      });
    }

    if (origin && origin !== allowedOrigin(env)) return blocked(403, env);
    if (isRateLimited(ip)) return blocked(429, env);

    try {
      if (
        (url.pathname === "/api/webhook" ||
          url.pathname === "/revenuecat/webhook" ||
          url.pathname === "/api/stripe/webhook") &&
        request.method === "POST"
      ) {
        const rawBody = await request.text().catch(() => "");
        if (url.pathname === "/api/stripe/webhook") {
          return await handleStripeWebhook(request, env, rawBody);
        }
        return await handleUnifiedWebhook(request, env, rawBody);
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return json(
          {
            worker_status: "operational",
            kv_bindings: Boolean(env.USER_STATE && env.USAGE_STATE && env.REVENUE_LOG && env.DAILY_BRIEF_LOG),
            openai_connected: Boolean(env.OPENAI_API_KEY),
            cron_active: true,
            timestamp: new Date().toISOString(),
          },
          200,
          env
        );
      }

      if (url.pathname === "/api/status" && request.method === "GET") {
        return json(
          {
            success: true,
            version: "revenue-fortress-phase-2",
            schedule: "0 7 * * *",
            kv_bindings_ok: Boolean(env.USER_STATE && env.USAGE_STATE && env.REVENUE_LOG && env.DAILY_BRIEF_LOG),
          },
          200,
          env
        );
      }

      if (url.pathname === "/api/command-brief" && request.method === "GET") {
        if (!env.COMMAND_LOG) return json({ error: "COMMAND_LOG KV not bound" }, 500, env);
        const today = todayIsoDateUTC();
        const result = await ensureTodayCommandBrief(env, today);
        if (result.created) {
          await logSystemBriefGenerated(env, {
            date: today,
            source: "api",
            key: result.key,
            success: true,
          });
        }
        return json({ success: true, created: result.created, key: result.key, brief: result.brief }, 200, env);
      }

      if (url.pathname === "/api/command-history" && request.method === "GET") {
        if (!env.COMMAND_LOG) return json({ error: "COMMAND_LOG KV not bound" }, 500, env);
        const items = await listCommandHistory(env, 14);
        return json({ success: true, items }, 200, env);
      }

      if (url.pathname === "/api/metrics" && request.method === "GET") {
        const metrics = await getMetricsSnapshot(env);
        return json(
          {
            success: true,
            usage_total_count: metrics.usage_total_count,
            revenue_events_count: metrics.revenue_events_count,
            enterprise_leads_count: metrics.enterprise_leads_count,
            tier_distribution: metrics.tier_distribution,
          },
          200,
          env
        );
      }

      if (url.pathname === "/api/revenue-summary" && request.method === "GET") {
        const summary = await buildRevenueSummary(env);
        return json(summary, 200, env);
      }

      if (url.pathname === "/api/brief/today" && request.method === "GET") {
        if (!env.DAILY_BRIEF_LOG) return json({ error: "DAILY_BRIEF_LOG KV not bound" }, 500, env);
        const today = todayIsoDateUTC();
        const result = await ensureTodayDailyBrief(env, today);
        if (result.created) {
          await logSystemBriefGenerated(env, {
            date: today,
            source: "api",
            key: result.key,
            success: true,
          });
        }
        return json({ success: true, created: result.created, key: result.key, brief: result.brief }, 200, env);
      }

      if (url.pathname === "/api/brief/auto" && request.method === "GET") {
        if (!env.DAILY_BRIEF_LOG) return json({ success: false, error: "DAILY_BRIEF_LOG KV not bound" }, 500, env);
        const latestRaw = await env.DAILY_BRIEF_LOG.get(AUTO_BRIEF_LATEST_KEY);
        if (latestRaw) {
          const latest = JSON.parse(latestRaw);
          return json({ success: true, created: false, key: AUTO_BRIEF_LATEST_KEY, brief: latest }, 200, env);
        }
        const auth = await getAuthContext(request, env);
        const auto = await handleAutoBrief(env, {
          authUserId: auth.validated ? auth.userId : null,
          authEmail: auth.email,
          source: "api",
        });
        return json(auto, 200, env);
      }

      if (url.pathname === "/api/brief/history" && request.method === "GET") {
        if (!env.DAILY_BRIEF_LOG) return json({ error: "DAILY_BRIEF_LOG KV not bound" }, 500, env);
        const items = await listRecentDailyBriefs(env, 7);
        return json({ success: true, items }, 200, env);
      }

      if (url.pathname === "/api/brief/latest" && request.method === "GET") {
        if (!env.DAILY_BRIEF_LOG) return json({ error: "DAILY_BRIEF_LOG KV not bound" }, 500, env);
        const date = todayIsoDateUTC();
        const result = await ensureRevenueBrief(env, date);
        if (result.created) {
          await logSystemBriefGenerated(env, {
            date,
            source: "api",
            key: result.key,
            success: true,
          });
        }
        return json(result.brief, 200, env);
      }

      if (url.pathname.startsWith("/api/brief/") && request.method === "GET") {
        const date = url.pathname.slice("/api/brief/".length);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          // allow explicit non-date routes handled below, e.g. /api/brief/test
        } else {
          if (!env.DAILY_BRIEF_LOG) return json({ error: "DAILY_BRIEF_LOG KV not bound" }, 500, env);
          const result = await ensureRevenueBrief(env, date);
          return json(result.brief, 200, env);
        }
      }

      if ((url.pathname === "/daily" || url.pathname === "/api/daily") && request.method === "GET") {
        if (!env.DAILY_BRIEF_LOG) return json({ error: "DAILY_BRIEF_LOG KV not bound" }, 500, env);
        const date = todayIsoDateUTC();
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        const tier = auth.userId
          ? ((await getSupabaseTier(env, auth.userId)) || await getTier(env, auth.userId))
          : "free";
        const isPremiumLocked = !(tier === "premium" || tier === "pro" || tier === "elite" || tier === "enterprise");
        const result = await ensureCommanderDaily(env, date, isPremiumLocked);
        const responseDaily: CommanderDaily = isPremiumLocked
          ? {
            ...result.daily,
            revenue_status: "Premium Daily Brief required for detailed revenue analytics.",
            brand_growth: "Premium Daily Brief required for detailed brand analytics.",
            is_premium_locked: true,
          }
          : {
            ...result.daily,
            is_premium_locked: false,
          };
        if (result.created) {
          await logSystemBriefGenerated(env, {
            date,
            source: "api",
            key: result.key,
            success: true,
          });
        }
        return json(responseDaily, 200, env);
      }

      if (url.pathname === "/api/brief/test" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401, env);
        const userId = String(url.searchParams.get("userId") || "colonel").trim() || "colonel";
        const cfg = await readBriefCfg(env, userId);
        const brief = await generateBrief({ ...env, BRIEF_TIMEZONE: cfg.BRIEF_TIMEZONE }, { timezone: cfg.BRIEF_TIMEZONE });
        return json({ success: true, userId, cfg, brief }, 200, env);
      }

      if (url.pathname === "/api/brief/send-now" && (request.method === "POST" || request.method === "GET")) {
        if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401, env);
        const out = await runDailyNotifier(env, "api");
        return json({ success: true, ...out }, 200, env);
      }

      if (url.pathname === "/api/brief/config" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401, env);
        const userId = String(url.searchParams.get("userId") || "colonel").trim() || "colonel";
        const cfg = await readBriefCfg(env, userId);
        return json({ success: true, cfg }, 200, env);
      }

      if (url.pathname === "/api/brief/config" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401, env);
        const body = await request.json().catch(() => ({} as any));
        const userId = String(body.userId || "colonel").trim() || "colonel";
        const cfg = {
          userId,
          BRIEF_TIMEZONE: body.BRIEF_TIMEZONE || env.BRIEF_TIMEZONE || "America/Chicago",
          BRIEF_SEND_HHMM: String(body.BRIEF_SEND_HHMM || env.BRIEF_SEND_HHMM || "0700").replace(":", ""),
          BRIEF_EMAIL_TO: body.BRIEF_EMAIL_TO || env.BRIEF_EMAIL_TO || "",
          updatedAt: new Date().toISOString(),
        };
        if (!env.USER_STATE) return json({ error: "USER_STATE KV not bound" }, 500, env);
        await env.USER_STATE.put(`briefcfg:${userId}`, JSON.stringify(cfg));
        return json({ success: true, cfg }, 200, env);
      }

      if (url.pathname === "/api/user/status" && request.method === "GET") {
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        if (!auth.userId && !auth.userId?.startsWith("device:")) {
          return blocked(401, env);
        }
        const tier = (await getSupabaseTier(env, auth.userId)) || await getTier(env, auth.userId);
        const usageToday = await getUsage(env, auth.userId);
        const usageLimit = tierLimit(tier as Tier, env);
        const usageLeft = usageLimit == null ? null : Math.max(0, usageLimit - usageToday);
        if (auth.validated && auth.userId) {
          await upsertSupabaseUsage(env, {
            user_id: auth.userId,
            usage_today: usageToday,
            usage_limit: usageLimit,
            tier: tier as Tier,
            day: todayIsoDateUTC(),
          });
        }
        return json(
          {
            success: true,
            user_id: auth.userId,
            tier,
            usage_today: usageToday,
            usage_limit: usageLimit,
            usage_left: usageLeft,
          },
          200,
          env
        );
      }

      if (url.pathname === "/api/me" && request.method === "GET") {
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        if (!auth.userId) {
          return json(
            {
              success: true,
              user_id: null,
              email: null,
              created_at: null,
              tier: "free",
              usage_today: 0,
              usage_limit: tierLimit("free", env),
              usage_left: tierLimit("free", env),
            },
            200,
            env
          );
        }
        await upsertSupabaseUser(env, {
          id: auth.userId,
          email: auth.email,
          created_at: auth.createdAt,
        });
        const tier = (await getSupabaseTier(env, auth.userId)) || await getTier(env, auth.userId);
        const usageToday = await getUsage(env, auth.userId);
        const usageLimit = tierLimit(tier as Tier, env);
        const usageLeft = usageLimit == null ? null : Math.max(0, usageLimit - usageToday);
        return json(
          {
            success: true,
            user_id: auth.userId,
            email: auth.email,
            created_at: auth.createdAt,
            tier,
            usage_today: usageToday,
            usage_limit: usageLimit,
            usage_left: usageLeft,
          },
          200,
          env
        );
      }

      if (url.pathname === "/api/subscription" && request.method === "PUT") {
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        if (!auth.userId && !auth.userId?.startsWith("device:")) {
          return blocked(401, env);
        }
        const body = await request.json().catch(() => ({} as any));
        const plan = String(body?.plan || "").toLowerCase();
        if (!["free", "premium", "pro", "elite", "enterprise"].includes(plan)) {
          return blocked(400, env);
        }
        const ok = await upsertSupabaseSubscription(env, auth.userId, plan as Tier, "active");
        if (!ok) return blocked(503, env);
        await setTier(env, auth.userId, plan as Tier);
        console.log(JSON.stringify({ event: "SUBSCRIPTION_UPGRADE", user_id: auth.userId, tier: plan }));
        return json({ success: true, user_id: auth.userId, tier: plan }, 200, env);
      }

      if ((url.pathname === "/api/briefs" || url.pathname === "/briefs") && request.method === "GET") {
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        const isAuthenticated = Boolean(auth.validated && auth.userId && !auth.userId.startsWith("device:"));
        if (!isAuthenticated) return blocked(401, env);
        const tier = (await getSupabaseTier(env, auth.userId)) || await getTier(env, auth.userId);
        const items = await listSupabaseBriefs(env, auth.userId, 30);
        await logRevenueEvent(env, auth.userId, tier, "brief_history_read", true, auth.email);
        return json({ success: true, items }, 200, env);
      }

      if (url.pathname.startsWith("/api/briefs/") && request.method === "DELETE") {
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        const isAuthenticated = Boolean(auth.validated && auth.userId && !auth.userId.startsWith("device:"));
        if (!isAuthenticated) return blocked(401, env);
        const briefId = url.pathname.slice("/api/briefs/".length);
        if (!briefId) return blocked(400, env);
        const deleted = await deleteSupabaseBrief(env, auth.userId, briefId);
        if (!deleted) return blocked(404, env);
        return json({ success: true, deleted: briefId }, 200, env);
      }

      if ((url.pathname === "/api/brief" || url.pathname === "/brief") && request.method === "POST") {
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        const isAuthenticated = Boolean(auth.validated && auth.userId && !auth.userId.startsWith("device:"));

        const body = await request.clone().json().catch(() => ({} as any));
        const extractedUserId = resolveBriefUserId({
          authUserId: auth.userId,
          deviceHeader: request.headers.get("X-Device-Id"),
          bodyDeviceId: body?.deviceId,
        });

        const userId = extractedUserId || "device:guest";

        if (String(env.REQUIRE_AUTH || "").toLowerCase() === "true" && !extractedUserId) {
          return blocked(401, env);
        }

        if (!env.OPENAI_API_KEY) {
          return json(
            {
              success: false,
              error: "OPENAI_API_KEY is not configured on the worker",
            },
            503,
            env
          );
        }

        if (isAuthenticated && auth.userId) {
          await upsertSupabaseUser(env, {
            id: auth.userId,
            email: auth.email,
            created_at: auth.createdAt,
          });
        }

        const tier = (isAuthenticated
          ? ((await getSupabaseTier(env, userId)) || await getTier(env, userId))
          : "free") as Tier;
        const response = await handleBrief(request, env, userId, tier as Tier);

        if (response.ok && isAuthenticated && auth.userId) {
          const payload = await response.clone().json().catch(() => ({} as any));
          const location = body?.lat && body?.lon ? `${body.lat},${body.lon}` : null;
          await saveSupabaseBrief(env, {
            user_id: userId,
            brief_json: payload?.brief ?? payload,
            location,
            focus: body?.focus || null,
            tone: body?.tone || null,
          });
          await upsertSupabaseUsage(env, {
            user_id: auth.userId,
            usage_today: Number(payload?.usage_today ?? payload?.brief?.usage_today ?? 0),
            usage_limit: payload?.usage_limit ?? payload?.brief?.usage_limit ?? tierLimit(tier as Tier, env),
            tier: tier as Tier,
            day: todayIsoDateUTC(),
          });
        }
        return response;
      }

      if (url.pathname === "/api/brief/auto" && request.method === "POST") {
        const auth = await getAuthContext(request, env);
        const auto = await handleAutoBrief(env, {
          authUserId: auth.validated ? auth.userId : null,
          authEmail: auth.email,
          source: "api",
        });
        return json(auto, 200, env);
      }

      if ((url.pathname === "/api/checkout" || url.pathname === "/api/checkout-session") && request.method === "POST") {
        const body = await request.json().catch(() => ({} as any));
        const plan = String(body?.plan || body?.tier || "").toLowerCase();
        if (!["pro", "elite", "enterprise"].includes(plan)) {
          return blocked(400, env);
        }
        if (!env.STRIPE_SECRET_KEY) {
          return stripeNotConfigured(env);
        }
        const priceId = stripePriceId(env, plan as "pro" | "elite" | "enterprise");
        if (!priceId) {
          return stripeNotConfigured(env);
        }
        const successUrl = String(body?.successUrl || body?.success_url || "");
        const cancelUrl = String(body?.cancelUrl || body?.cancel_url || "");
        if (!successUrl || !cancelUrl) return blocked(400, env);
        const deviceId = String(body?.deviceId || "").trim();
        const userId = String(body?.userId || "").trim();
        const userEmail = String(body?.userEmail || "").trim() || null;

        const form = new URLSearchParams();
        form.set("mode", "subscription");
        form.set("success_url", successUrl);
        form.set("cancel_url", cancelUrl);
        form.set("line_items[0][price]", priceId);
        form.set("line_items[0][quantity]", "1");
        const checkoutRef = userId || deviceId;
        if (checkoutRef) form.set("client_reference_id", checkoutRef);
        form.set("metadata[plan]", plan);
        if (userId) form.set("metadata[userId]", userId);
        if (userEmail) form.set("metadata[email]", userEmail);

        const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        if (!r.ok) return blocked(502, env);
        const data: any = await r.json();
        if (!data?.url) return blocked(502, env);
        const checkoutAmount = plan === "elite" ? 14.99 : plan === "enterprise" ? 49.99 : 4.99;
        await logRevenueEvent(
          env,
          checkoutRef || "anonymous",
          plan,
          "checkout_created",
          true,
          userEmail,
          checkoutAmount
        );
        return json({ success: true, url: data.url, id: data.id }, 200, env);
      }

      if (url.pathname === "/api/stripe/checkout-session" && request.method === "POST") {
        const auth = await getAuthContext(request, env);
        const body = await request.json().catch(() => ({} as any));
        const plan = String(body?.plan || "pro").toLowerCase();
        if (!["pro", "elite"].includes(plan)) {
          return json({ success: false, error: "unsupported_plan" }, 400, env);
        }

        const priceId = plan === "elite"
          ? String(env.STRIPE_PRICE_ID_ELITE || env.STRIPE_PRICE_ELITE || "").trim()
          : String(env.STRIPE_PRICE_ID_PRO || env.STRIPE_PRICE_PRO || "").trim();
        if (!priceId || !env.STRIPE_SECRET_KEY) {
          return json({ success: false, error: "stripe_not_configured" }, 503, env);
        }

        const successUrl = String(body?.success_url || body?.successUrl || `${env.PUBLIC_APP_URL || ""}/success.html`);
        const cancelUrl = String(body?.cancel_url || body?.cancelUrl || `${env.PUBLIC_APP_URL || ""}/pricing.html`);
        const result = await createCheckoutSession(env, auth.userId || "guest", priceId, successUrl, cancelUrl);
        if (!result.ok) {
          return json({ success: false, error: "stripe_checkout_failed", status: result.status }, result.status, env);
        }
        console.log(JSON.stringify({ event: "SUBSCRIPTION_UPGRADE", user_id: auth.userId || "guest", tier: plan }));
        return json({ success: true, session: result.data }, 200, env);
      }

      if (url.pathname === "/api/products" && request.method === "GET") {
        return json({
          products: [
            {
              id: "pro",
              tier: "pro",
              price_id: stripePriceId(env, "pro"),
              monthly_price_usd: 4.99,
            },
            {
              id: "elite",
              tier: "elite",
              price_id: stripePriceId(env, "elite"),
              monthly_price_usd: 14.99,
            },
            {
              id: "enterprise",
              tier: "enterprise",
              price_id: stripePriceId(env, "enterprise"),
              monthly_price_usd: 49.99,
            },
          ],
        }, 200, env);
      }

      if (url.pathname.startsWith("/api/agent/run/") && request.method === "POST") {
        const agentName = url.pathname.slice("/api/agent/run/".length).trim().toLowerCase();
        const validAgent = parseAgentName(agentName);
        if (!validAgent) return json({ success: false, error: "invalid_agent" }, 400, env);

        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;

        const body = await request.json().catch(() => ({} as any));
        const mode = body?.mode === "publish" ? "publish" : "draft";
        const contextInput = (body?.context && typeof body.context === "object") ? body.context : {};
        const ctxDate = typeof contextInput?.date === "string" ? contextInput.date : todayIsoDateUTC();
        const result = await runAgent(validAgent, mode, env, {
          date: ctxDate,
          requestedBy: auth.userId || "anonymous",
          trigger: "manual",
          context: contextInput,
        });
        return json(result, 200, env);
      }

      if (url.pathname.startsWith("/api/agent/history/") && request.method === "GET") {
        const agentName = url.pathname.slice("/api/agent/history/".length).trim().toLowerCase();
        const validAgent = parseAgentName(agentName);
        if (!validAgent) return json({ success: false, error: "invalid_agent" }, 400, env);
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)));
        const items = await getAgentHistory(validAgent, env, limit);
        return json({ success: true, agent: validAgent, limit, items }, 200, env);
      }

      if (url.pathname === "/api/lead" && request.method === "POST") {
        const body = await request.json().catch(() => ({} as any));
        const name = String(body?.name || "").trim();
        const email = String(body?.email || "").trim();
        const org = String(body?.org || "").trim();
        const message = String(body?.message || "").trim();
        if (!name || !email || !org || !message) return blocked(400, env);
        const auth = await getAuthContext(request, env);
        const rejected = authRejected(auth, env);
        if (rejected) return rejected;
        const id = await saveLead(env, { name, email, org, message, userId: auth.userId });
        await logRevenueEvent(env, auth.userId || email, "enterprise", "enterprise_lead_created", true, email);
        return json({ success: true, lead_id: id || null }, 200, env);
      }

      // Keep existing endpoints working by delegating to previous implementation.
      const legacyResponse = await legacy.fetch(request as any, env as any);
      return withSecurityHeaders(legacyResponse, env);
    } catch {
      return blocked(403, env);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    try {
      console.log("0700 Commander Mode Triggered:", new Date().toISOString());
      const sendWindow = shouldSendNow({
        BRIEF_TIMEZONE: env.BRIEF_TIMEZONE || "America/Chicago",
        BRIEF_SEND_HHMM: String(env.BRIEF_SEND_HHMM || "0700"),
      });
      if (!sendWindow.match) {
        console.log("[scheduled] skipped outside brief window", sendWindow);
        return;
      }
      const envWarnings = requiredEnvWarnings(env);
      if (envWarnings.length) {
        console.warn("[config-warning]", envWarnings.join("; "));
      }
      if (!env.DAILY_BRIEF_LOG) {
        console.log("scheduled daily brief skipped: DAILY_BRIEF_LOG KV not bound");
        return;
      }

      const date = todayIsoDateUTC();
      const todayBrief = await ensureTodayDailyBrief(env, date);
      if (todayBrief.created) {
        await logSystemBriefGenerated(env, {
          date,
          source: "scheduled",
          key: todayBrief.key,
          success: true,
        });
      }

      const revenueBrief = await ensureRevenueBrief(env, date);
      if (revenueBrief.created) {
        await logSystemBriefGenerated(env, {
          date,
          source: "scheduled",
          key: revenueBrief.key,
          success: true,
        });
      }

      const commander = await ensureCommanderDaily(env, date, true);
      if (commander.created) {
        await logSystemBriefGenerated(env, {
          date,
          source: "scheduled",
          key: commander.key,
          success: true,
        });
      }

      const distributionDraft = await runAgent("distribution", "draft", env, {
        date,
        trigger: "scheduled",
        context: { source: "cron" },
      });
      console.log("[scheduled] distribution agent run", JSON.stringify({
        success: distributionDraft.success,
        status: distributionDraft.status,
        runId: distributionDraft.runId,
        draft_key: distributionDraft.draft_key || null,
      }));

      const auto = await handleAutoBrief(env, { source: "scheduled" });
      if (auto.created) {
        await logSystemBriefGenerated(env, {
          date,
          source: "scheduled",
          key: auto.key,
          success: true,
        });
      }

      const command = await runDailyNotifier(env, "scheduled", { sendIfExisting: false });
      if (command.created) {
        await logSystemBriefGenerated(env, {
          date,
          source: "scheduled",
          key: command.brief_key,
          success: true,
        });
      }
    } catch (error) {
      console.error("scheduled brief job failed", error);
    }
  },
};

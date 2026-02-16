import legacy from "./legacy.js";
import { getAuthContext } from "./middleware/auth";
import { isRateLimited } from "./middleware/rateLimit";
import { handleBrief } from "./handlers/brief";
import { generateBrief } from "./briefing";
import { sendBriefEmail } from "./email";
import {
  buildDailyBrief,
  ensureTodayDailyBrief,
  listRecentDailyBriefs,
  saveDailyBrief,
  todayIsoDateUTC,
} from "./services/dailyBrief";
import {
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
  listBriefHistory,
  logRevenueEvent,
  logSystemBriefGenerated,
  saveLead,
} from "./services/usage";

type Env = {
  ALLOWED_ORIGINS?: string;
  USER_STATE?: KVNamespace;
  USAGE_STATE?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  DAILY_BRIEF_LOG?: KVNamespace;
  COMMAND_LOG?: KVNamespace;
  BRIEF_LOG?: KVNamespace;
  LEADS?: KVNamespace;
  REVENUECAT_WEBHOOK_SECRET?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ADMIN_TOKEN?: string;
  BRIEF_TIMEZONE?: string;
  BRIEF_SEND_HHMM?: string;
  BRIEF_EMAIL_TO?: string;
  FROM_EMAIL?: string;
  RESEND_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ELITE?: string;
  ENTERPRISE_DAILY_LIMIT?: string;
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

async function handleUnifiedWebhook(request: Request, env: Env): Promise<Response> {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return blocked(400, env);

  const webhookType = String((payload as any)?.type || "").toLowerCase();
  const isRevenueCat = Boolean((payload as any)?.event || webhookType.includes("revenuecat"));
  const auth = request.headers.get("Authorization") || "";
  const secretConfigured = Boolean(String(env.REVENUECAT_WEBHOOK_SECRET || "").trim());
  const secretValid = validateRevenueCatSecret(request, env);

  if (secretConfigured && !secretValid) return blocked(401, env);

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

  let tier: Tier = "free";
  if (eventType.includes("elite")) tier = "elite";
  if (eventType.includes("enterprise")) tier = "enterprise";
  if (eventType.includes("pro")) tier = "pro";
  if (eventType.includes("deleted") || eventType.includes("expired") || eventType.includes("canceled")) tier = "free";

  const metadataTier = String(
    stripeObject?.metadata?.tier ||
    stripeObject?.metadata?.plan ||
    ""
  ).toLowerCase();
  if (metadataTier === "pro" || metadataTier === "elite" || metadataTier === "enterprise" || metadataTier === "free") {
    tier = metadataTier as Tier;
  }

  if (eventType.includes("checkout.session.completed") && stripeObject?.metadata?.plan) {
    const plan = String(stripeObject.metadata.plan).toLowerCase();
    if (plan === "pro" || plan === "elite" || plan === "enterprise") tier = plan as Tier;
  }

  await setTier(env, userId, tier);
  await logRevenueEvent(env, userId, tier, "webhook_stripe", true, userEmail);
  return json({ success: true, source: "stripe", user_id: userId, tier }, 200, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

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
      if ((url.pathname === "/api/webhook" || url.pathname === "/revenuecat/webhook") && request.method === "POST") {
        return await handleUnifiedWebhook(request, env);
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

      if (url.pathname === "/api/brief/history" && request.method === "GET") {
        if (!env.DAILY_BRIEF_LOG) return json({ error: "DAILY_BRIEF_LOG KV not bound" }, 500, env);
        const items = await listRecentDailyBriefs(env, 7);
        return json({ success: true, items }, 200, env);
      }

      if (url.pathname === "/api/brief/test" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401, env);
        const userId = String(url.searchParams.get("userId") || "colonel").trim() || "colonel";
        const cfg = await readBriefCfg(env, userId);
        const brief = await generateBrief({ ...env, BRIEF_TIMEZONE: cfg.BRIEF_TIMEZONE }, { timezone: cfg.BRIEF_TIMEZONE });
        return json({ success: true, userId, cfg, brief }, 200, env);
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
        const auth = getAuthContext(request);
        if (!auth.userId) return blocked(401, env);
        const tier = await getTier(env, auth.userId);
        const usageToday = await getUsage(env, auth.userId);
        return json(
          {
            success: true,
            user_id: auth.userId,
            tier,
            usage_today: usageToday,
            usage_limit: tierLimit(tier as Tier, env),
          },
          200,
          env
        );
      }

      if (url.pathname === "/api/me" && request.method === "GET") {
        const auth = getAuthContext(request);
        if (!auth.userId) {
          return json(
            {
              success: true,
              user_id: null,
              tier: "free",
              usage_today: 0,
              usage_limit: tierLimit("free", env),
            },
            200,
            env
          );
        }
        const tier = await getTier(env, auth.userId);
        const usageToday = await getUsage(env, auth.userId);
        return json(
          {
            success: true,
            user_id: auth.userId,
            tier,
            usage_today: usageToday,
            usage_limit: tierLimit(tier as Tier, env),
          },
          200,
          env
        );
      }

      if ((url.pathname === "/api/briefs" || url.pathname === "/briefs") && request.method === "GET") {
        const auth = getAuthContext(request);
        if (!auth.userId) return blocked(401, env);
        const tier = await getTier(env, auth.userId);
        const items = await listBriefHistory(env, auth.userId, 20);
        await logRevenueEvent(env, auth.userId, tier, "brief_history_read", true, auth.email);
        return json({ success: true, items }, 200, env);
      }

      if (url.pathname === "/api/brief" && request.method === "POST") {
        const auth = getAuthContext(request);
        if (!auth.userId) return blocked(401, env);
        const tier = await getTier(env, auth.userId);
        return await handleBrief(request, env, auth.userId, tier as Tier);
      }

      if (url.pathname === "/api/checkout" && request.method === "POST") {
        const body = await request.json().catch(() => ({} as any));
        const plan = String(body?.plan || "").toLowerCase();
        if (!["pro", "elite"].includes(plan)) {
          return blocked(400, env);
        }
        if (!env.STRIPE_SECRET_KEY) {
          return stripeNotConfigured(env);
        }
        const priceId = plan === "pro" ? String(env.STRIPE_PRICE_PRO || "").trim() : String(env.STRIPE_PRICE_ELITE || "").trim();
        if (!priceId) {
          return stripeNotConfigured(env);
        }
        const successUrl = String(body?.successUrl || "");
        const cancelUrl = String(body?.cancelUrl || "");
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
        await logRevenueEvent(env, checkoutRef || "anonymous", plan, "checkout_created", true, userEmail);
        return json({ success: true, url: data.url, id: data.id }, 200, env);
      }

      if (url.pathname === "/api/lead" && request.method === "POST") {
        const body = await request.json().catch(() => ({} as any));
        const name = String(body?.name || "").trim();
        const email = String(body?.email || "").trim();
        const org = String(body?.org || "").trim();
        const message = String(body?.message || "").trim();
        if (!name || !email || !org || !message) return blocked(400, env);
        const auth = getAuthContext(request);
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
      if (!env.DAILY_BRIEF_LOG) {
        console.log("scheduled daily brief skipped: DAILY_BRIEF_LOG KV not bound");
        return;
      }

      const date = todayIsoDateUTC();
      const brief = buildDailyBrief(date);
      const key = await saveDailyBrief(env, brief);
      await logSystemBriefGenerated(env, {
        date,
        source: "scheduled",
        key,
        success: true,
      });

      if (env.COMMAND_LOG) {
        const command = await ensureTodayCommandBrief(env, date);
        await logSystemBriefGenerated(env, {
          date,
          source: "scheduled",
          key: command.key,
          success: true,
        });
      }

      // Keep existing Phase 2 email behavior available without forcing it.
      const cfg = await readBriefCfg(env, "colonel");
      const schedEnv = {
        ...env,
        BRIEF_TIMEZONE: cfg.BRIEF_TIMEZONE,
        BRIEF_EMAIL_TO: cfg.BRIEF_EMAIL_TO || env.BRIEF_EMAIL_TO,
      };
      const legacyBrief = await generateBrief(schedEnv, { timezone: cfg.BRIEF_TIMEZONE });
      await sendBriefEmail(schedEnv, legacyBrief);
    } catch (error) {
      console.error("scheduled brief job failed", error);
    }
  },
};

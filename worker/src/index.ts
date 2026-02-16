import legacy from "./legacy.js";
import { getAuthContext } from "./middleware/auth";
import { isRateLimited } from "./middleware/rateLimit";
import { handleBrief } from "./handlers/brief";
import {
  getTier,
  setTier,
  tierLimit,
  tierFromRevenueCatPayload,
  validateRevenueCatSecret,
  type Tier
} from "./services/subscription";
import { getUsage, listBriefHistory, logRevenueEvent, saveLead } from "./services/usage";

type Env = {
  ALLOWED_ORIGINS?: string;
  USER_STATE?: KVNamespace;
  USAGE_STATE?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  LEADS?: KVNamespace;
  REVENUECAT_WEBHOOK_SECRET?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ELITE?: string;
  ENTERPRISE_DAILY_LIMIT?: string;
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
  }
};

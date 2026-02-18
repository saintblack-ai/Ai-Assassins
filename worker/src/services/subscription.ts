export type Tier = "free" | "pro" | "premium" | "elite" | "enterprise";

type Env = {
  USER_STATE?: KVNamespace;
  REVENUECAT_WEBHOOK_SECRET?: string;
};

const TIER_LIMITS: Record<Tier, number | null> = {
  free: 1,
  pro: 25,
  premium: 10,
  elite: 100,
  enterprise: null,
};

export function tierLimit(tier: Tier, env?: Env): number | null {
  if (tier === "enterprise") return null;
  return TIER_LIMITS[tier] ?? 1;
}

export function isUsageAllowed(tier: Tier, usedToday: number, env?: Env): boolean {
  const limit = tierLimit(tier, env);
  if (limit == null) return true;
  return usedToday < limit;
}

export async function getTier(env: Env, userId: string): Promise<Tier> {
  if (!env.USER_STATE) return "free";
  const saved = await env.USER_STATE.get(`user:${userId}:tier`);
  if (saved === "pro" || saved === "premium" || saved === "elite" || saved === "enterprise") return saved;
  return "free";
}

export async function setTier(env: Env, userId: string, tier: Tier): Promise<void> {
  if (!env.USER_STATE) return;
  await env.USER_STATE.put(`user:${userId}:tier`, tier);
}

export function validateRevenueCatSecret(request: Request, env: Env): boolean {
  const secret = String(env.REVENUECAT_WEBHOOK_SECRET || "").trim();
  if (!secret) return true;
  const auth = request.headers.get("Authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return provided === secret;
}

export function tierFromRevenueCatPayload(payload: any): Tier {
  const entitlements = payload?.event?.entitlement_ids || payload?.entitlement_ids || [];
  if (Array.isArray(entitlements)) {
    const normalized = entitlements.map((x) => String(x).toLowerCase());
    if (normalized.includes("enterprise")) return "enterprise";
    if (normalized.includes("elite")) return "elite";
    if (normalized.includes("pro")) return "pro";
  }

  const productId = String(payload?.event?.product_id || payload?.product_id || "").toLowerCase();
  if (productId.includes("enterprise")) return "enterprise";
  if (productId.includes("elite")) return "elite";
  if (productId.includes("pro")) return "pro";

  const eventType = String(payload?.event?.type || payload?.type || "").toUpperCase();
  if (["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"].includes(eventType)) return "free";
  return "pro";
}

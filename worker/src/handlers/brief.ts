import { tierLimit, type Tier } from "../services/subscription";
import { getUsage, incrementUsage, logRevenueEvent, saveBriefHistory } from "../services/usage";
import { buildIntelligencePayload, recommendedActions, scoreIntelligence } from "../services/intel";

type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  FREE_BRIEFS_PER_DAY?: string;
  USAGE_STATE?: KVNamespace;
  DAILY_BRIEF_LOG?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  BRIEF_HISTORY?: KVNamespace;
};

export async function handleBrief(request: Request, env: Env, userId: string | null, tier: Tier): Promise<Response> {
  const effectiveUserId = userId || "device:guest";
  const isGuest = effectiveUserId === "device:guest";
  const effectiveTier: Tier = isGuest ? "free" : tier;
  const quota = isGuest ? Number(env.FREE_BRIEFS_PER_DAY || 1) : tierLimit(effectiveTier, env as any);
  const usedToday = isGuest ? await getGuestUsage(env) : await getUsage(env, effectiveUserId);

  if (!isUsageAllowedByQuota(usedToday, quota)) {
    await logRevenueEvent(env, effectiveUserId, effectiveTier, "brief_limit_blocked", false);
    return limitReached(usedToday, quota, env);
  }

  const OPENAI_API_KEY = String(env.OPENAI_API_KEY || "").trim();
  if (!OPENAI_API_KEY) {
    await logRevenueEvent(env, effectiveUserId, effectiveTier, "brief_missing_openai_key", false);
    return blocked(503, ["OPENAI_API_KEY"], env);
  }

  const input = await request.json().catch(() => ({} as any));
  let brief: any;
  try {
    brief = await generateBrief(OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-4.1-mini", input);
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown_error";
    return makeJson({
      success: false,
      error: "openai_request_failed",
      details,
    }, 502, env);
  }

  if (isGuest) {
    await incrementGuestUsage(env);
  } else {
    await incrementUsage(env, effectiveUserId);
  }
  await saveBriefHistory(env, effectiveUserId, brief);
  if (effectiveTier !== "free") {
    await logRevenueEvent(env, effectiveUserId, effectiveTier, "brief_generated", true);
  }
  console.log(
    JSON.stringify({
      event: "BRIEF_GENERATED",
      user_id: effectiveUserId,
      tier: effectiveTier,
      usage_today: usedToday + 1,
      usage_limit: quota,
    })
  );

  const briefPayload = {
    tier: effectiveTier,
    usage_today: usedToday + 1,
    usage_limit: quota,
    ...brief,
  };

  return ok({
    success: true,
    brief: briefPayload,
    ...briefPayload,
  }, 200, env);
}

async function generateBrief(apiKey: string, model: string, input: any): Promise<any> {
  const intel = await buildIntelligencePayload(input);
  const scores = scoreIntelligence(intel);
  const actions = recommendedActions(scores);
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You are a senior intelligence analyst. Return strict JSON only with clear strategic narrative and actionable recommendations."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Date: ${today}`,
              `Focus: ${input?.focus || "geopolitics, markets, operations"}`,
              `Tone: ${input?.tone || "strategic"}`,
              `Intelligence payload: ${JSON.stringify(intel)}`,
              `Pre-scored metrics: ${JSON.stringify(scores)}`,
              `Recommended actions seed: ${JSON.stringify(actions)}`
            ].join("\n")
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "brief",
        schema: {
          type: "object",
          additionalProperties: true,
          properties: {
            overnight_overview: { type: "array", items: { type: "string" } },
            markets_snapshot: { type: "object" },
            weather_local: { type: "object" },
            next_up_calendar: { type: "array", items: { type: "string" } },
            scripture_of_day: { type: "object" },
            mission_priorities: { type: "array", items: { type: "string" } },
            truthwave: { type: "object" },
            top_tasks: { type: "array", items: { type: "string" } },
            command_note: { type: "string" },
            narrative: { type: "string" },
            risk_score: { type: "number" },
            volatility: { type: "number" },
            confidence: { type: "number" },
            priority: { type: "string" },
            recommended_actions: { type: "array", items: { type: "string" } }
          },
          required: [
            "overnight_overview",
            "markets_snapshot",
            "weather_local",
            "next_up_calendar",
            "scripture_of_day",
            "mission_priorities",
            "truthwave",
            "top_tasks",
            "command_note",
            "narrative",
            "risk_score",
            "volatility",
            "confidence",
            "priority",
            "recommended_actions"
          ]
        },
        strict: true
      }
    }
  };

  let parsed: any;
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      throw new Error(`openai_http_${r.status}:${errText.slice(0, 300)}`);
    }
    const data: any = await r.json();
    const output = extractOutputText(data);
    parsed = JSON.parse(output);
  } catch (error) {
    const details = error instanceof Error ? error.message : "openai_request_failed";
    throw new Error(details);
  }
  return {
    ...parsed,
    risk_score: Number(parsed?.risk_score ?? scores.risk_score),
    volatility: Number(parsed?.volatility ?? scores.volatility),
    confidence: Number(parsed?.confidence ?? scores.confidence),
    priority: String(parsed?.priority || scores.priority),
    recommended_actions: Array.isArray(parsed?.recommended_actions) ? parsed.recommended_actions : actions,
    intelligence_payload: intel,
    cyber_alert_level: scores.cyber_alert_level,
  };
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const block of output) {
    const content = Array.isArray(block?.content) ? block.content : [];
    for (const part of content) {
      if ((part?.type === "output_text" || part?.type === "text") && typeof part?.text === "string") {
        return part.text;
      }
    }
  }
  throw new Error("Invalid OpenAI response");
}

function corsOrigin(env?: Env): string {
  const raw = String(env?.ALLOWED_ORIGINS || "").trim();
  if (!raw) return "*";
  return raw.split(",")[0].trim() || "*";
}

function makeJson(data: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": corsOrigin(env),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'"
    }
  });
}

function ok(data: unknown, status = 200, env?: Env): Response {
  return makeJson(data, status, env);
}

function blocked(status = 403, missing: string[] = [], env?: Env): Response {
  return makeJson({ success: false, error: "configuration_error", ...(missing.length ? { missing } : {}) }, status, env);
}

function limitReached(usageToday: number, usageLimit: number | null, env?: Env): Response {
  return makeJson({
    success: false,
    error: "rate_limit_exceeded",
    usage_today: usageToday,
    usage_limit: usageLimit,
  }, 429, env);
}

function isUsageAllowedByQuota(usedToday: number, quota: number | null): boolean {
  if (quota == null) return true;
  return usedToday < quota;
}

function guestUsageKey(dateIso: string): string {
  return `guest_usage:${dateIso}`;
}

async function getGuestUsage(env: Env): Promise<number> {
  if (!env.DAILY_BRIEF_LOG) return 0;
  const key = guestUsageKey(new Date().toISOString().slice(0, 10));
  const raw = await env.DAILY_BRIEF_LOG.get(key);
  return Number(raw || 0);
}

async function incrementGuestUsage(env: Env): Promise<number> {
  if (!env.DAILY_BRIEF_LOG) return 0;
  const key = guestUsageKey(new Date().toISOString().slice(0, 10));
  const current = Number((await env.DAILY_BRIEF_LOG.get(key)) || 0);
  const next = current + 1;
  await env.DAILY_BRIEF_LOG.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 2 });
  return next;
}

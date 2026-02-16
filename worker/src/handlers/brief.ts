import { isUsageAllowed, tierLimit, type Tier } from "../services/subscription";
import { getUsage, incrementUsage, logRevenueEvent, saveBriefHistory } from "../services/usage";

type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  USAGE_STATE?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  BRIEF_HISTORY?: KVNamespace;
};

export async function handleBrief(request: Request, env: Env, userId: string, tier: Tier): Promise<Response> {
  const usedToday = await getUsage(env, userId);
  if (!isUsageAllowed(tier, usedToday, env as any)) {
    await logRevenueEvent(env, userId, tier, "/api/brief", false);
    return blocked(402);
  }

  const OPENAI_API_KEY = env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    await logRevenueEvent(env, userId, tier, "/api/brief", false);
    return blocked(503, ["OPENAI_API_KEY"]);
  }

  const input = await request.json().catch(() => ({} as any));
  const brief = await generateBrief(OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-4.1-mini", input);

  await incrementUsage(env, userId);
  await saveBriefHistory(env, userId, brief);
  await logRevenueEvent(env, userId, tier, "/api/brief", true);

  return ok({
    success: true,
    tier,
    usage_today: usedToday + 1,
    usage_limit: tierLimit(tier, env as any),
    ...brief,
  });
}

async function generateBrief(apiKey: string, model: string, input: any): Promise<any> {
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "Return strict JSON only. Build concise intelligence brief sections."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Date: ${today}\nFocus: ${input?.focus || "geopolitics, markets, operations"}\nTone: ${input?.tone || "strategic"}`
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
            command_note: { type: "string" }
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
            "command_note"
          ]
        },
        strict: true
      }
    }
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error("OpenAI request failed");
  const data: any = await r.json();
  const output = extractOutputText(data);
  return JSON.parse(output);
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

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'"
    }
  });
}

function blocked(status = 403, missing: string[] = []): Response {
  return new Response(JSON.stringify({ success: false, error: "Request blocked", ...(missing.length ? { missing } : {}) }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'"
    }
  });
}

export type DailyBrief = {
  date: string;
  mission_focus: string;
  revenue_focus: string;
  build_priority: string;
  system_status: {
    api: string;
    scheduler: string;
    kv: string;
  };
  empire_metric_snapshot: {
    briefs_generated_today: number | null;
    leads_captured_today: number | null;
    subscription_events_24h: number | null;
  };
};

type Env = {
  DAILY_BRIEF_LOG?: KVNamespace;
};

export function todayIsoDateUTC(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dailyBriefKey(date: string): string {
  return `brief:${date}`;
}

export function buildDailyBrief(date = todayIsoDateUTC()): DailyBrief {
  return {
    date,
    mission_focus:
      "Protect execution bandwidth, publish one strategic asset, and advance one infrastructure hardening step.",
    revenue_focus:
      "Prioritize conversion throughput, tighten trial-to-paid flow, and follow up on high-intent enterprise leads.",
    build_priority:
      "Ship one reliability improvement touching auth, rate limits, or briefing pipeline resilience.",
    system_status: {
      api: "operational",
      scheduler: "active",
      kv: "healthy",
    },
    empire_metric_snapshot: {
      briefs_generated_today: null,
      leads_captured_today: null,
      subscription_events_24h: null,
    },
  };
}

export async function getDailyBrief(env: Env, date: string): Promise<DailyBrief | null> {
  if (!env.DAILY_BRIEF_LOG) return null;
  const raw = await env.DAILY_BRIEF_LOG.get(dailyBriefKey(date));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveDailyBrief(env: Env, brief: DailyBrief): Promise<string> {
  if (!env.DAILY_BRIEF_LOG) throw new Error("DAILY_BRIEF_LOG KV not bound");
  const key = dailyBriefKey(brief.date);
  await env.DAILY_BRIEF_LOG.put(key, JSON.stringify(brief), {
    expirationTtl: 60 * 60 * 24 * 60,
  });
  return key;
}

export async function ensureTodayDailyBrief(
  env: Env,
  date = todayIsoDateUTC()
): Promise<{ brief: DailyBrief; key: string; created: boolean }> {
  const existing = await getDailyBrief(env, date);
  if (existing) {
    return { brief: existing, key: dailyBriefKey(date), created: false };
  }
  const brief = buildDailyBrief(date);
  const key = await saveDailyBrief(env, brief);
  return { brief, key, created: true };
}

export async function listRecentDailyBriefs(env: Env, limit = 7): Promise<DailyBrief[]> {
  if (!env.DAILY_BRIEF_LOG) return [];
  const listed = await env.DAILY_BRIEF_LOG.list({ prefix: "brief:", limit: 60 });
  const rows: DailyBrief[] = [];
  for (const key of listed.keys) {
    const raw = await env.DAILY_BRIEF_LOG.get(key.name);
    if (!raw) continue;
    try {
      rows.push(JSON.parse(raw));
    } catch {
      // ignore malformed rows
    }
  }
  return rows
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);
}

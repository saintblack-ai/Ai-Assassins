import { todayIsoDateUTC } from "./dailyBrief";

export type CommandBrief = {
  date: string;
  system_health: {
    worker_version: string;
    kv_bindings: string[];
  };
  usage_summary: {
    active_users: number;
    free_count: number;
    pro_count: number;
    elite_count: number;
    enterprise_count: number;
  };
  revenue_summary: {
    total_events: number;
    enterprise_leads: number;
  };
  top_actions: string[];
};

type Env = {
  USER_STATE?: KVNamespace;
  USAGE_STATE?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  LEADS?: KVNamespace;
  DAILY_BRIEF_LOG?: KVNamespace;
  COMMAND_LOG?: KVNamespace;
  WORKER_VERSION?: string;
};

type MetricsSnapshot = {
  usage_total_count: number;
  revenue_events_count: number;
  enterprise_leads_count: number;
  tier_distribution: {
    active_users: number;
    free_count: number;
    pro_count: number;
    elite_count: number;
    enterprise_count: number;
  };
};

async function listAllKeys(kv: KVNamespace, prefix: string): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const listed = await kv.list({ prefix, limit: 1000, cursor });
    for (const key of listed.keys) out.push(key.name);
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
  return out;
}

function commandKey(date: string): string {
  return `command:${date}`;
}

async function usageTotalCount(env: Env): Promise<number> {
  if (!env.USAGE_STATE) return 0;
  const keys = await listAllKeys(env.USAGE_STATE, "usage:");
  let total = 0;
  for (const key of keys) {
    const raw = await env.USAGE_STATE.get(key);
    total += Number(raw || 0);
  }
  return total;
}

async function revenueEventsCount(env: Env): Promise<number> {
  if (!env.REVENUE_LOG) return 0;
  const keys = await listAllKeys(env.REVENUE_LOG, "revenue_log:");
  return keys.length;
}

async function leadsCount(env: Env): Promise<number> {
  if (!env.LEADS) return 0;
  const keys = await listAllKeys(env.LEADS, "lead:");
  return keys.length;
}

async function tierDistribution(env: Env): Promise<MetricsSnapshot["tier_distribution"]> {
  if (!env.USER_STATE) {
    return { active_users: 0, free_count: 0, pro_count: 0, elite_count: 0, enterprise_count: 0 };
  }
  const keys = await listAllKeys(env.USER_STATE, "user:");
  const tierKeys = keys.filter((k) => k.endsWith(":tier"));

  let free_count = 0;
  let pro_count = 0;
  let elite_count = 0;
  let enterprise_count = 0;

  for (const key of tierKeys) {
    const tier = String((await env.USER_STATE.get(key)) || "free");
    if (tier === "pro") pro_count += 1;
    else if (tier === "elite") elite_count += 1;
    else if (tier === "enterprise") enterprise_count += 1;
    else free_count += 1;
  }

  const active_users = tierKeys.length;
  return { active_users, free_count, pro_count, elite_count, enterprise_count };
}

export async function getMetricsSnapshot(env: Env): Promise<MetricsSnapshot> {
  const [usage_total_count, revenue_events_count, enterprise_leads_count, tiers] = await Promise.all([
    usageTotalCount(env),
    revenueEventsCount(env),
    leadsCount(env),
    tierDistribution(env),
  ]);
  return {
    usage_total_count,
    revenue_events_count,
    enterprise_leads_count,
    tier_distribution: tiers,
  };
}

export async function buildCommandBrief(env: Env, date = todayIsoDateUTC()): Promise<CommandBrief> {
  const metrics = await getMetricsSnapshot(env);
  return {
    date,
    system_health: {
      worker_version: env.WORKER_VERSION || "unknown",
      kv_bindings: [
        "USER_STATE",
        "USAGE_STATE",
        "REVENUE_LOG",
        "LEADS",
        "DAILY_BRIEF_LOG",
        "COMMAND_LOG",
      ],
    },
    usage_summary: {
      active_users: metrics.tier_distribution.active_users,
      free_count: metrics.tier_distribution.free_count,
      pro_count: metrics.tier_distribution.pro_count,
      elite_count: metrics.tier_distribution.elite_count,
      enterprise_count: metrics.tier_distribution.enterprise_count,
    },
    revenue_summary: {
      total_events: metrics.revenue_events_count,
      enterprise_leads: metrics.enterprise_leads_count,
    },
    top_actions: [
      "Use /api/brief/test to generate insights",
      "Review command dashboard",
      "Check subscription conversion funnel",
    ],
  };
}

export async function getCommandBrief(env: Env, date: string): Promise<CommandBrief | null> {
  if (!env.COMMAND_LOG) return null;
  const raw = await env.COMMAND_LOG.get(commandKey(date));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCommandBrief(env: Env, brief: CommandBrief): Promise<string> {
  if (!env.COMMAND_LOG) throw new Error("COMMAND_LOG KV not bound");
  const key = commandKey(brief.date);
  await env.COMMAND_LOG.put(key, JSON.stringify(brief), {
    expirationTtl: 60 * 60 * 24 * 120,
  });
  return key;
}

export async function ensureTodayCommandBrief(
  env: Env,
  date = todayIsoDateUTC()
): Promise<{ brief: CommandBrief; key: string; created: boolean }> {
  const existing = await getCommandBrief(env, date);
  if (existing) return { brief: existing, key: commandKey(date), created: false };
  const brief = await buildCommandBrief(env, date);
  const key = await saveCommandBrief(env, brief);
  return { brief, key, created: true };
}

export async function listCommandHistory(env: Env, limit = 14): Promise<CommandBrief[]> {
  if (!env.COMMAND_LOG) return [];
  const out: CommandBrief[] = [];
  const now = new Date();
  for (let i = 0; i < limit; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const isoDate = d.toISOString().slice(0, 10);
    const raw = await env.COMMAND_LOG.get(commandKey(isoDate));
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // ignore malformed rows
    }
  }
  return out;
}

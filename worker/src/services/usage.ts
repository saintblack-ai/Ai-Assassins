type Env = {
  USER_STATE?: KVNamespace;
  USAGE_STATE?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  LEADS?: KVNamespace;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function usageKey(userId: string, day = todayUtc()): string {
  return `usage:${userId}:${day}`;
}

export async function getUsage(env: Env, userId: string, day?: string): Promise<number> {
  if (!env.USAGE_STATE) return 0;
  const raw = await env.USAGE_STATE.get(usageKey(userId, day));
  return Number(raw || 0);
}

export async function incrementUsage(env: Env, userId: string): Promise<number> {
  if (!env.USAGE_STATE) return 0;
  const key = usageKey(userId);
  const current = await getUsage(env, userId);
  const next = current + 1;
  await env.USAGE_STATE.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 7 });
  return next;
}

export async function logRevenueEvent(
  env: Env,
  userId: string,
  tier: string,
  endpoint: string,
  success: boolean
): Promise<void> {
  if (!env.REVENUE_LOG) return;
  const ts = Date.now();
  const key = `revenue_log:${ts}:${userId}`;
  await env.REVENUE_LOG.put(
    key,
    JSON.stringify({
      tier,
      endpoint,
      success,
      timestamp: new Date(ts).toISOString(),
    }),
    { expirationTtl: 60 * 60 * 24 * 90 }
  );
}

export async function saveBriefHistory(env: Env, userId: string, brief: unknown): Promise<void> {
  if (!env.USER_STATE) return;
  const ts = Date.now();
  await env.USER_STATE.put(
    `brief:${userId}:${ts}`,
    JSON.stringify({
      id: ts,
      timestamp: new Date(ts).toISOString(),
      data: brief,
    }),
    { expirationTtl: 60 * 60 * 24 * 90 }
  );
}

export async function listBriefHistory(env: Env, userId: string, limit = 20): Promise<any[]> {
  if (!env.USER_STATE) return [];
  const listed = await env.USER_STATE.list({ prefix: `brief:${userId}:`, limit });
  const out: any[] = [];
  for (const key of listed.keys) {
    const raw = await env.USER_STATE.get(key.name);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // ignore malformed history rows
    }
  }
  return out.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

export async function saveLead(
  env: Env,
  payload: { name: string; email: string; org: string; message: string; userId?: string | null }
): Promise<string> {
  if (!env.LEADS) return "";
  const id = crypto.randomUUID();
  const ts = new Date().toISOString();
  await env.LEADS.put(
    `lead:${ts}:${id}`,
    JSON.stringify({
      id,
      created_at: ts,
      ...payload,
    }),
    { expirationTtl: 60 * 60 * 24 * 365 }
  );
  return id;
}

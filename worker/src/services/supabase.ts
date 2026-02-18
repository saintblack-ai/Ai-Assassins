import type { Tier } from "./subscription";

export type SupabaseEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
};

type SupabaseUserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
};

export type ValidatedTokenResult = {
  userId: string;
  email: string | null;
  createdAt: string | null;
};

export type BriefRow = {
  id: string;
  timestamp: string;
  location: string | null;
  focus: string | null;
  tone: string | null;
  data: unknown;
};

type RestResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

function supabaseUrl(env: SupabaseEnv): string {
  return String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
}

function serviceRoleKey(env: SupabaseEnv): string {
  return String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function hasSupabase(env: SupabaseEnv): boolean {
  return Boolean(supabaseUrl(env) && serviceRoleKey(env));
}

function headers(env: SupabaseEnv): Record<string, string> {
  const key = serviceRoleKey(env);
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function restCall<T>(
  env: SupabaseEnv,
  path: string,
  method: "GET" | "POST" | "DELETE" | "PATCH",
  body?: unknown,
  query = ""
): Promise<RestResult<T>> {
  if (!hasSupabase(env)) return { ok: false, status: 503, data: null };
  const url = `${supabaseUrl(env)}/rest/v1/${path}${query}`;
  const response = await fetch(url, {
    method,
    headers: headers(env),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text().catch(() => "");
  let parsed: T | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  return { ok: response.ok, status: response.status, data: parsed };
}

export async function validateToken(jwt: string, env: SupabaseEnv): Promise<string | null> {
  if (!hasSupabase(env) || !jwt) return null;
  try {
    const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey(env),
        Authorization: `Bearer ${jwt}`,
      },
    });
    if (!response.ok) return null;
    const data: any = await response.json().catch(() => null);
    const userId = String(data?.id || "").trim();
    return userId || null;
  } catch {
    return null;
  }
}

export async function validateSupabaseToken(env: SupabaseEnv, jwt: string): Promise<ValidatedTokenResult | null> {
  if (!hasSupabase(env) || !jwt) return null;
  try {
    const response = await fetch(`${supabaseUrl(env)}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey(env),
        Authorization: `Bearer ${jwt}`,
      },
    });
    if (!response.ok) return null;
    const data: any = await response.json().catch(() => null);
    const userId = String(data?.id || "").trim();
    if (!userId) return null;
    return {
      userId,
      email: data?.email ? String(data.email) : null,
      createdAt: data?.created_at ? String(data.created_at) : null,
    };
  } catch {
    return null;
  }
}

export async function upsertSupabaseUser(env: SupabaseEnv, user: SupabaseUserRow): Promise<boolean> {
  if (!hasSupabase(env) || !user.id) return false;
  const payload = [{
    id: user.id,
    email: user.email,
    created_at: user.created_at || new Date().toISOString(),
  }];
  const result = await restCall<any[]>(env, "users", "POST", payload);
  return result.ok;
}

export async function insertBrief(
  userId: string,
  brief: unknown,
  env: SupabaseEnv,
  options?: { location?: string | null; focus?: string | null; tone?: string | null }
): Promise<string | null> {
  if (!hasSupabase(env) || !userId) return null;
  const payload = [{
    user_id: userId,
    brief_json: brief,
    location: options?.location || null,
    focus: options?.focus || null,
    tone: options?.tone || null,
    timestamp: new Date().toISOString(),
  }];
  const result = await restCall<any[]>(env, "briefs", "POST", payload);
  if (!result.ok || !Array.isArray(result.data) || !result.data[0]?.id) return null;
  return String(result.data[0].id);
}

export async function saveSupabaseBrief(
  env: SupabaseEnv,
  payload: {
    user_id: string;
    brief_json: unknown;
    location?: string | null;
    focus?: string | null;
    tone?: string | null;
  }
): Promise<string | null> {
  return insertBrief(payload.user_id, payload.brief_json, env, {
    location: payload.location,
    focus: payload.focus,
    tone: payload.tone,
  });
}

export async function listBriefs(userId: string, env: SupabaseEnv, limit = 30): Promise<BriefRow[]> {
  if (!hasSupabase(env) || !userId) return [];
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const query =
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&order=timestamp.desc` +
    `&limit=${safeLimit}` +
    `&select=id,user_id,brief_json,location,focus,tone,timestamp`;
  const result = await restCall<any[]>(env, "briefs", "GET", undefined, query);
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data.map((row: any) => ({
    id: String(row.id),
    timestamp: String(row.timestamp),
    location: row.location ?? null,
    focus: row.focus ?? null,
    tone: row.tone ?? null,
    data: row.brief_json,
  }));
}

export async function listSupabaseBriefs(env: SupabaseEnv, userId: string, limit = 30): Promise<BriefRow[]> {
  return listBriefs(userId, env, limit);
}

export async function deleteBrief(userId: string, briefId: string, env: SupabaseEnv): Promise<boolean> {
  if (!hasSupabase(env) || !userId || !briefId) return false;
  const query = `?id=eq.${encodeURIComponent(briefId)}&user_id=eq.${encodeURIComponent(userId)}`;
  const result = await restCall<any[]>(env, `briefs${query}`, "DELETE");
  return result.ok;
}

export async function deleteSupabaseBrief(env: SupabaseEnv, userId: string, briefId: string): Promise<boolean> {
  return deleteBrief(userId, briefId, env);
}

export async function getSubscriptionPlan(userId: string, env: SupabaseEnv): Promise<Tier> {
  if (!hasSupabase(env) || !userId) return "free";
  const query =
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&order=updated_at.desc` +
    `&limit=1` +
    `&select=plan,status`;
  const result = await restCall<any[]>(env, "subscriptions", "GET", undefined, query);
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return "free";
  const row = result.data[0];
  if (String(row?.status || "").toLowerCase() !== "active") return "free";
  const plan = String(row?.plan || "").toLowerCase();
  if (plan === "enterprise") return "enterprise";
  if (plan === "elite") return "elite";
  if (plan === "pro") return "pro";
  if (plan === "premium") return "premium";
  return "free";
}

export async function getSupabaseTier(env: SupabaseEnv, userId: string): Promise<Tier | null> {
  return getSubscriptionPlan(userId, env);
}

export async function upsertSupabaseSubscription(
  env: SupabaseEnv,
  userId: string,
  plan: Tier,
  status = "active"
): Promise<boolean> {
  if (!hasSupabase(env) || !userId) return false;
  const payload = [{
    user_id: userId,
    plan,
    status,
    updated_at: new Date().toISOString(),
  }];
  const result = await restCall<any[]>(env, "subscriptions", "POST", payload);
  return result.ok;
}

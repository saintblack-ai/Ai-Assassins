import { createClient } from "@supabase/supabase-js";
import { getProfile, type SupabaseEnv } from "./services/supabase";

export type RequestContext = {
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    is_active_subscriber: boolean;
  };
  accessToken: string;
};

type AuthResult =
  | { ok: true; ctx: RequestContext }
  | { ok: false; status: number; error: string };

function bearerToken(request: Request): string {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

export async function authenticateRequest(request: Request, env: SupabaseEnv): Promise<AuthResult> {
  const url = String(env.SUPABASE_URL || "").trim();
  const anon = String(env.SUPABASE_ANON_KEY || "").trim();
  const token = bearerToken(request);
  if (!url || !anon) return { ok: false, status: 503, error: "supabase_not_configured" };
  if (!token) return { ok: false, status: 401, error: "missing_token" };

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userRes = await client.auth.getUser(token);
  const user = userRes.data?.user || null;
  if (userRes.error || !user?.id) return { ok: false, status: 401, error: "invalid_token" };

  const profile = await getProfile(env, user.id);
  return {
    ok: true,
    ctx: {
      user: { id: user.id, email: user.email || null },
      profile: {
        is_active_subscriber: Boolean(profile?.is_active_subscriber),
      },
      accessToken: token,
    },
  };
}

export async function requireAuth(request: Request, env: SupabaseEnv): Promise<AuthResult> {
  return authenticateRequest(request, env);
}

export async function requireSubscriber(request: Request, env: SupabaseEnv): Promise<AuthResult> {
  const auth = await authenticateRequest(request, env);
  if (!auth.ok) return auth;
  if (!auth.ctx.profile.is_active_subscriber) {
    return { ok: false, status: 403, error: "subscription_inactive" };
  }
  return auth;
}


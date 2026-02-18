import { validateSupabaseToken, validateToken } from "../services/supabase";

export type AuthContext = {
  userId: string | null;
  email: string | null;
  validated: boolean;
  createdAt: string | null;
  tokenProvided: boolean;
  invalidToken: boolean;
};

type AuthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function sanitizeDeviceId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
}

export async function getAuthContext(request: Request, env?: AuthEnv): Promise<AuthContext> {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (token) {
    const userId = await validateToken(token, env || {});
    if (!userId) {
      return {
        userId: null,
        email: null,
        createdAt: null,
        validated: false,
        tokenProvided: true,
        invalidToken: true,
      };
    }

    const verified = await validateSupabaseToken(env || {}, token);
    return {
      userId,
      email: verified?.email ?? null,
      createdAt: verified?.createdAt ?? null,
      validated: true,
      tokenProvided: true,
      invalidToken: false,
    };
  }

  const deviceId = sanitizeDeviceId(request.headers.get("X-Device-Id") || "");
  if (deviceId) {
    return {
      userId: `device:${deviceId}`,
      email: null,
      createdAt: null,
      validated: false,
      tokenProvided: false,
      invalidToken: false,
    };
  }

  return {
    userId: null,
    email: null,
    createdAt: null,
    validated: false,
    tokenProvided: false,
    invalidToken: false,
  };
}

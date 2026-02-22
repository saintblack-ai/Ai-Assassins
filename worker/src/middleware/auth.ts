import { validateSupabaseToken, validateToken } from "../services/supabase";

export type AuthContext = {
  userId: string | null;
  email: string | null;
  validated: boolean;
  createdAt: string | null;
  tokenProvided: boolean;
  invalidToken: boolean;
  isGuest: boolean;
};

type AuthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  REQUIRE_AUTH?: string;
};

function sanitizeDeviceId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
}

function deterministicGuestId(request: Request): string {
  const deviceHeader = sanitizeDeviceId(request.headers.get("X-Device-Id") || "");
  if (deviceHeader) return `device:${deviceHeader}`;

  const ip = String(request.headers.get("CF-Connecting-IP") || "unknown").trim();
  const ua = String(request.headers.get("User-Agent") || "unknown").trim();
  const seed = `${ip}|${ua}`;

  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }
  return `device:guest_${hash.toString(16)}`;
}

export async function getAuthContext(request: Request, env?: AuthEnv): Promise<AuthContext> {
  const requireAuth = String(env?.REQUIRE_AUTH || "").toLowerCase() === "true";
  const authHeader = request.headers.get("Authorization") || "";
  const bearerProvided = authHeader.startsWith("Bearer ");
  const token = bearerProvided ? authHeader.slice(7).trim() : "";
  if (bearerProvided && !token) {
    return {
      userId: null,
      email: null,
      createdAt: null,
      validated: false,
      tokenProvided: true,
      invalidToken: true,
      isGuest: false,
    };
  }

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
        isGuest: false,
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
      isGuest: false,
    };
  }

  if (requireAuth) {
    return {
      userId: null,
      email: null,
      createdAt: null,
      validated: false,
      tokenProvided: false,
      invalidToken: false,
      isGuest: false,
    };
  }

  return {
    userId: deterministicGuestId(request),
    email: null,
    createdAt: null,
    validated: false,
    tokenProvided: false,
    invalidToken: false,
    isGuest: true,
  };
}

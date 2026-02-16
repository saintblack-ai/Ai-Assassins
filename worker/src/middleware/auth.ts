export type AuthContext = {
  userId: string | null;
  email: string | null;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

export function getAuthContext(request: Request): AuthContext {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { userId: null, email: null };

  try {
    const parts = token.split(".");
    if (parts.length < 2) return { userId: null, email: null };
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    const userId = String(payload?.sub || payload?.user_id || "").trim() || null;
    const email = payload?.email ? String(payload.email).trim() : null;
    return { userId, email };
  } catch {
    return { userId: null, email: null };
  }
}

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

const ipStore = new Map<string, { count: number; start: number }>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);

  if (!entry) {
    ipStore.set(ip, { count: 1, start: now });
    return false;
  }

  if (now - entry.start > RATE_WINDOW_MS) {
    ipStore.set(ip, { count: 1, start: now });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

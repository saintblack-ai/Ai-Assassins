type PublicEnv = {
  DAILY_BRIEF_LOG?: KVNamespace;
  COMMAND_LOG?: KVNamespace;
  AGENT_LOG?: KVNamespace;
};

type RevenueBriefSample = {
  top_priorities: string[];
  revenue_actions: string[];
  risks_alerts: string[];
};

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function sanitizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 8);
}

function sanitizeBrief(raw: any): RevenueBriefSample {
  return {
    top_priorities: sanitizeList(raw?.top_priorities),
    revenue_actions: sanitizeList(raw?.revenue_actions),
    risks_alerts: sanitizeList(raw?.risks_alerts),
  };
}

function fallbackSample(): RevenueBriefSample {
  return {
    top_priorities: [
      "Protect execution bandwidth and ship one high-impact improvement.",
      "Publish one strategic revenue-facing asset before noon.",
      "Close one reliability risk in production today.",
    ],
    revenue_actions: [
      "Tighten checkout copy to reduce friction.",
      "Follow up warm leads within 2 hours.",
      "Promote one clear Pro/Elite upgrade CTA.",
    ],
    risks_alerts: [
      "Monitor failed webhook deliveries.",
      "Watch for auth or rate-limit anomalies.",
    ],
  };
}

function listToHtml(items: string[]): string {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLanding(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Assassins</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#0a0f1a; color:#eef2ff; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 56px 20px 64px; }
    h1 { margin: 0 0 14px; font-size: clamp(2rem, 4vw, 3rem); line-height:1.15; }
    p.sub { margin: 0 0 28px; color:#b6c2de; font-size: 1.05rem; }
    a.cta { display:inline-block; background:#1f6feb; color:#fff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:600; }
    .pricing { margin-top:44px; border-top:1px solid #273145; padding-top:22px; }
    .tiers { display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin-top:14px; }
    .card { border:1px solid #2a3550; border-radius:10px; padding:14px; background:#0f1628; }
    footer { margin-top:42px; color:#92a0bf; font-size:.9rem; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Know exactly what to execute before 7AM.</h1>
    <p class="sub">AI-generated revenue intelligence for SaaS founders.</p>
    <a class="cta" href="/public/sample">View Today&#39;s Sample Brief</a>
    <section class="pricing">
      <h2>Pricing</h2>
      <div class="tiers">
        <div class="card"><strong>Free</strong></div>
        <div class="card"><strong>Pro</strong> &ndash; $29/mo</div>
        <div class="card"><strong>Elite</strong> &ndash; $99/mo</div>
      </div>
    </section>
    <footer>AI Assassins &ndash; 7AM Execution System</footer>
  </main>
</body>
</html>`;
}

function renderSamplePage(brief: RevenueBriefSample): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Assassins Sample Brief</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#0a0f1a; color:#eef2ff; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 34px 20px 54px; }
    h1 { margin:0 0 20px; }
    section { margin: 0 0 22px; border:1px solid #263247; border-radius:12px; background:#0f1628; padding:16px; }
    h2 { margin:0 0 10px; font-size:1.1rem; }
    ul { margin:0; padding-left:18px; }
    li { margin: 0 0 8px; color:#d8e0f7; }
    a { color:#7db8ff; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Today&#39;s Sample Brief</h1>
    <section>
      <h2>Top Priorities</h2>
      <ul>${listToHtml(brief.top_priorities)}</ul>
    </section>
    <section>
      <h2>Revenue Actions</h2>
      <ul>${listToHtml(brief.revenue_actions)}</ul>
    </section>
    <section>
      <h2>Risks & Alerts</h2>
      <ul>${listToHtml(brief.risks_alerts)}</ul>
    </section>
    <p><a href="/public/sample.json">View JSON</a></p>
  </main>
</body>
</html>`;
}

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip || "unknown"));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function logPublicHit(env: PublicEnv, route: string, ip: string): Promise<void> {
  const kv = env.AGENT_LOG || env.COMMAND_LOG;
  if (!kv) return;
  const ipHash = await hashIp(ip);
  const ts = new Date().toISOString();
  const record = { route, ts, ipHash };
  const key = `public:analytics:${route}:${ts}:${ipHash.slice(0, 12)}`;
  await kv.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 30 });
}

async function readOrGenerateSample(request: Request, env: PublicEnv): Promise<RevenueBriefSample> {
  const latestRaw = await env.DAILY_BRIEF_LOG?.get("brief:latest");
  if (latestRaw) {
    try {
      return sanitizeBrief(JSON.parse(latestRaw));
    } catch {
      // ignore malformed cached brief
    }
  }

  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/api/brief/latest`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (response.ok) {
    const payload = await response.json().catch(() => null);
    if (payload && typeof payload === "object") {
      const sanitized = sanitizeBrief(payload);
      if (sanitized.top_priorities.length || sanitized.revenue_actions.length || sanitized.risks_alerts.length) {
        return sanitized;
      }
    }
  }

  return fallbackSample();
}

export async function handlePublicRoute(request: Request, env: PublicEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;

  if (url.pathname === "/") {
    return html(renderLanding(), 200);
  }

  if (url.pathname === "/public/sample") {
    await logPublicHit(env, "/public/sample", request.headers.get("CF-Connecting-IP") || "unknown");
    const sample = await readOrGenerateSample(request, env);
    return html(renderSamplePage(sample), 200);
  }

  if (url.pathname === "/public/sample.json") {
    await logPublicHit(env, "/public/sample.json", request.headers.get("CF-Connecting-IP") || "unknown");
    const sample = await readOrGenerateSample(request, env);
    return new Response(JSON.stringify({ success: true, sample }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return null;
}


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8"
};

const SCRIPTURE_ROTATION = [
  {
    ref: "Psalm 27:1",
    text: "The LORD is my light and my salvation; whom shall I fear?",
    reflection: "Clarity and confidence should anchor high-pressure decisions."
  },
  {
    ref: "Isaiah 41:10",
    text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God.",
    reflection: "Lead with steadiness under uncertainty."
  },
  {
    ref: "John 14:27",
    text: "Peace I leave with you, my peace I give unto you.",
    reflection: "Maintain calm command tempo even amid volatility."
  },
  {
    ref: "Proverbs 21:31",
    text: "The horse is prepared against the day of battle: but safety is of the LORD.",
    reflection: "Preparedness is a strategic multiplier."
  }
];

const WEATHER_CODE_MAP = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail"
};

const IN_MEMORY_BRIEFS = new Map();
const IN_MEMORY_AUTH_TOKENS = new Map();
const IN_MEMORY_USAGE = new Map();
const IN_MEMORY_SUBSCRIPTIONS = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, ts: new Date().toISOString() });
      }

      if (request.method === "GET" && url.pathname === "/api/markets") {
        return json(await getMarkets());
      }

      if (request.method === "GET" && url.pathname === "/api/weather") {
        const lat = Number(url.searchParams.get("lat"));
        const lon = Number(url.searchParams.get("lon"));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return json({ error: "lat and lon are required" }, 400);
        }
        return json(await getWeather(lat, lon));
      }

      if (request.method === "GET" && url.pathname === "/api/scripture") {
        return json(getScripture());
      }

      if (request.method === "GET" && (url.pathname === "/api/me" || url.pathname === "/api/user/status")) {
        const auth = getAuthContext(request);
        const profile = auth.userId ? await getOrCreateUserProfile(env, auth.userId, auth.email || null) : null;
        const tier = auth.userId ? await resolveUserTier(env, auth.userId) : "free";
        const usage = auth.userId ? await getDailyUsage(env, auth.userId, new Date().toISOString().slice(0, 10)) : 0;
        return json({
          authenticated: Boolean(auth.userId),
          user_id: auth.userId || null,
          email: auth.email || null,
          tier,
          free_quota_per_day: getFreeQuota(env),
          usage_today: usage,
          profile
        });
      }

      if (request.method === "GET" && (url.pathname === "/briefs" || url.pathname === "/api/briefs")) {
        const auth = getAuthContext(request);
        if (!auth.userId && String(env.REQUIRE_AUTH || "").toLowerCase() === "true") {
          return json({ error: "Authentication required" }, 401);
        }
        const items = await listBriefs(env, 50, auth.userId);
        return json({ items });
      }

      if (request.method === "GET" && url.pathname === "/brief") {
        const id = url.searchParams.get("id");
        if (id) {
          const auth = getAuthContext(request);
          if (!auth.userId && String(env.REQUIRE_AUTH || "").toLowerCase() === "true") {
            return json({ error: "Authentication required" }, 401);
          }
          const stored = await getBriefById(env, id, auth.userId);
          if (!stored) return json({ error: "Brief not found" }, 404);
          return json(stored);
        }

        const validated = validateBriefQuery(url.searchParams);
        if (!validated.ok) return json({ error: validated.error }, 400);
        if (!isAllowedWriteOrigin(request, env)) {
          return json({ error: "Origin not allowed" }, 403);
        }
        if (!isAuthorizedWrite(request, env)) {
          return json({ error: "Unauthorized" }, 401);
        }
        const auth = getAuthContext(request);
        const usageCheck = await enforceUsageLimit(env, auth.userId);
        if (!usageCheck.ok) return json({ error: usageCheck.error, tier: usageCheck.tier, usage: usageCheck.usage, quota: usageCheck.quota }, 402);
        const brief = await buildBrief(validated.value, env);
        const saved = await saveBrief(env, brief, auth.userId);
        if (auth.userId) await incrementUsage(env, auth.userId);
        return json({ id: saved.id, ...brief });
      }

      if (request.method === "POST" && url.pathname === "/auth/login") {
        const body = await request.json().catch(() => ({}));
        const email = String(body?.email || "").trim();
        const password = String(body?.password || "");
        const valid = validateLogin(email, password, env);
        if (!valid) return json({ error: "Invalid credentials" }, 401);

        const token = issueAuthToken(email);
        return json({ token, email, expires_in: 86400 });
      }

      if (request.method === "POST" && (url.pathname === "/api/checkout/session" || url.pathname === "/api/billing/checkout")) {
        if (!isAllowedWriteOrigin(request, env)) {
          return json({ error: "Origin not allowed" }, 403);
        }
        if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
          return json({ error: "Checkout not configured. App remains available on Free tier." }, 501);
        }
        const body = await request.json().catch(() => ({}));
        const auth = getAuthContext(request);
        const appUrl = String(env.PUBLIC_APP_URL || "https://saintblack-ai.github.io/Ai-Assassins").replace(/\/$/, "");
        const successUrl = String(body?.success_url || `${appUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`);
        const cancelUrl = String(body?.cancel_url || `${appUrl}/cancel.html`);
        const email = String(body?.email || auth.email || "").trim();
        const userId = String(body?.user_id || body?.userId || auth.userId || email).trim();

        const session = await stripeCreateCheckoutSession(env.STRIPE_SECRET_KEY, {
          priceId: env.STRIPE_PRICE_ID,
          successUrl,
          cancelUrl,
          email,
          userId
        });
        return json({ ok: true, id: session.id, url: session.url });
      }

      if (request.method === "GET" && (url.pathname === "/api/checkout/status" || url.pathname === "/api/billing/status")) {
        const sessionId = String(url.searchParams.get("session_id") || "").trim();
        if (!sessionId) return json({ error: "session_id is required" }, 400);
        if (!env.STRIPE_SECRET_KEY) {
          return json({ error: "Checkout status not configured. Continue using Free tier." }, 501);
        }

        const session = await stripeGetCheckoutSession(env.STRIPE_SECRET_KEY, sessionId);
        const subscriptionId = session?.subscription ? String(session.subscription) : "";
        const subscription = subscriptionId ? await stripeGetSubscriptionById(env.STRIPE_SECRET_KEY, subscriptionId) : null;
        const status = String(subscription?.status || session?.status || "none");
        const tier = (status === "active" || status === "trialing") ? "pro" : "free";
        const userId = String(session?.client_reference_id || "").trim();
        if (userId) {
          await setUserTier(env, userId, tier, { provider: "stripe_checkout", session_id: sessionId, status });
        }

        return json({
          ok: true,
          session_id: sessionId,
          payment_status: session?.payment_status || "unpaid",
          status,
          tier,
          customer_id: session?.customer || null,
          subscription_id: subscriptionId || null,
          user_id: userId || null
        });
      }

      if (request.method === "POST" && url.pathname === "/subscribe") {
        const body = await request.json().catch(() => ({}));
        const email = String(body?.email || "").trim();
        const priceId = String(body?.priceId || body?.price_id || "").trim();
        const userId = String(body?.user_id || body?.userId || email).trim();
        if (!email || !priceId) return json({ error: "email and priceId are required" }, 400);
        if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe not configured" }, 501);

        const customer = await stripeCreateCustomer(env.STRIPE_SECRET_KEY, email);
        const subscription = await stripeCreateSubscription(env.STRIPE_SECRET_KEY, customer.id, priceId);
        await upsertSubscriptionStatus(env, customer.id, subscription.status || "incomplete", subscription);
        await setUserTier(env, userId, subscription.status === "active" ? "pro" : "free", {
          provider: "stripe",
          customer_id: customer.id,
          subscription_id: subscription.id,
          status: subscription.status
        });

        return json({
          ok: true,
          user_id: userId,
          customer_id: customer.id,
          subscription_id: subscription.id,
          status: subscription.status
        });
      }

      if (request.method === "POST" && url.pathname === "/revenuecat/webhook") {
        const secret = String(env.REVENUECAT_WEBHOOK_SECRET || "").trim();
        if (secret) {
          const authHeader = request.headers.get("Authorization") || "";
          const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
          if (provided !== secret) return json({ error: "Unauthorized webhook" }, 401);
        }
        const payload = await request.json().catch(() => null);
        if (!payload || typeof payload !== "object") return json({ error: "Invalid payload" }, 400);

        const appUserId = String(payload?.event?.app_user_id || payload?.app_user_id || "").trim();
        if (!appUserId) return json({ error: "Missing app_user_id" }, 400);

        const eventType = String(payload?.event?.type || payload?.type || "").toUpperCase();
        const isActive = ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE", "UNCANCELLATION"].includes(eventType);
        const tier = isActive ? "pro" : "free";
        await setUserTier(env, appUserId, tier, payload);
        return json({ ok: true, user_id: appUserId, tier });
      }

      if (request.method === "GET" && url.pathname === "/status") {
        const customerId = String(url.searchParams.get("customer_id") || "").trim();
        const userId = String(url.searchParams.get("user_id") || "").trim();
        if (!customerId && !userId) return json({ tier: "free", status: "none" });

        if (env.STRIPE_SECRET_KEY) {
          const latest = customerId ? await stripeGetLatestSubscription(env.STRIPE_SECRET_KEY, customerId) : null;
          const status = latest?.status || "none";
          if (customerId) await upsertSubscriptionStatus(env, customerId, status, latest || {});
          if (userId) await setUserTier(env, userId, status === "active" ? "pro" : "free", { provider: "stripe", status });
          return json({
            customer_id: customerId,
            user_id: userId || null,
            status,
            tier: status === "active" ? "pro" : "free"
          });
        }

        if (userId) {
          const tier = await resolveUserTier(env, userId);
          return json({ user_id: userId, status: tier === "pro" ? "active" : "none", tier });
        }

        const saved = customerId ? await getSubscriptionStatus(env, customerId) : null;
        if (!saved) return json({ customer_id: customerId, status: "none", tier: "free" });
        return json({
          customer_id: customerId,
          status: saved.status,
          tier: saved.status === "active" ? "pro" : "free"
        });
      }

      if (request.method === "POST" && url.pathname === "/api/brief") {
        const body = await request.json().catch(() => null);
        const validated = validateBriefBody(body);
        if (!validated.ok) {
          return json({ error: validated.error }, 400);
        }
        if (!isAllowedWriteOrigin(request, env)) {
          return json({ error: "Origin not allowed" }, 403);
        }
        if (!isAuthorizedWrite(request, env)) {
          return json({ error: "Unauthorized" }, 401);
        }
        const auth = getAuthContext(request);
        const usageCheck = await enforceUsageLimit(env, auth.userId);
        if (!usageCheck.ok) return json({ error: usageCheck.error, tier: usageCheck.tier, usage: usageCheck.usage, quota: usageCheck.quota }, 402);

        const brief = await buildBrief(validated.value, env);
        const saved = await saveBrief(env, brief, auth.userId);
        if (auth.userId) await incrementUsage(env, auth.userId);
        return json({ id: saved.id, ...brief });
      }

      if (request.method === "DELETE" && url.pathname === "/api/user/data") {
        if (!isAllowedWriteOrigin(request, env)) {
          return json({ error: "Origin not allowed" }, 403);
        }
        const auth = getAuthContext(request);
        if (!auth.userId) return json({ error: "Authentication required" }, 401);
        await deleteUserData(env, auth.userId);
        return json({ ok: true, deleted_user_id: auth.userId });
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: "Internal server error", detail: String(error?.message || error) }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function validateBriefBody(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const lat = input.lat == null ? null : Number(input.lat);
  const lon = input.lon == null ? null : Number(input.lon);
  const focus = typeof input.focus === "string" && input.focus.trim() ? input.focus.trim().slice(0, 500) : "geopolitics, defense, cyber, space";
  const tone = typeof input.tone === "string" && input.tone.trim() ? input.tone.trim().slice(0, 80) : "strategic";
  const icsUrl = typeof input.icsUrl === "string" ? input.icsUrl.trim() : (typeof input.ics_url === "string" ? input.ics_url.trim() : "");

  if ((lat == null) !== (lon == null)) {
    return { ok: false, error: "lat and lon must be provided together" };
  }
  if (lat != null && (!Number.isFinite(lat) || !Number.isFinite(lon))) {
    return { ok: false, error: "lat/lon must be numeric" };
  }
  if (icsUrl && !/^https?:\/\//i.test(icsUrl)) {
    return { ok: false, error: "icsUrl must be an http(s) URL" };
  }

  return {
    ok: true,
    value: {
      lat,
      lon,
      focus,
      tone,
      icsUrl
    }
  };
}

function validateBriefQuery(params) {
  return validateBriefBody({
    lat: params.get("lat"),
    lon: params.get("lon"),
    focus: params.get("focus"),
    tone: params.get("tone"),
    icsUrl: params.get("icsUrl") || params.get("ics_url")
  });
}

async function buildBrief(input, env) {
  const date = new Date().toISOString().slice(0, 10);

  const [markets, scripture, weather, calendar] = await Promise.all([
    getMarkets(),
    Promise.resolve(getScripture()),
    input.lat != null ? getWeather(input.lat, input.lon).catch(() => weatherFallback()) : Promise.resolve(weatherFallback()),
    input.icsUrl ? getNextCalendarEvents(input.icsUrl, 2).catch(() => []) : Promise.resolve([])
  ]);

  const aiBrief = await generateBriefWithOpenAI({ date, input, markets, scripture, weather, calendar }, env);

  return normalizeBrief(aiBrief, { date, markets, scripture, weather, calendar });
}

async function getMarkets() {
  const [sp500, nasdaq, wti, btc] = await Promise.all([
    fetchMarketValue("^GSPC", "^spx"),
    fetchMarketValue("^IXIC", "^ndq"),
    fetchMarketValue("CL=F", "cl.f"),
    fetchCoinGeckoBTC()
  ]);

  return {
    SP500: sp500,
    NASDAQ: nasdaq,
    WTI: wti,
    BTC: btc,
    ts: new Date().toISOString()
  };
}

async function fetchMarketValue(yahooSymbol, stooqSymbol) {
  const yahoo = await fetchYahooQuote(yahooSymbol);
  if (yahoo != null) return yahoo;
  return fetchStooqClose(stooqSymbol);
}

async function fetchYahooQuote(symbol) {
  try {
    const u = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const r = await fetch(u, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "ai-assassins-api"
      }
    });
    if (!r.ok) return null;
    const j = await r.json();
    const quote = j?.quoteResponse?.result?.[0];
    const price = Number(quote?.regularMarketPrice);
    return Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

async function fetchStooqClose(symbol) {
  try {
    const u = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
    const r = await fetch(u, { headers: { "User-Agent": "ai-assassins-api" } });
    if (!r.ok) return null;
    const text = await r.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const cols = lines[1].split(",");
    const close = Number(cols[6]);
    return Number.isFinite(close) ? close : null;
  } catch {
    return null;
  }
}

async function fetchCoinGeckoBTC() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    if (!r.ok) return fetchCoinbaseBTC();
    const j = await r.json();
    const v = Number(j?.bitcoin?.usd);
    if (Number.isFinite(v)) return v;
    return fetchCoinbaseBTC();
  } catch {
    return fetchCoinbaseBTC();
  }
}

async function fetchCoinbaseBTC() {
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/spot?currency=USD");
    if (!r.ok) return null;
    const j = await r.json();
    const amount = Number(j?.data?.amount);
    return Number.isFinite(amount) ? amount : null;
  } catch {
    return null;
  }
}

async function getWeather(lat, lon) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("current_weather", "true");
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  u.searchParams.set("timezone", "auto");

  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`weather upstream ${r.status}`);
  const j = await r.json();
  const current = j.current_weather || {};
  const high = j.daily?.temperature_2m_max?.[0] ?? null;
  const low = j.daily?.temperature_2m_min?.[0] ?? null;
  const precip = current?.precipitation ?? null;

  return {
    summary: weatherCodeToDescription(current?.weathercode),
    high,
    low,
    precip
  };
}

function weatherCodeToDescription(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) return "Weather unavailable";
  return WEATHER_CODE_MAP[n] || `Weather code ${n}`;
}

function weatherFallback() {
  return {
    summary: "Location not set",
    high: "N/A",
    low: "N/A",
    precip: "N/A"
  };
}

async function saveBrief(env, brief, userId = null) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify(brief);

  if (env.BRIEFS_DB) {
    await ensureBriefTables(env);
    await env.BRIEFS_DB
      .prepare("INSERT INTO briefs (id, timestamp, json) VALUES (?1, ?2, ?3)")
      .bind(id, timestamp, payload)
      .run();
    if (userId) {
      await env.BRIEFS_DB
        .prepare("INSERT INTO brief_owners (brief_id, user_id, timestamp) VALUES (?1, ?2, ?3)")
        .bind(id, userId, timestamp)
        .run();
    }
  } else if (env.BRIEFS_KV) {
    await env.BRIEFS_KV.put(`brief:${id}`, payload);
    const rawIndex = await env.BRIEFS_KV.get("briefs:index");
    const parsed = rawIndex ? JSON.parse(rawIndex) : [];
    const next = [{ id, timestamp }, ...parsed].slice(0, 200);
    await env.BRIEFS_KV.put("briefs:index", JSON.stringify(next));
    if (userId) {
      const userIndexKey = `briefs:user:${userId}`;
      const rawUserIndex = await env.BRIEFS_KV.get(userIndexKey);
      const userParsed = rawUserIndex ? JSON.parse(rawUserIndex) : [];
      const userNext = [{ id, timestamp }, ...userParsed].slice(0, 200);
      await env.BRIEFS_KV.put(userIndexKey, JSON.stringify(userNext));
      await env.BRIEFS_KV.put(`brief_owner:${id}`, userId);
    }
  } else {
    IN_MEMORY_BRIEFS.set(id, { id, timestamp, userId: userId || null, json: payload });
  }

  return { id, timestamp };
}

async function getBriefById(env, id, userId = null) {
  if (!id) return null;

  if (env.BRIEFS_DB) {
    await ensureBriefTables(env);
    if (userId) {
      const owned = await env.BRIEFS_DB
        .prepare("SELECT brief_id FROM brief_owners WHERE brief_id = ?1 AND user_id = ?2")
        .bind(id, userId)
        .first();
      if (!owned) return null;
    }
    const row = await env.BRIEFS_DB
      .prepare("SELECT id, timestamp, json FROM briefs WHERE id = ?1")
      .bind(id)
      .first();
    if (!row) return null;
    return { id: row.id, timestamp: row.timestamp, ...JSON.parse(row.json) };
  } else if (env.BRIEFS_KV) {
    if (userId) {
      const owner = await env.BRIEFS_KV.get(`brief_owner:${id}`);
      if (owner !== userId) return null;
    }
    const payload = await env.BRIEFS_KV.get(`brief:${id}`);
    if (!payload) return null;
    return { id, ...JSON.parse(payload) };
  }

  const row = IN_MEMORY_BRIEFS.get(id);
  if (!row) return null;
  if (userId && row.userId !== userId) return null;
  return { id: row.id, timestamp: row.timestamp, ...JSON.parse(row.json) };
}

async function listBriefs(env, limit, userId = null) {
  if (env.BRIEFS_DB) {
    await ensureBriefTables(env);
    if (!userId) return [];
    const res = await env.BRIEFS_DB
      .prepare(
        "SELECT b.id AS id, b.timestamp AS timestamp FROM briefs b INNER JOIN brief_owners o ON o.brief_id = b.id WHERE o.user_id = ?1 ORDER BY b.timestamp DESC LIMIT ?2"
      )
      .bind(userId, limit)
      .all();
    return Array.isArray(res?.results) ? res.results : [];
  } else if (env.BRIEFS_KV) {
    if (!userId) return [];
    const rawIndex = await env.BRIEFS_KV.get(`briefs:user:${userId}`);
    const parsed = rawIndex ? JSON.parse(rawIndex) : [];
    return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
  }

  if (!userId) return [];
  return Array.from(IN_MEMORY_BRIEFS.entries())
    .map(([id, row]) => ({ id, timestamp: row.timestamp, userId: row.userId }))
    .filter((row) => row.userId === userId)
    .map(({ id, timestamp }) => ({ id, timestamp }))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, limit);
}

let briefTableReady = false;
async function ensureBriefTables(env) {
  if (briefTableReady || !env.BRIEFS_DB) return;
  await env.BRIEFS_DB.exec(
    "CREATE TABLE IF NOT EXISTS briefs (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, json TEXT NOT NULL);"
  );
  await env.BRIEFS_DB.exec(
    "CREATE TABLE IF NOT EXISTS brief_owners (brief_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, timestamp TEXT NOT NULL);"
  );
  briefTableReady = true;
}

async function deleteUserData(env, userId) {
  if (!userId) return;

  if (env.BRIEFS_DB) {
    await ensureBriefTables(env);
    await ensureUsageTables(env);
    const owned = await env.BRIEFS_DB
      .prepare("SELECT brief_id FROM brief_owners WHERE user_id = ?1")
      .bind(userId)
      .all();
    const briefIds = Array.isArray(owned?.results) ? owned.results.map((x) => x.brief_id).filter(Boolean) : [];
    if (briefIds.length) {
      const placeholders = briefIds.map(() => "?").join(",");
      await env.BRIEFS_DB.prepare(`DELETE FROM briefs WHERE id IN (${placeholders})`).bind(...briefIds).run();
    }
    await env.BRIEFS_DB.prepare("DELETE FROM brief_owners WHERE user_id = ?1").bind(userId).run();
    await env.BRIEFS_DB.prepare("DELETE FROM usage WHERE user_id = ?1").bind(userId).run();
    await env.BRIEFS_DB.prepare("DELETE FROM user_access WHERE user_id = ?1").bind(userId).run();
    await env.BRIEFS_DB.prepare("DELETE FROM users WHERE id = ?1").bind(userId).run();
    return;
  }

  if (env.BRIEFS_KV) {
    const userBriefsKey = `briefs:user:${userId}`;
    const rawUserBriefs = await env.BRIEFS_KV.get(userBriefsKey);
    const userBriefs = rawUserBriefs ? JSON.parse(rawUserBriefs) : [];
    if (Array.isArray(userBriefs)) {
      for (const item of userBriefs) {
        const id = item?.id;
        if (!id) continue;
        await env.BRIEFS_KV.delete(`brief:${id}`);
        await env.BRIEFS_KV.delete(`brief_owner:${id}`);
      }
    }
    await env.BRIEFS_KV.delete(userBriefsKey);
    await env.BRIEFS_KV.delete(`user:${userId}`);
    await env.BRIEFS_KV.delete(`tier:${userId}`);
    await env.BRIEFS_KV.delete(`tier_payload:${userId}`);
    return;
  }

  for (const [id, row] of IN_MEMORY_BRIEFS.entries()) {
    if (row?.userId === userId) IN_MEMORY_BRIEFS.delete(id);
  }
  for (const key of Array.from(IN_MEMORY_USAGE.keys())) {
    if (key.startsWith(`usage:${userId}:`)) IN_MEMORY_USAGE.delete(key);
  }
  IN_MEMORY_SUBSCRIPTIONS.delete(userId);
}

function validateLogin(email, password, env) {
  const requiredEmail = String(env.AUTH_EMAIL || "").trim();
  const requiredPassword = String(env.AUTH_PASSWORD || "");
  if (requiredEmail && requiredPassword) {
    return email.toLowerCase() === requiredEmail.toLowerCase() && password === requiredPassword;
  }
  return Boolean(email && password);
}

function issueAuthToken(email) {
  const token = `aia_${crypto.randomUUID()}`;
  IN_MEMORY_AUTH_TOKENS.set(token, {
    email,
    exp: Date.now() + 86400000
  });
  return token;
}

function isAuthorizedWrite(request, env) {
  if (String(env.REQUIRE_AUTH || "").toLowerCase() !== "true") return true;
  const authHeader = request.headers.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return false;

  const staticToken = String(env.AUTH_BEARER_TOKEN || "").trim();
  if (staticToken && bearer === staticToken) return true;

  const tokenRecord = IN_MEMORY_AUTH_TOKENS.get(bearer);
  if (!tokenRecord) return false;
  if (Date.now() > tokenRecord.exp) {
    IN_MEMORY_AUTH_TOKENS.delete(bearer);
    return false;
  }
  return true;
}

function isAllowedWriteOrigin(request, env) {
  const origin = String(request.headers.get("Origin") || "").trim();
  if (!origin) return true; // Native apps and non-browser clients may not send Origin.

  const configured = String(env.ALLOWED_ORIGINS || "").trim();
  const defaults = [
    "https://saintblack-ai.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
  ];
  const allowList = (configured ? configured.split(",") : defaults)
    .map((x) => x.trim())
    .filter(Boolean);
  return allowList.includes(origin);
}

function getAuthContext(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return { userId: null, email: null };

  // First, support local token from /auth/login.
  if (IN_MEMORY_AUTH_TOKENS.has(bearer)) {
    const tokenRecord = IN_MEMORY_AUTH_TOKENS.get(bearer);
    if (Date.now() <= tokenRecord.exp) {
      return { userId: tokenRecord.email || bearer, email: tokenRecord.email || null };
    }
    IN_MEMORY_AUTH_TOKENS.delete(bearer);
    return { userId: null, email: null };
  }

  // JWT decode (no signature verification in Worker lightweight path).
  try {
    const parts = bearer.split(".");
    if (parts.length < 2) return { userId: null, email: null };
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const userId = String(payload?.sub || payload?.user_id || "").trim() || null;
    const email = payload?.email ? String(payload.email).trim() : null;
    return { userId, email };
  } catch {
    return { userId: null, email: null };
  }
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function getFreeQuota(env) {
  const configured = Number(env.FREE_BRIEFS_PER_DAY || 1);
  return Number.isFinite(configured) && configured >= 0 ? configured : 1;
}

function usageKey(userId, date) {
  return `usage:${userId}:${date}`;
}

async function enforceUsageLimit(env, userId) {
  if (!userId) {
    return { ok: false, error: "Authentication required", tier: "free", usage: 0, quota: getFreeQuota(env) };
  }
  const tier = await resolveUserTier(env, userId);
  if (tier === "pro") return { ok: true, tier, usage: 0, quota: "unlimited" };

  const date = new Date().toISOString().slice(0, 10);
  const usage = await getDailyUsage(env, userId, date);
  const quota = getFreeQuota(env);
  if (usage >= quota) {
    return { ok: false, error: "Free tier quota reached. Upgrade to continue.", tier, usage, quota };
  }
  return { ok: true, tier, usage, quota };
}

async function incrementUsage(env, userId) {
  if (!userId) return;
  const date = new Date().toISOString().slice(0, 10);
  const key = usageKey(userId, date);

  if (env.BRIEFS_DB) {
    await ensureUsageTables(env);
    const row = await env.BRIEFS_DB
      .prepare("SELECT count FROM usage WHERE user_id = ?1 AND date = ?2")
      .bind(userId, date)
      .first();
    const next = (Number(row?.count) || 0) + 1;
    await env.BRIEFS_DB
      .prepare("INSERT INTO usage (user_id, date, count) VALUES (?1, ?2, ?3) ON CONFLICT(user_id, date) DO UPDATE SET count = ?3")
      .bind(userId, date, next)
      .run();
    return;
  }

  if (env.BRIEFS_KV) {
    const current = Number(await env.BRIEFS_KV.get(key)) || 0;
    await env.BRIEFS_KV.put(key, String(current + 1), { expirationTtl: 60 * 60 * 24 * 2 });
    return;
  }

  IN_MEMORY_USAGE.set(key, (IN_MEMORY_USAGE.get(key) || 0) + 1);
}

async function getDailyUsage(env, userId, date) {
  if (!userId) return 0;
  const key = usageKey(userId, date);

  if (env.BRIEFS_DB) {
    await ensureUsageTables(env);
    const row = await env.BRIEFS_DB
      .prepare("SELECT count FROM usage WHERE user_id = ?1 AND date = ?2")
      .bind(userId, date)
      .first();
    return Number(row?.count) || 0;
  }

  if (env.BRIEFS_KV) {
    return Number(await env.BRIEFS_KV.get(key)) || 0;
  }

  return IN_MEMORY_USAGE.get(key) || 0;
}

async function getOrCreateUserProfile(env, userId, email) {
  if (!userId) return null;
  const now = new Date().toISOString();

  if (env.BRIEFS_DB) {
    await ensureUsageTables(env);
    await env.BRIEFS_DB
      .prepare("INSERT INTO users (id, email, created_at, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET email = COALESCE(excluded.email, users.email), updated_at = excluded.updated_at")
      .bind(userId, email, now, now)
      .run();
    return env.BRIEFS_DB.prepare("SELECT id, email, created_at, updated_at FROM users WHERE id = ?1").bind(userId).first();
  }

  if (env.BRIEFS_KV) {
    const key = `user:${userId}`;
    const existing = await env.BRIEFS_KV.get(key, { type: "json" });
    const next = {
      id: userId,
      email: email || existing?.email || null,
      created_at: existing?.created_at || now,
      updated_at: now
    };
    await env.BRIEFS_KV.put(key, JSON.stringify(next));
    return next;
  }

  return { id: userId, email, created_at: now, updated_at: now };
}

async function resolveUserTier(env, userId) {
  if (!userId) return "free";

  if (env.BRIEFS_DB) {
    await ensureUsageTables(env);
    const row = await env.BRIEFS_DB
      .prepare("SELECT tier FROM user_access WHERE user_id = ?1")
      .bind(userId)
      .first();
    if (row?.tier) return String(row.tier);
    return "free";
  }

  if (env.BRIEFS_KV) {
    const value = await env.BRIEFS_KV.get(`tier:${userId}`);
    return value || "free";
  }

  return IN_MEMORY_SUBSCRIPTIONS.get(userId)?.tier || "free";
}

async function setUserTier(env, userId, tier, payload = null) {
  const normalized = tier === "pro" ? "pro" : "free";
  const now = new Date().toISOString();

  if (env.BRIEFS_DB) {
    await ensureUsageTables(env);
    await env.BRIEFS_DB
      .prepare("INSERT INTO user_access (user_id, tier, source_json, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id) DO UPDATE SET tier=excluded.tier, source_json=excluded.source_json, updated_at=excluded.updated_at")
      .bind(userId, normalized, JSON.stringify(payload || {}), now)
      .run();
    return;
  }

  if (env.BRIEFS_KV) {
    await env.BRIEFS_KV.put(`tier:${userId}`, normalized);
    if (payload) await env.BRIEFS_KV.put(`tier_payload:${userId}`, JSON.stringify(payload));
    return;
  }

  IN_MEMORY_SUBSCRIPTIONS.set(userId, { tier: normalized, updated_at: now, payload });
}

async function stripeCreateCheckoutSession(secretKey, input) {
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("line_items[0][price]", input.priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  if (input.email) body.set("customer_email", input.email);
  if (input.userId) {
    body.set("client_reference_id", input.userId);
    body.set("metadata[user_id]", input.userId);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!res.ok) throw new Error(`Stripe checkout session error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function stripeGetCheckoutSession(secretKey, sessionId) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  if (!res.ok) throw new Error(`Stripe checkout status error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function stripeGetSubscriptionById(secretKey, subscriptionId) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function stripeCreateCustomer(secretKey, email) {
  const body = new URLSearchParams();
  body.set("email", email);
  const res = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!res.ok) throw new Error(`Stripe customer error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function stripeCreateSubscription(secretKey, customerId, priceId) {
  const body = new URLSearchParams();
  body.set("customer", customerId);
  body.set("items[0][price]", priceId);
  body.set("payment_behavior", "default_incomplete");
  body.set("collection_method", "charge_automatically");

  const res = await fetch("https://api.stripe.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!res.ok) throw new Error(`Stripe subscription error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function stripeGetLatestSubscription(secretKey, customerId) {
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&limit=1`,
    {
      headers: { Authorization: `Bearer ${secretKey}` }
    }
  );
  if (!res.ok) throw new Error(`Stripe status error ${res.status}: ${await res.text()}`);
  const jsonData = await res.json();
  return Array.isArray(jsonData?.data) ? jsonData.data[0] : null;
}

async function upsertSubscriptionStatus(env, customerId, status, payload) {
  if (!env.BRIEFS_DB) return;
  await ensureSubscriptionTables(env);
  await env.BRIEFS_DB
    .prepare(
      "INSERT INTO subscriptions (customer_id, status, updated_at, json) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(customer_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at, json=excluded.json"
    )
    .bind(customerId, status, new Date().toISOString(), JSON.stringify(payload || {}))
    .run();
}

async function getSubscriptionStatus(env, customerId) {
  if (!env.BRIEFS_DB) return null;
  await ensureSubscriptionTables(env);
  return env.BRIEFS_DB
    .prepare("SELECT customer_id, status, updated_at FROM subscriptions WHERE customer_id = ?1")
    .bind(customerId)
    .first();
}

let subscriptionTableReady = false;
async function ensureSubscriptionTables(env) {
  if (subscriptionTableReady || !env.BRIEFS_DB) return;
  await env.BRIEFS_DB.exec(
    "CREATE TABLE IF NOT EXISTS subscriptions (customer_id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL, json TEXT NOT NULL);"
  );
  subscriptionTableReady = true;
}

let usageTableReady = false;
async function ensureUsageTables(env) {
  if (usageTableReady || !env.BRIEFS_DB) return;
  await env.BRIEFS_DB.exec(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"
  );
  await env.BRIEFS_DB.exec(
    "CREATE TABLE IF NOT EXISTS user_access (user_id TEXT PRIMARY KEY, tier TEXT NOT NULL, source_json TEXT NOT NULL, updated_at TEXT NOT NULL);"
  );
  await env.BRIEFS_DB.exec(
    "CREATE TABLE IF NOT EXISTS usage (user_id TEXT NOT NULL, date TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id, date));"
  );
  usageTableReady = true;
}

function getScripture() {
  const dayOfYear = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  return SCRIPTURE_ROTATION[dayOfYear % SCRIPTURE_ROTATION.length];
}

async function getNextCalendarEvents(icsUrl, count) {
  const r = await fetch(icsUrl, { headers: { "User-Agent": "ai-assassins-api" } });
  if (!r.ok) return [];
  const txt = await r.text();
  const events = parseICS(txt);
  const now = new Date();
  return events
    .filter((e) => e.start && e.start > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, count)
    .map(formatCalendarEvent);
}

function parseICS(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const unfolded = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }

  const out = [];
  let cur = null;
  for (const line of unfolded) {
    if (line.startsWith("BEGIN:VEVENT")) cur = {};
    else if (line.startsWith("END:VEVENT")) {
      if (cur) out.push(cur);
      cur = null;
    } else if (cur) {
      if (line.startsWith("SUMMARY:")) cur.summary = line.slice(8).trim();
      else if (line.startsWith("LOCATION:")) cur.location = line.slice(9).trim();
      else if (line.startsWith("DTSTART")) cur.start = parseICSTime(line);
      else if (line.startsWith("DTEND")) cur.end = parseICSTime(line);
    }
  }

  return out;
}

function parseICSTime(line) {
  const m = line.match(/:(\d{8}T\d{6}Z?)/);
  if (!m) return null;
  const raw = m[1];
  if (raw.endsWith("Z")) return new Date(raw);
  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6)) - 1;
  const d = Number(raw.slice(6, 8));
  const hh = Number(raw.slice(9, 11));
  const mm = Number(raw.slice(11, 13));
  const ss = Number(raw.slice(13, 15));
  return new Date(y, mo, d, hh, mm, ss);
}

function formatCalendarEvent(e) {
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(e.start);
  const at = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(e.start);
  return `${day} ${at} - ${e.summary || "(No title)"}${e.location ? ` @ ${e.location}` : ""}`;
}

async function generateBriefWithOpenAI(context, env) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      date: { type: "string" },
      overnight_overview: { type: "array", items: { type: "string" } },
      markets_snapshot: {
        type: "object",
        additionalProperties: false,
        properties: { SP500: { type: "string" }, NASDAQ: { type: "string" }, WTI: { type: "string" }, BTC: { type: "string" } },
        required: ["SP500", "NASDAQ", "WTI", "BTC"]
      },
      weather_local: {
        type: "object",
        additionalProperties: false,
        properties: { summary: { type: "string" }, high: { type: "string" }, low: { type: "string" }, precip: { type: "string" } },
        required: ["summary", "high", "low", "precip"]
      },
      next_up_calendar: { type: "array", items: { type: "string" } },
      scripture_of_day: {
        type: "object",
        additionalProperties: false,
        properties: { ref: { type: "string" }, text: { type: "string" }, reflection: { type: "string" } },
        required: ["ref", "text", "reflection"]
      },
      mission_priorities: { type: "array", items: { type: "string" } },
      truthwave: {
        type: "object",
        additionalProperties: false,
        properties: { narrative: { type: "string" }, risk_flag: { type: "string" }, counter_psyop: { type: "string" } },
        required: ["narrative", "risk_flag", "counter_psyop"]
      },
      top_tasks: { type: "array", items: { type: "string" } },
      command_note: { type: "string" }
    },
    required: ["date","overnight_overview","markets_snapshot","weather_local","next_up_calendar","scripture_of_day","mission_priorities","truthwave","top_tasks","command_note"]
  };

  const prompt = [
    `Date: ${context.date}`,
    `Focus: ${context.input.focus}`,
    `Tone: ${context.input.tone}`,
    `Markets context: ${JSON.stringify(context.markets)}`,
    `Weather context: ${JSON.stringify(context.weather)}`,
    `Calendar context: ${JSON.stringify(context.calendar)}`,
    `Scripture context: ${JSON.stringify(context.scripture)}`,
    "Generate concise operational brief sections.",
    "Output strict JSON only matching schema."
  ].join("\n");

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: "You generate intelligence briefs. Return strict JSON only." }] },
        { role: "user", content: [{ type: "input_text", text: prompt }] }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "brief",
          schema,
          strict: true
        }
      }
    })
  });

  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`OpenAI responses error ${r.status}: ${detail}`);
  }

  const response = await r.json();
  const text = extractResponseJsonText(response);
  return JSON.parse(text);
}

function extractResponseJsonText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text;

  const output = Array.isArray(response.output) ? response.output : [];
  for (const block of output) {
    const content = Array.isArray(block.content) ? block.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
      if (part?.type === "text" && typeof part.text === "string") return part.text;
    }
  }

  throw new Error("No JSON text found in OpenAI response");
}

function normalizeBrief(brief, fallback) {
  const markets = brief?.markets_snapshot || {};
  const weather = brief?.weather_local || {};
  const scripture = brief?.scripture_of_day || {};
  const truthwave = brief?.truthwave || {};

  return {
    date: String(brief?.date || fallback.date),
    overnight_overview: asArray(brief?.overnight_overview, ["N/A"]),
    markets_snapshot: {
      SP500: asString(markets.SP500, fallback.markets?.SP500),
      NASDAQ: asString(markets.NASDAQ, fallback.markets?.NASDAQ),
      WTI: asString(markets.WTI, fallback.markets?.WTI),
      BTC: asString(markets.BTC, fallback.markets?.BTC)
    },
    weather_local: {
      summary: asString(weather.summary, fallback.weather?.summary || "N/A"),
      high: asString(weather.high, fallback.weather?.high || "N/A"),
      low: asString(weather.low, fallback.weather?.low || "N/A"),
      precip: asString(weather.precip, fallback.weather?.precip || "N/A")
    },
    next_up_calendar: asArray(brief?.next_up_calendar, fallback.calendar?.length ? fallback.calendar : ["N/A"]),
    scripture_of_day: {
      ref: asString(scripture.ref, fallback.scripture?.ref || "N/A"),
      text: asString(scripture.text, fallback.scripture?.text || "N/A"),
      reflection: asString(scripture.reflection, fallback.scripture?.reflection || "N/A")
    },
    mission_priorities: asArray(brief?.mission_priorities, ["N/A"]),
    truthwave: {
      narrative: asString(truthwave.narrative, "N/A"),
      risk_flag: asString(truthwave.risk_flag, "N/A"),
      counter_psyop: asString(truthwave.counter_psyop, "N/A")
    },
    top_tasks: asArray(brief?.top_tasks, ["N/A"]),
    command_note: asString(brief?.command_note, "N/A")
  };
}

function asArray(value, fallback) {
  return Array.isArray(value) && value.length ? value.map((x) => String(x)) : fallback;
}

function asString(value, fallback) {
  if (value == null || value === "") return String(fallback ?? "N/A");
  return String(value);
}

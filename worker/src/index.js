const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

      if (request.method === "GET" && url.pathname === "/briefs") {
        const items = await listBriefs(env, 50);
        return json({ items });
      }

      if (request.method === "GET" && url.pathname === "/brief") {
        const id = url.searchParams.get("id");
        if (id) {
          const stored = await getBriefById(env, id);
          if (!stored) return json({ error: "Brief not found" }, 404);
          return json(stored);
        }

        const validated = validateBriefQuery(url.searchParams);
        if (!validated.ok) return json({ error: validated.error }, 400);
        if (!isAuthorizedWrite(request, env)) {
          return json({ error: "Unauthorized" }, 401);
        }
        const brief = await buildBrief(validated.value, env);
        const saved = await saveBrief(env, brief);
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

      if (request.method === "POST" && url.pathname === "/subscribe") {
        const body = await request.json().catch(() => ({}));
        const email = String(body?.email || "").trim();
        const priceId = String(body?.priceId || body?.price_id || "").trim();
        if (!email || !priceId) return json({ error: "email and priceId are required" }, 400);
        if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe not configured" }, 501);

        const customer = await stripeCreateCustomer(env.STRIPE_SECRET_KEY, email);
        const subscription = await stripeCreateSubscription(env.STRIPE_SECRET_KEY, customer.id, priceId);
        await upsertSubscriptionStatus(env, customer.id, subscription.status || "incomplete", subscription);

        return json({
          ok: true,
          customer_id: customer.id,
          subscription_id: subscription.id,
          status: subscription.status
        });
      }

      if (request.method === "GET" && url.pathname === "/status") {
        const customerId = String(url.searchParams.get("customer_id") || "").trim();
        if (!customerId) return json({ tier: "free", status: "none" });

        if (env.STRIPE_SECRET_KEY) {
          const latest = await stripeGetLatestSubscription(env.STRIPE_SECRET_KEY, customerId);
          const status = latest?.status || "none";
          await upsertSubscriptionStatus(env, customerId, status, latest || {});
          return json({
            customer_id: customerId,
            status,
            tier: status === "active" ? "pro" : "free"
          });
        }

        const saved = await getSubscriptionStatus(env, customerId);
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
        if (!isAuthorizedWrite(request, env)) {
          return json({ error: "Unauthorized" }, 401);
        }

        const brief = await buildBrief(validated.value, env);
        const saved = await saveBrief(env, brief);
        return json({ id: saved.id, ...brief });
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

async function saveBrief(env, brief) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify(brief);

  if (env.BRIEFS_DB) {
    await ensureBriefTables(env);
    await env.BRIEFS_DB
      .prepare("INSERT INTO briefs (id, timestamp, json) VALUES (?1, ?2, ?3)")
      .bind(id, timestamp, payload)
      .run();
  } else if (env.BRIEFS_KV) {
    await env.BRIEFS_KV.put(`brief:${id}`, payload);
    const rawIndex = await env.BRIEFS_KV.get("briefs:index");
    const parsed = rawIndex ? JSON.parse(rawIndex) : [];
    const next = [{ id, timestamp }, ...parsed].slice(0, 200);
    await env.BRIEFS_KV.put("briefs:index", JSON.stringify(next));
  } else {
    IN_MEMORY_BRIEFS.set(id, { id, timestamp, json: payload });
  }

  return { id, timestamp };
}

async function getBriefById(env, id) {
  if (!id) return null;

  if (env.BRIEFS_DB) {
    await ensureBriefTables(env);
    const row = await env.BRIEFS_DB
      .prepare("SELECT id, timestamp, json FROM briefs WHERE id = ?1")
      .bind(id)
      .first();
    if (!row) return null;
    return { id: row.id, timestamp: row.timestamp, ...JSON.parse(row.json) };
  } else if (env.BRIEFS_KV) {
    const payload = await env.BRIEFS_KV.get(`brief:${id}`);
    if (!payload) return null;
    return { id, ...JSON.parse(payload) };
  }

  const row = IN_MEMORY_BRIEFS.get(id);
  if (!row) return null;
  return { id: row.id, timestamp: row.timestamp, ...JSON.parse(row.json) };
}

async function listBriefs(env, limit) {
  if (env.BRIEFS_DB) {
    await ensureBriefTables(env);
    const res = await env.BRIEFS_DB
      .prepare("SELECT id, timestamp FROM briefs ORDER BY timestamp DESC LIMIT ?1")
      .bind(limit)
      .all();
    return Array.isArray(res?.results) ? res.results : [];
  } else if (env.BRIEFS_KV) {
    const rawIndex = await env.BRIEFS_KV.get("briefs:index");
    const parsed = rawIndex ? JSON.parse(rawIndex) : [];
    return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
  }

  return Array.from(IN_MEMORY_BRIEFS.entries())
    .map(([id, row]) => ({ id, timestamp: row.timestamp }))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, limit);
}

let briefTableReady = false;
async function ensureBriefTables(env) {
  if (briefTableReady || !env.BRIEFS_DB) return;
  await env.BRIEFS_DB.exec(
    "CREATE TABLE IF NOT EXISTS briefs (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, json TEXT NOT NULL);"
  );
  briefTableReady = true;
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

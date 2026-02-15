const DEFAULT_ALLOWED_ORIGIN = "https://saintblack-ai.github.io";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
    const requestOrigin = request.headers.get("Origin");

    if (requestOrigin && requestOrigin !== allowedOrigin) {
      return jsonResponse({ error: "Origin not allowed" }, 403, makeCorsHeaders(allowedOrigin));
    }

    const corsHeaders = makeCorsHeaders(allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/overview") {
        return jsonResponse(await getOverview(), 200, corsHeaders);
      }

      if (request.method === "GET" && url.pathname === "/api/markets") {
        return jsonResponse(await getMarkets(), 200, corsHeaders);
      }

      if (request.method === "GET" && url.pathname === "/api/weather") {
        const lat = Number(url.searchParams.get("lat"));
        const lon = Number(url.searchParams.get("lon"));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return jsonResponse({ error: "lat and lon are required query params" }, 400, corsHeaders);
        }
        return jsonResponse(await getWeather(lat, lon), 200, corsHeaders);
      }

      if (request.method === "GET" && url.pathname === "/api/scripture") {
        return jsonResponse(getScripture(), 200, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/api/brief") {
        if (!isAuthorizedForBrief(request, env)) {
          return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        }

        const payload = await request.json().catch(() => null);
        const validation = validateBriefRequest(payload);
        if (!validation.ok) {
          return jsonResponse({ error: "Invalid request body", detail: validation.error }, 400, corsHeaders);
        }

        const brief = await generateBrief(payload, env);
        return jsonResponse(brief, 200, corsHeaders);
      }

      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      return jsonResponse(
        { error: "Internal server error", detail: String(error && error.message ? error.message : error) },
        500,
        corsHeaders
      );
    }
  }
};

function isAuthorizedForBrief(request, env) {
  if (!env.BRIEF_BEARER_TOKEN) return true;
  const auth = request.headers.get("Authorization") || "";
  return auth === `Bearer ${env.BRIEF_BEARER_TOKEN}`;
}

function makeCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function getOverview() {
  const feeds = [
    { source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { source: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews" },
    { source: "NASA", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss" }
  ];

  const settled = await Promise.allSettled(
    feeds.map(async (feed) => {
      const response = await fetch(feed.url, { headers: { "User-Agent": "ai-assassins-api" } });
      if (!response.ok) return [];
      const xml = await response.text();
      return parseRss(xml, feed.source, 2);
    })
  );

  const items = [];
  for (const result of settled) {
    if (result.status === "fulfilled") items.push(...result.value);
  }

  return { items: items.slice(0, 5), timestamp: new Date().toISOString() };
}

function parseRss(xml, source, limit) {
  const output = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) && output.length < limit) {
    const itemXml = match[1];
    const title = decodeXml(readTag(itemXml, "title"));
    const link = decodeXml(readTag(itemXml, "link"));
    if (title && link) output.push({ title, link, source });
  }

  return output;
}

function readTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
}

function decodeXml(text) {
  return String(text)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

async function getMarkets() {
  const [sp500, nasdaq, wti, btc] = await Promise.all([
    fetchStooqClose("^spx"),
    fetchStooqClose("^ixic"),
    fetchStooqClose("cl.f"),
    fetchBtcPrice()
  ]);

  return {
    SP500: sp500,
    NASDAQ: nasdaq,
    WTI: wti,
    BTC: btc,
    timestamp: new Date().toISOString()
  };
}

async function fetchStooqClose(symbol) {
  try {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
    const response = await fetch(url, { headers: { "User-Agent": "ai-assassins-api" } });
    if (!response.ok) return null;

    const text = await response.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;

    const parts = lines[1].split(",");
    const closeIndex = 6;
    const value = Number(parts[closeIndex]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function fetchBtcPrice() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    if (!response.ok) return null;
    const json = await response.json();
    const value = Number(json?.bitcoin?.usd);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function getWeather(lat, lon) {
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", String(lat));
  endpoint.searchParams.set("longitude", String(lon));
  endpoint.searchParams.set("current", "temperature_2m,apparent_temperature,wind_speed_10m");
  endpoint.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  endpoint.searchParams.set("forecast_days", "1");
  endpoint.searchParams.set("timezone", "auto");

  const response = await fetch(endpoint.toString());
  if (!response.ok) throw new Error(`Open-Meteo failed: ${response.status}`);

  const json = await response.json();
  return {
    current: json.current || null,
    daily: {
      max: json.daily?.temperature_2m_max?.[0] ?? null,
      min: json.daily?.temperature_2m_min?.[0] ?? null,
      precipitation_sum: json.daily?.precipitation_sum?.[0] ?? null
    },
    timestamp: new Date().toISOString()
  };
}

function getScripture() {
  const verses = [
    {
      reference: "Psalm 27:1",
      text: "The LORD is my light and my salvation; whom shall I fear?",
      reflection: "Move with courage and clarity when the mission feels uncertain."
    },
    {
      reference: "Isaiah 41:10",
      text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God.",
      reflection: "Lead from steadiness, not anxiety."
    },
    {
      reference: "John 14:27",
      text: "Peace I leave with you, my peace I give unto you.",
      reflection: "Keep your operating tempo high, but your spirit settled."
    },
    {
      reference: "Proverbs 21:31",
      text: "The horse is prepared against the day of battle: but safety is of the LORD.",
      reflection: "Preparation and discipline are your daily edge."
    }
  ];

  const dayOfYear = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  const pick = verses[dayOfYear % verses.length];

  return {
    translation: "KJV",
    reference: pick.reference,
    text: pick.text,
    reflection: pick.reflection,
    timestamp: new Date().toISOString()
  };
}

async function generateBrief(payload, env) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const date = String(payload.date).slice(0, 40);
  const focus = String(payload.focus).slice(0, 500);
  const audience = String(payload.audience).slice(0, 100);
  const tone = String(payload.tone).slice(0, 60);
  const lat = payload.lat == null ? null : Number(payload.lat);
  const lon = payload.lon == null ? null : Number(payload.lon);
  const icsUrl = payload.ics_url ? String(payload.ics_url) : "";
  const agendaCount = Number.isFinite(Number(payload.agenda_count)) ? Math.max(1, Math.min(10, Number(payload.agenda_count))) : 3;

  const liveMarkets = await getMarkets();
  const liveWeather = Number.isFinite(lat) && Number.isFinite(lon) ? await getWeather(lat, lon).catch(() => null) : null;
  const liveCalendar = icsUrl ? await getUpcomingFromICS(icsUrl, agendaCount).catch(() => []) : [];
  const liveScripture = getScripture();

  const schema = {
    name: "daily_brief",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        overnight_overview: { type: "array", items: { type: "string" } },
        markets_snapshot: {
          type: "object",
          additionalProperties: false,
          properties: {
            SP500: { type: ["number", "null"] },
            NASDAQ: { type: ["number", "null"] },
            WTI: { type: ["number", "null"] },
            BTC: { type: ["number", "null"] }
          },
          required: ["SP500", "NASDAQ", "WTI", "BTC"]
        },
        weather_local: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            high_low: { type: "string" },
            precipitation: { type: "string" }
          },
          required: ["summary", "high_low", "precipitation"]
        },
        next_up_calendar: { type: "array", items: { type: "string" } },
        scripture_of_day: {
          type: "object",
          additionalProperties: false,
          properties: {
            reference: { type: "string" },
            verse: { type: "string" },
            reflection: { type: "string" }
          },
          required: ["reference", "verse", "reflection"]
        },
        mission_priorities: { type: "array", items: { type: "string" } },
        truthwave: {
          type: "object",
          additionalProperties: false,
          properties: {
            narrative: { type: "string" },
            risk_flag: { type: "string" },
            counter_psyop: { type: "string" }
          },
          required: ["narrative", "risk_flag", "counter_psyop"]
        },
        top_tasks: { type: "array", items: { type: "string" } },
        command_note: { type: "string" }
      },
      required: [
        "overnight_overview",
        "markets_snapshot",
        "weather_local",
        "next_up_calendar",
        "scripture_of_day",
        "mission_priorities",
        "truthwave",
        "top_tasks",
        "command_note"
      ]
    }
  };

  const system = [
    "You are an operations brief generator.",
    "Return concise factual content.",
    "Never include markdown.",
    "Output must strictly follow the JSON schema."
  ].join(" ");

  const user = [
    `Build a daily brief for ${audience}. Date: ${date}. Focus: ${focus}. Tone: ${tone}.`,
    "Use this live context as factual anchors:",
    `Markets: ${JSON.stringify(liveMarkets)}`,
    `Weather: ${JSON.stringify(liveWeather)}`,
    `Calendar: ${JSON.stringify(liveCalendar)}`,
    `Scripture: ${JSON.stringify(liveScripture)}`
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_schema", json_schema: schema },
      temperature: 0.35
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response had no content");

  const parsed = JSON.parse(content);
  return normalizeBriefPayload(parsed, {
    markets: liveMarkets,
    weather: liveWeather,
    calendar: liveCalendar,
    scripture: liveScripture
  });
}

function normalizeBriefPayload(input, context) {
  const market = input?.markets_snapshot || {};
  const weather = input?.weather_local || {};
  const scripture = input?.scripture_of_day || {};
  const truthwave = input?.truthwave || {};
  const fallbackWeather = summarizeWeather(context?.weather);
  const fallbackScripture = context?.scripture || {};
  const fallbackMarkets = context?.markets || {};

  return {
    overnight_overview: asStringArray(input?.overnight_overview, ["Unavailable"]),
    markets_snapshot: {
      SP500: normalizeNumber(market.SP500) ?? normalizeNumber(fallbackMarkets.SP500),
      NASDAQ: normalizeNumber(market.NASDAQ) ?? normalizeNumber(fallbackMarkets.NASDAQ),
      WTI: normalizeNumber(market.WTI) ?? normalizeNumber(fallbackMarkets.WTI),
      BTC: normalizeNumber(market.BTC) ?? normalizeNumber(fallbackMarkets.BTC)
    },
    weather_local: {
      summary: String(weather.summary || fallbackWeather.summary || "Unavailable"),
      high_low: String(weather.high_low || fallbackWeather.high_low || "Unavailable"),
      precipitation: String(weather.precipitation || fallbackWeather.precipitation || "Unavailable")
    },
    next_up_calendar: asStringArray(input?.next_up_calendar, context?.calendar?.length ? context.calendar : ["Unavailable"]),
    scripture_of_day: {
      reference: String(scripture.reference || fallbackScripture.reference || "Unavailable"),
      verse: String(scripture.verse || fallbackScripture.text || "Unavailable"),
      reflection: String(scripture.reflection || fallbackScripture.reflection || "Unavailable")
    },
    mission_priorities: asStringArray(input?.mission_priorities, ["Unavailable"]),
    truthwave: {
      narrative: String(truthwave.narrative || "Unavailable"),
      risk_flag: String(truthwave.risk_flag || "Unavailable"),
      counter_psyop: String(truthwave.counter_psyop || "Unavailable")
    },
    top_tasks: asStringArray(input?.top_tasks, ["Unavailable"]),
    command_note: String(input?.command_note || "Unavailable")
  };
}

function asStringArray(value, fallback) {
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.map((item) => String(item));
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function summarizeWeather(weather) {
  if (!weather || typeof weather !== "object") {
    return { summary: "Unavailable", high_low: "Unavailable", precipitation: "Unavailable" };
  }

  const current = weather.current || {};
  const daily = weather.daily || {};
  return {
    summary: `Current ${current.temperature_2m ?? "-"}°C, wind ${current.wind_speed_10m ?? "-"} km/h`,
    high_low: `High ${daily.max ?? "-"}°C / Low ${daily.min ?? "-"}°C`,
    precipitation: `${daily.precipitation_sum ?? "-"} mm`
  };
}

async function getUpcomingFromICS(url, limit) {
  const response = await fetch(url, { headers: { "User-Agent": "ai-assassins-api" } });
  if (!response.ok) return [];
  const text = await response.text();
  const events = parseICS(text);
  const now = new Date();
  return events
    .filter((event) => event.start && event.start > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, limit)
    .map((event) => formatCalendarEvent(event));
}

function parseICS(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const unfolded = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }

  const events = [];
  for (const line of unfolded) {
    if (line.startsWith("BEGIN:VEVENT")) current = {};
    else if (line.startsWith("END:VEVENT")) {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      if (line.startsWith("SUMMARY:")) current.summary = line.slice(8).trim();
      if (line.startsWith("LOCATION:")) current.location = line.slice(9).trim();
      if (line.startsWith("DTSTART")) current.start = parseICSTime(line);
      if (line.startsWith("DTEND")) current.end = parseICSTime(line);
    }
  }
  return events;
}

function parseICSTime(line) {
  const match = line.match(/:(\d{8}T\d{6}Z?)/);
  if (!match) return null;
  const raw = match[1];
  if (raw.endsWith("Z")) return new Date(raw);
  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(4, 6)) - 1;
  const d = Number(raw.slice(6, 8));
  const hh = Number(raw.slice(9, 11));
  const mm = Number(raw.slice(11, 13));
  const ss = Number(raw.slice(13, 15));
  return new Date(y, m, d, hh, mm, ss);
}

function formatCalendarEvent(event) {
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(event.start);
  const start = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(event.start);
  return `${day} ${start} — ${event.summary || "(No title)"}${event.location ? ` @ ${event.location}` : ""}`;
}

function validateBriefRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Body must be a JSON object" };
  }

  const date = typeof payload.date === "string" ? payload.date.trim() : "";
  const focus = typeof payload.focus === "string" ? payload.focus.trim() : "";
  const audience = typeof payload.audience === "string" ? payload.audience.trim() : "";
  const tone = typeof payload.tone === "string" ? payload.tone.trim() : "";

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "date must be YYYY-MM-DD" };
  if (!focus) return { ok: false, error: "focus is required" };
  if (!audience) return { ok: false, error: "audience is required" };
  if (!tone) return { ok: false, error: "tone is required" };
  if (focus.length > 500 || audience.length > 100 || tone.length > 60) {
    return { ok: false, error: "One or more fields exceed length limits" };
  }

  if (payload.lat != null && !Number.isFinite(Number(payload.lat))) return { ok: false, error: "lat must be numeric when provided" };
  if (payload.lon != null && !Number.isFinite(Number(payload.lon))) return { ok: false, error: "lon must be numeric when provided" };
  if (payload.ics_url != null && typeof payload.ics_url !== "string") return { ok: false, error: "ics_url must be a string when provided" };
  if (payload.agenda_count != null && !Number.isFinite(Number(payload.agenda_count))) return { ok: false, error: "agenda_count must be numeric when provided" };

  payload.date = date;
  payload.focus = focus;
  payload.audience = audience;
  payload.tone = tone;
  return { ok: true };
}

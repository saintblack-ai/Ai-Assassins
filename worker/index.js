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

        const payload = await request.json().catch(() => ({}));
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
    "Access-Control-Max-Age": "86400",
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

  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const date = String(payload?.date || new Date().toISOString().slice(0, 10)).slice(0, 40);
  const focus = String(payload?.focus || "geopolitics, defense, cyber, space").slice(0, 500);
  const audience = String(payload?.audience || "Commander").slice(0, 100);
  const tone = String(payload?.tone || "strategic").slice(0, 60);

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

  const user = `Build a daily brief for ${audience}. Date: ${date}. Focus: ${focus}. Tone: ${tone}.`;

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
  return normalizeBriefPayload(parsed);
}

function normalizeBriefPayload(input) {
  const market = input?.markets_snapshot || {};
  const weather = input?.weather_local || {};
  const scripture = input?.scripture_of_day || {};
  const truthwave = input?.truthwave || {};

  return {
    overnight_overview: asStringArray(input?.overnight_overview, ["Unavailable"]),
    markets_snapshot: {
      SP500: normalizeNumber(market.SP500),
      NASDAQ: normalizeNumber(market.NASDAQ),
      WTI: normalizeNumber(market.WTI),
      BTC: normalizeNumber(market.BTC)
    },
    weather_local: {
      summary: String(weather.summary || "Unavailable"),
      high_low: String(weather.high_low || "Unavailable"),
      precipitation: String(weather.precipitation || "Unavailable")
    },
    next_up_calendar: asStringArray(input?.next_up_calendar, ["Unavailable"]),
    scripture_of_day: {
      reference: String(scripture.reference || "Unavailable"),
      verse: String(scripture.verse || "Unavailable"),
      reflection: String(scripture.reflection || "Unavailable")
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

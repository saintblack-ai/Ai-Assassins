const ALLOWED_ORIGIN = "https://saintblack-ai.github.io";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = makeCorsHeaders(request.headers.get("Origin"));

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

function makeCorsHeaders(origin) {
  const resolvedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": resolvedOrigin,
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
    if (result.status === "fulfilled") {
      items.push(...result.value);
    }
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
    if (title && link) {
      output.push({ title, link, source });
    }
  }

  return output;
}

function readTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
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
  let btc = null;

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    if (response.ok) {
      const json = await response.json();
      btc = json?.bitcoin?.usd ?? null;
    }
  } catch {
    btc = null;
  }

  return {
    SP500: null,
    NASDAQ: null,
    WTI: null,
    BTC: btc,
    timestamp: new Date().toISOString()
  };
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
  if (!response.ok) {
    throw new Error(`Open-Meteo failed: ${response.status}`);
  }

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
  const date = payload?.date || new Date().toISOString().slice(0, 10);
  const focus = payload?.focus || "geopolitics, defense, cyber, space";
  const audience = payload?.audience || "Commander";
  const tone = payload?.tone || "strategic";

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const system = [
    "You generate daily operational briefs as JSON only.",
    "Return valid JSON with keys:",
    "overnight_overview (array of strings),",
    "markets_snapshot (object with SP500, NASDAQ, WTI, BTC numbers or null),",
    "weather_local (array of strings),",
    "next_up_calendar (array of strings),",
    "scripture_of_day (array of strings),",
    "mission_priorities (array of strings),",
    "truthwave (array of strings),",
    "top_tasks (array of strings),",
    "command_note (array of strings).",
    "No markdown, no prose outside JSON."
  ].join(" ");

  const user = `Build a concise daily brief for ${audience}. Date: ${date}. Focus: ${focus}. Tone: ${tone}.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response had no content");
  }

  const parsed = JSON.parse(content);
  return normalizeBriefPayload(parsed);
}

function normalizeBriefPayload(input) {
  const output = {
    overnight_overview: toStringArray(input?.overnight_overview, ["Unavailable"]),
    markets_snapshot: normalizeMarkets(input?.markets_snapshot),
    weather_local: toStringArray(input?.weather_local, ["Unavailable"]),
    next_up_calendar: toStringArray(input?.next_up_calendar, ["Unavailable"]),
    scripture_of_day: toStringArray(input?.scripture_of_day, ["Unavailable"]),
    mission_priorities: toStringArray(input?.mission_priorities, ["Unavailable"]),
    truthwave: toStringArray(input?.truthwave, ["Unavailable"]),
    top_tasks: toStringArray(input?.top_tasks, ["Unavailable"]),
    command_note: toStringArray(input?.command_note, ["Unavailable"])
  };

  return output;
}

function toStringArray(value, fallback) {
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.map((item) => String(item));
}

function normalizeMarkets(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    SP500: normalizeNumber(source.SP500),
    NASDAQ: normalizeNumber(source.NASDAQ),
    WTI: normalizeNumber(source.WTI),
    BTC: normalizeNumber(source.BTC)
  };
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

type MarketSnapshot = {
  BTC: number | null;
  ETH: number | null;
  SP500: number | null;
  NASDAQ: number | null;
  ts: string;
};

type WeatherSnapshot = {
  summary: string;
  temperature_c: number | null;
  wind_kph: number | null;
  precip_mm: number | null;
};

type IntelligencePayload = {
  timestamp: string;
  markets: MarketSnapshot;
  geopolitics: Array<{ title: string; source: string; link: string }>;
  weather: WeatherSnapshot;
  cyber_alerts: Array<{ title: string; severity: "low" | "medium" | "high"; source: string }>;
};

type Scores = {
  risk_score: number;
  volatility: number;
  cyber_alert_level: number;
  confidence: number;
  priority: "Low" | "Moderate" | "Elevated" | "Critical";
};

function safeNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { cf: { cacheTtl: 120 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  try {
    const r = await fetch(url, { cf: { cacheTtl: 300 } });
    if (!r.ok) return "";
    return await r.text();
  } catch {
    return "";
  }
}

function parseRssTitles(xml: string, source: string, limit = 4): Array<{ title: string; source: string; link: string }> {
  if (!xml) return [];
  const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, limit);
  const out: Array<{ title: string; source: string; link: string }> = [];
  for (const m of items) {
    const block = m[0];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim();
    if (title) out.push({ title, source, link });
  }
  return out;
}

async function fetchMarkets(): Promise<MarketSnapshot> {
  const [crypto, sp500, nasdaq] = await Promise.all([
    fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"),
    fetchJson("https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC"),
    fetchJson("https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EIXIC"),
  ]);

  const sp = safeNumber(sp500?.quoteResponse?.result?.[0]?.regularMarketPrice);
  const nq = safeNumber(nasdaq?.quoteResponse?.result?.[0]?.regularMarketPrice);

  return {
    BTC: safeNumber(crypto?.bitcoin?.usd),
    ETH: safeNumber(crypto?.ethereum?.usd),
    SP500: sp,
    NASDAQ: nq,
    ts: new Date().toISOString(),
  };
}

async function fetchGeopolitics(): Promise<Array<{ title: string; source: string; link: string }>> {
  const [bbc, reuters] = await Promise.all([
    fetchText("https://feeds.bbci.co.uk/news/world/rss.xml"),
    fetchText("https://www.reuters.com/world/rss"),
  ]);
  return [
    ...parseRssTitles(bbc, "BBC World", 3),
    ...parseRssTitles(reuters, "Reuters World", 3),
  ].slice(0, 6);
}

async function fetchWeather(lat?: number | null, lon?: number | null): Promise<WeatherSnapshot> {
  if (!lat || !lon) {
    return {
      summary: "No location set",
      temperature_c: null,
      wind_kph: null,
      precip_mm: null,
    };
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation&timezone=auto`;
  const data = await fetchJson(url);
  const cur = data?.current_weather || {};
  const precip = safeNumber(data?.hourly?.precipitation?.[0]);
  return {
    summary: `code:${cur?.weathercode ?? "unknown"}`,
    temperature_c: safeNumber(cur?.temperature),
    wind_kph: safeNumber(cur?.windspeed),
    precip_mm: precip,
  };
}

async function fetchCyberAlerts(): Promise<Array<{ title: string; severity: "low" | "medium" | "high"; source: string }>> {
  // Dummy feed with deterministic output; replace with live feed later.
  return [
    { title: "Credential stuffing spikes on major SaaS login endpoints", severity: "medium", source: "Simulated SOC Feed" },
    { title: "New high-severity CVE exploitation attempts observed", severity: "high", source: "Simulated SOC Feed" },
  ];
}

export async function buildIntelligencePayload(input: any): Promise<IntelligencePayload> {
  const lat = safeNumber(input?.lat);
  const lon = safeNumber(input?.lon);
  const [markets, geopolitics, weather, cyber_alerts] = await Promise.all([
    fetchMarkets(),
    fetchGeopolitics(),
    fetchWeather(lat, lon),
    fetchCyberAlerts(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    markets,
    geopolitics,
    weather,
    cyber_alerts,
  };
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function scoreIntelligence(payload: IntelligencePayload): Scores {
  const marketCount = [payload.markets.BTC, payload.markets.ETH, payload.markets.SP500, payload.markets.NASDAQ].filter(
    (x) => x != null
  ).length;
  const missingPenalty = (4 - marketCount) * 8;
  const cyberHigh = payload.cyber_alerts.filter((x) => x.severity === "high").length;
  const cyberMedium = payload.cyber_alerts.filter((x) => x.severity === "medium").length;
  const geoPressure = Math.min(payload.geopolitics.length * 4, 20);

  const volatility = clamp(35 + geoPressure + cyberMedium * 6 + cyberHigh * 10);
  const cyber_alert_level = clamp(20 + cyberMedium * 18 + cyberHigh * 28);
  const risk_score = clamp((volatility * 0.45) + (cyber_alert_level * 0.4) + geoPressure * 0.5 + missingPenalty);
  const confidence = clamp(88 - missingPenalty - cyberHigh * 6 - Math.max(0, 3 - payload.geopolitics.length) * 4);

  let priority: Scores["priority"] = "Low";
  if (risk_score >= 75) priority = "Critical";
  else if (risk_score >= 55) priority = "Elevated";
  else if (risk_score >= 30) priority = "Moderate";

  return { risk_score, volatility, cyber_alert_level, confidence, priority };
}

export function recommendedActions(scores: Scores): string[] {
  const actions = [
    "Validate market exposure and tighten stop-loss posture for volatile assets.",
    "Review identity/login telemetry for unusual access patterns.",
    "Publish one concise command brief update to stakeholders.",
  ];
  if (scores.priority === "Critical") {
    actions.unshift("Activate critical-response playbook and enforce temporary change freeze.");
  } else if (scores.priority === "Elevated") {
    actions.unshift("Shift to elevated monitoring cadence (hourly checks).");
  }
  return actions.slice(0, 5);
}

export type { IntelligencePayload, Scores };


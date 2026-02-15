const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";

const IDS = {
  btnGenerate: "btnGenerate",
  loadingState: "loadingState",
  errorBox: "errorBox",
  latInput: "latInput",
  lonInput: "lonInput",
  focusInput: "focusInput",
  toneInput: "toneInput",
  icsInput: "icsInput",
  overnightOverview: "overnightOverview",
  sp500: "sp500",
  nasdaq: "nasdaq",
  wti: "wti",
  btc: "btc",
  weatherLocal: "weatherLocal",
  calendarEvents: "calendarEvents",
  scriptureDay: "scriptureDay",
  missionPriorities: "missionPriorities",
  truthwaveNarrative: "truthwaveNarrative",
  truthwaveRisk: "truthwaveRisk",
  truthwaveCounter: "truthwaveCounter",
  topTasks: "topTasks",
  commandNote: "commandNote"
};

const missingWarned = new Set();
let autoRefreshTimer = null;

function byId(id) {
  const el = document.getElementById(id);
  if (!el && !missingWarned.has(id)) {
    console.warn(`[AI-Assassins] Missing DOM element #${id}`);
    missingWarned.add(id);
  }
  return el;
}

function setLoadingState(isLoading, text = "Generating brief...") {
  const btn = byId(IDS.btnGenerate);
  const loading = byId(IDS.loadingState);
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Generating..." : "Generate Brief";
  }
  if (loading) {
    loading.style.display = isLoading ? "block" : "none";
    loading.textContent = isLoading ? text : "";
  }
}

function setError(message) {
  const box = byId(IDS.errorBox);
  if (!box) return;
  if (message) {
    box.style.display = "block";
    box.textContent = message;
  } else {
    box.style.display = "none";
    box.textContent = "";
  }
}

function setAutoRefreshStatus(enabled) {
  const el = byId("autoRefreshStatus");
  if (!el) return;
  el.textContent = enabled
    ? "Auto-refresh enabled (every 10m)"
    : "Auto-refresh disabled";
}

function pick(obj, keys, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const found = lower.get(String(key).toLowerCase());
    if (found != null) return obj[found];
  }
  return fallback;
}

function toList(value) {
  if (!value) return ["N/A"];
  if (Array.isArray(value)) {
    const arr = value.flat().filter(Boolean).map((x) => String(x));
    return arr.length ? arr : ["N/A"];
  }
  if (typeof value === "string") {
    const lines = value.split("\n").map((s) => s.trim()).filter(Boolean);
    return lines.length ? lines : [value];
  }
  return [String(value)];
}

function setList(id, value) {
  const el = byId(id);
  if (!el) return;
  const items = toList(value);
  el.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }
}

function setText(id, value) {
  const el = byId(id);
  if (!el) return;
  const text = value == null || value === "" ? "N/A" : String(value);
  el.textContent = text;
  el.classList.toggle("muted", text === "N/A" || text === "—");
}

function formatMarket(v) {
  if (v == null || v === "") return "N/A";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function fetchWeatherFallback(lat, lon) {
  if (!lat || !lon) return null;
  try {
    const url = new URL(`${API_BASE}/api/weather`);
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function renderBrief(data, fallbackWeather = null) {
  console.log("[AI-Assassins] Rendering overview, markets, weather, etc");

  const overview = pick(data, ["overnight_overview", "overview", "headlines"], ["N/A"]);
  setList(IDS.overnightOverview, overview);

  const markets = pick(data, ["markets_snapshot", "markets"], {}) || {};
  setText(IDS.sp500, formatMarket(pick(markets, ["SP500", "sp500", "s&p 500"], "N/A")));
  setText(IDS.nasdaq, formatMarket(pick(markets, ["NASDAQ", "nasdaq"], "N/A")));
  setText(IDS.wti, formatMarket(pick(markets, ["WTI", "wti"], "N/A")));
  setText(IDS.btc, formatMarket(pick(markets, ["BTC", "btc", "bitcoin"], "N/A")));

  const weather = pick(data, ["weather_local", "weather"], {}) || {};
  const wx = Object.keys(weather).length ? weather : (fallbackWeather || {});
  const summary = pick(wx, ["summary"], "N/A");
  const high = pick(wx, ["high", "max"], "N/A");
  const low = pick(wx, ["low", "min"], "N/A");
  const precip = pick(wx, ["precip", "precipitation"], "N/A");
  setText(IDS.weatherLocal, `${summary} | High: ${high} | Low: ${low} | Precip: ${precip}`);

  setList(IDS.calendarEvents, pick(data, ["next_up_calendar", "calendar"], ["N/A"]));

  const scripture = pick(data, ["scripture_of_day", "scripture"], {}) || {};
  const ref = pick(scripture, ["ref", "reference"], "N/A");
  const text = pick(scripture, ["text"], "N/A");
  const reflection = pick(scripture, ["reflection"], "");
  setText(IDS.scriptureDay, `${ref} — ${text}${reflection ? ` | Reflection: ${reflection}` : ""}`);

  setList(IDS.missionPriorities, pick(data, ["mission_priorities", "priorities"], ["N/A"]));
  const truthwave = pick(data, ["truthwave", "black_phoenix_truthwave"], {}) || {};
  setText(IDS.truthwaveNarrative, pick(truthwave, ["narrative", "top_narrative"], "—"));
  setText(IDS.truthwaveRisk, pick(truthwave, ["risk_flag", "risk"], "—"));
  setText(IDS.truthwaveCounter, pick(truthwave, ["counter_psyop", "counter"], "—"));

  setList(IDS.topTasks, pick(data, ["top_tasks", "tasks"], ["—"]));
  setText(IDS.commandNote, pick(data, ["command_note", "note"], "—"));
}

function getInputs() {
  return {
    lat: byId(IDS.latInput)?.value?.trim() || "",
    lon: byId(IDS.lonInput)?.value?.trim() || "",
    focus: byId(IDS.focusInput)?.value?.trim() || "",
    tone: byId(IDS.toneInput)?.value?.trim() || "",
    icsUrl: byId(IDS.icsInput)?.value?.trim() || ""
  };
}

async function requestBrief({ lat, lon, focus, tone, icsUrl }) {
  const base = API_BASE.replace(/\/$/, "");

  const getUrl = new URL(`${base}/brief`);
  if (lat) getUrl.searchParams.set("lat", lat);
  if (lon) getUrl.searchParams.set("lon", lon);
  if (focus) getUrl.searchParams.set("focus", focus);
  if (tone) getUrl.searchParams.set("tone", tone);
  if (icsUrl) getUrl.searchParams.set("icsUrl", icsUrl);

  console.log("[AI-Assassins] Fetching brief from URL:", getUrl.toString());
  let res = await fetch(getUrl.toString(), { method: "GET", headers: { Accept: "application/json" } });
  if (res.ok) return res.json();

  const postUrl = `${base}/api/brief`;
  console.warn("[AI-Assassins] /brief failed, retrying /api/brief");
  res = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ lat: lat || null, lon: lon || null, focus: focus || null, tone: tone || null, icsUrl: icsUrl || null })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Brief request failed (${res.status}): ${txt}`);
  }
  return res.json();
}

async function generateBrief() {
  setError("");
  setLoadingState(true);
  try {
    const inputs = getInputs();
    const data = await requestBrief(inputs);
    console.log("[AI-Assassins] Received brief JSON", data);

    let weatherFallback = null;
    if (!pick(data, ["weather_local", "weather"], null) && inputs.lat && inputs.lon) {
      weatherFallback = await fetchWeatherFallback(inputs.lat, inputs.lon);
    }
    renderBrief(data, weatherFallback);
    if (!autoRefreshTimer) {
      autoRefreshTimer = setInterval(generateBrief, 600000);
      console.log("[AI-Assassins] Auto-refresh enabled (every 10m)");
    }
    setAutoRefreshStatus(true);
  } catch (err) {
    console.error("[AI-Assassins] generate failed", err);
    setError(err?.message || String(err));
  } finally {
    setLoadingState(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = byId(IDS.btnGenerate);
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    generateBrief();
  });
  setAutoRefreshStatus(Boolean(autoRefreshTimer));
});

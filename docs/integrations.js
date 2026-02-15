const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";

const IDS = {
  btnGenerate: "btnGenerate",
  loading: "loading",
  errorBox: "errorBox",
  latInput: "latInput",
  lonInput: "lonInput",
  focusInput: "focusInput",
  toneInput: "toneInput",
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

let refreshTimer = null;
let isGenerating = false;

function getNode(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const node = getNode(id);
  if (!node) return;
  node.textContent = text == null || text === "" ? "N/A" : String(text);
}

function updateList(id, arr) {
  const node = getNode(id);
  if (!node) return;
  node.textContent = "";
  const list = Array.isArray(arr) && arr.length ? arr : ["N/A"];
  for (const item of list) {
    const li = document.createElement("li");
    li.textContent = String(item);
    node.appendChild(li);
  }
}

function formatMarketValue(value) {
  if (value == null || value === "") return "N/A";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function updateMarkets(markets) {
  setText(IDS.sp500, formatMarketValue(markets?.SP500));
  setText(IDS.nasdaq, formatMarketValue(markets?.NASDAQ));
  setText(IDS.wti, formatMarketValue(markets?.WTI));
  setText(IDS.btc, formatMarketValue(markets?.BTC));
}

function updateWeather(weather) {
  const summary = weather?.summary || "N/A";
  const high = weather?.high ?? "N/A";
  const low = weather?.low ?? "N/A";
  const precip = weather?.precip ?? "N/A";
  setText(IDS.weatherLocal, `${summary} | High: ${high} | Low: ${low} | Precip: ${precip}`);
}

function showError(message) {
  const box = getNode(IDS.errorBox);
  if (!box) return;
  box.textContent = message || "An unknown error occurred.";
  box.style.display = "block";
}

function clearError() {
  const box = getNode(IDS.errorBox);
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

function setLoading(isLoading) {
  const btn = getNode(IDS.btnGenerate);
  const loading = getNode(IDS.loading);

  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Generating..." : "Generate Brief";
  }
  if (loading) {
    loading.style.display = isLoading ? "block" : "none";
  }
}

async function detectCoordinates() {
  const latRaw = getNode(IDS.latInput)?.value?.trim() || "";
  const lonRaw = getNode(IDS.lonInput)?.value?.trim() || "";
  const lat = latRaw === "" ? null : Number(latRaw);
  const lon = lonRaw === "" ? null : Number(lonRaw);

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }

  if (!navigator.geolocation) {
    return { lat: null, lon: null };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const geoLat = position?.coords?.latitude;
        const geoLon = position?.coords?.longitude;
        if (Number.isFinite(geoLat) && Number.isFinite(geoLon)) {
          const latInput = getNode(IDS.latInput);
          const lonInput = getNode(IDS.lonInput);
          if (latInput) latInput.value = String(geoLat);
          if (lonInput) lonInput.value = String(geoLon);
          resolve({ lat: geoLat, lon: geoLon });
          return;
        }
        resolve({ lat: null, lon: null });
      },
      () => resolve({ lat: null, lon: null }),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 }
    );
  });
}

async function collectPayload() {
  const { lat, lon } = await detectCoordinates();
  const focus = getNode(IDS.focusInput)?.value?.trim() || null;
  const tone = getNode(IDS.toneInput)?.value?.trim() || null;
  return { lat, lon, focus, tone };
}

function applyBrief(brief) {
  updateList(IDS.overnightOverview, brief?.overnight_overview);
  updateMarkets(brief?.markets_snapshot || {});
  updateWeather(brief?.weather_local || {});
  updateList(IDS.calendarEvents, brief?.next_up_calendar);

  const scripture = brief?.scripture_of_day || {};
  setText(IDS.scriptureDay, `${scripture.ref || "N/A"} — ${scripture.text || "N/A"} (${scripture.reflection || "N/A"})`);

  updateList(IDS.missionPriorities, brief?.mission_priorities);

  const truthwave = brief?.truthwave || {};
  setText(IDS.truthwaveNarrative, truthwave.narrative);
  setText(IDS.truthwaveRisk, truthwave.risk_flag);
  setText(IDS.truthwaveCounter, truthwave.counter_psyop);

  updateList(IDS.topTasks, brief?.top_tasks);
  setText(IDS.commandNote, brief?.command_note);
}

function startAutoRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    generateBrief().catch((error) => console.error("Auto-refresh failed", error));
  }, 600000);
}

async function generateBrief() {
  if (isGenerating) return;
  if (!API_BASE || API_BASE.includes("REPLACE_ME")) {
    showError("API_BASE is not configured. Set API_BASE in docs/integrations.js.");
    return;
  }

  isGenerating = true;
  clearError();
  setLoading(true);

  try {
    const payload = await collectPayload();
    const res = await fetch(`${API_BASE}/api/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    applyBrief(data);
    startAutoRefresh();
  } catch (error) {
    console.error("Generate Brief failed", error);
    showError(error.message || "Failed to generate brief.");
  } finally {
    setLoading(false);
    isGenerating = false;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = getNode(IDS.btnGenerate);
  if (btn) btn.addEventListener("click", () => generateBrief());
  generateBrief();
});

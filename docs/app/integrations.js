const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";

const IDS = {
  btnGenerate: "btnGenerate",
  loadingState: "loadingState",
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

function getNode(id) {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.error(`DOM error for ${id}`, error);
    return null;
  }
}

function setText(id, text) {
  const node = getNode(id);
  if (!node) return;
  node.textContent = text == null || text === "" ? "N/A" : String(text);
}

function setList(id, values) {
  const node = getNode(id);
  if (!node) return;
  node.textContent = "";
  const list = Array.isArray(values) && values.length ? values : ["N/A"];
  for (const value of list) {
    const li = document.createElement("li");
    li.textContent = String(value);
    node.appendChild(li);
  }
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
  const loading = getNode(IDS.loadingState);

  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Generating..." : "Generate Brief";
  }
  if (loading) {
    loading.style.display = isLoading ? "block" : "none";
  }
}

function collectPayload() {
  const latRaw = getNode(IDS.latInput)?.value?.trim() || "";
  const lonRaw = getNode(IDS.lonInput)?.value?.trim() || "";
  const focus = getNode(IDS.focusInput)?.value?.trim() || null;
  const tone = getNode(IDS.toneInput)?.value?.trim() || null;

  const lat = latRaw === "" ? null : Number(latRaw);
  const lon = lonRaw === "" ? null : Number(lonRaw);

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    focus,
    tone
  };
}

function applyBrief(brief) {
  setList(IDS.overnightOverview, brief?.overnight_overview);

  const markets = brief?.markets_snapshot || {};
  setText(IDS.sp500, markets.SP500);
  setText(IDS.nasdaq, markets.NASDAQ);
  setText(IDS.wti, markets.WTI);
  setText(IDS.btc, markets.BTC);

  const weather = brief?.weather_local || {};
  const weatherSummary = [
    weather.summary || "N/A",
    `High: ${weather.high ?? "N/A"}`,
    `Low: ${weather.low ?? "N/A"}`,
    `Precip: ${weather.precip ?? "N/A"}`
  ].join(" | ");
  setText(IDS.weatherLocal, weatherSummary);

  setList(IDS.calendarEvents, brief?.next_up_calendar);

  const scripture = brief?.scripture_of_day || {};
  setText(IDS.scriptureDay, `${scripture.ref || "N/A"} — ${scripture.text || "N/A"}`);

  setList(IDS.missionPriorities, brief?.mission_priorities);

  const truthwave = brief?.truthwave || {};
  setText(IDS.truthwaveNarrative, truthwave.narrative);
  setText(IDS.truthwaveRisk, truthwave.risk_flag);
  setText(IDS.truthwaveCounter, truthwave.counter_psyop);

  setList(IDS.topTasks, brief?.top_tasks);
  setText(IDS.commandNote, brief?.command_note);
}

async function generateBrief() {
  if (!API_BASE || API_BASE.includes("REPLACE_ME")) {
    showError("API_BASE is not configured. Set API_BASE in docs/integrations.js.");
    return;
  }

  clearError();
  setLoading(true);

  try {
    const payload = collectPayload();

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
  } catch (error) {
    console.error("Generate Brief failed", error);
    showError(error.message || "Failed to generate brief.");
  } finally {
    setLoading(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = getNode(IDS.btnGenerate);
  if (btn) btn.addEventListener("click", generateBrief);
});

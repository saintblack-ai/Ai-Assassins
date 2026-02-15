const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";

function byId(id) {
  return document.getElementById(id);
}

function setLoadingState(isLoading) {
  const btn = byId("btnGenerate");
  const loading = byId("loading") || byId("loadingState");

  if (btn) btn.disabled = isLoading;
  if (loading) loading.style.display = isLoading ? "block" : "none";
}

function setList(id, values) {
  const el = byId(id);
  if (!el) {
    console.warn(`[AI-Assassins] Missing #${id}`);
    return;
  }
  const list = Array.isArray(values) && values.length ? values : ["N/A"];
  el.innerHTML = list.map((item) => `<li>${String(item)}</li>`).join("");
}

function setText(id, value) {
  const el = byId(id);
  if (!el) {
    console.warn(`[AI-Assassins] Missing #${id}`);
    return;
  }
  el.textContent = value == null || value === "" ? "N/A" : String(value);
}

async function generateBrief() {
  try {
    setLoadingState(true);

    const lat = byId("latInput")?.value?.trim() || null;
    const lon = byId("lonInput")?.value?.trim() || null;
    const focus = byId("focusInput")?.value?.trim() || null;
    const tone = byId("toneInput")?.value?.trim() || null;
    const icsUrl = byId("icsInput")?.value?.trim() || null;

    const payload = { lat, lon, focus, tone, icsUrl };

    const response = await fetch(`${API_BASE}/api/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Brief request failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    console.log("Brief response:", data);

    setList("overnightOverview", data.overnight_overview);

    const markets = data.markets_snapshot || {};
    setText("sp500", markets.SP500);
    setText("nasdaq", markets.NASDAQ);
    setText("wti", markets.WTI);
    setText("btc", markets.BTC);

    const weather = data.weather_local || null;
    setText(
      "weatherLocal",
      weather
        ? `${weather.summary ?? "N/A"} | High: ${weather.high ?? "N/A"} | Low: ${weather.low ?? "N/A"} | Precip: ${weather.precip ?? "N/A"}`
        : "N/A"
    );

    setList("calendarEvents", data.next_up_calendar);

    const scripture = data.scripture_of_day || {};
    setText(
      "scriptureDay",
      `${scripture.ref ?? "N/A"} — ${scripture.text ?? "N/A"}${scripture.reflection ? ` | Reflection: ${scripture.reflection}` : ""}`
    );

    setList("missionPriorities", data.mission_priorities);
    const truthwave = data.truthwave || {};
    setText("truthwaveNarrative", truthwave.narrative);
    setText("truthwaveRisk", truthwave.risk_flag);
    setText("truthwaveCounter", truthwave.counter_psyop);
    setList("topTasks", data.top_tasks);
    setText("commandNote", data.command_note);
  } catch (err) {
    console.error(err);
    alert("Brief generation failed.");
  } finally {
    setLoadingState(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = byId("btnGenerate");
  if (!btn) {
    console.warn("[AI-Assassins] Missing #btnGenerate");
    return;
  }
  btn.addEventListener("click", generateBrief);
});

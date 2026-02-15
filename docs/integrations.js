/* docs/integrations.js
   Robust renderer for GitHub Pages + Cloudflare Worker brief endpoint.
*/

(() => {
  "use strict";

  const DEFAULT_API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";
  const API_BASE =
    (window.ATA_WORKER_URL && String(window.ATA_WORKER_URL).trim()) ||
    DEFAULT_API_BASE;

  const IDS = {
    btnGenerate: "btnGenerate",
    loadingState: "loadingState",
    autoRefreshStatus: "autoRefreshStatus",
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

  const warnedMissing = new Set();
  let autoRefreshTimer = null;

  function $(id) {
    const el = document.getElementById(id);
    if (!el && !warnedMissing.has(id)) {
      console.warn(`[AI-Assassins] Missing DOM element #${id}`);
      warnedMissing.add(id);
    }
    return el;
  }

  function setLoading(isLoading, msg) {
    const el = $(IDS.loadingState);
    if (!el) return;
    if (isLoading) {
      el.style.display = "block";
      el.textContent = msg || "Loading...";
    } else {
      el.style.display = "none";
      el.textContent = "";
    }
  }

  function setError(msg) {
    const el = $(IDS.errorBox);
    if (!el) return;
    if (msg) {
      el.style.display = "block";
      el.textContent = msg;
    } else {
      el.style.display = "none";
      el.textContent = "";
    }
  }

  function setAutoRefreshStatus(enabled) {
    const el = $(IDS.autoRefreshStatus);
    if (!el) return;
    el.textContent = enabled
      ? "Auto-refresh enabled (every 10m)"
      : "Auto-refresh disabled";
  }

  function pick(obj, candidates, fallback = undefined) {
    if (!obj || typeof obj !== "object") return fallback;
    const keys = Object.keys(obj);
    const lowerMap = new Map(keys.map((k) => [k.toLowerCase(), k]));
    for (const c of candidates) {
      const found = lowerMap.get(String(c).toLowerCase());
      if (found !== undefined) return obj[found];
    }
    return fallback;
  }

  function toListItems(value) {
    if (!value) return ["N/A"];
    if (Array.isArray(value)) {
      const flat = value.flat().filter(Boolean).map(String);
      return flat.length ? flat : ["N/A"];
    }
    if (typeof value === "string") {
      const lines = value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return lines.length ? lines : ["N/A"];
    }
    const items = pick(value, ["items", "bullets"], null);
    if (items) return toListItems(items);
    const text = pick(value, ["text", "summary"], null);
    if (text) return toListItems(text);
    return ["N/A"];
  }

  function renderList(ulId, items) {
    const ul = $(ulId);
    if (!ul) return;
    ul.innerHTML = "";
    const list = toListItems(items);
    for (const it of list) {
      const li = document.createElement("li");
      li.textContent = it;
      ul.appendChild(li);
    }
  }

  function renderText(elId, text) {
    const el = $(elId);
    if (!el) return;
    const value = text == null || text === "" ? "N/A" : String(text);
    el.textContent = value;
    el.classList.toggle("muted", value === "N/A" || value === "—");
  }

  function fmtMoney(v) {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function renderOverview(data) {
    const ov =
      pick(data, ["overnight_overview", "overview", "overnight"], null) ??
      pick(data, ["headlines"], null);
    renderList(IDS.overnightOverview, ov || ["N/A"]);
  }

  function renderMarkets(data) {
    const m =
      pick(data, ["markets_snapshot", "markets", "market_snapshot"], {}) || {};
    const sp = pick(m, ["sp500", "s&p 500", "sp_500", "SP500", "S&P500"], "N/A");
    const nd = pick(m, ["nasdaq", "NASDAQ"], "N/A");
    const wti = pick(m, ["wti", "WTI"], "N/A");
    const btc = pick(m, ["btc", "BTC", "bitcoin"], "N/A");

    renderText(IDS.sp500, sp === "N/A" ? "N/A" : fmtMoney(sp));
    renderText(IDS.nasdaq, nd === "N/A" ? "N/A" : fmtMoney(nd));
    renderText(IDS.wti, wti === "N/A" ? "N/A" : fmtMoney(wti));
    renderText(IDS.btc, btc === "N/A" ? "N/A" : fmtMoney(btc));
  }

  function renderWeather(data) {
    const w = pick(data, ["weather_local", "weather", "local_weather"], {}) || {};
    const summary = pick(w, ["summary"], "N/A");
    const high = pick(w, ["high", "max", "hi"], "N/A");
    const low = pick(w, ["low", "min", "lo"], "N/A");
    const precip = pick(w, ["precip", "precipitation"], "N/A");
    renderText(IDS.weatherLocal, `${summary} | High: ${high} | Low: ${low} | Precip: ${precip}`);
  }

  function renderCalendar(data) {
    const cal = pick(data, ["next_up_calendar", "calendar", "next"], null);
    renderList(IDS.calendarEvents, cal || ["N/A"]);
  }

  function renderScripture(data) {
    const s = pick(data, ["scripture_of_day", "scripture", "verse"], {}) || {};
    const ref = pick(s, ["ref", "reference"], "");
    const text = pick(s, ["text"], "");
    const reflection = pick(s, ["reflection"], "");
    const out = [ref && `— ${ref}`, text, reflection && `Reflection: ${reflection}`]
      .filter(Boolean)
      .join("\n");
    renderText(IDS.scriptureDay, out || "N/A");
  }

  function renderMissionPriorities(data) {
    renderList(IDS.missionPriorities, pick(data, ["mission_priorities", "priorities"], ["—"]));
  }

  function renderExtras(data) {
    const tw = pick(data, ["truthwave", "black_phoenix_truthwave"], {}) || {};
    renderText(IDS.truthwaveNarrative, pick(tw, ["narrative", "top_narrative"], "—"));
    renderText(IDS.truthwaveRisk, pick(tw, ["risk", "risk_flag"], "—"));
    renderText(IDS.truthwaveCounter, pick(tw, ["counter", "counter_psyop"], "—"));

    renderList(IDS.topTasks, pick(data, ["top_tasks", "tasks"], ["—"]));
    renderText(IDS.commandNote, pick(data, ["command_note", "note"], "—"));
  }

  function renderAll(data) {
    console.log("Rendering overview, markets, weather, etc");
    renderOverview(data);
    renderMarkets(data);
    renderWeather(data);
    renderCalendar(data);
    renderScripture(data);
    renderMissionPriorities(data);
    renderExtras(data);
  }

  function getInputs() {
    const lat = $(IDS.latInput)?.value?.trim() || "";
    const lon = $(IDS.lonInput)?.value?.trim() || "";
    const focus = $(IDS.focusInput)?.value?.trim() || "";
    const tone = $(IDS.toneInput)?.value?.trim() || "";
    return { lat, lon, focus, tone };
  }

  async function fetchBrief() {
    const { lat, lon, focus, tone } = getInputs();

    const base = API_BASE.replace(/\/$/, "");
    const url = new URL(`${base}/brief`);
    if (lat) url.searchParams.set("lat", lat);
    if (lon) url.searchParams.set("lon", lon);
    if (focus) url.searchParams.set("focus", focus);
    if (tone) url.searchParams.set("tone", tone);

    setError("");
    setLoading(true, "Generating brief...");
    console.log("Fetching brief from URL:", url.toString());

    try {
      let res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        const apiUrl = `${base}/api/brief`;
        console.warn("[AI-Assassins] /brief failed, retrying via /api/brief");
        res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ lat: lat || null, lon: lon || null, focus: focus || null, tone: tone || null })
        });
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Brief request failed (${res.status}). ${txt}`.trim());
      }

      const data = await res.json();
      console.log("Received brief JSON", data);
      renderAll(data);
      if (!autoRefreshTimer) {
        autoRefreshTimer = setInterval(fetchBrief, 600000);
      }
      setAutoRefreshStatus(true);
    } catch (err) {
      console.error("[AI-Assassins] generate failed:", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function wireUp() {
    const btn = $(IDS.btnGenerate);
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Clicked generate");
        fetchBrief();
      });
    } else {
      console.warn("[AI-Assassins] Missing #btnGenerate in DOM");
    }
    setAutoRefreshStatus(Boolean(autoRefreshTimer));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp);
  } else {
    wireUp();
  }
})();

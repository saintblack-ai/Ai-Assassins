// AI Assassins integrations (root app)
window.AIA = (() => {
  const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";
  const FALLBACK_TEXT = "Unavailable";
  const FETCHING_TEXT = "Fetching...";

  async function fillLive(brief, settings) {
    await Promise.allSettled([
      fetchOverview(brief),
      fetchMarkets(brief),
      fetchWeather(brief, settings),
      fetchScripture(brief),
      fillCalendar(brief, settings)
    ]);
    syncDomFromBrief(brief);
    return brief;
  }

  async function generateBrief(brief, settings) {
    showLoadingState();
    setLoadingState(brief);
    syncDomFromBrief(brief);

    try {
      const [lat, lon] = String(settings?.latlon || "")
        .split(",")
        .map((value) => parseFloat(value.trim()));

      const payload = {
        date: new Date().toISOString().slice(0, 10),
        focus: settings?.focus || "geopolitics, defense, cyber, space",
        audience: settings?.callsign || "Commander",
        tone: "strategic",
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        ics_url: settings?.icsUrl || "",
        agenda_count: Number.isFinite(Number(settings?.agendaCount)) ? Number(settings.agendaCount) : 3
      };

      const data = await fetchJson(`${API_BASE}/api/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      applyBriefPayload(brief, data);
      applyDirectDomPayload(data);
    } catch (error) {
      console.error("Generate brief failed:", error);
      markUnavailable(brief, "overview");
      markUnavailable(brief, "truthwave");
      markUnavailable(brief, "tasks");
      markUnavailable(brief, "closing");
    }

    syncDomFromBrief(brief);
    hideLoadingState();
    return brief;
  }

  function sec(brief, key) {
    return brief.sections.find((section) => section.key === key);
  }

  async function fetchJson(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function money(value) {
    return Number.isFinite(value)
      ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : FALLBACK_TEXT;
  }

  function markUnavailable(brief, key) {
    const section = sec(brief, key);
    if (!section) return;
    if (section.kvs) {
      section.kvs = section.kvs.map(([name]) => [name, FALLBACK_TEXT]);
      return;
    }
    section.items = [FALLBACK_TEXT];
  }

  function setLoadingState(brief) {
    const keys = ["overview", "weather", "calendar", "scripture", "truthwave", "tasks", "closing"];
    keys.forEach((key) => {
      const section = sec(brief, key);
      if (!section || section.kvs) return;
      section.items = [FETCHING_TEXT];
    });

    const markets = sec(brief, "markets");
    if (markets && markets.kvs) {
      markets.kvs = [
        ["S&P 500", FETCHING_TEXT],
        ["Nasdaq", FETCHING_TEXT],
        ["WTI", FETCHING_TEXT],
        ["BTC", FETCHING_TEXT]
      ];
    }
  }

  async function fetchOverview(brief) {
    const section = sec(brief, "overview");
    if (!section) return;

    try {
      const data = await fetchJson(`${API_BASE}/api/overview`);
      const items = Array.isArray(data?.items) ? data.items : [];
      section.items = items.slice(0, 5).map((item) => {
        const title = escapeHtml(item.title || "Untitled");
        const link = item.link || "#";
        const source = escapeHtml(item.source || "Source");
        return `<a href="${link}" target="_blank" rel="noopener">${title} (${source})</a>`;
      });
      if (!section.items.length) section.items = [FALLBACK_TEXT];
    } catch (error) {
      console.error("Overview fetch failed:", error);
      section.items = [FALLBACK_TEXT];
    }
  }

  async function fetchMarkets(brief) {
    const section = sec(brief, "markets");
    if (!section) return;

    try {
      const data = await fetchJson(`${API_BASE}/api/markets`);
      const values = {
        SP500: data?.SP500 ?? null,
        NASDAQ: data?.NASDAQ ?? null,
        WTI: data?.WTI ?? null,
        BTC: data?.BTC ?? null
      };
      section.kvs = [
        ["S&P 500", money(values.SP500)],
        ["Nasdaq", money(values.NASDAQ)],
        ["WTI", money(values.WTI)],
        ["BTC", money(values.BTC)]
      ];
      updateMarketDom(values);
    } catch (error) {
      console.error("Markets fetch failed:", error);
      section.kvs = [
        ["S&P 500", FALLBACK_TEXT],
        ["Nasdaq", FALLBACK_TEXT],
        ["WTI", FALLBACK_TEXT],
        ["BTC", FALLBACK_TEXT]
      ];
      updateMarketDom({ SP500: null, NASDAQ: null, WTI: null, BTC: null });
    }
  }

  async function fetchWeather(brief, settings) {
    const section = sec(brief, "weather");
    if (!section) return;

    const [lat, lon] = String(settings?.latlon || "")
      .split(",")
      .map((value) => parseFloat(value.trim()));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      section.items = [FALLBACK_TEXT];
      return;
    }

    try {
      const data = await fetchJson(`${API_BASE}/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      const current = data?.current || {};
      const daily = data?.daily || {};
      section.items = [
        `Current: ${current.temperature_2m ?? "-"}°C, wind ${current.wind_speed_10m ?? "-"} km/h`,
        `High / Low: ${daily.max ?? "-"}°C / ${daily.min ?? "-"}°C`,
        `Precip: ${daily.precipitation_sum ?? "-"} mm`
      ];
    } catch (error) {
      console.error("Weather fetch failed:", error);
      section.items = [FALLBACK_TEXT];
    }
  }

  async function fetchScripture(brief) {
    const section = sec(brief, "scripture");
    if (!section) return;

    try {
      const data = await fetchJson(`${API_BASE}/api/scripture`);
      section.items = [
        `${data?.translation || "KJV"} — ${data?.reference || ""}`,
        data?.text || FALLBACK_TEXT,
        `Reflection: ${data?.reflection || FALLBACK_TEXT}`
      ];
    } catch (error) {
      console.error("Scripture fetch failed:", error);
      section.items = [FALLBACK_TEXT];
    }
  }

  async function fillCalendar(brief, settings) {
    const section = sec(brief, "calendar");
    if (!section) return;

    const url = String(settings?.icsUrl || "").trim();
    if (!url) {
      section.items = ["(Add ICS link in Settings)"];
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        section.items = [FALLBACK_TEXT];
        return;
      }

      const text = await response.text();
      const events = parseICS(text);
      const now = new Date();
      const limit = Number(settings?.agendaCount || 3);
      const upcoming = events
        .filter((event) => event.start && event.start > now)
        .sort((a, b) => a.start - b.start)
        .slice(0, limit);

      section.items = upcoming.length ? upcoming.map(formatEvent) : [FALLBACK_TEXT];
    } catch (error) {
      console.error("Calendar fetch failed:", error);
      section.items = [FALLBACK_TEXT];
    }
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
    const mo = Number(raw.slice(4, 6)) - 1;
    const d = Number(raw.slice(6, 8));
    const hh = Number(raw.slice(9, 11));
    const mm = Number(raw.slice(11, 13));
    const ss = Number(raw.slice(13, 15));
    return new Date(y, mo, d, hh, mm, ss);
  }

  function formatEvent(event) {
    const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(event.start);
    const start = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(event.start);
    const end = event.end
      ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(event.end)
      : "";
    return `${day} ${start}${end ? `-${end}` : ""} — ${event.summary || "(No title)"}${event.location ? ` @ ${event.location}` : ""}`;
  }

  function applyBriefPayload(brief, payload) {
    const map = {
      overnight_overview: "overview",
      markets_snapshot: "markets",
      weather_local: "weather",
      next_up_calendar: "calendar",
      scripture_of_day: "scripture",
      mission_priorities: "priorities",
      truthwave: "truthwave",
      top_tasks: "tasks",
      command_note: "closing"
    };

    for (const [sourceKey, targetKey] of Object.entries(map)) {
      const section = sec(brief, targetKey);
      if (!section) continue;

      const value = payload?.[sourceKey];

      if (targetKey === "markets") {
        const m = value && typeof value === "object" ? value : {};
        const values = {
          SP500: normalizeNumber(m.SP500),
          NASDAQ: normalizeNumber(m.NASDAQ),
          WTI: normalizeNumber(m.WTI),
          BTC: normalizeNumber(m.BTC)
        };
        section.kvs = [
          ["S&P 500", money(values.SP500)],
          ["Nasdaq", money(values.NASDAQ)],
          ["WTI", money(values.WTI)],
          ["BTC", money(values.BTC)]
        ];
        updateMarketDom(values);
        continue;
      }

      if (Array.isArray(value)) {
        section.items = value.length ? value.map((item) => String(item)) : [FALLBACK_TEXT];
        continue;
      }

      if (value && typeof value === "object") {
        section.items = Object.entries(value).map(([k, v]) => `${titleize(k)}: ${v ?? FALLBACK_TEXT}`);
        continue;
      }

      if (typeof value === "string") {
        section.items = [value || FALLBACK_TEXT];
        continue;
      }

      section.items = [FALLBACK_TEXT];
    }
  }

  function updateMarketDom(values) {
    setNodeText(["sp500", "SP500"], money(values.SP500));
    setNodeText(["nasdaq", "NASDAQ"], money(values.NASDAQ));
    setNodeText(["wti", "WTI"], money(values.WTI));
    setNodeText(["btc", "BTC"], money(values.BTC));
  }

  function syncDomFromBrief(brief) {
    const overview = sec(brief, "overview");
    const weather = sec(brief, "weather");
    const calendar = sec(brief, "calendar");
    const scripture = sec(brief, "scripture");
    const priorities = sec(brief, "priorities");
    const truthwave = sec(brief, "truthwave");
    const tasks = sec(brief, "tasks");
    const closing = sec(brief, "closing");

    setNodeList("overnightOverview", overview?.items || [FALLBACK_TEXT]);
    setNodeList("weatherLocal", weather?.items || [FALLBACK_TEXT]);
    setNodeList("calendarEvents", calendar?.items || [FALLBACK_TEXT]);
    setNodeList("scriptureDay", scripture?.items || [FALLBACK_TEXT]);
    setNodeList("missionPriorities", priorities?.items || [FALLBACK_TEXT]);
    setNodeList("truthwave", truthwave?.items || [FALLBACK_TEXT]);
    setNodeList("topTasks", tasks?.items || [FALLBACK_TEXT]);
    setNodeText("commandNote", (closing?.items && closing.items[0]) || FALLBACK_TEXT);
  }

  function setNodeText(ids, text) {
    const arr = Array.isArray(ids) ? ids : [ids];
    for (const id of arr) {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    }
  }

  function setNodeList(id, values) {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = "";
    const list = Array.isArray(values) && values.length ? values : [FALLBACK_TEXT];
    for (const value of list) {
      const li = document.createElement("li");
      li.textContent = String(value);
      node.appendChild(li);
    }
  }

  function updateCard(selector, value) {
    const node = document.querySelector(selector);
    if (!node) return;

    if (Array.isArray(value)) {
      node.innerHTML = "";
      const list = value.length ? value : [FALLBACK_TEXT];
      for (const item of list) {
        const li = document.createElement("li");
        li.textContent = String(item);
        node.appendChild(li);
      }
      return;
    }

    if (value && typeof value === "object") {
      const lines = Object.entries(value).map(([k, v]) => `${titleize(k)}: ${v ?? FALLBACK_TEXT}`);
      node.textContent = lines.length ? lines.join(" | ") : FALLBACK_TEXT;
      return;
    }

    node.textContent = value == null || value === "" ? FALLBACK_TEXT : String(value);
  }

  function applyDirectDomPayload(data) {
    const markets = data?.markets_snapshot || {};
    const calendarEvents = data?.calendar_events || data?.next_up_calendar || [];
    const scripture = data?.scripture_of_day || {};
    const scriptureRef = scripture.ref || scripture.reference || FALLBACK_TEXT;
    const scriptureText = scripture.text || scripture.verse || FALLBACK_TEXT;

    updateCard("#overnightOverview", data?.overnight_overview || []);
    updateCard("#sp500", markets.SP500);
    updateCard("#nasdaq", markets.NASDAQ);
    updateCard("#wti", markets.WTI);
    updateCard("#btc", markets.BTC);
    updateCard("#weatherLocal", data?.weather_local?.summary || data?.weather_local);
    updateCard("#calendarEvents", calendarEvents);
    updateCard("#scriptureDay", `${scriptureRef} — ${scriptureText}`);
    updateCard("#missionPriorities", data?.mission_priorities || []);
    updateCard("#truthwave", data?.truthwave || FALLBACK_TEXT);
    updateCard("#topTasks", data?.top_tasks || []);
    updateCard("#commandNote", data?.command_note || FALLBACK_TEXT);
  }

  function hideLoadingState() {
    const generateButton = document.getElementById("generate");
    if (!generateButton) return;
    generateButton.disabled = false;
    generateButton.textContent = "Generate Brief";
  }

  function showLoadingState() {
    const generateButton = document.getElementById("generate");
    if (!generateButton) return;
    generateButton.disabled = true;
    generateButton.textContent = "Generating...";
  }

  function normalizeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function titleize(text) {
    return String(text)
      .replaceAll(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  return { API_BASE, fillLive, generateBrief };
})();

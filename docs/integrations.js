// AI Assassins integrations (v10)
window.AIA = (() => {
  // Replace <SUBDOMAIN> after deploying your worker.
  const API_BASE = "https://ai-assassins-api.<SUBDOMAIN>.workers.dev";

  async function fillLive(brief, settings) {
    await Promise.allSettled([
      fetchOverview(brief),
      fetchMarkets(brief),
      fetchWeather(brief, settings),
      fetchScripture(brief),
      fillCalendar(brief, settings)
    ]);
    return brief;
  }

  async function generateBrief(brief, settings) {
    try {
      const payload = {
        date: new Date().toISOString().slice(0, 10),
        focus: settings?.focus || "geopolitics, defense, cyber, space",
        audience: settings?.callsign || "Commander",
        tone: "strategic"
      };
      const data = await fetchJson(`${API_BASE}/api/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      applyBriefPayload(brief, data);
    } catch {
      markUnavailable(brief, "overview", "Unavailable");
      markUnavailable(brief, "truthwave", "Unavailable");
      markUnavailable(brief, "tasks", "Unavailable");
      markUnavailable(brief, "closing", "Unavailable");
    }
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
      : "Unavailable";
  }

  function markUnavailable(brief, key, text) {
    const section = sec(brief, key);
    if (!section) return;
    if (section.kvs) {
      section.kvs = section.kvs.map(([name]) => [name, "Unavailable"]);
      return;
    }
    section.items = [text];
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
      if (!section.items.length) section.items = ["Unavailable"];
    } catch {
      section.items = ["Unavailable"];
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
    } catch {
      section.kvs = [
        ["S&P 500", "Unavailable"],
        ["Nasdaq", "Unavailable"],
        ["WTI", "Unavailable"],
        ["BTC", "Unavailable"]
      ];
      updateMarketDom({ SP500: null, NASDAQ: null, WTI: null, BTC: null });
    }
  }

  function updateMarketDom(values) {
    const map = {
      SP500: values.SP500,
      NASDAQ: values.NASDAQ,
      WTI: values.WTI,
      BTC: values.BTC
    };
    Object.entries(map).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = money(value);
    });
  }

  async function fetchWeather(brief, settings) {
    const section = sec(brief, "weather");
    if (!section) return;

    const [lat, lon] = String(settings?.latlon || "")
      .split(",")
      .map((n) => parseFloat(n.trim()));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      section.items = ["Unavailable"];
      return;
    }

    try {
      const data = await fetchJson(`${API_BASE}/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      const current = data?.current || {};
      const daily = data?.daily || {};
      section.items = [
        `Current: ${current.temperature_2m ?? "-"}C, wind ${current.wind_speed_10m ?? "-"} km/h`,
        `High / Low: ${daily.max ?? "-"}C / ${daily.min ?? "-"}C`,
        `Precip: ${daily.precipitation_sum ?? "-"} mm`
      ];
    } catch {
      section.items = ["Unavailable"];
    }
  }

  async function fetchScripture(brief) {
    const section = sec(brief, "scripture");
    if (!section) return;
    try {
      const data = await fetchJson(`${API_BASE}/api/scripture`);
      section.items = [
        `${data?.translation || "KJV"} - ${data?.reference || ""}`,
        data?.text || "Unavailable",
        `Reflection: ${data?.reflection || "Unavailable"}`
      ];
    } catch {
      section.items = ["Unavailable"];
    }
  }

  async function fillCalendar(brief, settings) {
    const url = String(settings?.icsUrl || "").trim();
    if (!url) return;

    const section = sec(brief, "calendar");
    if (!section) return;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        section.items = ["Unavailable"];
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

      section.items = upcoming.length ? upcoming.map(formatEvent) : ["Unavailable"];
    } catch {
      section.items = ["Unavailable"];
    }
  }

  function parseICS(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const unfolded = [];
    let current = null;

    for (const line of lines) {
      if (line.startsWith(" ") || line.startsWith("\t")) {
        unfolded[unfolded.length - 1] += line.slice(1);
      } else {
        unfolded.push(line);
      }
    }

    const events = [];
    for (const line of unfolded) {
      if (line.startsWith("BEGIN:VEVENT")) {
        current = {};
      } else if (line.startsWith("END:VEVENT")) {
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

  function formatEvent(event) {
    const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(event.start);
    const start = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(event.start);
    const end = event.end
      ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(event.end)
      : "";
    return `${day} ${start}${end ? `-${end}` : ""} - ${event.summary || "(No title)"}${event.location ? ` @ ${event.location}` : ""}`;
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

    Object.entries(map).forEach(([sourceKey, targetKey]) => {
      const section = sec(brief, targetKey);
      if (!section) return;

      const value = payload?.[sourceKey];
      if (section.kvs && value && typeof value === "object") {
        section.kvs = [
          ["S&P 500", money(value.SP500 ?? null)],
          ["Nasdaq", money(value.NASDAQ ?? null)],
          ["WTI", money(value.WTI ?? null)],
          ["BTC", money(value.BTC ?? null)]
        ];
        updateMarketDom(value);
      } else if (Array.isArray(value)) {
        section.items = value.length ? value.map((item) => String(item)) : ["Unavailable"];
      } else if (typeof value === "string") {
        section.items = [value];
      } else if (value && typeof value === "object") {
        section.items = Object.entries(value).map(([k, v]) => `${k}: ${v}`);
      }
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  return {
    fillLive,
    generateBrief,
    API_BASE
  };
})();

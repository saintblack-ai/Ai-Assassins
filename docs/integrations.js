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
    icsInput: "icsInput",
    btnLogin: "btnLogin",
    loginDialog: "loginDialog",
    loginForm: "loginForm",
    loginEmail: "loginEmail",
    loginPassword: "loginPassword",
    btnSubscribe: "btnSubscribe",
    subscriptionBadge: "subscriptionBadge",

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
    ,
    pastBriefsList: "pastBriefsList"
  };

  const warnedMissing = new Set();
  let autoRefreshTimer = null;
  const ICS_STORAGE_KEY = "aia_ics_url";
  const AUTH_TOKEN_KEY = "aia_auth_token";
  const CUSTOMER_ID_KEY = "aia_customer_id";

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

  function renderPastBriefs(items) {
    const listEl = $(IDS.pastBriefsList);
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No saved briefs yet";
      listEl.appendChild(li);
      return;
    }
    for (const item of items) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${item.timestamp || "Unknown time"} — ${item.id}`;
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.addEventListener("click", async () => {
        try {
          const base = API_BASE.replace(/\/$/, "");
          const url = new URL(`${base}/brief`);
          url.searchParams.set("id", item.id);
          const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error(`Failed loading brief ${item.id}`);
          const data = await res.json();
          renderAll(data);
        } catch (error) {
          console.error("[AI-Assassins] failed to load past brief", error);
          setError(error.message || "Failed loading past brief.");
        }
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  async function loadBriefHistory() {
    try {
      const base = API_BASE.replace(/\/$/, "");
      const res = await fetch(`${base}/briefs`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("History unavailable");
      const payload = await res.json();
      renderPastBriefs(payload.items || []);
    } catch (error) {
      console.warn("[AI-Assassins] history fetch failed", error);
      renderPastBriefs([]);
    }
  }

  function getInputs() {
    const lat = $(IDS.latInput)?.value?.trim() || "";
    const lon = $(IDS.lonInput)?.value?.trim() || "";
    const focus = $(IDS.focusInput)?.value?.trim() || "";
    const tone = $(IDS.toneInput)?.value?.trim() || "";
    const icsUrl = $(IDS.icsInput)?.value?.trim() || "";
    return { lat, lon, focus, tone, icsUrl };
  }

  async function fetchBrief() {
    const { lat, lon, focus, tone, icsUrl } = getInputs();

    const base = API_BASE.replace(/\/$/, "");
    const url = new URL(`${base}/brief`);
    if (lat) url.searchParams.set("lat", lat);
    if (lon) url.searchParams.set("lon", lon);
    if (focus) url.searchParams.set("focus", focus);
    if (tone) url.searchParams.set("tone", tone);
    if (icsUrl) url.searchParams.set("icsUrl", icsUrl);

    setError("");
    setLoading(true, "Generating brief...");
    console.log("Fetching brief from URL:", url.toString());

    try {
      const authToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
      const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      let res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", ...authHeaders }
      });

      if (!res.ok) {
        const apiUrl = `${base}/api/brief`;
        console.warn("[AI-Assassins] /brief failed, retrying via /api/brief");
        res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            lat: lat || null,
            lon: lon || null,
            focus: focus || null,
            tone: tone || null,
            icsUrl: icsUrl || null
          })
        });
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Brief request failed (${res.status}). ${txt}`.trim());
      }

      const data = await res.json();
      console.log("Received brief JSON", data);
      renderAll(data);
      loadBriefHistory();
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

  async function login(email, password) {
    const base = API_BASE.replace(/\/$/, "");
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Login failed: ${text || res.status}`);
    }
    const data = await res.json();
    if (!data.token) throw new Error("Login response missing token");
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    return data;
  }

  function setPremiumVisibility(isPro) {
    const premiumNodes = document.querySelectorAll("[data-premium='true']");
    for (const node of premiumNodes) {
      node.style.display = isPro ? "" : "none";
    }
    const badge = $(IDS.subscriptionBadge);
    if (badge) badge.textContent = isPro ? "Tier: Pro" : "Tier: Free";
  }

  async function refreshSubscriptionStatus() {
    const customerId = localStorage.getItem(CUSTOMER_ID_KEY) || "";
    if (!customerId) {
      setPremiumVisibility(false);
      return;
    }
    try {
      const base = API_BASE.replace(/\/$/, "");
      const res = await fetch(`${base}/status?customer_id=${encodeURIComponent(customerId)}`, {
        headers: { Accept: "application/json" }
      });
      if (!res.ok) throw new Error("Status unavailable");
      const data = await res.json();
      setPremiumVisibility(data?.tier === "pro");
    } catch (error) {
      console.warn("[AI-Assassins] subscription status check failed", error);
      setPremiumVisibility(false);
    }
  }

  async function createSubscription() {
    const email = prompt("Enter billing email:");
    if (!email) return;
    const priceId = prompt("Enter Stripe Price ID (e.g. price_...):");
    if (!priceId) return;
    const base = API_BASE.replace(/\/$/, "");
    const res = await fetch(`${base}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, priceId })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Subscribe failed");
    }
    const data = await res.json();
    if (data.customer_id) localStorage.setItem(CUSTOMER_ID_KEY, data.customer_id);
    return data;
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
    const icsInput = $(IDS.icsInput);
    if (icsInput) {
      icsInput.value = localStorage.getItem(ICS_STORAGE_KEY) || "";
      icsInput.addEventListener("change", () => {
        localStorage.setItem(ICS_STORAGE_KEY, icsInput.value.trim());
      });
    }
    const loginBtn = $(IDS.btnLogin);
    const loginDialog = $(IDS.loginDialog);
    const loginForm = $(IDS.loginForm);
    if (loginBtn && loginDialog) {
      loginBtn.addEventListener("click", () => loginDialog.showModal());
    }
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const email = $(IDS.loginEmail)?.value?.trim() || "";
          const password = $(IDS.loginPassword)?.value || "";
          const result = await login(email, password);
          setError("");
          console.log("[AI-Assassins] Login succeeded", result.email);
          loginDialog?.close();
        } catch (error) {
          setError(error.message || "Login failed");
        }
      });
    }
    const subscribeBtn = $(IDS.btnSubscribe);
    if (subscribeBtn) {
      subscribeBtn.addEventListener("click", async () => {
        try {
          const result = await createSubscription();
          console.log("[AI-Assassins] Subscription created", result);
          await refreshSubscriptionStatus();
        } catch (error) {
          setError(error.message || "Subscription failed");
        }
      });
    }
    setAutoRefreshStatus(Boolean(autoRefreshTimer));
    loadBriefHistory();
    refreshSubscriptionStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireUp);
  } else {
    wireUp();
  }
})();

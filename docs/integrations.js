const WORKER_URL = "https://ai-assassins-worker.quandrix357.workers.dev";
const DEFAULT_API_BASE = WORKER_URL;
const API_BASE_STORAGE_KEY = "AI_ASSASSINS_API_BASE";
const DEVICE_ID_KEY = "AIA_DEVICE_ID";
const SUPABASE_URL_KEY = "AIA_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "AIA_SUPABASE_ANON_KEY";
const DEFAULT_REFRESH_MINUTES = 10;
const SETTINGS_KEY = "AIA_DEFAULT_SETTINGS";

const IDS = {
  btnGenerate: "btnGenerate",
  btnAutoBrief: "btnAutoBrief",
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
  commandNote: "commandNote",
  loginDialog: "loginDialog",
  loginForm: "loginForm",
  loginEmail: "loginEmail",
  loginPassword: "loginPassword",
  btnLogin: "btnLogin",
  btnLogout: "btnLogout",
  btnRestorePurchases: "btnRestorePurchases",
  btnExportPdf: "btnExportPdf",
  btnUpgrade: "btnUpgrade",
  btnContactEnterprise: "btnContactEnterprise",
  apiBaseInput: "apiBaseInput",
  btnSaveApiBase: "btnSaveApiBase",
  btnResetApiBase: "btnResetApiBase",
  apiBaseStatus: "apiBaseStatus",
  subscriptionBadge: "subscriptionBadge",
  userEmailBadge: "userEmailBadge",
  billingStatus: "billingStatus",
  tierDetails: "tierDetails"
  ,
  tabBriefBtn: "tabBriefBtn",
  tabHistoryBtn: "tabHistoryBtn",
  tabSettingsBtn: "tabSettingsBtn",
  tabBrief: "tabBrief",
  tabHistory: "tabHistory",
  tabSettings: "tabSettings",
  defaultLatInput: "defaultLatInput",
  defaultLonInput: "defaultLonInput",
  defaultFocusInput: "defaultFocusInput",
  defaultToneInput: "defaultToneInput",
  refreshMinutesInput: "refreshMinutesInput",
  btnSaveDefaults: "btnSaveDefaults",
  btnApplyDefaults: "btnApplyDefaults",
  supabaseUrlInput: "supabaseUrlInput",
  supabaseAnonInput: "supabaseAnonInput",
  btnSaveSupabase: "btnSaveSupabase"
};

const missingWarned = new Set();
let autoRefreshTimer = null;
let supabaseClient = null;
let authSession = null;
let currentTier = "free";
let currentUsage = 0;
let knownBriefs = [];
let apiBase = "";
let supabaseUrl = "";
let supabaseAnonKey = "";
let refreshMinutes = DEFAULT_REFRESH_MINUTES;

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const generated = (window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random()}`);
    id = String(generated).replace(/[^a-zA-Z0-9_-]/g, "");
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function byId(id) {
  const el = document.getElementById(id);
  if (!el && !missingWarned.has(id)) {
    console.warn(`[AI-Assassins] Missing DOM element #${id}`);
    missingWarned.add(id);
  }
  return el;
}

function sanitizeApiBase(value) {
  if (!value) return "";
  const trimmed = String(value).trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function parseNumber(input, fallback) {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getSupabaseConfig() {
  return {
    url: (window.SUPABASE_URL || localStorage.getItem(SUPABASE_URL_KEY) || "").trim(),
    anonKey: (window.SUPABASE_ANON_KEY || localStorage.getItem(SUPABASE_ANON_KEY_KEY) || "").trim(),
  };
}

function resolveApiBase() {
  const fromQuery = sanitizeApiBase(new URLSearchParams(window.location.search).get("apiBase"));
  if (fromQuery) {
    localStorage.setItem(API_BASE_STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  const fromStorage = sanitizeApiBase(localStorage.getItem(API_BASE_STORAGE_KEY));
  return fromStorage || DEFAULT_API_BASE;
}

function getApiBase() {
  return apiBase || DEFAULT_API_BASE;
}

function refreshApiBaseUi() {
  const input = byId(IDS.apiBaseInput);
  const status = byId(IDS.apiBaseStatus);
  if (input) input.value = getApiBase();
  if (status) {
    const usingDefault = getApiBase() === DEFAULT_API_BASE;
    status.textContent = usingDefault
      ? `Using default API base: ${DEFAULT_API_BASE}`
      : `Using override API base: ${getApiBase()}`;
  }
}

function toast(message, kind = "info") {
  const wrap = byId("toastContainer");
  if (!wrap || !message) return;
  const el = document.createElement("div");
  el.className = `toast${kind === "error" ? " error" : ""}`;
  el.textContent = String(message);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
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
    toast(message, "error");
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

function scheduleAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(generateBrief, refreshMinutes * 60 * 1000);
  setAutoRefreshStatus(true);
}

function setSubscriptionBadge(tier, usage, quota) {
  const badge = byId(IDS.subscriptionBadge);
  const emailBadge = byId(IDS.userEmailBadge);
  const status = byId(IDS.billingStatus);
  const details = byId(IDS.tierDetails);
  const upgradeBtn = byId(IDS.btnUpgrade);
  const contactEnterpriseBtn = byId(IDS.btnContactEnterprise);
  const label =
    tier === "enterprise" ? "Enterprise" :
    tier === "elite" ? "Elite" :
    tier === "pro" || tier === "premium" ? "Premium" : "Free";
  if (badge) badge.textContent = `Tier: ${label}`;
  if (emailBadge) emailBadge.textContent = authSession?.user?.email ? authSession.user.email : "Guest mode";
  if (status) status.textContent = `Billing status: ${tier === "free" ? "Free" : "Active"}`;
  if (details) {
    details.textContent =
      tier === "enterprise"
        ? "Enterprise tier active: custom policy, SLA, and priority support enabled."
        : tier === "elite"
          ? "Elite tier active: advanced exports and expanded strategic brief depth enabled."
          : tier === "pro"
            ? "Pro tier active: higher daily limits, history, and export features unlocked."
            : `Free tier usage: ${usage}/${quota} briefs today. Upgrade for more capacity.`;
  }

  if (upgradeBtn) {
    upgradeBtn.style.display = tier === "enterprise" ? "none" : "";
  }
  if (contactEnterpriseBtn) {
    contactEnterpriseBtn.style.display = tier === "enterprise" ? "none" : "";
  }

  const premiumNodes = document.querySelectorAll('[data-premium="true"]');
  premiumNodes.forEach((node) => {
    node.style.display = tier !== "free" ? "" : "none";
  });
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

function safeJsonParse(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: "Response was not valid JSON" };
  }
}

function userFacingError(raw) {
  const msg = String(raw || "");
  if (msg.includes("rate_limit_exceeded")) return "Quota limit reached for your tier today.";
  if (msg.includes("upgrade_required")) return "Upgrade required for this feature.";
  if (msg.includes("email_not_configured")) return "Email not configured. Ask admin to set RESEND_API_KEY and DAILY_ALERT_TO.";
  return msg;
}

async function fetchWithTimeout(url, init, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders() {
  const token = authSession?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWeatherFallback(lat, lon) {
  if (!lat || !lon) return null;
  try {
    const url = new URL(`${getApiBase()}/api/weather`);
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    const res = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json", ...authHeaders() } }, 12000);
    if (!res.ok) return null;
    const txt = await res.text();
    const parsed = safeJsonParse(txt);
    return parsed.ok ? parsed.data : null;
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

  const weather = pick(data, ["weather_local", "weatherLocal", "weather"], {}) || {};
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

function loadDefaults() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  try {
    const cfg = JSON.parse(raw);
    if (cfg.lat) byId(IDS.defaultLatInput).value = cfg.lat;
    if (cfg.lon) byId(IDS.defaultLonInput).value = cfg.lon;
    if (cfg.focus) byId(IDS.defaultFocusInput).value = cfg.focus;
    if (cfg.tone) byId(IDS.defaultToneInput).value = cfg.tone;
    refreshMinutes = parseNumber(cfg.refreshMinutes, DEFAULT_REFRESH_MINUTES);
    if (byId(IDS.refreshMinutesInput)) byId(IDS.refreshMinutesInput).value = String(refreshMinutes);
  } catch {
    // ignore
  }
}

function saveDefaults() {
  const cfg = {
    lat: byId(IDS.defaultLatInput)?.value?.trim() || "",
    lon: byId(IDS.defaultLonInput)?.value?.trim() || "",
    focus: byId(IDS.defaultFocusInput)?.value?.trim() || "",
    tone: byId(IDS.defaultToneInput)?.value?.trim() || "",
    refreshMinutes: parseNumber(byId(IDS.refreshMinutesInput)?.value, DEFAULT_REFRESH_MINUTES),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
  refreshMinutes = cfg.refreshMinutes;
  scheduleAutoRefresh();
  toast("Defaults saved");
}

function applyDefaultsToInputs() {
  const lat = byId(IDS.latInput);
  const lon = byId(IDS.lonInput);
  const focus = byId(IDS.focusInput);
  const tone = byId(IDS.toneInput);
  if (lat) lat.value = byId(IDS.defaultLatInput)?.value?.trim() || "";
  if (lon) lon.value = byId(IDS.defaultLonInput)?.value?.trim() || "";
  if (focus) focus.value = byId(IDS.defaultFocusInput)?.value?.trim() || "";
  if (tone) tone.value = byId(IDS.defaultToneInput)?.value?.trim() || "";
  toast("Defaults applied");
}

function saveSupabaseConfig() {
  const url = byId(IDS.supabaseUrlInput)?.value?.trim() || "";
  const anon = byId(IDS.supabaseAnonInput)?.value?.trim() || "";
  if (url) localStorage.setItem(SUPABASE_URL_KEY, url);
  if (anon) localStorage.setItem(SUPABASE_ANON_KEY_KEY, anon);
  supabaseUrl = url;
  supabaseAnonKey = anon;
  toast("Supabase config saved. Reload page to reinitialize auth.");
}

function switchTab(tabName) {
  const tabs = {
    brief: byId(IDS.tabBrief),
    history: byId(IDS.tabHistory),
    settings: byId(IDS.tabSettings),
  };
  Object.entries(tabs).forEach(([k, node]) => {
    if (!node) return;
    node.style.display = k === tabName ? "" : "none";
  });
}

async function requestBrief({ lat, lon, focus, tone, icsUrl }) {
  const deviceId = getOrCreateDeviceId();
  const payload = {
    deviceId,
    lat: lat || null,
    lon: lon || null,
    focus: focus || null,
    tone: tone || null,
    icsUrl: icsUrl || null
  };

  const res = await fetch(`${WORKER_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const txt = await res.text();
  const parsed = safeJsonParse(txt);
  if (!parsed.ok) throw new Error(`Brief request failed: ${parsed.error}`);
  if (!res.ok) {
    const mapped = userFacingError(parsed?.data?.error || txt);
    throw new Error(mapped);
  }
  return parsed.data;
}

async function viewDailyAutoBrief() {
  setError("");
  setLoadingState(true, "Loading auto brief...");
  try {
    let data = null;
    if (window.AIASupabase?.fetchAutoBrief) {
      data = await window.AIASupabase.fetchAutoBrief();
    } else {
      const res = await fetchWithTimeout(`${getApiBase()}/api/brief/auto`, {
        headers: { Accept: "application/json", ...authHeaders() },
        cache: "no-store",
        mode: "cors",
      });
      const text = await res.text();
      const parsed = safeJsonParse(text);
      if (!parsed.ok || !res.ok) throw new Error(parsed?.data?.error || "Unable to load auto brief");
      data = parsed.data;
    }
    const brief = data?.brief || data;
    renderBrief(brief || {});
    toast("Loaded daily auto brief");
  } catch (error) {
    setError(userFacingError(error?.message || "Unable to load daily auto brief"));
  } finally {
    setLoadingState(false);
  }
}

async function loadBriefHistory() {
  const list = byId("pastBriefsList");
  if (!list) return;
  if (!authSession?.access_token) {
    list.innerHTML = '<li class="muted">Sign in to sync cloud history</li>';
    return;
  }

  try {
    let items = [];
    if (window.AIASupabase?.fetchHistory) {
      const payload = await window.AIASupabase.fetchHistory();
      items = Array.isArray(payload?.items) ? payload.items : [];
    } else {
      const res = await fetchWithTimeout(`${getApiBase()}/api/briefs`, {
        headers: { Accept: "application/json", ...authHeaders() },
        cache: "no-store",
        mode: "cors"
      }, 12000);
      const text = await res.text();
      const parsed = safeJsonParse(text);
      if (!parsed.ok || !res.ok) throw new Error("Unable to load brief history");
      items = Array.isArray(parsed.data?.items) ? parsed.data.items : [];
    }
    knownBriefs = items;
    renderPastBriefs(items);
  } catch (error) {
    console.warn("[AI-Assassins] Failed loading brief history", error);
    list.innerHTML = '<li class="muted">History unavailable</li>';
  }
}

function renderPastBriefs(items) {
  const list = byId("pastBriefsList");
  if (!list) return;
  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML = '<li class="muted">No saved briefs yet</li>';
    return;
  }
  list.innerHTML = "";
  for (const item of items.slice(0, 20)) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr auto auto auto auto";
    row.style.gap = "6px";
    row.style.alignItems = "center";

    const btn = document.createElement("button");
    const ts = item?.timestamp ? new Date(item.timestamp).toLocaleString() : "Unknown time";
    btn.type = "button";
    btn.textContent = ts;
    btn.style.width = "100%";
    btn.style.textAlign = "left";
    btn.dataset.briefId = item.id;
    btn.addEventListener("click", async () => {
      await loadBriefById(item.id);
    });
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.textContent = "View";
    viewBtn.onclick = () => loadBriefById(item.id);

    const jsonBtn = document.createElement("button");
    jsonBtn.type = "button";
    jsonBtn.textContent = "JSON";
    jsonBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(item?.data || {}, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brief-${item.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const pdfBtn = document.createElement("button");
    pdfBtn.type = "button";
    pdfBtn.textContent = "PDF";
    pdfBtn.onclick = async () => {
      await loadBriefById(item.id);
      await exportPdf();
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      try {
        const res = await fetchWithTimeout(`${getApiBase()}/api/briefs/${item.id}`, {
          method: "DELETE",
          headers: { Accept: "application/json", ...authHeaders() },
          cache: "no-store",
          mode: "cors"
        }, 12000);
        if (!res.ok) throw new Error("Delete failed");
        toast("Brief deleted");
        await loadBriefHistory();
      } catch (error) {
        setError(error?.message || "Failed deleting brief");
      }
    };

    row.appendChild(btn);
    row.appendChild(viewBtn);
    row.appendChild(jsonBtn);
    row.appendChild(pdfBtn);
    row.appendChild(deleteBtn);
    li.appendChild(row);
    list.appendChild(li);
  }
}

async function loadBriefById(id) {
  if (!id) return;
  setError("");
  setLoadingState(true, "Loading saved brief...");
  try {
    const found = knownBriefs.find((item) => String(item.id) === String(id));
    if (!found) {
      throw new Error("Brief not found in local history list");
    }
    renderBrief(found.data || {});
    toast("Loaded saved brief");
  } catch (error) {
    console.error("[AI-Assassins] Failed loading brief by id", error);
    setError(error?.message || "Unable to load saved brief");
  } finally {
    setLoadingState(false);
  }
}

async function refreshAccountStatus() {
  if (!authSession?.user?.id) {
    setSubscriptionBadge("free", 0, 1);
    return;
  }
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/api/me`, {
      headers: { Accept: "application/json", ...authHeaders() },
      cache: "no-store",
      mode: "cors"
    }, 12000);
    const text = await res.text();
    const parsed = safeJsonParse(text);
    if (!parsed.ok) return;
    const data = parsed.data || {};
    currentTier = data.tier || "free";
    currentUsage = Number(data.usage_today || 0);
    const quota = data.usage_limit ?? data.free_quota_per_day ?? 1;
    setSubscriptionBadge(currentTier, currentUsage, quota);
    const details = byId(IDS.tierDetails);
    if (details && data.user_id) {
      details.textContent += ` | User: ${data.user_id}${data.email ? ` (${data.email})` : ""}`;
      details.textContent += " | Tip: set RESEND_API_KEY + DAILY_ALERT_TO for automated email delivery.";
    }
    const emailBadge = byId(IDS.userEmailBadge);
    if (emailBadge) {
      emailBadge.textContent = data.email || authSession?.user?.email || "Guest mode";
    }
  } catch (error) {
    console.warn("[AI-Assassins] Failed to refresh account status", error);
  }
}

async function generateBrief() {
  setError("");
  setLoadingState(true);
  try {
    const inputs = getInputs();
    const data = await requestBrief(inputs);
    console.log("[AI-Assassins] Received brief JSON", data);

    let weatherFallback = null;
    if (!pick(data, ["weather_local", "weatherLocal", "weather"], null) && inputs.lat && inputs.lon) {
      weatherFallback = await fetchWeatherFallback(inputs.lat, inputs.lon);
    }

    renderBrief(data, weatherFallback);
    toast("Brief updated");

    if (!autoRefreshTimer) {
      autoRefreshTimer = setInterval(generateBrief, 600000);
      console.log("[AI-Assassins] Auto-refresh enabled (every 10m)");
    }
    setAutoRefreshStatus(true);
    await refreshAccountStatus();
    await loadBriefHistory();
  } catch (err) {
    console.error("[AI-Assassins] generate failed", err);
    setError(userFacingError(err?.message || String(err)));
  } finally {
    setLoadingState(false);
  }
}

async function initSupabaseAuth() {
  supabaseClient = window.AIASupabase?.getClient ? window.AIASupabase.getClient() : null;
  if (!supabaseClient) {
    console.warn("[AI-Assassins] Supabase not configured. Device mode remains active.");
    const status = byId(IDS.billingStatus);
    if (status) status.textContent = "Supabase not configured. Running in free device mode.";
    return;
  }
  authSession = window.AIASupabase?.getSession ? await window.AIASupabase.getSession() : null;

  window.AIASupabase.onAuthStateChange((session) => {
    authSession = session;
    if (session) {
      toast("Logged in");
      refreshAccountStatus();
      loadBriefHistory();
      generateBrief();
    } else {
      setSubscriptionBadge("free", 0, 1);
      setError("");
      renderPastBriefs([]);
    }
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setError("Supabase is not configured. Continue in free device mode or set docs/config.js.");
    return;
  }

  const email = byId(IDS.loginEmail)?.value?.trim() || "";
  const password = byId(IDS.loginPassword)?.value || "";
  if (!email || !password) {
    setError("Email and password are required.");
    return;
  }

  const loginResult = await window.AIASupabase.signIn(email, password);
  const error = loginResult?.error;
  if (error) {
    const signUpResult = await window.AIASupabase.signUp(email, password);
    if (signUpResult?.error) {
      const signUpError = signUpResult.error;
      setError(signUpError.message || error.message || "Login failed.");
      return;
    }
  }

  byId(IDS.loginDialog)?.close();
}

function isCapacitorRuntime() {
  return Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

async function subscribeNative() {
  if (!isCapacitorRuntime() || !window.PurchasesCapacitor) {
    throw new Error("Native billing only. Use mobile app build for purchases.");
  }
  const appUserID = authSession?.user?.id;
  if (!appUserID) throw new Error("Login required before purchase.");

  await window.PurchasesCapacitor.configure({
    apiKey: window.AIA_REVENUECAT_PUBLIC_KEY || "",
    appUserID
  });
  const offerings = await window.PurchasesCapacitor.getOfferings();
  const pkg = offerings?.current?.availablePackages?.[0];
  if (!pkg) throw new Error("No subscription package configured.");
  await window.PurchasesCapacitor.purchasePackage({ aPackage: pkg.identifier });
  toast("Subscription purchase submitted");
}

async function restorePurchasesNative() {
  if (!isCapacitorRuntime() || !window.PurchasesCapacitor) {
    throw new Error("Restore is available in native app only.");
  }
  await window.PurchasesCapacitor.restorePurchases();
  toast("Purchases restored");
}

async function exportPdf() {
  const root = document.querySelector(".wrap");
  if (!root) throw new Error("Unable to locate briefing content");
  if (!window.html2pdf) throw new Error("PDF library unavailable");

  await window.html2pdf()
    .set({
      margin: 8,
      filename: `ai-assassins-brief-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#070b10" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    })
    .from(root)
    .save();
}

function saveApiBaseOverride() {
  const candidate = sanitizeApiBase(byId(IDS.apiBaseInput)?.value);
  if (!candidate) {
    setError("Invalid API base URL. Example: https://ai-assassins-api.quandrix357.workers.dev");
    return;
  }
  apiBase = candidate;
  localStorage.setItem(API_BASE_STORAGE_KEY, candidate);
  setError("");
  refreshApiBaseUi();
  toast("API base saved");
}

function resetApiBaseOverride() {
  localStorage.removeItem(API_BASE_STORAGE_KEY);
  apiBase = DEFAULT_API_BASE;
  setError("");
  refreshApiBaseUi();
  toast("API base reset to default");
}

function wireUp() {
  const generateBtn = byId(IDS.btnGenerate);
  if (generateBtn && !byId(IDS.btnAutoBrief)) {
    const autoBtn = document.createElement("button");
    autoBtn.id = IDS.btnAutoBrief;
    autoBtn.textContent = "View Daily Auto Brief";
    autoBtn.style.marginLeft = "8px";
    generateBtn.parentElement?.insertBefore(autoBtn, generateBtn.nextSibling);
  }

  byId(IDS.btnGenerate)?.addEventListener("click", (e) => {
    e.preventDefault();
    generateBrief();
  });

  byId(IDS.btnAutoBrief)?.addEventListener("click", (e) => {
    e.preventDefault();
    viewDailyAutoBrief();
  });

  byId(IDS.btnLogin)?.addEventListener("click", () => {
    byId(IDS.loginDialog)?.showModal();
  });

  byId(IDS.btnLogout)?.addEventListener("click", async () => {
    if (!supabaseClient) {
      setError("Auth provider not configured. You are in device mode.");
      return;
    }
    try {
      await window.AIASupabase.signOut();
      authSession = null;
      setSubscriptionBadge("free", 0, 1);
      setError("Logged out.");
    } catch (error) {
      setError(error?.message || "Logout failed.");
    }
  });

  byId(IDS.loginForm)?.addEventListener("submit", handleLoginSubmit);

  byId(IDS.btnRestorePurchases)?.addEventListener("click", async () => {
    try {
      await restorePurchasesNative();
      await refreshAccountStatus();
    } catch (error) {
      setError(error.message || "Restore failed");
    }
  });

  byId(IDS.btnExportPdf)?.addEventListener("click", async () => {
    try {
      if (!["premium", "pro", "elite", "enterprise"].includes(currentTier)) {
        throw new Error("PDF export is available for Premium/Pro tiers.");
      }
      await exportPdf();
      toast("PDF exported");
    } catch (error) {
      setError(error.message || "PDF export failed");
    }
  });

  byId(IDS.btnSaveApiBase)?.addEventListener("click", (e) => {
    e.preventDefault();
    saveApiBaseOverride();
  });

  byId(IDS.btnResetApiBase)?.addEventListener("click", (e) => {
    e.preventDefault();
    resetApiBaseOverride();
  });

  byId(IDS.tabBriefBtn)?.addEventListener("click", () => switchTab("brief"));
  byId(IDS.tabHistoryBtn)?.addEventListener("click", () => switchTab("history"));
  byId(IDS.tabSettingsBtn)?.addEventListener("click", () => switchTab("settings"));
  byId(IDS.btnSaveDefaults)?.addEventListener("click", saveDefaults);
  byId(IDS.btnApplyDefaults)?.addEventListener("click", applyDefaultsToInputs);
  byId(IDS.btnSaveSupabase)?.addEventListener("click", saveSupabaseConfig);

  setAutoRefreshStatus(Boolean(autoRefreshTimer));
  refreshApiBaseUi();
  loadDefaults();
  applyDefaultsToInputs();
  const supaUrlInput = byId(IDS.supabaseUrlInput);
  const supaAnonInput = byId(IDS.supabaseAnonInput);
  if (supaUrlInput) supaUrlInput.value = supabaseUrl;
  if (supaAnonInput) supaAnonInput.value = supabaseAnonKey;
  switchTab("brief");
}

window.addEventListener("DOMContentLoaded", async () => {
  apiBase = resolveApiBase();
  const cfg = getSupabaseConfig();
  supabaseUrl = cfg.url;
  supabaseAnonKey = cfg.anonKey;
  wireUp();
  await initSupabaseAuth();
  await refreshAccountStatus();
  await loadBriefHistory();
  scheduleAutoRefresh();
  await generateBrief();
});

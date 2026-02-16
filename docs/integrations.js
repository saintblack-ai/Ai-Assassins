const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";
const SUPABASE_URL = window.AIA_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.AIA_SUPABASE_ANON_KEY || "";

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
  commandNote: "commandNote",
  loginDialog: "loginDialog",
  loginForm: "loginForm",
  loginEmail: "loginEmail",
  loginPassword: "loginPassword",
  btnLogin: "btnLogin",
  btnLogout: "btnLogout",
  btnRestorePurchases: "btnRestorePurchases",
  subscriptionBadge: "subscriptionBadge",
  billingStatus: "billingStatus",
  tierDetails: "tierDetails"
};

const missingWarned = new Set();
let autoRefreshTimer = null;
let supabaseClient = null;
let authSession = null;
let currentTier = "free";
let currentUsage = 0;
let knownBriefs = [];

function byId(id) {
  const el = document.getElementById(id);
  if (!el && !missingWarned.has(id)) {
    console.warn(`[AI-Assassins] Missing DOM element #${id}`);
    missingWarned.add(id);
  }
  return el;
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

function setSubscriptionBadge(tier, usage, quota) {
  const badge = byId(IDS.subscriptionBadge);
  const status = byId(IDS.billingStatus);
  const details = byId(IDS.tierDetails);
  const label =
    tier === "enterprise" ? "Enterprise" :
    tier === "elite" ? "Elite" :
    tier === "pro" ? "Pro" : "Free";
  if (badge) badge.textContent = `Tier: ${label}`;
  if (status) status.textContent = `Billing status: ${tier === "free" ? "Free" : "Active"}`;
  if (details) {
    details.textContent =
      tier === "enterprise"
        ? "Enterprise tier active: custom policy, SLA, and priority support enabled."
        : tier === "elite"
          ? "Elite tier active: advanced exports and expanded strategic brief depth enabled."
          : tier === "pro"
            ? "Pro tier active: higher daily limits, history, and export features unlocked."
            : `Free tier usage: ${usage}/${quota} briefs today. Upgrade for higher limits.`;
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
    const url = new URL(`${API_BASE}/api/weather`);
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

async function requestBrief({ lat, lon, focus, tone, icsUrl }) {
  const base = API_BASE.replace(/\/$/, "");
  const postUrl = `${base}/api/brief`;

  const res = await fetchWithTimeout(postUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json",
      ...authHeaders()
    },
    cache: "no-store",
    mode: "cors",
    body: JSON.stringify({ lat: lat || null, lon: lon || null, focus: focus || null, tone: tone || null, icsUrl: icsUrl || null })
  }, 12000);

  const txt = await res.text();
  const parsed = safeJsonParse(txt);
  if (!parsed.ok) throw new Error(`Brief request failed: ${parsed.error}`);
  if (!res.ok) throw new Error(`Brief request failed (${res.status}): ${txt}`);
  return parsed.data;
}

async function loadBriefHistory() {
  const list = byId("pastBriefsList");
  if (!list) return;
  if (!authSession?.access_token) {
    list.innerHTML = '<li class="muted">Login required</li>';
    return;
  }

  try {
    const res = await fetchWithTimeout(`${API_BASE}/briefs`, {
      headers: { Accept: "application/json", ...authHeaders() },
      cache: "no-store",
      mode: "cors"
    }, 12000);
    const text = await res.text();
    const parsed = safeJsonParse(text);
    if (!parsed.ok || !res.ok) throw new Error("Unable to load brief history");
    const items = Array.isArray(parsed.data?.items) ? parsed.data.items : [];
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
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function loadBriefById(id) {
  if (!id) return;
  setError("");
  setLoadingState(true, "Loading saved brief...");
  try {
    const url = new URL(`${API_BASE}/brief`);
    url.searchParams.set("id", id);
    const res = await fetchWithTimeout(url.toString(), {
      headers: { Accept: "application/json", ...authHeaders() },
      cache: "no-store",
      mode: "cors"
    }, 12000);
    const text = await res.text();
    const parsed = safeJsonParse(text);
    if (!parsed.ok) throw new Error(parsed.error);
    if (!res.ok) throw new Error(`Failed loading brief (${res.status})`);
    renderBrief(parsed.data || {});
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
    const res = await fetchWithTimeout(`${API_BASE}/api/me`, {
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
    const quota = data.free_quota_per_day || 1;
    setSubscriptionBadge(currentTier, currentUsage, quota);
  } catch (error) {
    console.warn("[AI-Assassins] Failed to refresh account status", error);
  }
}

async function generateBrief() {
  if (!authSession?.access_token) {
    setError("Login required. Tap Login to continue.");
    byId(IDS.loginDialog)?.showModal();
    return;
  }

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
    setError(err?.message || String(err));
  } finally {
    setLoadingState(false);
  }
}

async function initSupabaseAuth() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[AI-Assassins] Supabase not configured. Set window.AIA_SUPABASE_URL and window.AIA_SUPABASE_ANON_KEY.");
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabaseClient.auth.getSession();
  authSession = data?.session || null;

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    authSession = session;
    if (session) {
      toast("Logged in");
      refreshAccountStatus();
      loadBriefHistory();
      generateBrief();
    } else {
      setSubscriptionBadge("free", 0, 1);
      setError("Login required. Tap Login to continue.");
      renderPastBriefs([]);
    }
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    setError("Supabase is not configured in this environment.");
    return;
  }

  const email = byId(IDS.loginEmail)?.value?.trim() || "";
  const password = byId(IDS.loginPassword)?.value || "";
  if (!email || !password) {
    setError("Email and password are required.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    const { error: signUpError } = await supabaseClient.auth.signUp({ email, password });
    if (signUpError) {
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

function wireUp() {
  byId(IDS.btnGenerate)?.addEventListener("click", (e) => {
    e.preventDefault();
    generateBrief();
  });

  byId(IDS.btnLogin)?.addEventListener("click", () => {
    byId(IDS.loginDialog)?.showModal();
  });

  byId(IDS.btnLogout)?.addEventListener("click", async () => {
    if (!supabaseClient) {
      setError("Auth provider not configured.");
      return;
    }
    try {
      await supabaseClient.auth.signOut();
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
      if (currentTier !== "pro") throw new Error("PDF export is available for Pro tier.");
      await exportPdf();
      toast("PDF exported");
    } catch (error) {
      setError(error.message || "PDF export failed");
    }
  });

  setAutoRefreshStatus(Boolean(autoRefreshTimer));
}

window.addEventListener("DOMContentLoaded", async () => {
  wireUp();
  await initSupabaseAuth();
  if (!authSession) {
    setError("Login required. Tap Login to continue.");
    return;
  }
  await refreshAccountStatus();
  await loadBriefHistory();
  await generateBrief();
});

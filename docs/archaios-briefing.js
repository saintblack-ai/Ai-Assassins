const DEFAULT_API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";
const API_BASE_STORAGE_KEY = "AI_ASSASSINS_API_BASE";
const ADMIN_TOKEN_STORAGE_KEY = "ARCHAIOS_ADMIN_TOKEN";

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

function resolveApiBase() {
  const fromQuery = sanitizeApiBase(new URLSearchParams(window.location.search).get("apiBase"));
  if (fromQuery) {
    localStorage.setItem(API_BASE_STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  const fromStorage = sanitizeApiBase(localStorage.getItem(API_BASE_STORAGE_KEY));
  return fromStorage || DEFAULT_API_BASE;
}

const state = {
  apiBase: resolveApiBase(),
};

const byId = (id) => document.getElementById(id);

function setStatus(msg, cls = "muted") {
  const el = byId("status");
  if (!el) return;
  el.className = cls;
  el.textContent = msg;
}

function setResult(data) {
  const el = byId("result");
  if (!el) return;
  if (typeof data === "string") {
    el.textContent = data;
    return;
  }
  el.textContent = JSON.stringify(data, null, 2);
}

function getToken() {
  return byId("adminToken")?.value?.trim() || "";
}

function getUserId() {
  return byId("userId")?.value?.trim() || "colonel";
}

function hhmmFromInput(value) {
  return String(value || "07:00").replace(":", "");
}

function hhmmToInput(value) {
  const clean = String(value || "0700").replace(":", "");
  if (clean.length !== 4) return "07:00";
  return `${clean.slice(0, 2)}:${clean.slice(2)}`;
}

async function loadConfig() {
  const token = getToken();
  if (!token) {
    setStatus("Paste ADMIN_TOKEN to load settings.", "err");
    return;
  }
  const userId = getUserId();
  const url = new URL(`${state.apiBase}/api/brief/config`);
  url.searchParams.set("userId", userId);
  setStatus("Loading settings...");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      mode: "cors",
    });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!res.ok) throw new Error(json?.error || `Load failed (${res.status})`);
    const cfg = json?.cfg || {};
    byId("timezone").value = cfg.BRIEF_TIMEZONE || "America/Chicago";
    byId("sendTime").value = hhmmToInput(cfg.BRIEF_SEND_HHMM || "0700");
    byId("emailTo").value = cfg.BRIEF_EMAIL_TO || "";
    setResult(json);
    setStatus("Settings loaded.", "ok");
  } catch (error) {
    setStatus(error.message || "Load failed.", "err");
  }
}

async function saveConfig() {
  const token = getToken();
  if (!token) {
    setStatus("Paste ADMIN_TOKEN to save settings.", "err");
    return;
  }
  const userId = getUserId();
  const payload = {
    userId,
    BRIEF_TIMEZONE: byId("timezone").value.trim() || "America/Chicago",
    BRIEF_SEND_HHMM: hhmmFromInput(byId("sendTime").value),
    BRIEF_EMAIL_TO: byId("emailTo").value.trim(),
  };
  setStatus("Saving settings...");
  try {
    const res = await fetch(`${state.apiBase}/api/brief/config`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      mode: "cors",
    });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);
    setResult(json);
    setStatus("Settings saved.", "ok");
  } catch (error) {
    setStatus(error.message || "Save failed.", "err");
  }
}

async function runBriefNow() {
  const token = getToken();
  if (!token) {
    setStatus("Paste ADMIN_TOKEN to run test.", "err");
    return;
  }
  const userId = getUserId();
  const url = new URL(`${state.apiBase}/api/brief/test`);
  url.searchParams.set("userId", userId);
  setStatus("Running Archaios brief test...");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      mode: "cors",
    });
    const text = await res.text();
    const json = JSON.parse(text);
    if (!res.ok) throw new Error(json?.error || `Test failed (${res.status})`);
    setResult(json);
    setStatus("Brief test complete.", "ok");
  } catch (error) {
    setStatus(error.message || "Test failed.", "err");
  }
}

function boot() {
  byId("apiBase").value = state.apiBase;
  byId("adminToken").value = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
  byId("btnLoad").addEventListener("click", loadConfig);
  byId("btnSave").addEventListener("click", saveConfig);
  byId("btnRunNow").addEventListener("click", runBriefNow);
  byId("apiBase").addEventListener("change", () => {
    const clean = sanitizeApiBase(byId("apiBase").value);
    if (!clean) return;
    state.apiBase = clean;
    localStorage.setItem(API_BASE_STORAGE_KEY, clean);
    setStatus(`API base updated: ${clean}`, "ok");
  });
  byId("adminToken").addEventListener("change", () => {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, getToken());
  });
  setResult({
    info: "Enter ADMIN_TOKEN, then Load Current Settings.",
    defaults: {
      BRIEF_TIMEZONE: "America/Chicago",
      BRIEF_SEND_HHMM: "0700",
      BRIEF_EMAIL_TO: "",
    },
  });
}

window.addEventListener("DOMContentLoaded", boot);

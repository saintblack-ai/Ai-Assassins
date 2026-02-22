(() => {
  "use strict";

  function readConfig() {
    return {
      url: String(window.SUPABASE_URL || "").trim(),
      anonKey: String(window.SUPABASE_ANON_KEY || "").trim(),
    };
  }

  let client = null;

  function initClient() {
    if (client) return client;
    const { url, anonKey } = readConfig();
    if (!url || !anonKey || !window.supabase?.createClient) return null;
    client = window.supabase.createClient(url, anonKey);
    return client;
  }

  function getClient() {
    return initClient();
  }

  async function signUp(email, password) {
    const c = getClient();
    if (!c) return { data: null, error: new Error("Supabase not configured") };
    return c.auth.signUp({ email, password });
  }

  async function signIn(email, password) {
    const c = getClient();
    if (!c) return { data: null, error: new Error("Supabase not configured") };
    return c.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    const c = getClient();
    if (!c) return { error: null };
    return c.auth.signOut();
  }

  async function getSession() {
    const c = getClient();
    if (!c) return null;
    const { data, error } = await c.auth.getSession();
    if (error) return null;
    return data?.session || null;
  }

  async function getUser() {
    const c = getClient();
    if (!c) return null;
    const { data, error } = await c.auth.getUser();
    if (error) return null;
    return data?.user || null;
  }

  function onAuthChange(callback) {
    const c = getClient();
    if (!c) {
      return {
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      };
    }
    return c.auth.onAuthStateChange((_event, session) => callback(session || null));
  }

  function apiBase() {
    const stored = String(localStorage.getItem("AI_ASSASSINS_API_BASE") || "").trim();
    return (stored || "https://ai-assassins-api.quandrix357.workers.dev").replace(/\/+$/, "");
  }

  async function apiFetch(path) {
    const session = await getSession();
    const headers = { Accept: "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch(`${apiBase()}${path}`, { headers, cache: "no-store", mode: "cors" });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Invalid API JSON response");
    }
    if (!res.ok) {
      const error = data?.error || `HTTP_${res.status}`;
      throw new Error(String(error));
    }
    return data;
  }

  async function fetchAutoBrief() {
    return apiFetch("/api/brief/auto");
  }

  async function fetchLatestBrief() {
    return apiFetch("/api/brief/latest");
  }

  async function fetchHistory() {
    return apiFetch("/api/briefs");
  }

  window.AIASupabase = {
    signUp,
    signIn,
    signOut,
    getSession,
    getUser,
    onAuthChange,
    getClient,
    fetchAutoBrief,
    fetchLatestBrief,
    fetchHistory,
  };
})();

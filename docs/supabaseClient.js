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

  window.AIASupabase = {
    signUp,
    signIn,
    signOut,
    getSession,
    getUser,
    onAuthChange,
    getClient,
  };
})();

const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";
const SUPABASE_URL = window.AIA_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.AIA_SUPABASE_ANON_KEY || "";

function byId(id) {
  return document.getElementById(id);
}

function setError(message) {
  const box = byId("errorBox");
  if (!box) return;
  if (!message) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }
  box.style.display = "block";
  box.textContent = message;
}

function setLoading(isLoading) {
  const loading = byId("loading");
  const btn = byId("btnCheckout");
  if (loading) loading.style.display = isLoading ? "block" : "none";
  if (btn) btn.disabled = isLoading;
}

async function getAuthContext() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { token: "", email: "", userId: "" };
  }
  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await client.auth.getSession();
    const session = data?.session || null;
    return {
      token: session?.access_token || "",
      email: session?.user?.email || "",
      userId: session?.user?.id || ""
    };
  } catch {
    return { token: "", email: "", userId: "" };
  }
}

async function startCheckout() {
  setError("");
  setLoading(true);
  try {
    const auth = await getAuthContext();
    const successUrl = `${window.location.origin}${window.location.pathname.replace(/\/pricing\.html$/, "/success.html")}`;
    const cancelUrl = `${window.location.origin}${window.location.pathname.replace(/\/pricing\.html$/, "/cancel.html")}`;
    const response = await fetch(`${API_BASE}/api/checkout/session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
      },
      body: JSON.stringify({
        email: auth.email || null,
        user_id: auth.userId || null,
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "Checkout is currently unavailable. Continue on Free tier and try again later.");
    }
    if (!data?.url) {
      throw new Error("Checkout URL missing from server response.");
    }
    window.location.href = data.url;
  } catch (error) {
    setError(error?.message || "Unable to start checkout.");
    setLoading(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  byId("btnCheckout")?.addEventListener("click", startCheckout);
});

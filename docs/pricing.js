const DEFAULT_API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";
const API_BASE_STORAGE_KEY = "AI_ASSASSINS_API_BASE";

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

const API_BASE = resolveApiBase();

function setNotice(msg) {
  const el = document.getElementById("notice");
  el.style.display = "block";
  el.textContent = msg;
}

async function startCheckout(plan) {
  try {
    // Optional: attach a lightweight device/user id for post-checkout syncing
    const deviceId = localStorage.getItem("aa_device_id") || crypto.randomUUID();
    localStorage.setItem("aa_device_id", deviceId);

    const res = await fetch(`${API_BASE}/api/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plan,
        deviceId,
        successUrl: `${location.origin}${location.pathname.replace("pricing.html","")}success.html`,
        cancelUrl: `${location.origin}${location.pathname.replace("pricing.html","")}pricing.html?canceled=1`,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Checkout failed (${res.status})`);
    }

    const data = await res.json();
    if (!data?.url) throw new Error("Missing checkout url");
    location.href = data.url;
  } catch (e) {
    console.error(e);
    setNotice("Checkout isn’t configured yet. Make sure STRIPE keys/prices are set in the Worker, then redeploy.");
  }
}

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("freeBack").onclick = () => (location.href = "./index.html");
document.getElementById("buyPro").onclick = () => startCheckout("pro");
document.getElementById("buyElite").onclick = () => startCheckout("elite");
document.getElementById("contactSales").onclick = () => {
  const wrap = document.getElementById("enterpriseFormWrap");
  if (wrap) wrap.style.display = "block";
  wrap?.scrollIntoView({ behavior: "smooth", block: "start" });
};

document.getElementById("submitLead").onclick = async () => {
  const name = document.getElementById("leadName")?.value?.trim();
  const email = document.getElementById("leadEmail")?.value?.trim();
  const org = document.getElementById("leadOrg")?.value?.trim();
  const message = document.getElementById("leadMessage")?.value?.trim();
  if (!name || !email || !org || !message) {
    setNotice("Please complete all enterprise contact fields.");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/lead`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, org, message }),
    });
    if (!res.ok) throw new Error("Lead submit failed");
    setNotice("Thanks. Enterprise sales will contact you shortly.");
    document.getElementById("leadMessage").value = "";
  } catch {
    setNotice("Lead capture is unavailable right now. Please email support@aiassassins.app.");
  }
};

const params = new URLSearchParams(location.search);
if (params.get("canceled") === "1") setNotice("Checkout canceled. You can try again anytime.");

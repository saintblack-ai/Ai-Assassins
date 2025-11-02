/* ARCHAIOS ChatKit v1.0 — Saint Black OS (Final) */
// Update these if your Worker route or workflow changes:
const WORKFLOW_ID = "wf_690439f7ec7081908c60483912da5b3b0c6f69dbf0cf4846";
const PROXY_URL   = "https://archaios-proxy.quandrix357.workers.dev/chat";

// ---------- DOM helpers ----------
const $ = (s) => document.querySelector(s);
const logEl   = $("#log");
const inputEl = $("#input");
const sendBtn = $("#send");

function append(role, text) {
  if (!logEl) return;
  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap";
  pre.textContent = `${role}: ${text}`;
  logEl.appendChild(pre);
  logEl.scrollTop = logEl.scrollHeight;
}

async function callArchaios(message) {
  if (!message) return;
  if (sendBtn) sendBtn.disabled = true;
  append("You", message);

  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        workflow_id: WORKFLOW_ID
      }),
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let payload = ct.includes("application/json") ? await res.json() : await res.text();

    const reply =
      typeof payload === "string"
        ? payload
        : payload.reply || payload.message || JSON.stringify(payload, null, 2);

    append("ARCHAIOS", reply);
  } catch (err) {
    append("SYSTEM", `Error: ${err.message}`);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (inputEl) {
      inputEl.value = "";
      inputEl.focus();
    }
  }
}

// ---------- UI wiring ----------
if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    const msg = (inputEl?.value || "").trim();
    if (msg) callArchaios(msg);
  });
}
if (inputEl) {
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const msg = inputEl.value.trim();
      if (msg) callArchaios(msg);
    }
  });
}

// Optional: health check to show connectivity
(async () => {
  try {
    const pingUrl = PROXY_URL.replace(/\/$/, "").replace(/\/chat$/, "/health");
    const res = await fetch(pingUrl).catch(() => null);
    if (res && res.ok) append("SYSTEM", "Proxy online ✅");
  } catch (_) { /* ignore */ }
})();

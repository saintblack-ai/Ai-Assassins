// chatkit.js — ARCHAIOS Frontend
const WORKFLOW_ID = "wf_690439f7ec7081908c60483912da5b3b0c6f69dbf0cf4846";
const PROXY_URL   = "https://archaios-proxy.quandrix357.workers.dev";

function append(text) {
  const log = document.getElementById('log');
  log.textContent += "\n" + text;
  log.scrollTop = log.scrollHeight;
}

async function send(message) {
  // Build body the proxy expects: { workflow_id, message }
  const body = { workflow_id: WORKFLOW_ID, message };
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    // Show raw text for now (proxy may return plain text)
    append("ARCHAIOS: " + text);
  } catch (err) {
    append("ERROR: " + err.message);
  }
}

function wire() {
  const input = document.getElementById('ask');
  const btn = document.getElementById('send');

  async function handle() {
    const msg = input.value.trim();
    if (!msg) return;
    append("You: " + msg);
    input.value = "";
    await send(msg);
  }

  btn.addEventListener('click', handle);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handle(); });
}

document.addEventListener('DOMContentLoaded', wire);

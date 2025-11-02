// chatkit.js — ARCHAIOS Vault Interface ↔ Cloudflare Worker

// 1) Your IDs/URLs
const WORKFLOW_ID = "wf_690439f7ec7081908c60483912da5b3b0c6f69dbf0cf4846";
const PROXY_URL   = "https://archaios-proxy.quandrix357.workers.dev"; // no trailing slash

// 2) UI helpers
function appendMessage(text) {
  const log = document.getElementById('log');
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = text;
  log.appendChild(pre);
  log.scrollTop = log.scrollHeight;
}

// 3) Call the proxy (Worker expects { message, workflow_id })
async function callChatKit(message) {
  const payload = {
    workflow_id: WORKFLOW_ID,
    message: message // <-- key corrected
  };

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => String(res.status));
    throw new Error(`Proxy ${res.status}: ${errText}`);
  }

  return await res.text();
}

// 4) Wire up the form
window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form');
  const input = document.getElementById('input');

  appendMessage('SYSTEM: Ready. Type and press Enter.');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = (input.value || '').trim();
    if (!text) return;
    appendMessage(`You: ${text}`);
    input.value = '';
    try {
      const reply = await callChatKit(text);
      appendMessage(`ARCHAIOS: ${reply}`);
    } catch (err) {
      appendMessage(`ERROR: ${err.message}`);
    }
  });
});

// chatkit.js — ARCHAIOS Vault Interface ↔ Cloudflare Worker

const WORKFLOW_ID = "wf_690439f7ec7081908c60483912da5b3b0c6f69dbf0cf4846"; // your workflow
const PROXY_URL   = "https://archaios-proxy.quandrix357.workers.dev";      // no trailing slash

function appendMessage(text) {
  const log = document.getElementById('log');
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = text;
  log.appendChild(pre);
  log.scrollTop = log.scrollHeight;
}

async function callChatKit(message) {
  try {
    const payload = { workflow_id: WORKFLOW_ID, message };
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      appendMessage(`Archaios error (${res.status}): ${data?.error || res.statusText}`);
      if (data?.detail) appendMessage(String(data.detail));
      return;
    }

    // Prefer 'text' from Worker, else show raw
    appendMessage(`Archaios: ${data.text || JSON.stringify(data)}`);
  } catch (e) {
    appendMessage(`Archaios exception: ${e}`);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('userInput');
  const send  = document.getElementById('sendBtn');

  function sendMsg() {
    const msg = (input.value || '').trim();
    if (!msg) return;
    appendMessage(`You: ${msg}`);
    input.value = '';
    callChatKit(msg);
  }

  send?.addEventListener('click', sendMsg);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMsg();
  });
});

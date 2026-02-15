// chatkit.js — ARCHAIOS Vault Interface ↔ Cloudflare Worker

const PROXY_URL = "https://archaios-proxy.quandrix357.workers.dev";

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
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      appendMessage(`ERROR: ${data?.error || res.statusText}`);
      return;
    }

    if (data.reply) {
      appendMessage(`ARCHAIOS: ${data.reply}`);
    } else if (data.error) {
      appendMessage(`ERROR: ${data.error}`);
    } else {
      appendMessage(`(No response from Archaios)`);
    }
  } catch (err) {
    appendMessage(`NETWORK ERROR: ${err.message}`);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('input');
  const send = document.getElementById('send');

  async function sendNow() {
    const text = (input.value || '').trim();
    if (!text) return;
    appendMessage(`You: ${text}`);
    input.value = '';
    await callChatKit(text);
  }

  send?.addEventListener('click', sendNow);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendNow();
    }
  });

  appendMessage('SYSTEM: Ready. Type and press Enter.');
});

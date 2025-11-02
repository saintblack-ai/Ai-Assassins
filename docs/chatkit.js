// chatkit.js – ARCHAIOS Vault Interface ↔ Cloudflare Worker

const WORKFLOW_ID = "wf_690439f7ec7081908c60483912da5b3b0c6f69dbf0cf4846"; // your workflow
const PROXY_URL   = "https://archaios-proxy.quandrix357.workers.dev"; // no trailing slash

function appendMessage(text) {
  const log = document.getElementById('log');
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = text;
  log.appendChild(pre);
  log.scrollTop = log.scrollHeight;
}

async function callChatKit(message) {
  const payload = { workflow_id: WORKFLOW_ID, input: message };
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    appendMessage('ERROR: ' + errorText);
    return;
  }

  const data = await response.text();
  appendMessage('Archaios: ' + data);
}

document.getElementById('send').addEventListener('click', async () => {
  const input = document.getElementById('msg');
  const message = input.value.trim();
  if (!message) return;
  appendMessage('You: ' + message);
  input.value = '';
  await callChatKit(message);
});

document.getElementById('msg').addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('send').click();
  }
});

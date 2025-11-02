// Front-end for Archaios ChatKit integration
// Replace PROXY_URL with your deployed proxy endpoint
// Replace WORKFLOW_ID with your workflow ID from the Agent Builder

const WORKFLOW_ID = "wf_690439f7ec7081908c60483912da5b3b0c6f69dbf0cf4846";
const PROXY_URL = "https://archaios-proxy.quandrix357.workers.dev;

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
  const result = await response.json();
  return result;
}

function setupUI() {
  const root = document.getElementById('archaios-chat');
  root.innerHTML = `
    <div style="max-width:800px;margin:24px auto;font-family:system-ui">
      <h1>ARCHAIOS • Vault Interface</h1>
      <div id="log" style="border:1px solid #ddd;padding:12px;border-radius:8px;min-height:200px;"></div>
      <form id="chat-form" style="margin-top:12px;display:flex;gap:8px">
        <input id="chat-input" style="flex:1;padding:10px;border:1px solid #ccc;border-radius:6px" placeholder="Ask Archaios…" />
        <button>Send</button>
      </form>
    </div>
  `;

  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    appendMessage('You: ' + msg);
    input.value = '';
    const result = await callChatKit(msg);
    appendMessage('Archaios:\n' + JSON.stringify(result, null, 2));
  });

  callChatKit('Initialize Archaios.').then((initial) => {
    appendMessage('Archaios:\n' + JSON.stringify(initial, null, 2));
  });
}

setupUI();

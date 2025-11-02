// Front-end for Archaios ChatKit integration
// Replace PROXY_URL with the URL of your deployed proxy function
// and WORKFLOW_ID with your published workflow ID.

const WORKFLOW_ID = "wf_690439f7ec7081908c60483912da5b3b0c6f69dbf0cf4846";
const PROXY_URL = "https://YOUR_PROXY_URL_HERE";

/**
 * Append a message to the log area.
 * @param {string} text
 */
function appendMessage(text) {
  const log = document.getElementById('log');
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = text;
  log.appendChild(pre);
  log.scrollTop = log.scrollHeight;
}

/**
 * Call the ChatKit proxy with the given message.
 * @param {string} message
 */
async function callChatKit(message) {
  const payload = {
    workflow_id: WORKFLOW_ID,
    input: message
  };
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  return result;
}

/**
 * Initialize the chat UI and handle form submissions.
 */
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

  // Send an initial handshake message
  callChatKit('Initialize Archaios.').then((initial) => {
    appendMessage('Archaios:\n' + JSON.stringify(initial, null, 2));
  });
}

// Initialize the chat when the script loads
setupUI();

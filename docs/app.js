const NAV_ITEMS = [
  "Overview",
  "Intelligence",
  "Decision Engine",
  "Operations",
  "Saved Briefs",
  "Settings"
];

const MISSION_MODES = [
  "Growth Mode",
  "Revenue Mode",
  "Build Mode",
  "Intel Mode",
  "Creator Mode"
];

const STORAGE_KEY = "archaiosDocsSavedBriefs";

const FALLBACK = {
  "Growth Mode": {
    overview: "AI demand is clustering around focused operator workflows, so growth is strongest where positioning is sharp and proof of value is immediate.",
    priorities: [
      "Clarify the one-sentence product promise on the first screen.",
      "Turn the best intelligence output into a shareable growth asset.",
      "Use visible wins to pull new users into a repeatable motion."
    ],
    commandNote: "Expand reach by packaging the dashboard as an operating advantage, not a feature list.",
    bestNextMove: "Publish one concrete operator use case that shows how ARCHAIOS cuts research-to-decision time.",
    whyNow: "Buyer curiosity is high, but attention closes quickly unless the value proposition is specific.",
    expectedImpact: "Higher conversion from curious visitors into users who understand the product within one session.",
    marketIntelligence: {
      opportunity: "Founders are actively testing AI systems that collapse research, planning, and action into one workflow.",
      threat: "Broad AI positioning risks blending into generic assistant products.",
      recommendation: "Lead with a sharp operator outcome and back it with visible, immediate evidence.",
      status: "ready"
    },
    actionQueue: [
      { description: "Write a homepage proof block around one operator workflow.", assignedAgent: "content_agent", result: "Homepage proof block drafted for operator workflow positioning." },
      { description: "Turn the latest brief into a public-facing sample output.", assignedAgent: "marketing_agent", result: "Public sample output prepared for growth-facing distribution." },
      { description: "Add one CTA tied to a measurable growth outcome.", assignedAgent: "optimization_agent", result: "Growth CTA variant added with measurable conversion target." }
    ]
  },
  "Revenue Mode": {
    overview: "Revenue expansion is strongest when the product shows a clear weekly payoff and keeps the path from insight to conversion extremely short.",
    priorities: [
      "Surface the revenue-critical KPI and decision in one view.",
      "Align messaging around payback instead of generic automation.",
      "Reduce friction between insight, offer, and follow-up action."
    ],
    commandNote: "Convert intelligence into monetization moves that are visible and easy to execute.",
    bestNextMove: "Create a revenue play card that links the current brief to a concrete pricing, sales, or upsell action.",
    whyNow: "The dashboard already has revenue signals, so the shortest path to value is turning those signals into decisions.",
    expectedImpact: "More direct monetization behavior and a stronger reason for operators to return daily.",
    marketIntelligence: {
      opportunity: "Lean SaaS buyers still spend when the product directly replaces fragmented, revenue-adjacent manual work.",
      threat: "Decorative AI experiences lose monetization power when they don’t clearly improve pipeline or retention.",
      recommendation: "Tie every brief to one revenue action and one commercial outcome.",
      status: "ready"
    },
    actionQueue: [
      { description: "Define one monetization move from the current brief.", assignedAgent: "revenue_agent", result: "Monetization move defined and attached to current revenue brief." },
      { description: "Add revenue-oriented messaging to the decision summary.", assignedAgent: "marketing_agent", result: "Revenue-oriented messaging added to the decision summary." },
      { description: "Prepare a follow-up action tied to trial conversion or upsell.", assignedAgent: "feedback_agent", result: "Follow-up upsell action prepared for trial conversion flow." }
    ]
  },
  "Build Mode": {
    overview: "Product momentum is highest when teams can see what to build next, why it matters, and how it compounds operational trust.",
    priorities: [
      "Turn the dashboard into a command surface for the next product improvement.",
      "Promote reliability and traceability as visible product features.",
      "Make every new capability measurable in operator terms."
    ],
    commandNote: "Use intelligence to prioritize the next build decision, not just summarize conditions.",
    bestNextMove: "Build one operator-facing feature that turns today’s intelligence into a direct workflow step.",
    whyNow: "The dashboard already has live state and generated outputs, so adding actionability compounds immediately.",
    expectedImpact: "Stronger user trust and faster product differentiation through visible execution support.",
    marketIntelligence: {
      opportunity: "Teams are rewarding automation products that make orchestration legible and dependable.",
      threat: "Black-box behavior creates hesitation and slows adoption of more advanced features.",
      recommendation: "Ship operator-visible decision tools that reveal progress and next action clearly.",
      status: "ready"
    },
    actionQueue: [
      { description: "Choose one workflow gap revealed by the brief.", assignedAgent: "intelligence_agent", result: "Workflow gap identified and prioritized for the next build cycle." },
      { description: "Define a UI state that turns the gap into an action.", assignedAgent: "content_agent", result: "Operator-facing UI action state defined for the selected workflow gap." },
      { description: "Instrument the action so impact can be seen on the dashboard.", assignedAgent: "optimization_agent", result: "Execution instrumentation added for dashboard-visible impact tracking." }
    ]
  },
  "Intel Mode": {
    overview: "Decision advantage now comes from turning noisy signal streams into clear, operator-ready moves faster than competitors.",
    priorities: [
      "Condense the signal into a single decisive recommendation.",
      "Preserve context while reducing interpretation load.",
      "Keep the intelligence loop visible and repeatable."
    ],
    commandNote: "Treat every brief as a command asset that shortens the path from awareness to action.",
    bestNextMove: "Promote the clearest market signal into a top-level command for the operator.",
    whyNow: "Fast-changing AI and media conditions reward dashboards that reduce hesitation, not just information gaps.",
    expectedImpact: "Quicker operator response time and a stronger sense that ARCHAIOS is driving decisions.",
    marketIntelligence: {
      opportunity: "Teams need intelligence surfaces that translate trends into immediate operational posture.",
      threat: "Raw summaries create hesitation if they do not resolve into a clear recommended move.",
      recommendation: "Promote decision clarity over data volume and make the next action unmistakable.",
      status: "ready"
    },
    actionQueue: [
      { description: "Select the strongest signal in the current brief.", assignedAgent: "intelligence_agent", result: "Highest-conviction signal selected for operator escalation." },
      { description: "Map it to one strategic decision for the operator.", assignedAgent: "mentor_agent", result: "Strategic decision recommendation mapped to the selected signal." },
      { description: "Log the outcome so the next brief compounds context.", assignedAgent: "feedback_agent", result: "Decision outcome logged to strengthen the next intelligence cycle." }
    ]
  },
  "Creator Mode": {
    overview: "Creators respond to tools that transform market awareness into content direction, monetization angles, and rapid execution without flattening voice.",
    priorities: [
      "Connect market signals to a publishable angle.",
      "Tie strategy output to audience growth or monetization.",
      "Keep creativity guided, not templated."
    ],
    commandNote: "Turn insight into a differentiated creator move with clear upside.",
    bestNextMove: "Convert the current intelligence signal into one creator-facing angle with a monetizable follow-through.",
    whyNow: "Audience attention windows are short, so creators benefit most when insight turns into a clear publishing decision quickly.",
    expectedImpact: "More differentiated output and better alignment between content effort and commercial return.",
    marketIntelligence: {
      opportunity: "Creators want systems that reveal what to say next and how it can compound across products and channels.",
      threat: "Generic AI outputs reduce distinctiveness and weaken audience trust.",
      recommendation: "Use the dashboard to suggest sharp, differentiated creator actions tied to monetization.",
      status: "ready"
    },
    actionQueue: [
      { description: "Turn the brief into one strong creator angle.", assignedAgent: "content_agent", result: "Creator angle drafted from the current signal." },
      { description: "Connect that angle to a product, offer, or funnel step.", assignedAgent: "revenue_agent", result: "Creator angle connected to an offer and funnel step." },
      { description: "Draft the first execution move while the signal is fresh.", assignedAgent: "marketing_agent", result: "First execution move drafted for immediate creator deployment." }
    ]
  }
};

const state = {
  activeView: "Overview",
  missionMode: "Intel Mode",
  lastBriefTimestamp: null,
  revenueStatus: "$49.99",
  activeAgentsCount: 6,
  savedBriefs: readSavedBriefs(),
  intelStream: [],
  brief: generateBriefSnapshot("Intel Mode"),
  operations: []
};

initialize();

function initialize() {
  renderNav();
  renderMissionModes();
  attachControls();
  generateBrief();
}

function generateTaskId(mode, index) {
  return `${mode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}-${index}`;
}

function generateBriefSnapshot(mode) {
  const template = FALLBACK[mode];
  return {
    missionMode: mode,
    overview: template.overview,
    priorities: template.priorities,
    commandNote: template.commandNote,
    bestNextMove: template.bestNextMove,
    whyNow: template.whyNow,
    expectedImpact: template.expectedImpact,
    marketIntelligence: { ...template.marketIntelligence },
    actionQueue: template.actionQueue.map((task, index) => ({
      taskId: generateTaskId(mode, index),
      description: task.description,
      assignedAgent: task.assignedAgent,
      status: "pending",
      result: task.result
    }))
  };
}

function renderNav() {
  const rail = document.getElementById("nav-rail");
  rail.innerHTML = NAV_ITEMS.map((item) => `
    <button class="${item === state.activeView ? "active" : ""}" data-view="${item}">${item}</button>
  `).join("");

  rail.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      renderAll();
    });
  });
}

function renderMissionModes() {
  const select = document.getElementById("mission-mode");
  select.innerHTML = MISSION_MODES.map((mode) => `<option value="${mode}">${mode}</option>`).join("");
  select.value = state.missionMode;
}

function attachControls() {
  document.getElementById("mission-mode").addEventListener("change", (event) => {
    state.missionMode = event.target.value;
  });

  document.getElementById("generate-brief").addEventListener("click", () => {
    generateBrief();
  });

  document.getElementById("save-brief").addEventListener("click", () => {
    const savedAt = state.lastBriefTimestamp || new Date().toISOString();
    const entry = { id: `${savedAt}-${state.brief.missionMode}`, savedAt, ...structuredClone(state.brief) };
    state.savedBriefs = [entry, ...state.savedBriefs.filter((item) => item.id !== entry.id)];
    writeSavedBriefs(state.savedBriefs);
    renderAll();
  });
}

function generateBrief() {
  const startedAt = new Date().toISOString();
  appendStream(`brief_run_started  ${state.missionMode} brief requested`);
  appendStream(`market_intel_triggered  ${state.missionMode} market scan started`);

  state.brief = generateBriefSnapshot(state.missionMode);
  state.lastBriefTimestamp = startedAt;
  state.operations = state.brief.actionQueue.map((task) => ({ ...task, createdAt: startedAt }));

  appendStream(`brief_run_completed  fallback intelligence ready`);
  appendStream(`market_intel_completed  ${state.brief.marketIntelligence.opportunity}`);
  renderAll();
}

function executeTask(taskId) {
  const task = state.operations.find((item) => item.taskId === taskId);
  if (!task || task.status !== "pending") {
    return;
  }

  const startedAt = new Date().toISOString();
  task.status = "running";
  task.createdAt = startedAt;
  syncBriefQueue();
  appendStream(`task_execution_started  ${task.assignedAgent}  ${task.description}`);
  renderAll();

  window.setTimeout(() => {
    task.status = "completed";
    task.createdAt = new Date().toISOString();
    syncBriefQueue();
    appendStream(`task_execution_completed  ${task.assignedAgent}  ${task.result}`);
    renderAll();
  }, 1000);
}

function syncBriefQueue() {
  state.brief.actionQueue = state.operations.map((task) => ({
    taskId: task.taskId,
    description: task.description,
    assignedAgent: task.assignedAgent,
    status: task.status,
    result: task.result
  }));
}

function loadSavedBrief(id) {
  const saved = state.savedBriefs.find((item) => item.id === id);
  if (!saved) {
    return;
  }

  state.brief = structuredClone(saved);
  state.missionMode = saved.missionMode;
  state.lastBriefTimestamp = saved.savedAt;
  state.operations = saved.actionQueue.map((task) => ({ ...task, createdAt: saved.savedAt }));
  document.getElementById("mission-mode").value = state.missionMode;
  appendStream(`brief_archive  loaded saved brief for ${saved.missionMode}`);
  renderAll();
}

function deleteSavedBrief(id) {
  state.savedBriefs = state.savedBriefs.filter((item) => item.id !== id);
  writeSavedBriefs(state.savedBriefs);
  renderAll();
}

function appendStream(line) {
  state.intelStream = [`${timestampLabel(new Date().toISOString())}  ${line}`, ...state.intelStream].slice(0, 18);
}

function renderAll() {
  renderNav();
  renderCommandBar();
  renderSignalRow();
  renderOverview();
  renderViews();
}

function renderCommandBar() {
  const commandBar = document.getElementById("command-bar");
  const items = [
    { label: "ARCHAIOS Core Status", value: "Active" },
    { label: "Mission Mode", value: state.missionMode },
    { label: "Last Brief Timestamp", value: state.lastBriefTimestamp ? timestampLabel(state.lastBriefTimestamp) : "No brief yet" },
    { label: "Active Agents Count", value: String(state.activeAgentsCount) },
    { label: "Revenue Status", value: state.revenueStatus }
  ];

  commandBar.innerHTML = items.map((item) => `
    <article class="command-pill">
      <p class="label">${item.label}</p>
      <p class="command-value">${item.value}</p>
    </article>
  `).join("");
}

function renderSignalRow() {
  const readiness = state.operations.length
    ? state.operations.every((task) => task.status === "completed")
      ? "Ready to ship"
      : state.operations.some((task) => task.status === "running")
        ? "Executing now"
        : "Awaiting execution"
    : "Brief required";

  const row = document.getElementById("signal-row");
  const cards = [
    { label: "Top Opportunity", value: state.brief.marketIntelligence.opportunity, accent: false },
    { label: "Top Threat", value: state.brief.marketIntelligence.threat, accent: false },
    { label: "Best Next Move", value: state.brief.bestNextMove, accent: true },
    { label: "Execution Readiness", value: readiness, accent: false }
  ];

  row.innerHTML = cards.map((card) => `
    <article class="signal-card ${card.accent ? "accent" : ""}">
      <p class="label">${card.label}</p>
      <p class="signal-value">${card.value}</p>
    </article>
  `).join("");
}

function renderOverview() {
  const overviewCards = document.getElementById("overview-cards");
  const cards = [
    ["Overnight Overview", state.brief.overview, "Latest strategic market signal"],
    ["Mission Priorities", state.brief.priorities.join(" / "), "First operational action from the brief"],
    ["Command Note", state.brief.commandNote, "Generated brief title"],
    ["Best Next Move", state.brief.bestNextMove, state.brief.whyNow],
    ["ARCHAIOS Action Queue", state.brief.actionQueue[0]?.description || "Stand by", state.brief.expectedImpact],
    ["Export Timestamp", state.lastBriefTimestamp ? timestampLabel(state.lastBriefTimestamp) : "Awaiting brief export", "Most recent intelligence package time"],
    ["Saved Briefs", `${state.savedBriefs.length} archived`, "Local browser archive"],
    ["Market Intel Status", "Ready", state.brief.marketIntelligence.recommendation]
  ];

  overviewCards.innerHTML = cards.map(([label, value, hint]) => `
    <article class="card">
      <p class="label">${label}</p>
      <p class="signal-value">${value}</p>
      <p class="hint">${hint}</p>
    </article>
  `).join("");

  const agentPanel = document.getElementById("agent-status-panel");
  const agents = [
    ["Brief Agent", "ready", "Brief orchestration online"],
    ["Market Intel Agent", "ready", "Signal ingestion synchronized"],
    ["Revenue Agent", "ready", "Revenue playbooks synced"],
    ["Media Ops Agent", "running", "Distribution board synchronized"],
    ["Growth Agent", "ready", "Growth experiments staged"],
    ["Security Sentinel", "ready", "Environment checks stable"]
  ];
  agentPanel.innerHTML = agents.map(([name, status, hint]) => `
    <article class="card">
      <p class="label">${name}</p>
      <p class="hint"><span class="badge ${status}">${status}</span></p>
      <p class="hint">${hint}</p>
    </article>
  `).join("");

  document.getElementById("decision-panel").innerHTML = `
    Mission Mode: ${state.brief.missionMode}

    Decision Engine

    Best Next Move: ${state.brief.bestNextMove}
    Why Now: ${state.brief.whyNow}
    Expected Impact: ${state.brief.expectedImpact}

    ARCHAIOS Action Queue
    ${state.brief.actionQueue.map((task, index) => `${index + 1}. ${task.description} | ${task.assignedAgent} | ${task.status}`).join("\n")}

    Market Intelligence
    Opportunity: ${state.brief.marketIntelligence.opportunity}
    Threat: ${state.brief.marketIntelligence.threat}
    Recommendation: ${state.brief.marketIntelligence.recommendation}
    Status: Ready
  `;

  renderIntelStream(document.getElementById("intel-stream-panel"));
}

function renderViews() {
  ["overview", "intelligence", "decision", "operations", "saved", "settings"].forEach((key) => {
    const map = {
      Overview: "overview",
      Intelligence: "intelligence",
      "Decision Engine": "decision",
      Operations: "operations",
      "Saved Briefs": "saved",
      Settings: "settings"
    };
    const visible = map[state.activeView] === key;
    document.getElementById(`${key}-view`).classList.toggle("hidden", !visible);
  });

  document.getElementById("intelligence-view-panel").innerHTML = `
    Mission Mode: ${state.brief.missionMode}

    Overview: ${state.brief.overview}

    Priorities:
    ${state.brief.priorities.map((item, index) => `${index + 1}. ${item}`).join("\n")}
  `;

  document.getElementById("decision-view-panel").innerHTML = `
    Mission Mode: ${state.brief.missionMode}

    Best Next Move: ${state.brief.bestNextMove}

    Why Now: ${state.brief.whyNow}

    Expected Impact: ${state.brief.expectedImpact}
  `;

  document.getElementById("market-intel-view-panel").innerHTML = `
    Market Intelligence

    Opportunity: ${state.brief.marketIntelligence.opportunity}
    Threat: ${state.brief.marketIntelligence.threat}
    Recommendation: ${state.brief.marketIntelligence.recommendation}
    Status: Ready
  `;

  renderOperationsBoard();
  renderSavedBriefs();
  document.getElementById("settings-panel").innerHTML = `
    GitHub Pages Source of Truth

    Served file: docs/index.html
    Dashboard source: src/dashboard/MasterControlPanel.tsx
    Fallback strategy source: src/dashboard/briefFallback.ts

    This static docs site mirrors the latest ARCHAIOS features with local fallback data.
  `;
}

function renderOperationsBoard() {
  const board = document.getElementById("operations-board");
  board.innerHTML = state.operations.length
    ? state.operations.map((task) => `
        <article class="card">
          <p class="label">${task.description}</p>
          <p class="hint">Assigned Agent: ${task.assignedAgent}</p>
          <p class="hint">Timestamp: ${timestampLabel(task.createdAt)}</p>
          <p class="hint"><span class="badge ${task.status}">${task.status}</span></p>
          <p class="hint">Result: ${task.status === "completed" ? task.result : "Awaiting execution"}</p>
          <div class="actions">
            <button class="button" ${task.status !== "pending" ? "disabled" : ""} data-task="${task.taskId}">
              ${task.status === "pending" ? "Execute Task" : task.status === "running" ? "Running" : "Completed"}
            </button>
          </div>
        </article>
      `).join("")
    : `<article class="card"><p class="label">Operations Board</p><p class="hint">Generate a brief to create executable operations.</p></article>`;

  board.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", () => executeTask(button.dataset.task));
  });
}

function renderSavedBriefs() {
  const panel = document.getElementById("saved-briefs-panel");
  panel.innerHTML = state.savedBriefs.length
    ? state.savedBriefs.map((saved) => `
        <article class="card">
          <p class="label">Saved Brief</p>
          <p class="hint">${timestampLabel(saved.savedAt)}</p>
          <p class="hint">${saved.missionMode}</p>
          <p class="hint">${saved.overview.split("\n")[0]}</p>
          <div class="actions">
            <button class="button" data-load="${saved.id}">Load</button>
            <button class="button button-secondary" data-delete="${saved.id}">Delete</button>
          </div>
        </article>
      `).join("")
    : `<article class="card"><p class="label">Saved Briefs</p><p class="hint">No saved briefs yet. Generate and save a brief to build the archive.</p></article>`;

  panel.querySelectorAll("[data-load]").forEach((button) => {
    button.addEventListener("click", () => loadSavedBrief(button.dataset.load));
  });
  panel.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteSavedBrief(button.dataset.delete));
  });
}

function renderIntelStream(container) {
  container.innerHTML = `
    <div class="terminal-header">Intel Stream</div>
    ${state.intelStream.map((line) => `<div class="stream-line">${line}</div>`).join("")}
  `;
}

function timestampLabel(value) {
  return new Date(value).toLocaleString();
}

function readSavedBriefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
  } catch {
    return [];
  }
}

function writeSavedBriefs(briefs) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(briefs));
}


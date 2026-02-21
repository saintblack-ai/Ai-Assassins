#!/usr/bin/env node

const base = (process.env.AGENT_BASE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const agents = ["distribution", "outreach", "conversion", "quality"];

async function runAgent(agent) {
  const res = await fetch(`${base}/api/agent/run/${agent}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      mode: "draft",
      context: { source: "smoke_test" },
    }),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function history(agent) {
  const res = await fetch(`${base}/api/agent/history/${agent}?limit=2`, {
    headers: { accept: "application/json" },
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`Agent smoke against ${base}`);
  for (const agent of agents) {
    const run = await runAgent(agent);
    console.log(`RUN ${agent}:`, run.status, JSON.stringify(run.data));
    const hist = await history(agent);
    console.log(`HISTORY ${agent}:`, hist.status, JSON.stringify(hist.data));
  }
}

main().catch((error) => {
  console.error("agent smoke failed:", error);
  process.exit(1);
});


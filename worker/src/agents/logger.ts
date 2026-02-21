import type { AgentName, AgentRunRecord } from "./types";

type LoggerEnv = {
  AGENT_LOG?: KVNamespace;
  COMMAND_LOG?: KVNamespace;
};

const TTL_SECONDS = 60 * 60 * 24 * 180;

function getAgentKV(env: LoggerEnv): KVNamespace | null {
  return env.AGENT_LOG || env.COMMAND_LOG || null;
}

function safeAgent(input: string): AgentName | null {
  if (input === "distribution" || input === "outreach" || input === "conversion" || input === "quality") {
    return input;
  }
  return null;
}

export function makeRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function writeAgentRunLog(env: LoggerEnv, record: AgentRunRecord): Promise<string | null> {
  const kv = getAgentKV(env);
  if (!kv) return null;
  const key = `agent:log:${record.agent}:${record.ts}:${record.runId}`;
  await kv.put(key, JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  return key;
}

export async function readAgentHistory(env: LoggerEnv, agentName: string, limit = 20): Promise<AgentRunRecord[]> {
  const kv = getAgentKV(env);
  const agent = safeAgent(agentName);
  if (!kv || !agent) return [];
  const bounded = Math.max(1, Math.min(100, Number(limit) || 20));
  const listed = await kv.list({ prefix: `agent:log:${agent}:`, limit: Math.max(50, bounded * 3) });
  const rows: AgentRunRecord[] = [];
  for (const key of listed.keys) {
    const raw = await kv.get(key.name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.agent && parsed?.runId && parsed?.ts) rows.push(parsed as AgentRunRecord);
    } catch {
      // ignore malformed rows
    }
  }
  return rows
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    .slice(0, bounded);
}


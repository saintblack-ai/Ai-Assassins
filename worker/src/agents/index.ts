import { todayIsoDateUTC } from "../services/dailyBrief";
import { readAgentHistory, makeRunId, writeAgentRunLog } from "./logger";
import { runDistributionAgent } from "./distributionAgent";
import { runOutreachAgent } from "./outreachAgent";
import { runConversionOptimizerAgent } from "./conversionOptimizerAgent";
import { runIntelligenceQualityAgent } from "./intelligenceQualityAgent";
import type { AgentContext, AgentMode, AgentName, AgentRunRecord, AgentRunResponse } from "./types";

type AgentEnv = {
  AGENT_LOG?: KVNamespace;
  COMMAND_LOG?: KVNamespace;
  DAILY_BRIEF_LOG?: KVNamespace;
  USAGE_STATE?: KVNamespace;
  REVENUE_LOG?: KVNamespace;
  LEADS?: KVNamespace;
};

function validAgentName(input: string): AgentName | null {
  if (input === "distribution" || input === "outreach" || input === "conversion" || input === "quality") {
    return input;
  }
  return null;
}

async function loadLatestBrief(env: AgentEnv, date: string): Promise<Record<string, unknown> | null> {
  if (!env.DAILY_BRIEF_LOG) return null;
  const candidates = [`brief:latest`, `brief:${date}`];
  for (const key of candidates) {
    const raw = await env.DAILY_BRIEF_LOG.get(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // ignore malformed values
    }
  }
  return null;
}

function storageKeyFor(agent: AgentName, date: string): string {
  if (agent === "conversion" || agent === "quality") {
    return `agent:recommendation:${agent}:${date}`;
  }
  return `agent:draft:${agent}:${date}`;
}

async function lightweightMetrics(env: AgentEnv): Promise<{ usageEvents24h: number; revenueEvents24h: number; leads24h: number }> {
  const usageEvents24h = env.USAGE_STATE ? (await env.USAGE_STATE.list({ prefix: "usage:", limit: 1000 })).keys.length : 0;
  const revenueEvents24h = env.REVENUE_LOG ? (await env.REVENUE_LOG.list({ prefix: "revenue_log:", limit: 1000 })).keys.length : 0;
  const leads24h = env.LEADS ? (await env.LEADS.list({ prefix: "lead:", limit: 1000 })).keys.length : 0;
  return { usageEvents24h, revenueEvents24h, leads24h };
}

async function writeOutput(env: AgentEnv, key: string, payload: Record<string, unknown>): Promise<void> {
  const kv = env.AGENT_LOG || env.COMMAND_LOG || null;
  if (!kv) return;
  await kv.put(key, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 120 });
}

export async function runAgent(agentName: string, mode: AgentMode, env: AgentEnv, ctx?: AgentContext): Promise<AgentRunResponse> {
  const agent = validAgentName(String(agentName || "").toLowerCase());
  if (!agent) {
    return {
      success: false,
      agent: "distribution",
      runId: makeRunId(),
      ts: new Date().toISOString(),
      mode,
      status: "error",
      error: "invalid_agent"
    };
  }

  const runId = makeRunId();
  const ts = new Date().toISOString();
  const date = String(ctx?.date || todayIsoDateUTC());
  const brief = ctx?.brief ?? await loadLatestBrief(env, date);
  const trigger = ctx?.trigger || "manual";

  if (mode === "publish") {
    const record: AgentRunRecord = {
      agent,
      runId,
      ts,
      mode,
      status: "publish_stub",
      inputsSummary: { trigger, date, publish_requested: true },
      outputsSummary: { configured: false, message: "Publishing not configured. Use draft mode." }
    };
    await writeAgentRunLog(env, record);
    return {
      success: false,
      agent,
      runId,
      ts,
      mode,
      status: "publish_stub",
      message: "Publishing not configured. Use draft mode."
    };
  }

  try {
    let data: Record<string, unknown>;
    if (agent === "distribution") {
      data = runDistributionAgent({ date, brief });
    } else if (agent === "outreach") {
      data = runOutreachAgent({ date, brief });
    } else if (agent === "conversion") {
      data = runConversionOptimizerAgent({ date, metrics: await lightweightMetrics(env) });
    } else {
      data = runIntelligenceQualityAgent({ date, brief });
    }

    const draftKey = storageKeyFor(agent, date);
    await writeOutput(env, draftKey, { agent, runId, ts, mode, trigger, data });

    const record: AgentRunRecord = {
      agent,
      runId,
      ts,
      mode,
      status: "ok",
      inputsSummary: { trigger, date, has_brief: Boolean(brief), has_context: Boolean(ctx?.context) },
      outputsSummary: {
        output_key: draftKey,
        top_level_keys: Object.keys(data),
        output_size: JSON.stringify(data).length
      }
    };
    await writeAgentRunLog(env, record);

    return {
      success: true,
      agent,
      runId,
      ts,
      mode,
      status: "ok",
      draft_key: draftKey,
      data
    };
  } catch (error) {
    const record: AgentRunRecord = {
      agent,
      runId,
      ts,
      mode,
      status: "error",
      inputsSummary: { trigger, date },
      outputsSummary: {},
      error: error instanceof Error ? error.message : "agent_run_failed"
    };
    await writeAgentRunLog(env, record);
    return {
      success: false,
      agent,
      runId,
      ts,
      mode,
      status: "error",
      error: record.error
    };
  }
}

export async function getAgentHistory(agentName: string, env: AgentEnv, limit = 20): Promise<AgentRunRecord[]> {
  return readAgentHistory(env, agentName, limit);
}

export function parseAgentName(agentName: string): AgentName | null {
  return validAgentName(String(agentName || "").toLowerCase());
}


export type AgentName = "distribution" | "outreach" | "conversion" | "quality";
export type AgentMode = "draft" | "publish";

export type AgentContext = {
  date?: string;
  requestedBy?: string;
  trigger?: "manual" | "scheduled";
  context?: Record<string, unknown>;
  brief?: Record<string, unknown> | null;
  metrics?: Record<string, unknown>;
};

export type AgentRunRecord = {
  agent: AgentName;
  runId: string;
  ts: string;
  status: "ok" | "error" | "publish_stub";
  mode: AgentMode;
  inputsSummary: Record<string, unknown>;
  outputsSummary: Record<string, unknown>;
  error?: string;
};

export type AgentRunResponse = {
  success: boolean;
  agent: AgentName;
  runId: string;
  ts: string;
  mode: AgentMode;
  status: AgentRunRecord["status"];
  data?: Record<string, unknown>;
  draft_key?: string;
  message?: string;
  error?: string;
};


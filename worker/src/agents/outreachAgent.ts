type Input = {
  date: string;
  brief: Record<string, unknown> | null;
  count?: number;
};

function safeLine(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length > 0) return String(value[0] || fallback).trim();
  return fallback;
}

export function runOutreachAgent(input: Input): Record<string, unknown> {
  const mission = safeLine(input.brief?.["mission_focus"], "Build fast and protect execution bandwidth.");
  const revenue = safeLine(input.brief?.["revenue_focus"], "Tighten conversion from interest to paid.");
  const dmCount = Math.max(1, Math.min(10, Number(input.count) || 3));
  const drafts: Array<Record<string, unknown>> = [];

  for (let i = 1; i <= dmCount; i += 1) {
    drafts.push({
      id: `outreach-${input.date}-${i}`,
      target_profile: `Founder ${i}`,
      channel: "dm",
      status: "draft_only",
      message: [
        "Quick note from a fellow operator.",
        `Today's execution focus: ${mission}`,
        `Growth focus: ${revenue}`,
        "If useful, I can share the exact daily briefing template we use."
      ].join(" ")
    });
  }

  return {
    date: input.date,
    safety: "No auto-send. Draft queue only.",
    queue_size: drafts.length,
    drafts
  };
}


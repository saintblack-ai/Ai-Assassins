type Input = {
  date: string;
  brief: Record<string, unknown> | null;
};

function briefLine(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length > 0) return String(value[0] || fallback).trim();
  return fallback;
}

export function runDistributionAgent(input: Input): Record<string, unknown> {
  const mission = briefLine(input.brief?.["mission_focus"], "Mission: ship one high-impact move today.");
  const revenue = briefLine(input.brief?.["revenue_focus"], "Revenue: optimize conversion path and follow up warm leads.");
  const build = briefLine(input.brief?.["build_priority"], "Build: close one reliability gap in production.");

  return {
    date: input.date,
    channels: ["x", "linkedin", "short_form_video"],
    x_thread: [
      `Daily Command Brief (${input.date})`,
      mission,
      revenue,
      build,
      "Execution rule: one publish, one follow-up, one shipped improvement before noon."
    ],
    linkedin_post: [
      `Operating Brief — ${input.date}`,
      mission,
      revenue,
      build,
      "Comment with your top execution target for the next 24 hours."
    ].join("\n\n"),
    short_form_script: {
      hook: "If you only had one day to increase leverage, do this.",
      beats: [mission, revenue, build],
      cta: "Follow for daily command briefs and operator workflows."
    }
  };
}


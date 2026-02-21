type Input = {
  date: string;
  brief: Record<string, unknown> | null;
};

function hasContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 20;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

export function runIntelligenceQualityAgent(input: Input): Record<string, unknown> {
  const brief = input.brief || {};
  const sections = [
    "mission_focus",
    "revenue_focus",
    "build_priority",
    "system_status",
    "empire_metric_snapshot",
    "top_priorities",
    "risks_alerts"
  ];

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const key of sections) {
    if (hasContent(brief[key])) strengths.push(key);
    else weaknesses.push(key);
  }

  return {
    date: input.date,
    quality_score: Math.max(0, Math.min(100, Math.round((strengths.length / sections.length) * 100))),
    strengths,
    weaknesses,
    prompt_weighting: {
      geopolitical_intel: weaknesses.includes("risks_alerts") ? 1.25 : 1.0,
      revenue_optimization: weaknesses.includes("revenue_focus") ? 1.3 : 1.0,
      operational_reliability: weaknesses.includes("system_status") ? 1.2 : 1.0
    },
    guidance: [
      "Increase prompt weighting for weak sections by 20-30%.",
      "Require at least 3 concrete actions per critical section.",
      "Force JSON schema strict mode on all generated brief sections."
    ]
  };
}


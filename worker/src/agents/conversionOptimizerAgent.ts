type Input = {
  date: string;
  metrics: {
    usageEvents24h: number;
    revenueEvents24h: number;
    leads24h: number;
  };
};

export function runConversionOptimizerAgent(input: Input): Record<string, unknown> {
  const { usageEvents24h, revenueEvents24h, leads24h } = input.metrics;
  const conversionSignal = usageEvents24h > 0 ? Number((revenueEvents24h / usageEvents24h).toFixed(4)) : 0;
  const leadIntensity = usageEvents24h > 0 ? Number((leads24h / usageEvents24h).toFixed(4)) : 0;

  return {
    date: input.date,
    metrics: {
      usage_events_24h: usageEvents24h,
      revenue_events_24h: revenueEvents24h,
      leads_24h: leads24h,
      conversion_signal: conversionSignal,
      lead_intensity: leadIntensity
    },
    recommendations: [
      "If conversion signal is below 0.05, simplify checkout and reduce fields.",
      "If lead intensity is above 0.02, trigger human follow-up within 2 hours.",
      "Add one high-clarity CTA in each distribution draft and measure clickthrough."
    ],
    experiments: [
      {
        id: "exp_checkout_copy",
        hypothesis: "Shorter value statement increases paid conversion.",
        success_metric: "checkout_completed / checkout_started"
      },
      {
        id: "exp_followup_speed",
        hypothesis: "Faster founder follow-up increases upgrade rate.",
        success_metric: "upgrades_within_24h"
      }
    ]
  };
}


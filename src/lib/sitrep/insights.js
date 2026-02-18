function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function hourBucket(iso) {
  const d = new Date(iso);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

export function computeInsights(events24h, latestErrors) {
  const countsByType = {};
  const buckets = new Map();
  let deployFailures = 0;
  let deploySuccess = 0;
  let lastDeployTs = null;

  for (const evt of events24h) {
    countsByType[evt.type] = (countsByType[evt.type] || 0) + 1;
    const hour = hourBucket(evt.ts);
    buckets.set(hour, (buckets.get(hour) || 0) + 1);

    if (evt.type === "deploy") {
      if (!lastDeployTs || evt.ts > lastDeployTs) lastDeployTs = evt.ts;
      if (evt.severity === "error" || evt.meta?.status === "failed") deployFailures += 1;
      else deploySuccess += 1;
    }
  }

  const bucketValues = [...buckets.values()];
  const currentHourCount = bucketValues[bucketValues.length - 1] || 0;
  const baseline = bucketValues.slice(0, -1);
  const m = mean(baseline);
  const s = stddev(baseline);
  const z = s > 0 ? (currentHourCount - m) / s : 0;

  const errorRate = events24h.length
    ? latestErrors.filter((e) => new Date(e.ts).getTime() >= Date.now() - 24 * 3600 * 1000).length / events24h.length
    : 0;

  const anomalyFlags = [];
  if (z > 2.5 && currentHourCount >= 10) {
    anomalyFlags.push({
      flag: "ingest_spike",
      severity: "warn",
      detail: `Current hour events are ${z.toFixed(2)}σ above baseline`,
    });
  }
  if (errorRate > 0.2 && latestErrors.length >= 5) {
    anomalyFlags.push({
      flag: "error_rate_high",
      severity: "error",
      detail: `Error rate in last 24h is ${(errorRate * 100).toFixed(1)}%`,
    });
  }

  const deployHealth = {
    status: deployFailures > 0 ? "degraded" : "healthy",
    deploy_success_count: deploySuccess,
    deploy_failure_count: deployFailures,
    latest_deploy_ts: lastDeployTs,
  };

  return {
    last_24h_event_counts_by_type: countsByType,
    latest_errors: latestErrors.slice(0, 20),
    deploy_health: deployHealth,
    anomaly_flags: anomalyFlags,
  };
}

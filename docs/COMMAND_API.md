# Command Intelligence API

Base URL:

- `https://ai-assassins-api.quandrix357.workers.dev`

## `GET /api/command-brief`
Returns today's command brief. If today's entry doesn't exist, it is generated, stored in `COMMAND_LOG`, and returned.

### Response
```json
{
  "success": true,
  "created": true,
  "key": "command:2026-02-16",
  "brief": {
    "date": "2026-02-16",
    "system_health": {
      "worker_version": "unknown",
      "kv_bindings": [
        "USER_STATE",
        "USAGE_STATE",
        "REVENUE_LOG",
        "LEADS",
        "DAILY_BRIEF_LOG",
        "COMMAND_LOG"
      ]
    },
    "usage_summary": {
      "active_users": 0,
      "free_count": 0,
      "pro_count": 0,
      "elite_count": 0,
      "enterprise_count": 0
    },
    "revenue_summary": {
      "total_events": 0,
      "enterprise_leads": 0
    },
    "top_actions": [
      "Use /api/brief/test to generate insights",
      "Review command dashboard",
      "Check subscription conversion funnel"
    ]
  }
}
```

## `GET /api/command-history`
Returns the last 14 command briefs from `COMMAND_LOG`.

### Response
```json
{
  "success": true,
  "items": [
    {
      "date": "2026-02-16",
      "system_health": { "worker_version": "unknown", "kv_bindings": [] },
      "usage_summary": { "active_users": 0, "free_count": 0, "pro_count": 0, "elite_count": 0, "enterprise_count": 0 },
      "revenue_summary": { "total_events": 0, "enterprise_leads": 0 },
      "top_actions": []
    }
  ]
}
```

## `GET /api/metrics`
Returns aggregate snapshot metrics from KV stores:

- Total usage counts from `USAGE_STATE`
- Revenue event count from `REVENUE_LOG`
- Enterprise lead count from `LEADS`
- Tier distribution from `USER_STATE`

### Response
```json
{
  "success": true,
  "usage_total_count": 0,
  "revenue_events_count": 0,
  "enterprise_leads_count": 0,
  "tier_distribution": {
    "active_users": 0,
    "free_count": 0,
    "pro_count": 0,
    "elite_count": 0,
    "enterprise_count": 0
  }
}
```

## Security and limits
These endpoints inherit Worker middleware controls:

- CORS allow origin: `https://saintblack-ai.github.io`
- Rate limit: `60 req/min/IP`
- Security headers on responses

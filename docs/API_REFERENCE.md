# AI Assassins API Reference

Base URL:

- `https://ai-assassins-api.quandrix357.workers.dev`

CORS origin allow-list is enforced server-side.

## `POST /api/brief`
Generate one structured intelligence brief (tier and daily quota enforced).

### Request
```http
POST /api/brief
content-type: application/json
authorization: Bearer <jwt>
```

```json
{
  "lat": 29.7604,
  "lon": -95.3698,
  "focus": "macro + geopolitics",
  "tone": "executive",
  "icsUrl": "https://example.com/calendar.ics"
}
```

### Success response
```json
{
  "success": true,
  "tier": "pro",
  "usage_today": 3,
  "usage_limit": 50,
  "overnight_overview": ["..."],
  "markets_snapshot": { "SP500": 0, "NASDAQ": 0, "WTI": 0, "BTC": 0 },
  "weather_local": { "summary": "...", "high": 0, "low": 0, "precip": 0 },
  "next_up_calendar": ["..."],
  "scripture_of_day": { "ref": "...", "text": "...", "reflection": "..." },
  "mission_priorities": ["..."],
  "truthwave": { "narrative": "...", "risk_flag": "...", "counter_psyop": "..." },
  "top_tasks": ["..."],
  "command_note": "..."
}
```

### Error responses
- `401` unauthorized
- `402` tier daily limit reached
- `503` missing `OPENAI_API_KEY`

## `POST /api/checkout`
Create Stripe Checkout session for `pro` or `elite` plans.

### Request
```json
{
  "plan": "pro",
  "deviceId": "device-123",
  "userId": "optional-user-id",
  "userEmail": "optional@email.com",
  "successUrl": "https://saintblack-ai.github.io/Ai-Assassins/success.html",
  "cancelUrl": "https://saintblack-ai.github.io/Ai-Assassins/pricing.html?canceled=1"
}
```

### Success response
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/c/session_id",
  "id": "cs_test_..."
}
```

### Stripe missing configuration response
```json
{
  "success": false,
  "error": "Stripe not configured"
}
```

## `GET /api/me`
Returns current user tier and usage.

### Request
```http
GET /api/me
authorization: Bearer <jwt>
```

### Authenticated response
```json
{
  "success": true,
  "user_id": "user-123",
  "tier": "free",
  "usage_today": 1,
  "usage_limit": 5
}
```

### Unauthenticated response
```json
{
  "success": true,
  "user_id": null,
  "tier": "free",
  "usage_today": 0,
  "usage_limit": 5
}
```

## `POST /api/lead`
Capture enterprise sales lead into KV `LEADS`.

### Request
```json
{
  "name": "Jane Doe",
  "email": "jane@enterprise.com",
  "org": "Enterprise Inc",
  "message": "Need SOC2 + SSO rollout support"
}
```

### Response
```json
{
  "success": true,
  "lead_id": "uuid"
}
```

## `POST /api/webhook`
Unified webhook endpoint for RevenueCat/Stripe-style payloads. Updates user tier state.

### Request
- Content-Type: `application/json`
- Optional auth header if webhook secret is configured:
  - `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`

### Example response
```json
{
  "success": true,
  "source": "stripe",
  "user_id": "user-or-device-id",
  "tier": "pro"
}
```

## Security behavior
- Origin check against allowed domain
- Rate limit: 60 requests/min/IP
- Security headers attached to JSON responses

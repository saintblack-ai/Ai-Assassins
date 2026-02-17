# AI Assassins Smoke Test (Production)

## 1) Web app load
1. Open `https://saintblack-ai.github.io/Ai-Assassins/`.
2. Confirm UI renders (not raw code).
3. Open browser console and verify no blocking errors.

## 2) Test `GET /api/me`
1. Without auth token:
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/me
```
2. Expected: `200` with free-tier defaults (`tier: free`).
3. With auth token:
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/me \
  -H "Authorization: Bearer <jwt>"
```
4. Expected: `200` with resolved tier + usage counters.

## 2b) Test API status
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/status
```
Expected:
- HTTP `200`
- JSON includes `success`, `version`, `schedule`, `kv_bindings_ok`

## 3) Test `POST /api/lead`
```bash
curl -i -X POST https://ai-assassins-api.quandrix357.workers.dev/api/lead \
  -H "content-type: application/json" \
  -d '{"name":"Operator One","email":"operator@example.com","org":"Saintblack","message":"Need enterprise pilot"}'
```
Expected:
- HTTP `200`
- JSON: `{ "success": true, "lead_id": "..." }`

## 4) Test Stripe checkout logic (`POST /api/checkout`)
```bash
curl -i -X POST https://ai-assassins-api.quandrix357.workers.dev/api/checkout \
  -H "content-type: application/json" \
  -d '{"tier":"pro","deviceId":"smoke-test-device","success_url":"https://saintblack-ai.github.io/Ai-Assassins/success.html","cancel_url":"https://saintblack-ai.github.io/Ai-Assassins/pricing.html?canceled=1"}'
```
Expected:
- If Stripe configured: HTTP `200` + `{ "success": true, "url": "https://checkout.stripe.com/..." }`
- If not configured: HTTP `503` + `{ "success": false, "error": "Stripe not configured" }`

## 5) Test brief generation + tier enforcement
1. Use authenticated request to `POST /api/brief`.
2. Free user expected limit: 5/day.
3. Pro user expected limit: 50/day.
4. Elite and Enterprise expected: unlimited unless custom enterprise cap is configured.
5. When over limit, expected payload includes:
   - `{ "success": false, "error": "limit reached" }`

## 6) Test command intelligence endpoints

### `GET /api/command-brief`
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/command-brief
```
Expected:
- HTTP `200`
- returns today's command brief object
- first call may return `"created": true`

### `GET /api/command-history`
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/command-history
```
Expected:
- HTTP `200`
- returns up to 14 brief entries

### `GET /api/metrics`
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/metrics
```
Expected:
- HTTP `200`
- includes usage total, revenue events, leads count, tier distribution

## 7) Test pricing page enterprise funnel
1. Open `https://saintblack-ai.github.io/Ai-Assassins/pricing.html`.
2. Click **Contact Sales**.
3. Submit form.
4. Confirm success notice and no uncaught JS errors.

## 8) Security checks
1. Send requests from non-allowed origin and confirm blocked response.
2. Burst >60 req/min from one IP and confirm HTTP `429`.

## 9) Archaios config endpoint (`POST /api/brief/config`)
```bash
curl -i -X POST "https://ai-assassins-api.quandrix357.workers.dev/api/brief/config" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "userId":"colonel",
    "BRIEF_TIMEZONE":"America/Chicago",
    "BRIEF_SEND_HHMM":"0700",
    "BRIEF_EMAIL_TO":"ops@example.com"
  }'
```
Expected:
- HTTP `200`
- JSON: `{ "success": true, "cfg": { ... } }`

## 10) Archaios test endpoint (`GET /api/brief/test`)
```bash
curl -i "https://ai-assassins-api.quandrix357.workers.dev/api/brief/test?userId=colonel" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Expected:
- HTTP `200`
- JSON with `brief` payload
- No email send from this endpoint

## 11) Confirm cron behavior
1. Ensure `worker/wrangler.toml` has:
   - `[triggers]`
   - `crons = ["0 7 * * *"]`
2. Deploy Worker.
3. Ensure vars are set: `BRIEF_TIMEZONE`, `BRIEF_SEND_HHMM`, `DAILY_ALERT_TO`, `FROM_EMAIL`.
4. Wait for cron tick where local time matches `BRIEF_SEND_HHMM`.
5. Verify entry is written to both `DAILY_BRIEF_LOG` and `COMMAND_LOG` as applicable.
6. Verify `REVENUE_LOG` contains:
   - `type: "system_brief_generated"` (generation log)
   - `type: "daily_brief_sent"` (delivery log with `email_sent` boolean)

## 12) Test manual send-now endpoint (`POST /api/brief/send-now`)
```bash
curl -i -X POST "https://ai-assassins-api.quandrix357.workers.dev/api/brief/send-now" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Expected:
- HTTP `200`
- Response includes `brief_key`, `command_brief`, `email_sent`, and `email_to`
- `REVENUE_LOG` includes `type: "daily_brief_sent"`

## 13) Test Stripe webhook event handling
1. Trigger Stripe test event:
   - `checkout.session.completed`
2. Verify:
   - `POST /api/webhook` returns success
   - `USER_STATE` tier is updated for target user
   - `REVENUE_LOG` contains `event: "webhook_stripe"`

## 14) Test revenue summary endpoint
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/revenue-summary
```
Expected:
- HTTP `200`
- keys:
  - `total_revenue`
  - `total_subscriptions`
  - `daily_revenue`
  - `tier_breakdown`

## 14b) Test latest daily revenue brief endpoint
```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/brief/latest
```
Expected:
- HTTP `200`
- JSON includes:
  - `date`
  - `top_priorities`
  - `revenue_actions`
  - `marketing_actions`
  - `build_actions`
  - `risks_alerts`

## 15) Test free → pro upgrade flow
1. Call `POST /api/checkout` for `tier=pro`.
2. Complete checkout in Stripe test mode.
3. Confirm `GET /api/me` shows tier `pro`.
4. Confirm `POST /api/brief` limit increases to 50/day.

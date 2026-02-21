# AI-Assassins

AI-Assassins is a Cloudflare Worker + static dashboard system for generating daily strategic briefs with tier limits, automation, and billing hooks.

## Architecture
- Frontend: `docs/` (GitHub Pages)
- Worker API: `worker/src/index.ts`
- Supabase schema/migrations: `supabase/`
- Daily cron: `0 7 * * *`

## Setup

### 1) Clone and install
```bash
git clone <repo-url>
cd Ai-Assassins
npm install
```

### 2) Supabase config
- Set public frontend values in `docs/config.js`:
  - `window.SUPABASE_URL`
  - `window.SUPABASE_ANON_KEY`
- Apply DB schema:
```bash
supabase db push
```

### 3) Worker secrets
From `worker/`:
```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put DAILY_ALERT_TO
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

### 4) Worker vars (non-secret)
Set in `worker/wrangler.toml` `[vars]`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ELITE`
- `FREE_BRIEFS_PER_DAY`

## Daily Automation
- Cron trigger is configured in `worker/wrangler.toml`:
  - `crons = ["0 7 * * *"]`
- Automation handler: `handleAutoBrief` in `worker/src/index.ts`
- Behavior:
  - Reuses daily brief generation flow (`/api/brief/today` data path)
  - Persists brief in KV (`DAILY_BRIEF_LOG`) and latest auto snapshot
  - If authenticated context exists, syncs to Supabase
  - Sends email summary when Resend is configured

### Verify 0700 run
```bash
cd worker
wrangler tail
```
Look for events:
- `AUTO_BRIEF_SENT`
- `EMAIL_SENT`

## Email Delivery (Resend)
- Service: `worker/src/services/email.ts`
- API endpoint used: `POST https://api.resend.com/emails`
- Required secrets:
```bash
wrangler secret put RESEND_API_KEY
wrangler secret put DAILY_ALERT_TO
```

## Stripe Setup
- Endpoints:
  - `POST /api/stripe/checkout-session`
  - `POST /api/stripe/webhook`
- Required secrets:
```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```
- Billing tier mapping:
  - Pro -> `STRIPE_PRICE_ID_PRO`
  - Elite -> `STRIPE_PRICE_ID_ELITE`
- Cloudflare webhook setup:
  - In Stripe Dashboard, create a webhook endpoint to:
    - `https://<your-worker-domain>/api/stripe/webhook`
  - Subscribe to:
    - `checkout.session.completed`
    - `customer.subscription.updated`
    - `invoice.payment_succeeded`
  - Save the Stripe webhook signing secret with:
```bash
wrangler secret put STRIPE_WEBHOOK_SECRET
```

## Tier Limits
- Free: 1 brief / 24h
- Pro: 10 briefs / 24h
- Elite: 100 briefs / 24h
- Enterprise: unlimited

Usage state is tracked in KV and synced best-effort to Supabase for authenticated users.

## API Highlights
- `POST /api/brief` and `POST /brief`
- `GET /api/brief/today`
- `GET /api/brief/auto`
- `GET /api/brief/history`
- `GET /api/user/status` (includes `usage_left`)

## Local Run
```bash
cd worker
npm install
wrangler dev
```

## Deploy
```bash
cd worker
wrangler deploy
```

Or use root helper:
```bash
./deploy.sh
```

## Monitoring
```bash
cd worker
wrangler tail
```

Structured event logs:
- `BRIEF_GENERATED`
- `AUTO_BRIEF_SENT`
- `EMAIL_SENT`
- `SUBSCRIPTION_UPGRADE`

## Agent Commands
Manual agent run endpoint:
- `POST /api/agent/run/:agentName`
- `agentName`: `distribution`, `outreach`, `conversion`, `quality`
- body:
```json
{ "mode": "draft", "context": { "source": "manual" } }
```

Draft-first safety:
- `mode` defaults to `draft`
- `publish` mode is a stub and returns:
  - `Publishing not configured. Use draft mode.`

Agent history endpoint:
- `GET /api/agent/history/:agentName?limit=20`

Local curl examples (`wrangler dev`):
```bash
curl -X POST http://127.0.0.1:8787/api/agent/run/distribution \
  -H "content-type: application/json" \
  -d '{"mode":"draft","context":{"source":"local"}}'

curl "http://127.0.0.1:8787/api/agent/history/distribution?limit=5"
```

Deployed curl examples:
```bash
export WORKER_URL="https://ai-assassins-worker.quandrix357.workers.dev"

curl -X POST "$WORKER_URL/api/agent/run/outreach" \
  -H "content-type: application/json" \
  -d '{"mode":"draft","context":{"source":"prod_manual"}}'

curl -X POST "$WORKER_URL/api/agent/run/conversion" \
  -H "content-type: application/json" \
  -d '{"mode":"draft"}'

curl -X POST "$WORKER_URL/api/agent/run/quality" \
  -H "content-type: application/json" \
  -d '{"mode":"draft"}'

curl "$WORKER_URL/api/agent/history/outreach?limit=10"
```

Smoke script:
```bash
node scripts/agent-smoke.mjs
AGENT_BASE_URL="$WORKER_URL" node scripts/agent-smoke.mjs
```

## Public Marketing Surface
Public routes:
- `GET /`
- `GET /public/sample`
- `GET /public/sample.json`

Behavior:
- `/` serves a minimal public landing page.
- `/public/sample` serves sanitized sample brief HTML with:
  - `top_priorities`
  - `revenue_actions`
  - `risks_alerts`
- `/public/sample.json` returns the same sanitized fields as JSON.
- lightweight analytics are recorded with SHA-256 hashed IP (no raw IP storage).

Curl tests:
```bash
curl https://<worker-url>/
curl https://<worker-url>/public/sample
curl https://<worker-url>/public/sample.json
```

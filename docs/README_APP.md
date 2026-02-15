# AI Assassins Daily Brief

## What This App Does
AI Assassins generates a structured daily intelligence brief using OpenAI and renders it in a web UI.

Core brief sections:
- Overnight Overview
- Markets Snapshot (S&P 500, NASDAQ, WTI, BTC)
- Weather (lat/lon based)
- Next Up Calendar
- Scripture of the Day
- Mission Priorities
- Black Phoenix Truthwave
- Top 5 Tasks
- Command Note

## Architecture
- Frontend: GitHub Pages static UI (`/docs/index.html`)
- Backend: Cloudflare Worker API (`/worker/src/index.js`)
- AI: OpenAI Responses API using Worker secret `OPENAI_API_KEY`

Text diagram:

```text
Browser (GitHub Pages /docs)
  -> POST /api/brief
Cloudflare Worker
  -> gathers markets/weather/scripture/calendar context
  -> calls OpenAI Responses API
  -> returns normalized brief JSON
Browser
  -> updates all UI cards with safe DOM helpers
```

## Setup And Deployment
### 1. GitHub Pages
1. Open repository Settings -> Pages.
2. Set Source to:
   - Branch: `main`
   - Folder: `/docs`
3. Save and wait for the Pages build.

### 2. Worker Deployment
1. `cd worker`
2. `npm install`
3. `npx wrangler login`
4. `npx wrangler deploy`

### 3. Secrets
`OPENAI_API_KEY` must be set in Cloudflare Worker secrets:

```bash
npx wrangler secret put OPENAI_API_KEY
```

### 4. Frontend API Base
Set the deployed Worker URL in `/docs/integrations.js`:

```js
const API_BASE = "https://<your-worker-subdomain>.workers.dev";
```

## Testing Checklist
Run these checks after deploy:

```bash
curl https://<worker>.workers.dev/health
curl https://<worker>.workers.dev/api/markets
curl "https://<worker>.workers.dev/api/weather?lat=29.7604&lon=-95.3698"
curl https://<worker>.workers.dev/api/scripture
curl -X POST https://<worker>.workers.dev/api/brief \
  -H "Content-Type: application/json" \
  -d '{"lat":29.7604,"lon":-95.3698,"focus":"defense","tone":"strategic"}'
```

## Monetization Plan
### Free Tier
- 1 brief/day
- Limited export and history features
- Basic refresh cadence

### Pro Tier ($7-$15/month)
- Unlimited briefs
- Save/export templates and presets
- Higher rate limits and richer brief formatting

### Commander Tier ($29/month)
- Team workspaces
- Shared brief templates
- Custom feed integrations and priority processing

## Stripe Integration (Next Milestone)
- Use Stripe Checkout for subscriptions
- Use Stripe Customer Portal for billing management
- Store plan entitlement and enforce quota in Worker before OpenAI calls

## Privacy, Logging, And Abuse Controls
- Never expose API keys in client-side code
- Keep logs minimal: endpoint, status, latency, and coarse usage counters
- Avoid storing raw sensitive prompt content
- Add rate limiting by IP/session/API token
- Add daily caps for `/api/brief` by plan tier

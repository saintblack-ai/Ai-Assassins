# AI Assassins Daily Brief

## What The App Does
- Generates structured daily intelligence briefs via OpenAI.
- Serves the UI from GitHub Pages.
- Serves the API from a Cloudflare Worker.

The brief includes:
- Overnight Overview
- Markets Snapshot (S&P 500, NASDAQ, WTI, BTC)
- Weather
- Next Up Calendar
- Scripture of the Day
- Mission Priorities
- Black Phoenix Truthwave
- Top Tasks
- Command Note

## Technical Architecture
- Frontend: static app on GitHub Pages (`main` branch root).
- Backend: Cloudflare Worker (`/worker`) exposing `/api/*`.
- AI: OpenAI API called from Worker using secret `OPENAI_API_KEY`.

Data flow:
1. Browser loads `index.html` from Pages.
2. `integrations.js` calls Worker endpoints (`/api/overview`, `/api/markets`, `/api/weather`, `/api/scripture`, `/api/brief`).
3. Worker fetches public market/weather/RSS sources and calls OpenAI for structured brief generation.
4. UI cards update with safe DOM helpers and graceful fallbacks.

## Setup & Deployment
### 1) GitHub Pages
1. Go to repository Settings -> Pages.
2. Set source to:
   - Branch: `main`
   - Folder: `/(root)`
3. Save and wait for build.

### 2) Cloudflare Worker
1. Open terminal:
   - `cd worker`
2. Authenticate:
   - `wrangler login`
3. Deploy:
   - `wrangler deploy`

### 3) Set Secrets
- Required:
  - `wrangler secret put OPENAI_API_KEY`
- Optional:
  - `wrangler secret put BRIEF_BEARER_TOKEN` (protects `/api/brief`)

### 4) Verify Endpoints
- `GET /api/overview`
- `GET /api/markets`
- `GET /api/weather?lat=29.7604&lon=-95.3698`
- `GET /api/scripture`
- `POST /api/brief`

## Monetization Strategy
### Free Tier
- 1 brief per day
- Basic refresh cadence
- Limited history and export options

### Pro Tier
- Suggested price: **$7/month**
- Unlimited briefs
- Faster refresh and richer brief templates
- Premium integrations and team features

### Usage Limits
- Per-user or per-key rate limits on `/api/brief`
- Daily generation quotas by plan
- Burst control to cap abuse/cost spikes

### Stripe Integration Notes
- Use Stripe Checkout + Customer Portal for subscriptions
- Store plan entitlement in a lightweight user store
- Enforce plan limits at Worker layer before OpenAI calls

### Logging / Analytics Suggestions
- Track request count, status code, latency, and endpoint
- Track generation success/failure rates and token usage buckets
- Avoid storing sensitive prompt content in logs
- Add dashboarding/alerts for cost, error spikes, and rate-limit triggers

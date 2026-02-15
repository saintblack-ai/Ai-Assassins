# AI Assassins Daily Brief - App Guide

## What The App Does
AI Assassins Daily Brief provides a daily command-style briefing with:
- Overnight Overview
- Markets Snapshot (S&P 500, NASDAQ, WTI, BTC)
- Local Weather (from saved lat/lon)
- Next Up Calendar (from ICS URL)
- Scripture of the Day
- Mission Priorities
- Black Phoenix Truthwave
- Top 5 Tasks
- Command Note

## Architecture
- Frontend: static web app served by GitHub Pages from repository root (`main` + `/`).
- Backend: Cloudflare Worker in `worker/` exposing `/api/*` endpoints.
- AI: Worker calls OpenAI using `OPENAI_API_KEY` secret for `POST /api/brief`.

## Setup
1. GitHub Pages
- Repo Settings -> Pages
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`

2. Worker deploy
- `cd worker`
- `wrangler login`
- `wrangler secret put OPENAI_API_KEY`
- Optional: `wrangler secret put BRIEF_BEARER_TOKEN`
- `wrangler deploy`

3. Frontend endpoint
- Root `integrations.js` is configured to:
- `https://ai-assassins-api.quandrix357.workers.dev`
- If your worker URL changes, update `API_BASE` in `integrations.js`.

## Monetization Strategy
### Free tier
- 1 generated brief per day
- Basic live data refresh
- Local-only brief history

### Pro tier
- Unlimited brief generation
- Premium brief templates by mission profile
- Faster refresh cadence and exports
- Team workspace sharing

Suggested pricing:
- Monthly: $9 to $19
- Annual: $79 to $149

## Abuse Protection / Security
- Restrict CORS to your Pages origin.
- Optional bearer token gate for `POST /api/brief` via `BRIEF_BEARER_TOKEN`.
- Add rate-limiting in front of Worker (Cloudflare Rules / API Shield / Turnstile flow).
- Keep OpenAI key only in Worker secrets.

## Privacy Notes
- No sensitive user profile storage is required.
- Local app settings and saved briefs stay in browser localStorage.
- Worker logs should avoid storing prompt bodies in full.
- Store only operational metrics (status, latency, endpoint).

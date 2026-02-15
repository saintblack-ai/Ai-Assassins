# AI Assassins Daily Brief

## What The App Does
AI Assassins generates a daily intelligence brief using OpenAI and displays it in the web UI. The brief includes operational sections like overnight overview, markets, weather, scripture, priorities, truthwave, tasks, and command note.

## Architecture
- GitHub Pages UI (static frontend from repo)
- Cloudflare Worker API (`/worker`)
- OpenAI backend call from Worker (`POST /api/brief`)

## Setup Steps
1. Pages deploy
- GitHub repo Settings -> Pages
- Source: `main` branch, folder `/(root)`

2. Worker deploy
- `cd worker`
- `wrangler login`
- `wrangler deploy`

3. Set OpenAI secret
- `wrangler secret put OPENAI_API_KEY`

4. Test endpoints
- `GET /api/overview`
- `GET /api/markets`
- `GET /api/weather?lat=29.7604&lon=-95.3698`
- `GET /api/scripture`
- `POST /api/brief`

## Monetization Ideas
- Free tier: 1 brief/day
- Pro tier: $7/month for unlimited briefs
- Add per-user API usage limits to protect cost
- Integrate Stripe subscriptions for paid access

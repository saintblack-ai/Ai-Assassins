# AI Assassins App

## What The App Does
AI Assassins Daily Brief is a web app that generates and displays a daily intelligence-style briefing with:
- Overnight headline overview
- Market snapshot (SP500, NASDAQ, WTI, BTC)
- Local weather summary
- Next-up calendar items
- Scripture and reflection
- Mission priorities, truthwave, top tasks, and command note

## Architecture
- Frontend: GitHub Pages static app served from `docs/`
- API: Cloudflare Worker (`worker/`) exposing `/api/*` endpoints
- AI generation: OpenAI API called from Worker endpoint `POST /api/brief`

Flow:
1. Browser loads `docs/index.html`
2. `docs/integrations.js` calls Worker endpoints for live data
3. Clicking **Generate Brief** calls `POST /api/brief`
4. Worker returns structured JSON, UI cards update in place

## Setup Steps
### 1) GitHub Pages
1. GitHub repository settings -> Pages
2. Set source to:
   - Branch: `main`
   - Folder: `/docs`
3. Save and wait for build

### 2) Cloudflare Worker Deploy
1. Install Wrangler CLI
2. From repo root:
   - `cd worker`
   - `wrangler login`
   - `wrangler deploy`
3. Set secret:
   - `wrangler secret put OPENAI_API_KEY`
4. Copy deployed URL, then edit `docs/integrations.js`:
   - `const API_BASE = "https://ai-assassins-api.<SUBDOMAIN>.workers.dev";`
   - Replace `<SUBDOMAIN>` with your actual Worker subdomain

### 3) Verify Endpoints
- `GET /api/overview`
- `GET /api/markets`
- `GET /api/weather?lat=29.7604&lon=-95.3698`
- `GET /api/scripture`
- `POST /api/brief`

## Pricing + Monetization Plan
### Free Tier
- 1 generated brief/day
- Delayed or partial live data refresh
- Basic saved briefs in local browser storage

### Pro Tier (subscription)
- Unlimited brief generation
- Faster refresh cadence
- Premium briefing modes (deeper analysis, custom templates)
- Team/shared briefing exports

Suggested pricing:
- Monthly: $9 to $19
- Annual: $79 to $149

## Rate Limiting And Abuse Protection
Implement at Worker layer:
- IP-based rate limit (per minute + per day)
- Request size limits for `/api/brief`
- Optional signed token or API key for non-public access
- Cache static upstream calls (`/api/overview`, `/api/markets`, `/api/weather`) for short TTL

## Privacy Notes
- No sensitive personal data should be stored in Worker by default
- Browser settings/saved briefs remain in localStorage on user device
- Worker logs should avoid full user prompt storage where possible
- Keep only operational telemetry: timestamp, endpoint, status code, latency

## PWA / App Store Packaging Notes
- App is installable as PWA from mobile and desktop browsers
- Ensure `manifest.webmanifest`, icons, and `sw.js` are present under `docs/`
- For App Store distribution, use a web wrapper approach (if desired):
  - iOS wrapper (e.g., Capacitor)
  - Android wrapper (e.g., Trusted Web Activity or Capacitor)
- Keep app shell fully HTTPS and ensure offline strategy in `sw.js`

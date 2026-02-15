# AI Assassins Launch Guide

## Architecture Overview
- Frontend: static dashboard served by GitHub Pages from `/docs`
- Backend API: Cloudflare Worker in `/worker`
- AI generation: OpenAI Responses API (server-side only)
- Persistence: D1 (if bound as `BRIEFS_DB`), with in-memory fallback for dev
- Billing: Stripe endpoints `/subscribe` and `/status`

## Deploy Checklist
1. Push `main` branch updates to GitHub.
2. In GitHub Pages settings, set source to `main` + `/docs`.
3. Deploy Worker:
   ```bash
   cd worker
   npm install
   npx wrangler deploy
   ```
4. Confirm frontend points to Worker URL:
   - `https://ai-assassins-api.quandrix357.workers.dev`

## Required Secrets / Vars
Set secrets in Cloudflare Worker:
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put AUTH_PASSWORD
npx wrangler secret put AUTH_BEARER_TOKEN
```

Set environment variables in `wrangler.toml` or dashboard:
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `AUTH_EMAIL` (optional)
- `REQUIRE_AUTH` (`true` or `false`)

## Optional Database Binding (D1)
Bind D1 as `BRIEFS_DB` in `wrangler.toml` or Cloudflare dashboard.

Expected tables are auto-created:
- `briefs(id, timestamp, json)`
- `subscriptions(customer_id, status, updated_at, json)`

## Run Worker Locally
```bash
cd worker
npm install
npx wrangler dev
```

## Run UI Locally
Option 1 (simple):
```bash
cd docs
python3 -m http.server 8080
```
Then open `http://localhost:8080`.

## Monetization Plan
- Free tier:
  - Basic brief generation
  - Limited history visibility
- Pro tier:
  - Full brief history
  - PDF export
  - Priority refresh and premium workflow features
- Billing implementation:
  - `POST /subscribe` creates customer + subscription
  - `GET /status` reads subscription status and controls premium UI

## Post-Launch Validation
1. Open GitHub Pages site and generate brief.
2. Verify weather + markets fields populate.
3. Verify brief ID returned and `Past Briefs` list updates.
4. Verify loading and toasts appear.
5. Verify Worker endpoints:
   - `/health`
   - `/briefs`
   - `/brief?id=<id>`
   - `/status?customer_id=<id>`

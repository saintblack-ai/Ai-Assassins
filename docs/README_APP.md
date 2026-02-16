# AI Assassins App (Pages + Worker + Native Wrapper)

## What this app does
AI Assassins generates a structured daily intelligence brief with these sections:
- Overnight overview
- Markets snapshot (SP500, NASDAQ, WTI, BTC)
- Weather summary (lat/lon)
- Next-up calendar (ICS input)
- Scripture of the day
- Mission priorities
- Truthwave narrative/risk/counter
- Top tasks
- Command note

## Architecture
- Web UI: GitHub Pages from `/docs`
- API: Cloudflare Worker (`/worker`)
- AI generation: OpenAI Responses API (server-side only)
- Auth: Supabase session token from client -> Worker `Authorization` header
- Billing: RevenueCat (native) + optional Stripe endpoints in Worker
- Persistence: D1 (`BRIEFS_DB`) or KV (`BRIEFS_KV`) with in-memory fallback for dev

## Setup
1. GitHub Pages
- Repo Settings -> Pages
- Source: `main` / `/docs`

2. Worker deployment
```bash
cd worker
npm install
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
npx wrangler deploy
```

3. Runtime config in UI
- `window.AIA_SUPABASE_URL`
- `window.AIA_SUPABASE_ANON_KEY`
- Worker URL in `docs/integrations.js` (`API_BASE`)

4. Native wrapper (Capacitor)
```bash
cd mobile
npm install
npm run ios:add
npm run android:add
npm run sync
```

## Pricing + monetization plan
- Free tier: 1 brief/day, no premium exports
- Pro tier: unlimited briefs, history + export features
- Suggested pricing: $7-$15/month
- Commander tier (team): $29/month (shared presets/feeds)

## Rate limiting and abuse protection
- `REQUIRE_AUTH=true` in Worker
- Free quota via `FREE_BRIEFS_PER_DAY`
- Enforce per-user usage in Worker persistence layer
- Add WAF/Turnstile for abuse-heavy paths

## Privacy notes
- No client-side API keys in repository
- OpenAI key only in Worker secrets
- Log minimally (status/latency/error class)
- Do not store sensitive personal data in brief payloads

## Packaging notes (App Store / Play)
- iOS: archive in Xcode -> upload via Organizer/TestFlight
- Android: generate `.aab` -> internal testing in Play Console
- In-app subscriptions managed with RevenueCat entitlements

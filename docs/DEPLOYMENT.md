# AI Assassins Deployment Guide

This runbook deploys the web app from GitHub Pages and the API from Cloudflare Workers.

## 1) Set frontend API base
Published frontend files must call the deployed Worker domain:

- `/Users/quandrixblackburn/projects/Ai-Assassins/docs/integrations.js`
- `/Users/quandrixblackburn/projects/Ai-Assassins/docs/pricing.js`

Use:

```js
const API_BASE = "https://ai-assassins-api.quandrix357.workers.dev";
```

## 2) Deploy Cloudflare Worker

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler deploy
```

Expected output includes:

- `Deployed ai-assassins-api triggers`
- `https://ai-assassins-api.quandrix357.workers.dev`

## 3) Required Wrangler secrets
Set secrets once per environment:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put RESEND_API_KEY
```

Notes:

- `OPENAI_API_KEY` is required for `/api/brief`.
- `STRIPE_SECRET_KEY` is required for `/api/checkout`.
- If Stripe keys are missing, checkout returns a friendly `Stripe not configured` error.
- If `REVENUECAT_WEBHOOK_SECRET` is missing, webhook validation is skipped by design.

## 4) Required Wrangler vars (non-secret)
In `worker/wrangler.toml` and/or Cloudflare dashboard env vars:

- `ALLOWED_ORIGINS=https://saintblack-ai.github.io`
- `OPENAI_MODEL=gpt-4.1-mini`
- `STRIPE_PRICE_PRO=<price_id>`
- `STRIPE_PRICE_ELITE=<price_id>`
- `ENTERPRISE_DAILY_LIMIT=<optional integer>`
- `WORKER_VERSION=<optional display version>`
- `FROM_EMAIL=<sender for Resend>`
- `BRIEF_TIMEZONE=<IANA timezone, e.g. America/Chicago>`
- `BRIEF_SEND_HHMM=<local send time HHMM, default 0700>`
- `DAILY_ALERT_TO=<email recipient for the daily Archaios notifier>`

## 5) KV namespaces and bindings
Required bindings in `worker/wrangler.toml`:

- `USER_STATE`
- `USAGE_STATE`
- `REVENUE_LOG`
- `LEADS`
- `DAILY_BRIEF_LOG`
- `COMMAND_LOG`

Create missing namespaces:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler kv namespace create USER_STATE
npx wrangler kv namespace create USAGE_STATE
npx wrangler kv namespace create REVENUE_LOG
npx wrangler kv namespace create LEADS
npx wrangler kv namespace create DAILY_BRIEF_LOG
npx wrangler kv namespace create COMMAND_LOG
```

## 6) Cron schedules
Current schedule:

- `0 * * * *` (hourly tick)
- Worker sends once/day when local `BRIEF_SEND_HHMM` matches in `BRIEF_TIMEZONE` (default 07:00 local)

## 7) GitHub Pages deployment
GitHub Pages should publish:

- Branch: `main`
- Folder: `/docs`

After pushing to `main`, verify site:

- `https://saintblack-ai.github.io/Ai-Assassins/`

## 8) Stripe webhook setup
Configure webhook destination in Stripe dashboard:

- Endpoint URL: `https://ai-assassins-api.quandrix357.workers.dev/api/webhook`
- Events: checkout/session completed + subscription lifecycle events

## 9) Command intelligence endpoint checks

```bash
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/command-brief
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/command-history
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/metrics
```

## 10) Daily notifier endpoint (`/api/brief/send-now`)

Requires `ADMIN_TOKEN`:

```bash
curl -i -X POST "https://ai-assassins-api.quandrix357.workers.dev/api/brief/send-now" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Expected:
- HTTP `200`
- JSON with `brief_key`, `command_brief`, and `email_sent`
- A `daily_brief_sent` event written to `REVENUE_LOG`

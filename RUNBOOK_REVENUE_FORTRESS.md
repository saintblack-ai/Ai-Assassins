# AI Assassins Revenue Fortress Runbook

## Current architecture map
```text
Client (PWA / iOS / Android)
        |
        v
GitHub Pages UI (/docs)
        |
        v
Cloudflare Worker API (workers.dev)
https://ai-assassins-api.quandrix357.workers.dev
        |
        v
KV Namespaces (USER_STATE, USAGE_STATE, REVENUE_LOG, LEADS, DAILY_BRIEF_LOG, COMMAND_LOG)
        |
        v
OpenAI + Stripe + external data APIs
```

## Active API base URL
- `https://ai-assassins-api.quandrix357.workers.dev`

## Two blockers and fixes

### Blocker 1: Git push rejected for workflow file updates
Observed error:
- push rejected because workflow file update requires PAT with `workflow` scope.

Fix:
- create a new GitHub classic PAT with scopes:
  - public repo: `public_repo` + `workflow`
  - private repo: `repo` + `workflow`
- use PAT at push prompt (never commit/store in source files).

### Blocker 2: Worker route binding on placeholder domain
Observed issue:
- custom route placeholder can break deploy when no valid zone is configured.

Fix:
- keep `workers_dev = true` in `worker/wrangler.toml`
- keep custom `route` disabled until real DNS zone is configured.

## Fix GitHub push auth
1. Create PAT (classic):
   - Name suggestion: `AI-Assassins Deploy (repo+workflow) - MacBookAir`
   - Scopes:
     - `public_repo` (or `repo` for private)
     - `workflow`
2. Push normally:
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
git push origin main
```
3. At password prompt, paste the PAT (not your GitHub account password).

## How to deploy

### 1) GitHub Pages (UI)
- Source: `main` branch, `/docs` folder.
- Push to `main` and verify:
  - `https://saintblack-ai.github.io/Ai-Assassins/`

### 2) Cloudflare Worker (API)
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler deploy
```
Expected trigger:
- `https://ai-assassins-api.quandrix357.workers.dev`

### 3) Mobile wrapper (Capacitor)
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
npm run mobile:release:prep
```
Then open native projects in Xcode/Android Studio for signed builds.

## Cloudflare route stabilization (now + later)

### Temporary stable mode (now)
- `workers_dev = true`
- no required custom route

### Custom domain later (optional)
When DNS is ready:
1. set `workers_dev = false`
2. add route and zone config
3. deploy again

Placeholder:
```toml
# workers_dev = false
# route = "https://api.your-real-domain.com/*"
# zone_id = "YOUR_ZONE_ID"
```

## Security checklist (lock down infra)
- [ ] No secrets committed to repo.
- [ ] All runtime secrets stored via Wrangler:
  - `OPENAI_API_KEY`
  - `STRIPE_SECRET_KEY`
  - `REVENUECAT_WEBHOOK_SECRET`
- [ ] CORS restricted to approved origin(s).
- [ ] Rate limiting enabled in Worker middleware.
- [ ] Revenue + usage logging enabled (KV).
- [ ] `.gitignore` includes `.env`/key material.
- [ ] Run secrets scan before push:
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
git grep -nE "OPENAI_API_KEY|STRIPE_SECRET_KEY|REVENUECAT_WEBHOOK_SECRET|ghp_[A-Za-z0-9]{20,}" || true
```

## Secret rotation
Rotate credentials without committing them:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
```

After rotation:
1. Deploy Worker.
2. Run `/api/status`, `/api/products`, and checkout smoke checks.

## Change cron schedule
Edit `/Users/quandrixblackburn/projects/Ai-Assassins/worker/wrangler.toml`:

```toml
[triggers]
crons = ["0 7 * * *"]
```

Then redeploy:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler deploy
```

## Read KV logs
Use Cloudflare dashboard KV viewer or Wrangler:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler kv key list --binding DAILY_BRIEF_LOG --prefix brief:
npx wrangler kv key list --binding REVENUE_LOG --prefix revenue_log:
npx wrangler kv key list --binding LEADS --prefix lead:
```

## Smoke tests

### API checks
```bash
# /api/status
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/status

# /api/brief/latest
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/brief/latest

# /api/me
curl -i https://ai-assassins-api.quandrix357.workers.dev/api/me

# /api/lead
curl -i -X POST https://ai-assassins-api.quandrix357.workers.dev/api/lead \
  -H "content-type: application/json" \
  -d '{"name":"Ops User","email":"ops@example.com","org":"ACME","message":"Enterprise pilot request"}'

# /api/checkout
curl -i -X POST https://ai-assassins-api.quandrix357.workers.dev/api/checkout \
  -H "content-type: application/json" \
  -d '{"plan":"pro","deviceId":"runbook-test","successUrl":"https://saintblack-ai.github.io/Ai-Assassins/success.html","cancelUrl":"https://saintblack-ai.github.io/Ai-Assassins/pricing.html?canceled=1"}'
```

### UI checks
1. Open `https://saintblack-ai.github.io/Ai-Assassins/`.
2. Click **Generate Brief** and verify cards populate.
3. Open **Pricing** and test Pro/Elite buttons.
4. Submit Enterprise **Contact Sales** form.
5. Send webhook event to `/api/webhook` and confirm tier update via `/api/me`.

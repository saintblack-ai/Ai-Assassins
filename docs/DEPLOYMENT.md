# AI Assassins Deployment Guide

## 1) GitHub auth fix for workflow pushes

### Option A: Personal Access Token (HTTPS)
Create a PAT with scopes:
- `repo`
- `workflow`

Then set remote and push:
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
git remote set-url origin https://<GITHUB_USERNAME>:<PAT_WITH_REPO_WORKFLOW>@github.com/saintblack-ai/Ai-Assassins.git
git push origin main
```

### Option B: SSH (recommended long-term)
```bash
ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub
```
Add the public key in GitHub -> Settings -> SSH and GPG keys.
Then:
```bash
git remote set-url origin git@github.com:saintblack-ai/Ai-Assassins.git
git push origin main
```

## 2) Cloudflare Worker deployment
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler deploy
```

Required secrets:
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
```

Required env vars (wrangler vars or dashboard):
- `ALLOWED_ORIGINS=https://saintblack-ai.github.io`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ELITE`
- `ENTERPRISE_DAILY_LIMIT` (optional)

## 3) KV namespace creation
```bash
npx wrangler kv namespace create USER_STATE
npx wrangler kv namespace create USAGE_STATE
npx wrangler kv namespace create REVENUE_LOG
npx wrangler kv namespace create LEADS
```
Update IDs in `wrangler.toml`.

## 4) GitHub Pages deployment
Use branch `main`, folder `/docs`.
If Actions-based Pages workflow is enabled, pushing `main` auto-deploys.

## 5) Mobile wrapper build
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
npm run mobile:release:prep
```

## 6) App Store + Play submission
1. Build signed iOS archive in Xcode -> upload to TestFlight.
2. Build Android AAB -> upload to Play Internal Test.
3. Attach legal/policy URLs in store metadata.
4. Verify billing, lead capture, and tier enforcement before production rollout.

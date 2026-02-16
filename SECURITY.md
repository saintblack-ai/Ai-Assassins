# Security Policy

## Supported surfaces
- Web/PWA frontend in `/docs`
- Cloudflare Worker API in `/worker`
- Mobile wrapper in `/mobile`

## Reporting a vulnerability
Please report security issues privately to:

- `security@aiassassins.app` (placeholder)

Include:
- Affected endpoint/file
- Reproduction steps
- Impact assessment
- Any suggested mitigation

Do not post unpatched vulnerabilities publicly.

## Secret handling policy
- Never commit API keys, tokens, webhook secrets, or `.env` files.
- Use Cloudflare Wrangler secrets for runtime credentials:
  - `OPENAI_API_KEY`
  - `STRIPE_SECRET_KEY`
  - `REVENUECAT_WEBHOOK_SECRET`
- Keep GitHub tokens out of remotes and source files.

## Baseline controls
- CORS restricted to allowed origin(s)
- Rate limiting in Worker middleware
- Security headers on API responses
- Revenue and usage audit events persisted to KV

## Pre-push security checks
Run before pushing:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
git status
git diff --name-only
git grep -nE "OPENAI_API_KEY|STRIPE_SECRET_KEY|REVENUECAT_WEBHOOK_SECRET|ghp_[A-Za-z0-9]{20,}" || true
```

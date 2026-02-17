# Changelog

## Phase 2 – Daily Brief UI Settings
- Added `docs/archaios-briefing.html` and `docs/archaios-briefing.js`
- Added admin UI controls for:
  - timezone
  - send time (HH:MM)
  - recipient email
  - run-now test button
- Added dashboard link to Archaios settings page

## BRIEF_LOG KV bound
- Added `BRIEF_LOG` KV binding to `worker/wrangler.toml`
- Bound ID:
  - `be5f592bf9cc4c56aed50479e67f20e0`
- Added cron trigger:
  - `0 * * * *`

## Admin Token & email configuration
- Added admin-only routes:
  - `GET /api/brief/config`
  - `POST /api/brief/config`
  - `GET /api/brief/test`
- Added per-user config storage in `USER_STATE`:
  - key format: `briefcfg:<userId>`
- Scheduled handler now reads saved config and attempts Resend email delivery.
- Email send gracefully skips when `RESEND_API_KEY`, `FROM_EMAIL`, or `BRIEF_EMAIL_TO` is missing.

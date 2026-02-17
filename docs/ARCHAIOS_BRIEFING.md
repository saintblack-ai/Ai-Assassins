# Archaios Daily Briefing (Phase 2)

This guide configures the admin-controlled Archaios briefing workflow:

- Save per-user briefing config in `USER_STATE` KV
- Run a manual test brief from UI/API (`/api/brief/test`)
- Run hourly cron and send brief email when send-time matches

## Architecture

- UI settings page: `docs/archaios-briefing.html`
- API routes (Worker):
  - `GET /api/brief/config?userId=...` (admin-only)
  - `POST /api/brief/config` (admin-only)
  - `GET /api/brief/test?userId=...` (admin-only)
- Scheduler:
  - `wrangler.toml` cron: `0 * * * *`
  - checks `BRIEF_SEND_HHMM` against current time in `BRIEF_TIMEZONE`
  - writes brief to `BRIEF_LOG` KV (fallback `REVENUE_LOG`)
  - sends email via Resend when configured

## Required KV bindings

`worker/wrangler.toml` must include:

- `USER_STATE`
- `BRIEF_LOG`

Current `BRIEF_LOG` ID:

- `be5f592bf9cc4c56aed50479e67f20e0`

## Required secrets

Set these in Worker environment:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put RESEND_API_KEY
```

## Optional vars

In `worker/wrangler.toml` or dashboard vars:

- `BRIEF_TIMEZONE` (default: `America/Chicago`)
- `BRIEF_SEND_HHMM` (default: `0700`)
- `BRIEF_EMAIL_TO` (default empty)
- `FROM_EMAIL` (required for email send)

## UI setup flow

1. Open: `https://saintblack-ai.github.io/Ai-Assassins/archaios-briefing.html`
2. Paste `ADMIN_TOKEN`
3. Set:
   - `User ID` (example: `colonel`)
   - Timezone
   - Send time
   - Recipient email
4. Click **Save Settings**
5. Click **Run Archaios Brief Now** to test generation

## API payloads

### Save config
`POST /api/brief/config`

```json
{
  "userId": "colonel",
  "BRIEF_TIMEZONE": "America/Chicago",
  "BRIEF_SEND_HHMM": "0700",
  "BRIEF_EMAIL_TO": "ops@example.com"
}
```

### Load config
`GET /api/brief/config?userId=colonel`

### Test run
`GET /api/brief/test?userId=colonel`

All admin routes require:

`Authorization: Bearer <ADMIN_TOKEN>`

## Deploy

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler deploy
```

Then push pages updates:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
git push origin main
```

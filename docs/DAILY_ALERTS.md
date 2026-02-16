# Archaios Daily Alerts

This document configures the daily Archaios command notifier.

## What it does

At the configured local send time (default `07:00`):

1. Generates or loads today's command brief
2. Stores it in `COMMAND_LOG` with key `command:YYYY-MM-DD`
3. Emails a summary to `DAILY_ALERT_TO`
4. Logs a notification event to `REVENUE_LOG` with type `daily_brief_sent`

## Required env vars

Set these via Cloudflare Worker vars/secrets:

- `BRIEF_TIMEZONE` (example: `America/Chicago`)
- `BRIEF_SEND_HHMM` (example: `0700`)
- `DAILY_ALERT_TO` (recipient email)
- `FROM_EMAIL` (sender email, verified in Resend)
- `RESEND_API_KEY` (secret)
- `ADMIN_TOKEN` (secret, required for manual trigger endpoint)

## Cron model

`wrangler.toml` uses:

- `crons = ["0 * * * *"]`

The Worker checks local time (`BRIEF_TIMEZONE`) each hourly tick and only sends when current time equals `BRIEF_SEND_HHMM`.

## Manual trigger

Run on demand:

```bash
curl -i -X POST "https://ai-assassins-api.quandrix357.workers.dev/api/brief/send-now" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Success response includes:

- `brief_key`
- `command_brief`
- `email_sent`
- `email_to`

## Troubleshooting

- If `email_sent` is `false`, check `RESEND_API_KEY`, `FROM_EMAIL`, and `DAILY_ALERT_TO`.
- If no daily send occurs, verify `BRIEF_TIMEZONE` and `BRIEF_SEND_HHMM`.
- Check Worker logs:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler tail
```

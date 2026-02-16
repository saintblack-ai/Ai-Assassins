# Dashboard Overview: Command Intelligence Layer

The command intelligence layer adds a lightweight strategic operations plane on top of existing AI-Assassins billing and briefing APIs.

## What it provides

- **Daily Command Brief**
  - One structured strategic summary per day.
  - Stored in `COMMAND_LOG` using key format: `command:YYYY-MM-DD`.

- **History Retrieval**
  - Last 14 command briefs for trend and execution review.

- **Analytics Snapshot**
  - Total usage from `USAGE_STATE`
  - Revenue event count from `REVENUE_LOG`
  - Enterprise lead count from `LEADS`
  - Tier distribution from `USER_STATE`

## How it runs

- On-demand via API:
  - `GET /api/command-brief`
  - `GET /api/command-history`
  - `GET /api/metrics`

- Scheduled automation:
  - Cron at `08:00 UTC`
  - Generates/stores today's command brief in `COMMAND_LOG`
  - Logs generation event in `REVENUE_LOG` as `system_brief_generated`

## Design constraints

- KV-only persistence (no external DB)
- Existing billing/auth flows unchanged
- Existing brief routes remain intact
- CORS, rate limiting, and response hardening inherited globally

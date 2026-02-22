#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

supabase db push

cd worker

echo "Set Worker secrets (interactive prompts):"
wrangler secret put OPENAI_API_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put DAILY_ALERT_TO
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET

wrangler deploy

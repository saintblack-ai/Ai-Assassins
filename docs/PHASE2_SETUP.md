# Phase 2 Auth + History Setup

## 1) Supabase tables
Run:

`/Users/quandrixblackburn/projects/Ai-Assassins/docs/SUPABASE_SCHEMA.sql`

in the Supabase SQL editor.

## 2) Worker configuration
Set in `worker/wrangler.toml`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Set as worker secret:
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

## 3) Frontend configuration
In UI Settings tab:
- Set Supabase URL
- Set Supabase anon key
- Save config

Then login from the dialog.

## 4) Behavior
- No login: device fallback identity (`device:<id>`) and free tier.
- Logged in: verified Supabase user token used as identity.
- Brief history is stored/retrieved/deleted from Supabase `briefs` table.
- Limits:
  - Free: 1/day
  - Premium/Pro: 10/day
  - Enterprise/Elite: unlimited


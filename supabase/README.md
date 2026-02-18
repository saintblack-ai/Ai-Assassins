# Supabase Setup (Phase A)

1. Create a Supabase project.
2. Open SQL Editor and run:
   - `/Users/quandrixblackburn/projects/Ai-Assassins/supabase/migrations/001_init.sql`
3. In Supabase Project Settings:
   - copy project URL
   - copy anon key (public)
   - copy service role key (secret, worker only)

## Worker config

- Set in `worker/wrangler.toml` `[vars]`:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Set as Wrangler secret:
  - `SUPABASE_SERVICE_ROLE_KEY`

## Notes

- Device fallback users are stored as `device:<id>` and are not queryable via Supabase history endpoints.
- Past Briefs API requires authenticated Supabase user.

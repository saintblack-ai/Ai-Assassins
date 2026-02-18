# AI-Assassins

Production repo for AI Assassins web UI (`/docs`), Cloudflare Worker backend (`/worker`), and local ARCHAIOS tooling.

## Local install (Python tooling)
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev,watch]'
```

## ARCHAIOS utility CLI scripts
Installed console commands:
- `archaios_init`
- `archaios_capture`
- `archaios_dashboard`

Wrapper scripts:
- `/Users/quandrixblackburn/projects/Ai-Assassins/scripts/archaios_init`
- `/Users/quandrixblackburn/projects/Ai-Assassins/scripts/archaios_capture`
- `/Users/quandrixblackburn/projects/Ai-Assassins/scripts/archaios_dashboard`

## Quick run
```bash
archaios_init
archaios_capture --title "Test Capture" --project_code "DEMO" --tier Research --tags "demo,archaios" --content "Initial capture text"
archaios_dashboard
```

## Supabase + Worker setup (Phase A)

1. Create a Supabase project.
2. Run migration (SQL Editor or CLI):
   - `/Users/quandrixblackburn/projects/Ai-Assassins/supabase/migrations/001_init.sql`
   - CLI path:
     ```bash
     make supabase:init
     supabase link --project-ref <project-ref>
     make supabase:migrate
     ```
3. Configure frontend public values in:
   - `/Users/quandrixblackburn/projects/Ai-Assassins/docs/config.js`
   - Set `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY`
4. Configure worker env:
   - `worker/wrangler.toml` `[vars]`:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
5. Set worker secrets:
   - `OPENAI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Example docs/config.js
```js
window.SUPABASE_URL = "https://your-project-id.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Copy from template:
```bash
cp /Users/quandrixblackburn/projects/Ai-Assassins/docs/config.js.example /Users/quandrixblackburn/projects/Ai-Assassins/docs/config.js
```

## Worker deploy
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```

Or from repo root:
```bash
npm run supabase:secrets
make worker:deploy
```

`/api/brief` supports:
- authenticated Supabase user mode (JWT bearer token)
- device fallback mode (`X-Device-Id` and `deviceId` in JSON body)

## GitHub Pages frontend deploy
```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins
git add docs worker supabase README.md
git commit -m "feat: phase a supabase auth + history + subscription activation"
git push origin main
```

## Acceptance checks
- Supabase configured:
  - login/signup works
  - generate brief works
  - brief is saved
  - past briefs load in History tab
- Supabase not configured:
  - warning shown
  - Generate Brief still works in device mode
- Invalid JWT:
  - request falls back to `device:<id>` if device id present

## Tests
```bash
pytest -q tests/test_versioning.py tests/test_worker_fallback_identity.py
```

## SITREP Integration
```bash
cp .env.example .env
# set SITREP_INGEST_SECRET (and optional SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
npm install
npm run sitrep:dev
```

- Dashboard: `http://localhost:8788/sitrep`
- Docs: `/Users/quandrixblackburn/projects/Ai-Assassins/docs/SITREP_INTEGRATION.md`

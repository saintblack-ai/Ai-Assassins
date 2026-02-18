# SITREP Integration

This module adds a signed telemetry ingest API and an insights API for ARCHAIOS/AI Assassins.

## Endpoints

- `POST /api/sitrep/ingest`
- `GET /api/sitrep/insights`
- `GET /healthz`

## Event schema

```json
{
  "source": "sitrep",
  "type": "agent_run|agent_error|deploy|metric|heartbeat",
  "app": "archaios|ai-assassins",
  "severity": "info|warn|error",
  "message": "string",
  "tags": {"any":"json"},
  "meta": {"any":"json"},
  "ts": "ISO timestamp"
}
```

## Signature requirements

Headers:

- `X-SITREP-TIMESTAMP`: unix epoch seconds
- `X-SITREP-SIGNATURE`: hex HMAC SHA256

Algorithm:

- `signature = HMAC_SHA256(secret, "${timestamp}.${rawBody}")`
- rejects if timestamp skew is greater than 300 seconds

## Storage mode

- If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, events are written to Supabase `sitrep_events`.
- Otherwise events are written to local SQLite: `./data/sitrep.db`.

## Setup

1. Copy env template:
   - `cp .env.example .env`
2. Set at minimum:
   - `SITREP_INGEST_SECRET`
3. For Supabase mode:
   - set `SUPABASE_URL`
   - set `SUPABASE_SERVICE_ROLE_KEY`
   - run `supabase db push`
4. Start service:
   - `npm install`
   - `npm run sitrep:dev`

## Dashboard

- Local page: `http://localhost:8788/sitrep`

## CLI test event

```bash
npm run sitrep:send-test
```

## cURL examples

Unsigned request (should fail):

```bash
curl -i -X POST http://localhost:8788/api/sitrep/ingest \
  -H "content-type: application/json" \
  -d '{"source":"sitrep","type":"heartbeat","app":"ai-assassins","severity":"info","message":"unsigned","tags":{},"meta":{},"ts":"2026-02-18T00:00:00Z"}'
```

Signed request (should succeed):

```bash
SECRET="replace_me"
BODY='{"source":"sitrep","type":"heartbeat","app":"ai-assassins","severity":"info","message":"signed","tags":{"env":"dev"},"meta":{"from":"curl"},"ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
TS="$(date +%s)"
SIG="$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')"

curl -i -X POST http://localhost:8788/api/sitrep/ingest \
  -H "content-type: application/json" \
  -H "X-SITREP-TIMESTAMP: $TS" \
  -H "X-SITREP-SIGNATURE: $SIG" \
  -d "$BODY"
```

# AI Assassins Enterprise Guide

## Overview
Enterprise support in AI Assassins is built around:

- Pricing funnel (`/docs/pricing.html`)
- Lead capture endpoint (`POST /api/lead`)
- Tier state in `USER_STATE` KV
- Usage and revenue audit trails in `USAGE_STATE` and `REVENUE_LOG`

## Enterprise lead workflow
1. User opens pricing page and selects **Contact Sales**.
2. User submits Name, Email, Organization, Message.
3. Frontend posts payload to `POST /api/lead`.
4. Worker validates fields and stores lead in `LEADS` KV.
5. Worker logs event to `REVENUE_LOG`.
6. UI shows success confirmation.

## Lead payload shape
```json
{
  "name": "Full Name",
  "email": "work@email.com",
  "org": "Organization",
  "message": "Deployment goals, compliance, timeline"
}
```

## Onboarding an Enterprise user
Use the user identifier from your auth system (Supabase/Clerk JWT `sub`) and set tier in `USER_STATE`.

### Option A: via webhook automation
- Send Stripe/RevenueCat webhook event to:
  - `POST /api/webhook`
- Include user id in event metadata (`userId` or client reference id).
- Worker maps the event to `enterprise` tier and stores it.

### Option B: manual KV update (admin)
Set KV key:

- `user:<userId>:tier = enterprise`

Example command pattern (replace values):

```bash
npx wrangler kv:key put --namespace-id <USER_STATE_ID> "user:<userId>:tier" "enterprise"
```

## Upgrading Free/Pro to Enterprise
1. Confirm user identity (`userId`) from authenticated session.
2. Create/update subscription record through billing workflow.
3. Trigger webhook to `POST /api/webhook` with enterprise entitlement or metadata.
4. Verify tier via `GET /api/me`.
5. Confirm user can generate unlimited briefs (or custom enterprise limit).

## Downgrade / cancellation handling
1. Billing system sends cancellation/expiration webhook.
2. Worker maps event tier to `free` (or configured fallback tier).
3. `GET /api/me` reflects updated tier immediately.

## Operational checks
- Verify `LEADS` writes for each submitted enterprise form.
- Verify `REVENUE_LOG` entries include event outcome.
- Verify origin/rate-limit blocks abuse traffic.
- Verify support team receives lead notification workflow (email/CRM integration, if configured).

## Recommended enterprise SOP
1. Daily review: new leads in `LEADS` namespace.
2. Weekly review: revenue events + failed checkout/webhook entries.
3. Monthly review: enterprise account usage and SLA commitments.

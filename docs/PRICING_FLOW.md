# Pricing Flow

## Overview
1. User opens `/docs/dashboard.html`.
2. User clicks **Upgrade to Pro** or **Upgrade to Elite**.
3. Frontend calls `POST /api/checkout-session`.
4. Worker creates Stripe checkout session and returns redirect URL.
5. User completes payment in Stripe Checkout.
6. Stripe sends webhook to `POST /api/webhook`.
7. Worker updates `USER_STATE` tier.
8. Dashboard refreshes tier via `GET /api/me`.

## Tier Limits
- Free: 5 briefs/day
- Pro: 50 briefs/day
- Elite: unlimited
- Enterprise: unlimited (custom features path)

## Limit Enforcement Path
- Endpoint: `POST /api/brief`
- Reads tier from `USER_STATE`
- Reads usage from `USAGE_STATE`
- Blocks when over limit with:
```json
{ "success": false, "error": "limit reached" }
```
- Increments usage on success.

# Stripe Setup

## Required secrets
Set in Worker environment:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PUBLIC_KEY
```

## Required vars
In `worker/wrangler.toml` or dashboard vars:
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ELITE`
- `STRIPE_PRICE_ID_ENTERPRISE`

Fallback vars are supported:
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ELITE`
- `STRIPE_PRICE_ENTERPRISE`

## Webhook configuration
Stripe Dashboard:
- Endpoint URL: `https://ai-assassins-api.quandrix357.workers.dev/api/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `invoice.payment_succeeded`

## Verification
1. Start checkout from dashboard.
2. Complete payment.
3. Confirm `USER_STATE` tier key updates:
   - `user:<userId>:tier`
4. Confirm revenue events exist in `REVENUE_LOG`.

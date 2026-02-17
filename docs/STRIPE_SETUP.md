# Stripe Setup

## Required secrets
Set in Worker environment:

```bash
cd /Users/quandrixblackburn/projects/Ai-Assassins/worker
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## Required vars
In `worker/wrangler.toml` or dashboard vars:
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ELITE`

Fallback vars are supported:
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ELITE`

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

# Revenue API

Base URL:
- `https://ai-assassins-api.quandrix357.workers.dev`

## `POST /api/checkout`
Creates a Stripe checkout session.

Request:
```json
{
  "tier": "pro",
  "deviceId": "device-123",
  "success_url": "https://saintblack-ai.github.io/Ai-Assassins/dashboard.html?checkout=success",
  "cancel_url": "https://saintblack-ai.github.io/Ai-Assassins/dashboard.html?checkout=cancel"
}
```

Response:
```json
{
  "success": true,
  "id": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

Notes:
- `/api/checkout-session` is supported as a compatibility alias.
- Valid tiers: `pro`, `elite`, `enterprise`.

## `GET /api/products`
Returns available Stripe-backed plans.

Response:
```json
{
  "products": [
    { "id": "pro", "tier": "pro", "price_id": "price_...", "monthly_price_usd": 4.99 },
    { "id": "elite", "tier": "elite", "price_id": "price_...", "monthly_price_usd": 14.99 }
  ]
}
```

## `POST /api/webhook`
Handles webhook events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `invoice.payment_succeeded`

Updates user tier in `USER_STATE` based on Stripe metadata/price ID mapping.

## `GET /api/status`
Returns operational API status and schedule.

## `GET /api/brief/latest`
Returns latest generated Revenue Fortress daily brief.

## `GET /api/revenue-summary`
Aggregates `REVENUE_LOG` for dashboard analytics.

Response:
```json
{
  "total_revenue": 0,
  "total_subscriptions": 0,
  "daily_revenue": {},
  "tier_breakdown": { "free": 0, "pro": 0, "elite": 0, "enterprise": 0 }
}
```

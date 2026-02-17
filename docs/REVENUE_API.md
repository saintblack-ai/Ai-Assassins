# Revenue API

Base URL:
- `https://ai-assassins-api.quandrix357.workers.dev`

## `POST /api/checkout-session`
Creates a Stripe checkout session.

Request:
```json
{
  "plan": "pro",
  "deviceId": "device-123",
  "successUrl": "https://saintblack-ai.github.io/Ai-Assassins/dashboard.html?checkout=success",
  "cancelUrl": "https://saintblack-ai.github.io/Ai-Assassins/dashboard.html?checkout=cancel"
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

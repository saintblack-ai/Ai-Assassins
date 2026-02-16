# Billing Test Matrix

## Checkout (Web/PWA)
- `pricing.html` loads and `Start Pro`/`Start Elite` buttons are clickable.
- If Stripe env vars are unset, checkout shows friendly notice and app remains usable on Free tier.
- If Stripe is configured, user is redirected to hosted checkout URL.
- Cancel path returns to `pricing.html?canceled=1` and shows cancel notice.
- Success path returns to `success.html`.

## Subscription Sync
- `GET /api/checkout/status?session_id=...` returns status and tier.
- `GET /api/user/status` reflects updated tier after successful checkout.
- Tier sync works by `user_id` or `deviceId` (`client_reference_id`).

## Enforcement
- Free tier at quota receives limit response on `POST /api/brief`.
- Pro tier bypasses free quota.
- `GET /api/briefs` requires auth when `REQUIRE_AUTH=true`.

## Data Deletion
- `DELETE /api/user/data` removes user profile, usage counters, and brief ownership mapping.
- After deletion, status returns free/default and history is empty.

# AI Assassins Smoke Test

## 1. Core app load
1. Open `https://saintblack-ai.github.io/Ai-Assassins/`.
2. Confirm dashboard renders with no console errors.
3. Confirm footer links open:
   - `TERMS_OF_SERVICE.md`
   - `PRIVACY_POLICY.md`

## 2. Auth + brief generation
1. Login with configured auth provider.
2. Click **Generate Brief**.
3. Verify cards populate (overview, markets, weather, scripture, tasks).

## 3. Billing and pricing
1. Open `pricing.html`.
2. Click **Start Pro** / **Start Elite**.
3. If Stripe vars are missing, verify graceful notice appears (no crash).
4. If Stripe configured, verify redirect to Stripe Checkout.
5. Confirm `success.html` and cancel flow (`pricing.html?canceled=1`) work.

## 4. Enterprise lead flow
1. On pricing page click **Contact Sales**.
2. Submit Name, Email, Org, Message.
3. Verify success notice and Worker returns `{ success: true }`.

## 5. Rate limiting
1. Send >10 requests in 60s from same IP to Worker.
2. Verify `429` response with blocked payload.

## 6. Tier enforcement
1. Free user generates 5 briefs/day; 6th should be blocked.
2. Pro user generates up to 50/day.
3. Elite user should not hit daily limit.
4. Enterprise follows configured `ENTERPRISE_DAILY_LIMIT` if set; otherwise unlimited.

## 7. iOS PWA install check
1. Open site in Safari on iPhone.
2. Share -> Add to Home Screen.
3. Launch installed app.
4. Verify latest UI loads, login works, and brief generation functions.

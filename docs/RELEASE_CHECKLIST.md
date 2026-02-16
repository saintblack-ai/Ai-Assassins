# AI Assassins Release Checklist

## Accounts and Store Setup
1. Enroll in Apple Developer Program.
2. Enroll in Google Play Console.
3. Create app records with bundle/package IDs matching Capacitor config.

## Billing Setup
1. Create Stripe products/prices for Pro and Elite tiers.
2. Set Worker secrets/vars:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_ELITE`
3. (Optional) Configure RevenueCat and app store products for native billing.

## Worker Configuration
1. Set OpenAI + auth + quota vars.
2. Deploy Worker.
3. Validate endpoints:
   - `POST /api/checkout`
   - `GET /api/checkout/status`
   - `GET /api/user/status`
   - `POST /api/brief`
   - `GET /api/briefs`
   - `DELETE /api/user/data`

## Web/PWA Configuration
1. Ensure Pages publishes `/docs`.
2. Verify legal links:
   - `/terms.html`
   - `/privacy.html`
3. Verify pricing funnel:
   - `/pricing.html`
   - `/success.html`
   - `/cancel.html`

## Native Build and Submission
1. `cd mobile && npm install && npm run sync`
2. Build Android AAB (`npm run build:android`)
3. Build iOS archive (`npm run ios:open`, then Archive in Xcode)
4. Upload to Play Internal + TestFlight
5. Run billing and subscription QA matrix before production release

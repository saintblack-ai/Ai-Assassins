# AI Assassins Store Deployment Guide

## 1. Developer Program Enrollment

### Apple
1. Enroll in Apple Developer Program ($99/yr).
2. Configure App Store Connect organization, tax, and banking.
3. Create app record with bundle id `com.saintblack.aiassassins`.

### Google
1. Enroll in Google Play Console ($25 one-time).
2. Complete merchant profile and payouts.
3. Create app record using package id from Android project.

## 2. Authentication Provider Setup

Choose one provider and configure before app release:
- Supabase Auth (email/password + optional social)
- Clerk (email/password, OAuth, device sessions)

Configure web app keys in runtime:
- `window.AIA_SUPABASE_URL`
- `window.AIA_SUPABASE_ANON_KEY`

Backend access control in Worker:
- `REQUIRE_AUTH=true`
- `FREE_BRIEFS_PER_DAY=<n>`

## 3. RevenueCat + In-App Purchases

1. Create RevenueCat project.
2. Add iOS app and Android app with matching package/bundle IDs.
3. Connect App Store and Google Play credentials.
4. Create entitlement (e.g. `pro`) and map products.
5. Configure products in:
   - App Store Connect -> In-App Purchases (auto-renewing subscription)
   - Google Play Console -> Monetize -> Subscriptions
6. Set Worker secret:
   - `REVENUECAT_WEBHOOK_SECRET`
7. Configure RevenueCat webhook to:
   - `POST https://ai-assassins-api.quandrix357.workers.dev/revenuecat/webhook`

## 4. Backend Deployment

```bash
cd worker
npm install
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
npx wrangler deploy
```

Required production endpoints:
- `POST /api/brief`
- `GET /api/user/status`
- `GET /api/briefs`
- `DELETE /api/user/data`

Optional durable storage:
- Bind D1 as `BRIEFS_DB`
- Bind KV as `BRIEFS_KV` fallback

## 5. Build Native Binaries

```bash
cd mobile
npm install
npm run ios:add
npm run android:add
npm run sync
```

### Android AAB
```bash
npm run build:android
```
Output:
- `mobile/android/app/build/outputs/bundle/release/app-release.aab`

### iOS IPA
1. Open Xcode: `npm run ios:open`
2. Set signing + team.
3. Archive (Product -> Archive).
4. Export/upload via Organizer or Transporter.

## 6. CI Builds (GitHub Actions)
- Workflow file: `.github/workflows/mobile-build.yml`
- Triggers on push and manual dispatch.
- Produces artifacts:
  - Android `.aab`
  - iOS `.xcarchive`

## 7. Submission Steps

### Apple
1. Upload archive to App Store Connect.
2. Fill metadata, screenshots, privacy policy URL.
3. Set subscription review notes and test account.
4. Submit for review.

### Google
1. Upload `.aab` to internal testing.
2. Complete Data Safety form + app content declarations.
3. Attach screenshots and feature graphic.
4. Promote to production when ready.

## 8. Handling Rejections

Common rejection causes:
- Missing account deletion path
- Subscription terms unclear in app UI
- Incomplete privacy disclosures
- Non-working purchase restore flow

Resolution checklist:
1. Reproduce issue from reviewer notes.
2. Patch and increment build number.
3. Add reviewer instructions and demo credentials.
4. Resubmit with changelog.

## 9. Internal Testing

- iOS: TestFlight internal group first, then external group.
- Android: Internal track first, then closed/open testing.
- Validate entitlements with sandbox/test users.
- Validate user data deletion flow via `DELETE /api/user/data`.

# Device and E2E Testing Guide

## 1. Web/PWA smoke test
1. Open `https://saintblack-ai.github.io/Ai-Assassins/`.
2. Sign in using configured auth provider.
3. Click **Generate Brief** and confirm all cards populate.
4. Confirm free-tier quota behavior after limit is reached.
5. Confirm legal links open:
   - `TERMS_OF_SERVICE.md`
   - `PRIVACY_POLICY.md`

## 2. API endpoint checks
Use bearer token from your auth session:

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  https://ai-assassins-api.quandrix357.workers.dev/api/user/status

curl -H "Authorization: Bearer <TOKEN>" \
  https://ai-assassins-api.quandrix357.workers.dev/api/briefs

curl -X POST https://ai-assassins-api.quandrix357.workers.dev/api/brief \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"lat":29.7604,"lon":-95.3698,"focus":"geopolitics","tone":"strategic"}'

curl -X DELETE -H "Authorization: Bearer <TOKEN>" \
  https://ai-assassins-api.quandrix357.workers.dev/api/user/data
```

## 3. iOS device testing (TestFlight)
1. Build archive in Xcode and upload to TestFlight.
2. Install on at least one iPhone and one iPad.
3. Validate login, generation, subscription, restore purchases.
4. Validate delete-account/data request flow (`DELETE /api/user/data`).
5. Capture crash/performance logs from Xcode Organizer.

## 4. Android testing (Play internal)
1. Upload `.aab` to Play Console internal testing track.
2. Invite internal testers and install via Play link.
3. Validate auth, quota, subscription unlock, and billing state sync.
4. Validate update path from older build to new build.

## 5. Optional browser automation
Recommended stack: Playwright.

```bash
npm init -y
npm i -D @playwright/test
npx playwright install
npx playwright test
```

Suggested scenarios:
- Login required before generate
- Generate brief success path
- Quota reached path for free tier
- Premium tier unlock path (mocked entitlement)

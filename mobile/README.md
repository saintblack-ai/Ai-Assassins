# AI Assassins Native Wrapper (Capacitor)

This directory wraps the existing PWA in `../docs` for native iOS and Android delivery.

## App identity
- App name: `AI Assassins`
- Bundle/package id: `com.saintblack.aiassassins`
- Web assets source: `../docs`

## Prerequisites
- Node.js 20+
- Xcode (latest stable) + Apple Developer account
- Android Studio + Android SDK/NDK
- Java 17

## Setup
```bash
cd mobile
npm install
npm run ios:add
npm run android:add
npm run sync
```

## Open native projects
```bash
# iOS project in Xcode
npm run ios:open

# Android project in Android Studio
npm run android:open
```

## iOS: signing, archive, and TestFlight upload
1. Open `ios/App/App.xcworkspace` in Xcode.
2. Select `App` target -> `Signing & Capabilities`.
3. Set Team, Bundle Identifier (`com.saintblack.aiassassins`), and automatic signing (or manual profiles).
4. Ensure deployment target and device family align with release strategy.
5. Product -> Archive.
6. In Organizer:
   - Validate App
   - Distribute App -> App Store Connect -> Upload
7. In App Store Connect:
   - Assign build to TestFlight
   - Complete compliance and metadata
   - Promote to production when approved

## iOS provisioning profile notes
- Automatic signing: Xcode manages profiles/certs.
- Manual signing: install distribution certificate + provisioning profile matching bundle id.
- CI export (optional) uses `IOS_EXPORT_OPTIONS_PLIST_BASE64` secret in workflow.

## Android: release AAB and Play upload
```bash
cd mobile/android
./gradlew bundleRelease
```

Output:
- `mobile/android/app/build/outputs/bundle/release/app-release.aab`

In Play Console:
1. Create app entry.
2. Upload AAB to Internal testing.
3. Complete Data safety + content declarations.
4. Promote to Closed/Open/Production tracks.

## Deep links and auth flow
- Hostname navigation is configured in `capacitor.config.ts`.
- Auth flow remains web-based (Supabase/Clerk via PWA).
- Ensure redirect URIs include app/web origins used by wrapper.

## Billing strategy
- Web/PWA: Stripe Checkout via Worker endpoints.
- Native apps: use App Store / Play billing (RevenueCat plugin is included for cross-platform entitlement sync).

## Resource placeholders
- See `mobile/resources/README.md` for required iOS/Android icon and splash assets.

## Build from repo root
```bash
cd ..
npm run mobile:release:prep
```
